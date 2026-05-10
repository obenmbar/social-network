package auth

import (
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(u *User) error {
	query := `INSERT INTO users (id, email, password_hash, first_name, last_name, date_of_birth, gender, avatar, nickname, about_me, is_public) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, u.ID, u.Email, u.PasswordHash, u.FirstName, u.LastName, u.DateOfBirth, u.Gender, u.Avatar, u.Nickname, u.AboutMe, u.IsPublic)
	if err != nil {
		return fmt.Errorf("failed to insert user: %w", err)
	}
	return nil
}

func (r *Repository) GetUserByEmail(email string) (*User, error) {
	u := &User{}
	query := `SELECT id, email, password_hash, first_name, last_name, date_of_birth, gender, avatar, nickname, about_me, is_public, created_at FROM users WHERE email = ?`
	err := r.db.QueryRow(query, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.DateOfBirth, &u.Gender, &u.Avatar, &u.Nickname, &u.AboutMe, &u.IsPublic, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return u, nil
}

func (r *Repository) GetUserByID(id string) (*User, error) {
	u := &User{}
	query := `SELECT id, email, password_hash, first_name, last_name, date_of_birth, gender, avatar, nickname, about_me, is_public, created_at FROM users WHERE id = ?`
	err := r.db.QueryRow(query, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.DateOfBirth, &u.Gender, &u.Avatar, &u.Nickname, &u.AboutMe, &u.IsPublic, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return u, nil
}

func (r *Repository) CreateSession(s *Session) error {
	query := `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
	_, err := r.db.Exec(query, s.ID, s.UserID, s.TokenHash, s.ExpiresAt)
	if err != nil {
		return fmt.Errorf("failed to insert session: %w", err)
	}
	return nil
}

func (r *Repository) DeleteSessionByID(id string) error {
	query := `DELETE FROM sessions WHERE id = ?`
	_, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

func (r *Repository) GetSessionByID(id string) (*Session, error) {
	s := &Session{}
	query := `SELECT id, user_id, token_hash, expires_at, created_at FROM sessions WHERE id = ?`
	err := r.db.QueryRow(query, id).Scan(&s.ID, &s.UserID, &s.TokenHash, &s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	return s, nil
}
