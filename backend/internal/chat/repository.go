package chat

import (
	"database/sql"
	"fmt"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) SaveMessage(msg *Message) error {
	query := `INSERT INTO messages (id, sender_id, receiver_id, group_id, content) VALUES (?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, msg.ID, msg.SenderID, msg.ReceiverID, msg.GroupID, msg.Content)
	if err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}
	return nil
}

func (r *Repository) GetPrivateMessages(user1ID, user2ID string) ([]Message, error) {
	query := `
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
		       (u.first_name || ' ' || u.last_name) as sender_name
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE (m.sender_id = ? AND m.receiver_id = ?)
		   OR (m.sender_id = ? AND m.receiver_id = ?)
		ORDER BY m.created_at ASC`

	rows, err := r.db.Query(query, user1ID, user2ID, user2ID, user1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get private messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &msg.CreatedAt, &msg.SenderName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (r *Repository) GetGroupMessages(groupID string) ([]Message, error) {
	query := `
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
		       (u.first_name || ' ' || u.last_name) as sender_name
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.group_id = ?
		ORDER BY m.created_at ASC`

	rows, err := r.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &msg.CreatedAt, &msg.SenderName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (r *Repository) GetUserFullName(userID string) (string, error) {
	var firstName, lastName, email string
	query := `SELECT first_name, last_name, email FROM users WHERE id = ?`
	err := r.db.QueryRow(query, userID).Scan(&firstName, &lastName, &email)
	if err != nil {
		return "", err
	}

	fullName := strings.TrimSpace(firstName + " " + lastName)
	if fullName == "" {
		parts := strings.Split(email, "@")
		return parts[0], nil
	}
	return fullName, nil
}

func (r *Repository) GetUserNickname(userID string) (string, error) {
	var nickname string
	err := r.db.QueryRow(`SELECT nickname FROM users WHERE id = ?`, userID).Scan(&nickname)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("failed to get user nickname: %w", err)
	}
	return nickname, nil
}

func (r *Repository) GetGroupMembers(groupID string) ([]string, error) {
	query := `SELECT user_id FROM group_members WHERE group_id = ?`
	rows, err := r.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("failed to scan group member: %w", err)
		}
		userIDs = append(userIDs, userID)
	}

	return userIDs, nil
}
