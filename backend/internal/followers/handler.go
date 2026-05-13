package followers

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

func (h *Handler) Users(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodGet:
		users, err := h.service.ListUsers(userID)
		if err != nil {
			writeFollowError(w, err)
			return
		}
		json.NewEncoder(w).Encode(users)
	default:
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	profile, err := h.service.GetProfile(userID, r.PathValue("id"))
	if err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(profile)
}

func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	targetID := r.PathValue("id")

	switch r.Method {
	case http.MethodPost:
		response, err := h.service.Follow(userID, targetID)
		if err != nil {
			writeFollowError(w, err)
			return
		}
		json.NewEncoder(w).Encode(response)
	case http.MethodDelete:
		if err := h.service.Unfollow(userID, targetID); err != nil {
			writeFollowError(w, err)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": StatusNone})
	default:
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) Requests(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	requests, err := h.service.ListPendingRequests(userID)
	if err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(requests)
}

func (h *Handler) RespondToRequest(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.service.RespondToRequest(userID, r.PathValue("id"), r.PathValue("status")); err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow request updated"})
}

func (h *Handler) Followers(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	users, err := h.service.ListFollowers(userID, r.URL.Query().Get("user_id"))
	if err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(users)
}

func (h *Handler) Following(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	users, err := h.service.ListFollowing(userID, r.URL.Query().Get("user_id"))
	if err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(users)
}

func (h *Handler) UpdateVisibility(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)
	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPatch {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.service.UpdateVisibility(userID, req.IsPublic); err != nil {
		writeFollowError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]bool{"is_public": req.IsPublic})
}

func userIDFromRequest(r *http.Request) (string, bool) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	return userID, ok && strings.TrimSpace(userID) != ""
}

func writeFollowError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrCannotFollow), errors.Is(err, ErrInvalidStatus):
		writeJSONError(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrUserNotFound), errors.Is(err, ErrRequestNotFound):
		writeJSONError(w, err.Error(), http.StatusNotFound)
	default:
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
	}
}

func writeJSONHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
}

func writeJSONError(w http.ResponseWriter, message string, status int) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
