package groups

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"social-network/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Groups(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListGroups(w, r)
	case http.MethodPost:
		h.CreateGroup(w, r)
	default:
		writeJSONHeader(w)
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) ListGroups(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	groups, err := h.service.ListGroups(userID)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(groups)
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	group, err := h.service.CreateGroup(userID, req)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	detail, err := h.service.GetGroup(userID, r.PathValue("id"))
	if err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(detail)
}

func (h *Handler) InviteUser(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	var req InviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.service.InviteUser(userID, r.PathValue("id"), req); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Invitation sent"})
}

