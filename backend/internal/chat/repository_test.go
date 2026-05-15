package chat

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestCanSendPrivateMessageAllowsEitherFollowDirection(t *testing.T) {
	db := newChatTestDB(t)
	repo := NewRepository(db)

	execChatTestSQL(t, db, `INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)`, "alice", "bob")

	for _, tc := range []struct {
		name     string
		sender   string
		receiver string
		want     bool
	}{
		{name: "sender follows receiver", sender: "alice", receiver: "bob", want: true},
		{name: "receiver follows sender", sender: "bob", receiver: "alice", want: true},
		{name: "no follow relationship", sender: "alice", receiver: "carol", want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := repo.CanSendPrivateMessage(tc.sender, tc.receiver)
			if err != nil {
				t.Fatalf("CanSendPrivateMessage() error = %v", err)
			}
			if got != tc.want {
				t.Fatalf("CanSendPrivateMessage() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCanViewPrivateHistoryAllowsExistingConversationWithoutFollow(t *testing.T) {
	db := newChatTestDB(t)
	repo := NewRepository(db)

	insertChatTestUser(t, db, "alice", "alice@example.com", nil)
	insertChatTestUser(t, db, "bob", "bob@example.com", nil)
	execChatTestSQL(t, db, `
		INSERT INTO messages (id, sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		"message-1", "alice", "bob", "hello", "2026-01-01 00:00:00",
	)

	canSend, err := repo.CanSendPrivateMessage("alice", "bob")
	if err != nil {
		t.Fatalf("CanSendPrivateMessage() error = %v", err)
	}
	if canSend {
		t.Fatal("CanSendPrivateMessage() = true, want false without follow relationship")
	}

	canView, err := repo.CanViewPrivateHistory("alice", "bob")
	if err != nil {
		t.Fatalf("CanViewPrivateHistory() error = %v", err)
	}
	if !canView {
		t.Fatal("CanViewPrivateHistory() = false, want true for existing conversation")
	}
}

func TestListPrivateContactsIncludesPastConversationWithoutFollow(t *testing.T) {
	db := newChatTestDB(t)
	repo := NewRepository(db)

	insertChatTestUser(t, db, "alice", "alice@example.com", nil)
	insertChatTestUser(t, db, "bob", "bob@example.com", ptr("bobby"))
	execChatTestSQL(t, db, `
		INSERT INTO messages (id, sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		"message-1", "alice", "bob", "hello", "2026-01-01 00:00:00",
	)

	contacts, err := repo.ListPrivateContacts("alice")
	if err != nil {
		t.Fatalf("ListPrivateContacts() error = %v", err)
	}
	if len(contacts) != 1 {
		t.Fatalf("len(contacts) = %d, want 1", len(contacts))
	}
	if contacts[0].ID != "bob" {
		t.Fatalf("contact ID = %q, want bob", contacts[0].ID)
	}
	if contacts[0].CanMessage {
		t.Fatal("CanMessage = true, want false without follow relationship")
	}
	if contacts[0].LastActivity == nil {
		t.Fatal("LastActivity = nil, want timestamp")
	}
}

func TestGetUserNicknameAllowsMissingNickname(t *testing.T) {
	db := newChatTestDB(t)
	repo := NewRepository(db)

	execChatTestSQL(t, db, `
		INSERT INTO users (id, email, first_name, last_name, password_hash, date_of_birth, gender, nickname)
		VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
		"alice", "alice@example.com", "Alice", "User", "hash", "2000-01-01", "other",
	)

	nickname, err := repo.GetUserNickname("alice")
	if err != nil {
		t.Fatalf("GetUserNickname() error = %v", err)
	}
	if nickname != "" {
		t.Fatalf("GetUserNickname() = %q, want empty string", nickname)
	}
}

func TestGetPrivateMessagesAllowsSenderWithoutNickname(t *testing.T) {
	db := newChatTestDB(t)
	repo := NewRepository(db)

	insertChatTestUser(t, db, "alice", "alice@example.com", nil)
	insertChatTestUser(t, db, "bob", "bob@example.com", ptr("bobby"))
	execChatTestSQL(t, db, `
		INSERT INTO messages (id, sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		"message-1", "alice", "bob", "hello", "2026-01-01T00:00:00Z",
	)

	messages, err := repo.GetPrivateMessages("alice", "bob", "", 10)
	if err != nil {
		t.Fatalf("GetPrivateMessages() error = %v", err)
	}
	if len(messages) != 1 {
		t.Fatalf("len(messages) = %d, want 1", len(messages))
	}
	if messages[0].SenderNickname != "" {
		t.Fatalf("SenderNickname = %q, want empty string", messages[0].SenderNickname)
	}
	if messages[0].CreatedAt.IsZero() {
		t.Fatalf("CreatedAt is zero, want parsed timestamp")
	}
}

func TestParseMessageTimeSupportsSQLiteTimestampWithOffset(t *testing.T) {
	parsed := parseMessageTime("2026-05-15 17:36:11.446639055+00:00")
	if parsed.IsZero() {
		t.Fatal("parseMessageTime() returned zero time")
	}
}

func newChatTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	execChatTestSQL(t, db, `
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			nickname TEXT DEFAULT NULL UNIQUE,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			date_of_birth TEXT NOT NULL,
			gender TEXT NOT NULL,
			avatar TEXT DEFAULT NULL
		);
		CREATE TABLE followers (
			follower_id TEXT NOT NULL,
			followed_id TEXT NOT NULL,
			PRIMARY KEY (follower_id, followed_id)
		);
		CREATE TABLE messages (
			id TEXT PRIMARY KEY,
			sender_id TEXT NOT NULL,
			receiver_id TEXT,
			group_id TEXT,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)

	return db
}

func insertChatTestUser(t *testing.T, db *sql.DB, id, email string, nickname *string) {
	t.Helper()

	execChatTestSQL(t, db, `
		INSERT INTO users (id, email, first_name, last_name, password_hash, date_of_birth, gender, nickname)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, email, id, "User", "hash", "2000-01-01", "other", nickname,
	)
}

func execChatTestSQL(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()

	if _, err := db.Exec(query, args...); err != nil {
		t.Fatalf("failed to exec test sql: %v", err)
	}
}

func ptr(value string) *string {
	return &value
}
