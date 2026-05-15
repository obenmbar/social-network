package notification

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/gofrs/uuid/v5"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateNotification(n *Notification) error {
	u, err := uuid.NewV4()
	if err != nil {
		return fmt.Errorf("failed to generate uuid: %w", err)
	}
	n.ID = u.String()
	n.CreatedAt = time.Now().UTC()

	query := `INSERT INTO notifications (id, user_id, type, content, source_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err = r.db.Exec(query, n.ID, n.UserID, n.Type, n.Content, n.SourceID, n.IsRead, n.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert notification: %w", err)
	}
	return nil
}

func (r *Repository) GetUserNotifications(userID string) ([]Notification, error) {
	query := `
		SELECT id, user_id, type, content, source_id, is_read, created_at
		FROM notifications
		WHERE user_id = ? AND is_read = FALSE
		ORDER BY created_at DESC`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get notifications: %w", err)
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Content, &n.SourceID, &n.IsRead, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		notifications = append(notifications, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read notifications: %w", err)
	}

	return notifications, nil
}

func (r *Repository) MarkAsRead(notificationID, userID string) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}
	rows, err := res.RowsAffected()
	if err == nil && rows == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}
