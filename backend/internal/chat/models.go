package chat

import "time"

type Message struct {
	ID             string    `json:"id"`
	Type           string    `json:"type,omitempty"` // "chat" or "notification"
	SenderID       string    `json:"sender_id"`
	SourceID       *string   `json:"source_id,omitempty"`
	SenderNickname string    `json:"sender_nickname,omitempty"`
	SenderName     string    `json:"sender_name"`
	SenderAvatar   string    `json:"sender_avatar,omitempty"`
	ReceiverID     *string   `json:"receiver_id,omitempty"`
	GroupID        *string   `json:"group_id,omitempty"`
	Content        string    `json:"content"`
	IsRead         bool      `json:"is_read"`
	CreatedAt      time.Time `json:"created_at"`
}
