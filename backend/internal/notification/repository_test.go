package notification

import (
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestGetUserNotificationsReturnsOnlyUnreadNotifications(t *testing.T) {
	db := newNotificationTestDB(t)
	repo := NewRepository(db)

	readNotification := Notification{
		ID:        "read-notification",
		UserID:    "user-1",
		Type:      "follow",
		Content:   "already read",
		IsRead:    true,
		CreatedAt: time.Now().UTC().Add(-time.Minute),
	}
	unreadNotification := Notification{
		ID:        "unread-notification",
		UserID:    "user-1",
		Type:      "follow",
		Content:   "new notification",
		IsRead:    false,
		CreatedAt: time.Now().UTC(),
	}

	insertNotificationTestRow(t, db, readNotification)
	insertNotificationTestRow(t, db, unreadNotification)

	notifications, err := repo.GetUserNotifications("user-1")
	if err != nil {
		t.Fatalf("GetUserNotifications() error = %v", err)
	}

	if len(notifications) != 1 {
		t.Fatalf("notification count = %d, want 1", len(notifications))
	}
	if notifications[0].ID != unreadNotification.ID {
		t.Fatalf("notification ID = %q, want %q", notifications[0].ID, unreadNotification.ID)
	}
	if notifications[0].IsRead {
		t.Fatal("notification IsRead = true, want false")
	}
}

func TestMarkAsReadRemovesNotificationFromUnreadResults(t *testing.T) {
	db := newNotificationTestDB(t)
	repo := NewRepository(db)

	n := Notification{
		ID:        "notification-1",
		UserID:    "user-1",
		Type:      "follow",
		Content:   "new notification",
		IsRead:    false,
		CreatedAt: time.Now().UTC(),
	}
	insertNotificationTestRow(t, db, n)

	if err := repo.MarkAsRead(n.ID, n.UserID); err != nil {
		t.Fatalf("MarkAsRead() error = %v", err)
	}

	notifications, err := repo.GetUserNotifications(n.UserID)
	if err != nil {
		t.Fatalf("GetUserNotifications() error = %v", err)
	}
	if len(notifications) != 0 {
		t.Fatalf("notification count = %d, want 0", len(notifications))
	}
}

func newNotificationTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	_, err = db.Exec(`
		CREATE TABLE notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			type TEXT NOT NULL,
			content TEXT NOT NULL,
			source_id TEXT,
			is_read BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		t.Fatalf("failed to create notifications table: %v", err)
	}

	return db
}

func insertNotificationTestRow(t *testing.T, db *sql.DB, n Notification) {
	t.Helper()

	_, err := db.Exec(`
		INSERT INTO notifications (id, user_id, type, content, source_id, is_read, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		n.ID, n.UserID, n.Type, n.Content, n.SourceID, n.IsRead, n.CreatedAt,
	)
	if err != nil {
		t.Fatalf("failed to insert notification: %v", err)
	}
}
