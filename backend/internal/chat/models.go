package chat

import "time"

type Message struct {
	ID             string    `json:"id"`
	SenderID       string    `json:"sender_id"`
	SenderNickname string    `json:"sender_nickname,omitempty"`
	SenderName     string    `json:"sender_name"`
	ReceiverID     *string   `json:"receiver_id,omitempty"`
	GroupID        *string   `json:"group_id,omitempty"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}
