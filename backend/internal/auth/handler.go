package auth

import (
	"encoding/json"
	"log"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)

	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Sanitize empty strings to nil to avoid DB constraint issues
	if req.Nickname != nil && *req.Nickname == "" {
		req.Nickname = nil
	}
	if req.AboutMe != nil && *req.AboutMe == "" {
		req.AboutMe = nil
	}
	if req.Avatar != nil && *req.Avatar == "" {
		req.Avatar = nil
	}

	if err := h.service.Register(req); err != nil {
		if err == ErrUserAlreadyExists {
			writeJSONError(w, err.Error(), http.StatusConflict)
			return
		}
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User registered successfully"})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)

	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if cookie, err := r.Cookie(SessionCookieName); err == nil {
		if err := h.service.Logout(cookie.Value); err != nil {
			log.Printf("failed to remove existing session before login: %v", err)
		}
	}

	session, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		if err == ErrInvalidCredentials {
			ClearSessionCookie(w, r)
			writeJSONError(w, err.Error(), http.StatusUnauthorized)
			return
		}
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	SetSessionCookie(w, r, session.Token, session.ExpiresAt)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Login successful"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)

	if r.Method != http.MethodGet {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		ClearSessionCookie(w, r)
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}

	user, err := h.service.GetCurrentUser(cookie.Value)
	if err != nil {
		if err == ErrInvalidSession {
			ClearSessionCookie(w, r)
			writeJSONError(w, "Not logged in", http.StatusUnauthorized)
			return
		}
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	writeJSONHeader(w)

	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		ClearSessionCookie(w, r)
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}

	if err := h.service.Logout(cookie.Value); err != nil {
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ClearSessionCookie(w, r)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}

func writeJSONHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
}

func writeJSONError(w http.ResponseWriter, message string, status int) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
