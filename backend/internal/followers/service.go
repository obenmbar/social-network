package followers

import (
	"database/sql"
	"errors"
	"strings"

	"social-network/internal/chat"
	"social-network/internal/notification"

	"github.com/gofrs/uuid/v5"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrCannotFollow    = errors.New("cannot follow yourself")
	ErrRequestNotFound = errors.New("follow request not found")
	ErrInvalidStatus   = errors.New("invalid status")
	ErrPrivateProfile  = errors.New("private profile")
)

type Service struct {
	repo      *Repository
	notifRepo *notification.Repository
	hub       *chat.Hub
}

func NewService(repo *Repository, notifRepos ...*notification.Repository) *Service {
	var notifRepo *notification.Repository
	if len(notifRepos) > 0 {
		notifRepo = notifRepos[0]
	}
	return &Service{repo: repo, notifRepo: notifRepo}
}

func (s *Service) WithHub(hub *chat.Hub) *Service {
	s.hub = hub
	return s
}

func (s *Service) ListUsers(viewerID string) ([]UserSummary, error) {
	return s.repo.ListUsers(viewerID)
}

func (s *Service) GetProfile(viewerID, profileID string) (*Profile, error) {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return nil, ErrUserNotFound
	}
	profile, err := s.repo.GetUserProfile(viewerID, profileID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, ErrUserNotFound
	}
	return profile, nil
}

func (s *Service) Follow(requesterID, targetID string) (FollowResponse, error) {
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return FollowResponse{}, ErrUserNotFound
	}
	if requesterID == targetID {
		return FollowResponse{}, ErrCannotFollow
	}
	exists, err := s.repo.UserExists(targetID)
	if err != nil {
		return FollowResponse{}, err
	}
	if !exists {
		return FollowResponse{}, ErrUserNotFound
	}
	isFollowing, err := s.repo.IsFollowing(requesterID, targetID)
	if err != nil {
		return FollowResponse{}, err
	}
	if isFollowing {
		return FollowResponse{Status: StatusFollowing}, nil
	}
	isPublic, err := s.repo.UserIsPublic(targetID)
	if err != nil {
		return FollowResponse{}, err
	}
	if isPublic {
		if err := s.repo.Follow(requesterID, targetID); err != nil {
			return FollowResponse{}, err
		}
		s.notifyFollow(targetID, requesterID)
		return FollowResponse{Status: StatusFollowing}, nil
	}

	id, _ := uuid.NewV4()
	requestID := id.String()
	if err := s.repo.CreateFollowRequest(requestID, requesterID, targetID); err != nil {
		return FollowResponse{}, err
	}
	s.notify(&notification.Notification{
		UserID:   targetID,
		SourceID: &requestID,
		Type:     "follow_request",
		Content:  "A user has requested to follow you",
	})
	return FollowResponse{Status: StatusPending}, nil
}

func (s *Service) Unfollow(requesterID, targetID string) error {
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return ErrUserNotFound
	}
	if requesterID == targetID {
		return ErrCannotFollow
	}
	return s.repo.Unfollow(requesterID, targetID)
}

func (s *Service) ListPendingRequests(userID string) ([]FollowRequest, error) {
	return s.repo.ListPendingRequests(userID)
}

func (s *Service) RespondToRequest(userID, requestID, status string) error {
	switch status {
	case RequestAccepted, RequestDeclined:
	default:
		return ErrInvalidStatus
	}
	requesterID, err := s.repo.RespondToRequest(userID, strings.TrimSpace(requestID), status)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrRequestNotFound
		}
		return err
	}
	if status == RequestAccepted {
		name, err := s.repo.DisplayName(userID)
		if err != nil || name == "" {
			name = "A user"
		}
		s.notify(&notification.Notification{
			UserID:   requesterID,
			SourceID: &userID,
			Type:     "follow_accept",
			Content:  name + " accepted your follow request",
		})
	}
	return nil
}

func (s *Service) notifyFollow(targetID, followerID string) {
	name, err := s.repo.DisplayName(followerID)
	if err != nil || name == "" {
		name = "A user"
	}
	s.notify(&notification.Notification{
		UserID:   targetID,
		SourceID: &followerID,
		Type:     "follow",
		Content:  name + " has followed you",
	})
}

func (s *Service) notify(n *notification.Notification) {
	if s.notifRepo != nil {
		_ = s.notifRepo.CreateNotification(n)
	}
	if s.hub != nil {
		s.hub.Broadcast <- &chat.Message{
			Type:       "notification",
			ReceiverID: &n.UserID,
			Content:    n.Content,
		}
	}
}

func (s *Service) ListFollowers(viewerID, userID string) ([]UserSummary, error) {
	targetID, err := s.visibleFollowListTarget(viewerID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListFollowers(viewerID, targetID)
}

func (s *Service) ListFollowing(viewerID, userID string) ([]UserSummary, error) {
	targetID, err := s.visibleFollowListTarget(viewerID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListFollowing(viewerID, targetID)
}

func (s *Service) UpdateVisibility(userID string, isPublic bool) error {
	return s.repo.UpdateVisibility(userID, isPublic)
}

func (s *Service) visibleFollowListTarget(viewerID, userID string) (string, error) {
	targetID := strings.TrimSpace(userID)
	if targetID == "" {
		targetID = viewerID
	}

	exists, canView, err := s.repo.CanViewProfileDetails(viewerID, targetID)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", ErrUserNotFound
	}
	if !canView {
		return "", ErrPrivateProfile
	}
	return targetID, nil
}
