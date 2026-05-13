package followers

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/gofrs/uuid/v5"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrCannotFollow    = errors.New("cannot follow yourself")
	ErrRequestNotFound = errors.New("follow request not found")
	ErrInvalidStatus   = errors.New("invalid status")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
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
		return FollowResponse{Status: StatusFollowing}, s.repo.Follow(requesterID, targetID)
	}

	id, _ := uuid.NewV4()
	if err := s.repo.CreateFollowRequest(id.String(), requesterID, targetID); err != nil {
		return FollowResponse{}, err
	}
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
	if err := s.repo.RespondToRequest(userID, strings.TrimSpace(requestID), status); err != nil {
		if err == sql.ErrNoRows {
			return ErrRequestNotFound
		}
		return err
	}
	return nil
}

func (s *Service) ListFollowers(viewerID, userID string) ([]UserSummary, error) {
	if strings.TrimSpace(userID) == "" {
		userID = viewerID
	}
	return s.repo.ListFollowers(viewerID, userID)
}

func (s *Service) ListFollowing(viewerID, userID string) ([]UserSummary, error) {
	if strings.TrimSpace(userID) == "" {
		userID = viewerID
	}
	return s.repo.ListFollowing(viewerID, userID)
}

func (s *Service) UpdateVisibility(userID string, isPublic bool) error {
	return s.repo.UpdateVisibility(userID, isPublic)
}
