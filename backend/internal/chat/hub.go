package chat

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofrs/uuid/v5"
)

type Hub struct {
	// Map UserID to their active connections
	Clients map[string]map[*Client]bool

	// Inbound messages from clients
	Broadcast chan *Message

	// Register requests from clients
	Register chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Repository to save messages
	Repo *Repository
}

func NewHub(repo *Repository) *Hub {
	return &Hub{
		Broadcast:  make(chan *Message, 256),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[string]map[*Client]bool),
		Repo:       repo,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			if h.Clients[client.UserID] == nil {
				h.Clients[client.UserID] = make(map[*Client]bool)
			}
			h.Clients[client.UserID][client] = true

		case client := <-h.Unregister:
			if connections, ok := h.Clients[client.UserID]; ok {
				if _, ok := connections[client]; ok {
					delete(connections, client)
					close(client.Send)
					if len(connections) == 0 {
						delete(h.Clients, client.UserID)
					}
				}
			}

		case msg := <-h.Broadcast:
			// Default type to "chat" if not specified
			if msg.Type == "" {
				msg.Type = "chat"
			}

			// Only process chat-specific fields and save to DB if it's a chat message
			if msg.Type == "chat" {
				// 1. Fetch Sender Identity
				senderName, senderAvatar, err := h.Repo.GetUserIdentity(msg.SenderID)
				if err != nil {
					log.Printf("failed to fetch sender identity: %v", err)
					senderName = "User"
				}
				msg.SenderName = senderName
				msg.SenderAvatar = senderAvatar

				// 2. Generate ID and Timestamp BEFORE saving
				u, _ := uuid.NewV4()
				msg.ID = u.String()
				msg.CreatedAt = time.Now().UTC()

				// 3. Save to database
				if err := h.Repo.SaveMessage(msg); err != nil {
					log.Printf("🔴 failed to save message to database: %v", err)
					continue
				}
			}

			// 4. Prepare message for broadcasting
			jsonMsg, err := json.Marshal(msg)
			if err != nil {
				log.Printf("failed to marshal message: %v", err)
				continue
			}

			// 4. Route Message
			if msg.GroupID != nil {
				// Group Message Routing
				memberIDs, err := h.Repo.GetGroupMembers(*msg.GroupID)
				if err != nil {
					log.Printf("failed to get group members for routing: %v", err)
					continue
				}

				for _, memberID := range memberIDs {
					if connections, ok := h.Clients[memberID]; ok {
						for client := range connections {
							select {
							case client.Send <- jsonMsg:
							default:
								close(client.Send)
								delete(connections, client)
							}
						}
						if len(connections) == 0 {
							delete(h.Clients, memberID)
						}
					}
				}
			} else if msg.ReceiverID != nil {
				// Private Message Routing
				// Route to Receiver
				if connections, ok := h.Clients[*msg.ReceiverID]; ok {
					for client := range connections {
						select {
						case client.Send <- jsonMsg:
						default:
							close(client.Send)
							delete(connections, client)
						}
					}
					if len(connections) == 0 {
						delete(h.Clients, *msg.ReceiverID)
					}
				}

				// Route back to Sender (for multi-tab sync and confirmation)
				if connections, ok := h.Clients[msg.SenderID]; ok {
					for client := range connections {
						select {
						case client.Send <- jsonMsg:
						default:
							close(client.Send)
							delete(connections, client)
						}
					}
					if len(connections) == 0 {
						delete(h.Clients, msg.SenderID)
					}
				}
			}
		}
	}
}
