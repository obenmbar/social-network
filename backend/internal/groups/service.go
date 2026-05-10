package groups

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/gofrs/uuid/v5"
)

var (
	ErrGroupNotFound = errors.New("group not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrEmptyTitle    = errors.New("title is required")
	ErrEmptyContent  = errors.New("content is required")
	ErrEmptyEvent    = errors.New("event title and day/time are required")
	ErrInvalidStatus = errors.New("invalid status")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateGroup(userID string, req CreateGroupRequest) (*Group, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	if req.Title == "" {
		return nil, ErrEmptyTitle
	}

	id, _ := uuid.NewV4()
	group := &Group{
		ID:          id.String(),
		CreatorID:   userID,
		Title:       req.Title,
		Description: req.Description,
	}
	if err := s.repo.CreateGroup(group, uniqueStrings(req.InviteeIDs)); err != nil {
		return nil, err
	}
	return s.repo.GetGroupByID(userID, group.ID)
}

func (s *Service) ListGroups(userID string) ([]*Group, error) {
	return s.repo.ListGroups(userID)
}

func (s *Service) GetGroup(userID, groupID string) (*GroupDetail, error) {
	group, err := s.repo.GetGroupByID(userID, groupID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, ErrGroupNotFound
	}

	members, err := s.repo.GetMembers(groupID)
	if err != nil {
		return nil, err
	}

	detail := &GroupDetail{Group: group, Members: members}
	if !group.IsMember {
		return detail, nil
	}

	posts, err := s.repo.GetPosts(groupID)
	if err != nil {
		return nil, err
	}
	events, err := s.repo.GetEvents(groupID, userID)
	if err != nil {
		return nil, err
	}
	detail.Posts = posts
	detail.Events = events

	isCreator, err := s.repo.IsCreator(groupID, userID)
	if err != nil {
		return nil, err
	}
	if isCreator {
		requests, err := s.repo.GetPendingRequests(groupID)
		if err != nil {
			return nil, err
		}
		detail.Requests = requests
	}
	return detail, nil
}

func (s *Service) InviteUser(userID, groupID string, req InviteRequest) error {
	req.UserID = strings.TrimSpace(req.UserID)
	if req.UserID == "" {
		return ErrInvalidStatus
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return err
	}
	return s.repo.InviteUser(groupID, userID, req.UserID)
}

func (s *Service) RespondToInvitation(userID, groupID, status string) error {
	switch status {
	case InvitationAccepted, InvitationDeclined:
	default:
		return ErrInvalidStatus
	}
	if err := s.repo.RespondToInvitation(groupID, userID, status); err != nil {
		if err == sql.ErrNoRows {
			return ErrGroupNotFound
		}
		return err
	}
	return nil
}

func (s *Service) RequestToJoin(userID, groupID string) error {
	group, err := s.repo.GetGroupByID(userID, groupID)
	if err != nil {
		return err
	}
	if group == nil {
		return ErrGroupNotFound
	}
	if group.IsMember {
		return nil
	}
	return s.repo.RequestToJoin(groupID, userID)
}
