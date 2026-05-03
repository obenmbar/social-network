package models

import "time"

// User maps directly to the `users` table in SQLite
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	Nickname     string    `json:"nickname,omitempty"`
	About        string    `json:"about,omitempty"`
	IsPrivate    bool      `json:"is_private"`
	CreatedAt    time.Time `json:"created_at"`
}

// RegisterInput represents the payload expected from the registration form
type RegisterInput struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	AvatarURL string `json:"avatar_url,omitempty"`
	Nickname  string `json:"nickname,omitempty"`
	About     string `json:"about,omitempty"`
	IsPrivate bool   `json:"is_private"`
}

// LoginRequest handles input for authentication
type LoginRequest struct {
	Identifier string `json:"identifier"` // Accepts email OR username
	Password   string `json:"password"`
}
