package chat

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"

	"social-network/internal/middleware"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		parsed, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := parsed.Hostname()
		return host == "localhost" || host == "127.0.0.1" || host == "::1"
	},
}

type Handler struct {
	hub  *Hub
	repo *Repository
}

func NewHandler(hub *Hub, repo *Repository) *Handler {
	return &Handler{
		hub:  hub,
		repo: repo,
	}
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Extract userID from context using the shared key
	val := r.Context().Value(middleware.UserIDKey)
	userID, ok := val.(string)
	if !ok || userID == "" {
		log.Printf("🔴 WS Connection attempt failed: Unauthorized. No UserID found in context.")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("🔴 WS Upgrade failed: %v", err)
		return
	}

	nickname, _ := h.repo.GetUserNickname(userID)

	client := &Client{
		Hub:      h.hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   userID,
		Nickname: nickname,
	}

	h.hub.Register <- client

	go client.WritePump()
	client.ReadPump()
}

func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || currentUserID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	otherUserID := r.URL.Query().Get("user_id")
	if otherUserID == "" {
		http.Error(w, "Missing user_id parameter", http.StatusBadRequest)
		return
	}

	// Step 1: Secure the HTTP History Endpoints (Private)
	hasPermission, err := h.repo.CanViewPrivateHistory(currentUserID, otherUserID)
	if err != nil {
		log.Printf("failed to check private chat permission: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if !hasPermission {
		http.Error(w, "Forbidden: Private chat is not allowed", http.StatusForbidden)
		return
	}

	cursor := r.URL.Query().Get("cursor")
	messages, err := h.repo.GetPrivateMessages(currentUserID, otherUserID, cursor, 10)
	if err != nil {
		log.Printf("failed to get private chat history: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func (h *Handler) GetContacts(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || currentUserID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	contacts, err := h.repo.ListPrivateContacts(currentUserID)
	if err != nil {
		log.Printf("failed to get private chat contacts: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contacts)
}

func (h *Handler) GetGroupHistory(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || currentUserID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupID := r.URL.Query().Get("group_id")
	if groupID == "" {
		http.Error(w, "Missing group_id parameter", http.StatusBadRequest)
		return
	}

	// Step 1: Secure the HTTP History Endpoints (Group)
	isMember, err := h.repo.IsGroupMember(currentUserID, groupID)
	if err != nil {
		log.Printf("failed to check group chat membership: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if !isMember {
		http.Error(w, "Forbidden: Not a group member", http.StatusForbidden)
		return
	}

	cursor := r.URL.Query().Get("cursor")
	messages, err := h.repo.GetGroupMessages(groupID, cursor, 10)
	if err != nil {
		log.Printf("failed to get group chat history: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
