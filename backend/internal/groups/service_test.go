package groups

import (
	"database/sql"
	"strings"
	"testing"

	"social-network/internal/notification"

	_ "github.com/mattn/go-sqlite3"
)

func TestInviteUserCreatesGroupInviteNotification(t *testing.T) {
	db := newGroupsTestDB(t)
	repo := NewRepository(db)
	notifRepo := notification.NewRepository(db)
	service := NewService(repo, notifRepo, nil)

	const (
		inviterID = "inviter"
		inviteeID = "invitee"
		groupID   = "group-1"
	)

	insertGroupsTestUser(t, db, inviterID, "inviter@example.com", "Inviter")
	insertGroupsTestUser(t, db, inviteeID, "invitee@example.com", "Invitee")
	execGroupsTestSQL(t, db, `INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)`, inviteeID, inviterID)
	execGroupsTestSQL(t, db, `INSERT INTO groups (id, creator_id, title, description) VALUES (?, ?, ?, ?)`, groupID, inviterID, "Chess Club", "")
	execGroupsTestSQL(t, db, `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`, groupID, inviterID, RoleCreator)

	err := service.InviteUser(inviterID, groupID, InviteRequest{UserID: inviteeID})
	if err != nil {
		t.Fatalf("InviteUser() error = %v", err)
	}

	var invitationCount int
	err = db.QueryRow(`
		SELECT COUNT(*)
		FROM group_invitations
		WHERE group_id = ? AND inviter_id = ? AND invitee_id = ? AND status = ?`,
		groupID, inviterID, inviteeID, InvitationPending,
	).Scan(&invitationCount)
	if err != nil {
		t.Fatalf("failed to count invitations: %v", err)
	}
	if invitationCount != 1 {
		t.Fatalf("pending invitation count = %d, want 1", invitationCount)
	}

	var notifType, content, sourceID string
	err = db.QueryRow(`
		SELECT type, content, source_id
		FROM notifications
		WHERE user_id = ?`,
		inviteeID,
	).Scan(&notifType, &content, &sourceID)
	if err != nil {
		t.Fatalf("failed to load notification: %v", err)
	}
	if notifType != "group_invite" {
		t.Fatalf("notification type = %q, want group_invite", notifType)
	}
	if !strings.Contains(content, "Chess Club") {
		t.Fatalf("notification content = %q, want group title", content)
	}
	if sourceID != groupID {
		t.Fatalf("notification source_id = %q, want %q", sourceID, groupID)
	}
}

func newGroupsTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	schema := `
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			nickname TEXT DEFAULT NULL UNIQUE,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			date_of_birth TEXT NOT NULL,
			gender TEXT NOT NULL,
			avatar TEXT DEFAULT NULL,
			about_me TEXT,
			is_public BOOLEAN DEFAULT TRUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE followers (
			follower_id TEXT NOT NULL,
			followed_id TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (follower_id, followed_id)
		);
		CREATE TABLE groups (
			id TEXT PRIMARY KEY,
			creator_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE group_members (
			group_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'member',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (group_id, user_id)
		);
		CREATE TABLE group_invitations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id TEXT NOT NULL,
			inviter_id TEXT NOT NULL,
			invitee_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (group_id, invitee_id, status)
		);
		CREATE TABLE group_join_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (group_id, user_id, status)
		);
		CREATE TABLE messages (
			id TEXT PRIMARY KEY,
			sender_id TEXT NOT NULL,
			receiver_id TEXT,
			group_id TEXT,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			type TEXT NOT NULL,
			content TEXT NOT NULL,
			is_read BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			source_id TEXT
		);
	`
	execGroupsTestSQL(t, db, schema)

	return db
}

func insertGroupsTestUser(t *testing.T, db *sql.DB, id, email, firstName string) {
	t.Helper()

	execGroupsTestSQL(t, db, `
		INSERT INTO users (id, email, first_name, last_name, password_hash, date_of_birth, gender)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, email, firstName, "User", "hash", "2000-01-01", "other",
	)
}

func execGroupsTestSQL(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()

	if _, err := db.Exec(query, args...); err != nil {
		t.Fatalf("failed to exec test sql: %v", err)
	}
}
