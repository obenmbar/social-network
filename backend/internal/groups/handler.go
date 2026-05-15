package groups

import (
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"strings"

	"social-network/internal/middleware"
)

const maxRequestBodySize = maxImageSize + 1<<20

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

func (h *Handler) RespondToInvitation(w http.ResponseWriter, r *http.Request) {
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
	if err := h.service.RespondToInvitation(userID, r.PathValue("id"), r.PathValue("status")); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Invitation updated"})
}

func (h *Handler) RequestToJoin(w http.ResponseWriter, r *http.Request) {
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
	if err := h.service.RequestToJoin(userID, r.PathValue("id")); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Request sent"})
}

func (h *Handler) RespondToJoinRequest(w http.ResponseWriter, r *http.Request) {
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
	if err := h.service.RespondToJoinRequest(userID, r.PathValue("id"), r.PathValue("userID"), r.PathValue("status")); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Request updated"})
}

func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
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
	req, fileHeader, err := parseCreatePostRequest(w, r)
	if err != nil {
		if isRequestTooLarge(err) {
			writeJSONError(w, ErrImageTooLarge.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	post, err := h.service.CreatePost(userID, r.PathValue("id"), req, fileHeader)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
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
	detail, err := h.service.GetPost(userID, r.PathValue("id"), r.PathValue("postID"))
	if err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(detail)
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
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
	req, fileHeader, err := parseCreateCommentRequest(w, r)
	if err != nil {
		if isRequestTooLarge(err) {
			writeJSONError(w, ErrImageTooLarge.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	comment, err := h.service.CreateComment(userID, r.PathValue("id"), r.PathValue("postID"), req, fileHeader)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
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
	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	event, err := h.service.CreateEvent(userID, r.PathValue("id"), req)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

func (h *Handler) RespondToEvent(w http.ResponseWriter, r *http.Request) {
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
	var req EventResponseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.service.RespondToEvent(userID, r.PathValue("id"), r.PathValue("eventID"), req); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Event response saved"})
}

func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
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
	targetID := r.PathValue("id")
	if err := h.service.FollowUser(userID, targetID); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow request sent"})
}

func (h *Handler) AcceptFollow(w http.ResponseWriter, r *http.Request) {
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
	followerID := r.PathValue("id")
	if err := h.service.AcceptFollowRequest(followerID, userID); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow request accepted"})
}

func (h *Handler) DeclineFollow(w http.ResponseWriter, r *http.Request) {
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
	followerID := r.PathValue("id")
	if err := h.service.DeclineFollowRequest(followerID, userID); err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow request declined"})
}

func (h *Handler) Invitations(w http.ResponseWriter, r *http.Request) {
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
	invitations, err := h.service.GetInvitations(userID)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(invitations)
}

func (h *Handler) Followers(w http.ResponseWriter, r *http.Request) {
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
	followers, err := h.service.GetFollowers(userID)
	if err != nil {
		writeGroupError(w, err)
		return
	}
	json.NewEncoder(w).Encode(followers)
}

func (h *Handler) ServeUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONHeader(w)
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := userIDFromRequest(r)
	if !ok {
		writeJSONHeader(w)
		writeJSONError(w, "Not logged in", http.StatusUnauthorized)
		return
	}

	fullPath, err := h.service.GetVisibleUploadPath(userID, r.URL.Path)
	if err != nil {
		writeJSONHeader(w)
		writeGroupError(w, err)
		return
	}

	http.ServeFile(w, r, fullPath)
}

func userIDFromRequest(r *http.Request) (string, bool) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	return userID, ok && strings.TrimSpace(userID) != ""
}

func writeGroupError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrEmptyTitle), errors.Is(err, ErrEmptyContent), errors.Is(err, ErrEmptyEvent), errors.Is(err, ErrPastEvent), errors.Is(err, ErrInvalidStatus), errors.Is(err, ErrUserRequired), errors.Is(err, ErrNotFollower), errors.Is(err, ErrTextTooLong), errors.Is(err, ErrInvalidImage):
		writeJSONError(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrImageTooLarge):
		writeJSONError(w, err.Error(), http.StatusRequestEntityTooLarge)
	case errors.Is(err, ErrGroupNotFound), errors.Is(err, ErrUserNotFound):
		writeJSONError(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrUnauthorized):
		writeJSONError(w, err.Error(), http.StatusForbidden)
	default:
		writeJSONError(w, "Internal server error", http.StatusInternalServerError)
	}
}

func parseCreatePostRequest(w http.ResponseWriter, r *http.Request) (CreatePostRequest, *multipart.FileHeader, error) {
	var req CreatePostRequest
	var fileHeader *multipart.FileHeader
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(maxImageSize + 1<<20); err != nil {
			return req, nil, err
		}
		req.Content = r.FormValue("content")
		file, header, err := r.FormFile("image")
		if err == nil {
			file.Close()
			fileHeader = header
		}
		return req, fileHeader, nil
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, nil, err
	}
	return req, nil, nil
}

func parseCreateCommentRequest(w http.ResponseWriter, r *http.Request) (CreateCommentRequest, *multipart.FileHeader, error) {
	var req CreateCommentRequest
	var fileHeader *multipart.FileHeader
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(maxImageSize + 1<<20); err != nil {
			return req, nil, err
		}
		req.Content = r.FormValue("content")
		file, header, err := r.FormFile("image")
		if err == nil {
			file.Close()
			fileHeader = header
		}
		return req, fileHeader, nil
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, nil, err
	}
	return req, nil, nil
}

func isRequestTooLarge(err error) bool {
	var maxBytesErr *http.MaxBytesError
	return errors.As(err, &maxBytesErr) || strings.Contains(strings.ToLower(err.Error()), "request body too large")
}

func writeJSONHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
}

func writeJSONError(w http.ResponseWriter, message string, status int) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
