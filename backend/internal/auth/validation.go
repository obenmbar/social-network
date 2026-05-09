package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/gofrs/uuid/v5"
)

const maxAvatarBytes = 2 * 1024 * 1024

var (
	ErrInvalidEmail    = errors.New("email must be valid and start with a letter or digit")
	ErrInvalidPassword = errors.New("password must be 8 to 24 ASCII characters")
	ErrInvalidAvatar   = errors.New("avatar must be a PNG, JPG, JPEG, WEBP, or GIF image under 2MB")
	ErrInvalidText     = errors.New("text fields cannot contain HTML characters")

	emailPattern    = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`)
	avatarDataURLRe = regexp.MustCompile(`^data:image/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$`)
	htmlUnsafeChars = regexp.MustCompile(`[<>]`)
	allowedGenders  = map[string]bool{"male": true, "female": true}
)

func NormalizeRegisterRequest(req *RegisterRequest) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.DateOfBirth = strings.TrimSpace(req.DateOfBirth)
	req.Gender = strings.TrimSpace(req.Gender)
	trimOptional(&req.Nickname)
	trimOptional(&req.AboutMe)
	trimOptional(&req.Avatar)
}

func NormalizeLoginRequest(req *LoginRequest) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
}

func ValidateRegisterRequest(req RegisterRequest) error {
	if !IsValidEmail(req.Email) {
		return ErrInvalidEmail
	}
	if !IsValidPassword(req.Password) {
		return ErrInvalidPassword
	}
	if req.FirstName == "" || req.LastName == "" || req.DateOfBirth == "" || !allowedGenders[req.Gender] {
		return ErrInvalidText
	}
	if !isSafeText(req.FirstName) || !isSafeText(req.LastName) || !isSafeOptionalText(req.Nickname) || !isSafeOptionalText(req.AboutMe) {
		return ErrInvalidText
	}
	if !IsValidAvatar(req.Avatar) {
		return ErrInvalidAvatar
	}
	return nil
}

func ValidateLoginRequest(req LoginRequest) error {
	if !IsValidEmail(req.Email) {
		return ErrInvalidEmail
	}
	if !IsValidPassword(req.Password) {
		return ErrInvalidPassword
	}
	return nil
}

func IsValidEmail(email string) bool {
	return emailPattern.MatchString(email)
}

func IsValidPassword(password string) bool {
	if len(password) < 8 || len(password) > 24 {
		return false
	}
	for _, r := range password {
		if r < 32 || r > 126 {
			return false
		}
	}
	return utf8.ValidString(password)
}

func IsValidSessionToken(token string) bool {
	if strings.TrimSpace(token) != token || token == "" {
		return false
	}
	_, err := uuid.FromString(token)
	return err == nil
}

func HashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func IsValidAvatar(avatar *string) bool {
	if avatar == nil {
		return true
	}

	matches := avatarDataURLRe.FindStringSubmatch(*avatar)
	if len(matches) != 3 {
		return false
	}

	data, err := base64.StdEncoding.DecodeString(matches[2])
	if err != nil {
		return false
	}
	return len(data) <= maxAvatarBytes
}

func trimOptional(value **string) {
	if *value == nil {
		return
	}

	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return
	}
	*value = &trimmed
}

func isSafeText(value string) bool {
	return value != "" && !htmlUnsafeChars.MatchString(value)
}

func isSafeOptionalText(value *string) bool {
	return value == nil || !htmlUnsafeChars.MatchString(*value)
}
