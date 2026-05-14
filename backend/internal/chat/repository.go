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
	query := `INSERT INTO messages (id, sender_id, receiver_id, group_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, msg.ID, msg.SenderID, msg.ReceiverID, msg.GroupID, msg.Content, msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}
	return nil
}

func (r *Repository) GetPrivateMessages(user1ID, user2ID, cursor string, limit int) ([]Message, error) {
	query := `
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
		       u.nickname as sender_nickname,
		       (u.first_name || ' ' || u.last_name) as sender_name,
		       u.avatar as sender_avatar
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`
	
	args := []interface{}{user1ID, user2ID, user2ID, user1ID}

	if cursor != "" {
		query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)`
		args = append(args, cursor)
	}

	query += ` ORDER BY m.created_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get private messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var avatar sql.NullString
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &msg.CreatedAt, &msg.SenderNickname, &msg.SenderName, &avatar)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		if avatar.Valid {
			msg.SenderAvatar = avatar.String
		}
		messages = append(messages, msg)
	}

	// Reverse messages to return them in ascending chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

func (r *Repository) GetGroupMessages(groupID, cursor string, limit int) ([]Message, error) {
	query := `
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, m.created_at,
		       u.nickname as sender_nickname,
		       (u.first_name || ' ' || u.last_name) as sender_name,
		       u.avatar as sender_avatar
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.group_id = ?`

	args := []interface{}{groupID}

	if cursor != "" {
		query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)`
		args = append(args, cursor)
	}

	query += ` ORDER BY m.created_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get group messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var avatar sql.NullString
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &msg.CreatedAt, &msg.SenderNickname, &msg.SenderName, &avatar)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		if avatar.Valid {
			msg.SenderAvatar = avatar.String
		}
		messages = append(messages, msg)
	}

	// Reverse messages to return them in ascending chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

func (r *Repository) GetUserIdentity(userID string) (string, string, error) {
	var firstName, lastName, email string
	var avatar sql.NullString
	query := `SELECT first_name, last_name, email, avatar FROM users WHERE id = ?`
	err := r.db.QueryRow(query, userID).Scan(&firstName, &lastName, &email, &avatar)
	if err != nil {
		return "", "", err
	}

	fullName := strings.TrimSpace(firstName + " " + lastName)
	if fullName == "" {
		parts := strings.Split(email, "@")
		fullName = parts[0]
	}

	avatarStr := ""
	if avatar.Valid {
		avatarStr = avatar.String
	}

	return fullName, avatarStr, nil
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

func (r *Repository) IsGroupMember(userID, groupID string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?)`
	err := r.db.QueryRow(query, userID, groupID).Scan(&exists)
	return exists, err
}

func (r *Repository) IsMutualFollow(user1ID, user2ID string) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) 
		FROM followers 
		WHERE (follower_id = ? AND followed_id = ?) 
		   OR (follower_id = ? AND followed_id = ?)`
	err := r.db.QueryRow(query, user1ID, user2ID, user2ID, user1ID).Scan(&count)
	return count == 2, err
}
