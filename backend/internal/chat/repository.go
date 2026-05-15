package chat

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
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
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, CAST(m.created_at AS TEXT),
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
		var createdAt string
		var nickname sql.NullString
		var avatar sql.NullString
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &createdAt, &nickname, &msg.SenderName, &avatar)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		msg.CreatedAt = parseMessageTime(createdAt)
		if nickname.Valid {
			msg.SenderNickname = nickname.String
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
		SELECT m.id, m.sender_id, m.receiver_id, m.group_id, m.content, CAST(m.created_at AS TEXT),
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
		var createdAt string
		var nickname sql.NullString
		var avatar sql.NullString
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.GroupID, &msg.Content, &createdAt, &nickname, &msg.SenderName, &avatar)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		msg.CreatedAt = parseMessageTime(createdAt)
		if nickname.Valid {
			msg.SenderNickname = nickname.String
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

func (r *Repository) ListPrivateContacts(userID string) ([]PrivateContact, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar,
		       CASE
		         WHEN EXISTS (SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.followed_id = u.id) THEN 'following'
		         WHEN EXISTS (SELECT 1 FROM followers f WHERE f.follower_id = u.id AND f.followed_id = ?) THEN 'follower'
		         ELSE 'none'
		       END AS follow_status,
		       EXISTS (
		         SELECT 1 FROM followers f
		         WHERE (f.follower_id = ? AND f.followed_id = u.id)
		            OR (f.follower_id = u.id AND f.followed_id = ?)
		       ) AS can_message,
		       (
		         SELECT MAX(m.created_at)
		         FROM messages m
		         WHERE (m.sender_id = ? AND m.receiver_id = u.id)
		            OR (m.sender_id = u.id AND m.receiver_id = ?)
		       ) AS last_activity
		FROM users u
		WHERE u.id != ?
		  AND (
		    EXISTS (
		      SELECT 1 FROM followers f
		      WHERE (f.follower_id = ? AND f.followed_id = u.id)
		         OR (f.follower_id = u.id AND f.followed_id = ?)
		    )
		    OR EXISTS (
		      SELECT 1 FROM messages m
		      WHERE (m.sender_id = ? AND m.receiver_id = u.id)
		         OR (m.sender_id = u.id AND m.receiver_id = ?)
		    )
		  )
		ORDER BY last_activity DESC, LOWER(u.first_name), LOWER(u.last_name)`,
		userID, userID, userID, userID, userID, userID, userID, userID, userID, userID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list private contacts: %w", err)
	}
	defer rows.Close()

	contacts := []PrivateContact{}
	for rows.Next() {
		var contact PrivateContact
		var canMessage int
		var nickname sql.NullString
		var avatar sql.NullString
		var lastActivity sql.NullString
		if err := rows.Scan(
			&contact.ID, &contact.FirstName, &contact.LastName, &nickname, &avatar,
			&contact.FollowStatus, &canMessage, &lastActivity,
		); err != nil {
			return nil, fmt.Errorf("failed to scan private contact: %w", err)
		}
		contact.CanMessage = canMessage != 0
		if nickname.Valid {
			contact.Nickname = nickname.String
		}
		if avatar.Valid {
			contact.Avatar = avatar.String
		}
		if lastActivity.Valid {
			parsed := parseMessageTime(lastActivity.String)
			if !parsed.IsZero() {
				contact.LastActivity = &parsed
			}
		}
		contacts = append(contacts, contact)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read private contacts: %w", err)
	}

	return contacts, nil
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
	var nickname sql.NullString
	err := r.db.QueryRow(`SELECT nickname FROM users WHERE id = ?`, userID).Scan(&nickname)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("failed to get user nickname: %w", err)
	}
	if !nickname.Valid {
		return "", nil
	}
	return nickname.String, nil
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

func (r *Repository) HasFollowRelationship(user1ID, user2ID string) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM followers
			WHERE (follower_id = ? AND followed_id = ?)
			   OR (follower_id = ? AND followed_id = ?)
		)`
	err := r.db.QueryRow(query, user1ID, user2ID, user2ID, user1ID).Scan(&exists)
	return exists, err
}

func (r *Repository) CanSendPrivateMessage(senderID, receiverID string) (bool, error) {
	return r.HasFollowRelationship(senderID, receiverID)
}

func (r *Repository) CanViewPrivateHistory(user1ID, user2ID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM messages
			WHERE (sender_id = ? AND receiver_id = ?)
			   OR (sender_id = ? AND receiver_id = ?)
		)`, user1ID, user2ID, user2ID, user1ID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check private chat history: %w", err)
	}
	if exists {
		return true, nil
	}
	return r.HasFollowRelationship(user1ID, user2ID)
}

func parseMessageTime(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}

	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed
		}
	}

	return time.Time{}
}
