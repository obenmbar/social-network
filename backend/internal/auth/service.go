package auth

import (
	"errors"
	"fmt"
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

func (s *Service) Login(email, password string) (*Session, error) {
	user, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	sID, _ := uuid.NewV4()
	sToken, _ := uuid.NewV4()
	session := &Session{
		ID:        sID.String(),
		UserID:    user.ID,
		Token:     sToken.String(),
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	if err := s.repo.CreateSession(session); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Service) Logout(sessionToken string) error {
	return s.repo.DeleteSession(sessionToken)
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
	session, err := s.repo.GetSessionByToken(sessionToken)
	if err != nil {
		return nil, err
	}
	if session == nil || time.Now().After(session.ExpiresAt) {
		return nil, errors.New("session expired or invalid")
	}
	return session, nil
}
