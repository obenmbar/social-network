package chat

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   string
	Nickname string
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("unmarshal error: %v", err)
			continue
		}

		// Ensure msg.SenderID is strictly overridden by the secure session's UserID
		msg.SenderID = c.UserID
		msg.SenderNickname = c.Nickname
		msg.Type = "chat"
		msg.Content = strings.TrimSpace(msg.Content)

		hasGroupTarget := msg.GroupID != nil && strings.TrimSpace(*msg.GroupID) != ""
		hasPrivateTarget := msg.ReceiverID != nil && strings.TrimSpace(*msg.ReceiverID) != ""

		if msg.Content == "" || hasGroupTarget == hasPrivateTarget {
			log.Printf("Security Alert: User %s sent invalid chat payload", c.UserID)
			continue
		}

		// Step 2: Secure the WebSocket Message Broadcasting (Authorization Checks)
		if hasGroupTarget {
			groupID := strings.TrimSpace(*msg.GroupID)
			msg.GroupID = &groupID
			isMember, err := c.Hub.Repo.IsGroupMember(c.UserID, *msg.GroupID)
			if err != nil || !isMember {
				log.Printf("Security Alert: User %s attempted to send unauthorized group message to %s", c.UserID, *msg.GroupID)
				continue // Drop the malicious/unauthorized message
			}
		} else if hasPrivateTarget {
			receiverID := strings.TrimSpace(*msg.ReceiverID)
			msg.ReceiverID = &receiverID
			hasPermission, err := c.Hub.Repo.CanSendPrivateMessage(c.UserID, *msg.ReceiverID)
			if err != nil || !hasPermission {
				log.Printf("Security Alert: User %s attempted to send unauthorized message to %s", c.UserID, *msg.ReceiverID)
				continue // Drop the malicious/unauthorized message
			}
		}

		c.Hub.Broadcast <- &msg
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
