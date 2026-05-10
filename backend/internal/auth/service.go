package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofrs/uuid/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid session")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Register(req RegisterRequest) error {
	NormalizeRegisterRequest(&req)
	if err := ValidateRegisterRequest(req); err != nil {
		return err
	}

	existing, err := s.repo.GetUserByEmail(req.Email)
	if err != nil {
		return err
	}
	if existing != nil {
		return ErrUserAlreadyExists
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	u, _ := uuid.NewV4()
	user := &User{
		ID:           u.String(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		DateOfBirth:  req.DateOfBirth,
		Gender:       req.Gender,
		Avatar:       req.Avatar,
		Nickname:     req.Nickname,
		AboutMe:      req.AboutMe,
		IsPublic:     true,
	}

	return s.repo.CreateUser(user)
}

func (s *Service) Login(email, password string) (string, time.Time, error) {
	req := LoginRequest{Email: email, Password: password}
	NormalizeLoginRequest(&req)
	if err := ValidateLoginRequest(req); err != nil {
		return "", time.Time{}, err
	}

	user, err := s.repo.GetUserByEmail(req.Email)
	if err != nil {
		return "", time.Time{}, err
	}
	if user == nil {
		return "", time.Time{}, ErrInvalidCredentials
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return "", time.Time{}, ErrInvalidCredentials
	}

	sID, _ := uuid.NewV4()
	secret, _ := uuid.NewV4()
	secretStr := secret.String()

	hash, err := bcrypt.GenerateFromPassword([]byte(secretStr), bcrypt.DefaultCost)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to hash session secret: %w", err)
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	session := &Session{
		ID:        sID.String(),
		UserID:    user.ID,
		TokenHash: string(hash),
		ExpiresAt: expiresAt,
	}

	if err := s.repo.CreateSession(session); err != nil {
		return "", time.Time{}, err
	}

	tokenValue := sID.String() + "." + secretStr
	return tokenValue, expiresAt, nil
}

func (s *Service) Logout(sessionToken string) error {
	if sessionToken == "" {
		return nil
	}
	if !IsValidSessionToken(sessionToken) {
		return ErrInvalidSession
	}
	parts := strings.Split(sessionToken, ".")
	return s.repo.DeleteSessionByID(parts[0])
}

func (s *Service) GetCurrentUser(sessionToken string) (*User, error) {
	session, err := s.ValidateSession(sessionToken)
	if err != nil {
		return nil, ErrInvalidSession
	}

	user, err := s.repo.GetUserByID(session.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidSession
	}

	return user, nil
}

func (s *Service) ValidateSession(sessionToken string) (*Session, error) {
	if !IsValidSessionToken(sessionToken) {
		return nil, ErrInvalidSession
	}

	parts := strings.Split(sessionToken, ".")
	sID := parts[0]
	secret := parts[1]

	session, err := s.repo.GetSessionByID(sID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, ErrInvalidSession
	}

	err = bcrypt.CompareHashAndPassword([]byte(session.TokenHash), []byte(secret))
	if err != nil {
		// Invalid secret
		return nil, ErrInvalidSession
	}

	if time.Now().After(session.ExpiresAt) {
		_ = s.repo.DeleteSessionByID(sID)
		return nil, ErrInvalidSession
	}
	return session, nil
}
