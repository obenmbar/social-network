package groups

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"social-network/internal/chat"
	"social-network/internal/notification"

	"github.com/gofrs/uuid/v5"
)

var (
	ErrGroupNotFound = errors.New("group not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrEmptyTitle    = errors.New("title is required")
	ErrEmptyContent  = errors.New("content is required")
	ErrEmptyEvent    = errors.New("event title and day/time are required")
	ErrPastEvent     = errors.New("event time must be in the future")
	ErrInvalidStatus = errors.New("invalid status")
	ErrUserRequired  = errors.New("user is required")
	ErrUserNotFound  = errors.New("user not found")
)

type Service struct {
	repo      *Repository
	notifRepo *notification.Repository
	hub       *chat.Hub
}

func NewService(repo *Repository, notifRepo *notification.Repository, hub *chat.Hub) *Service {
	return &Service{repo: repo, notifRepo: notifRepo, hub: hub}
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
	inviteeIDs, err := s.userIDsByNicknames(req.InviteeNicknames)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateGroup(group, inviteeIDs); err != nil {
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
	nickname := normalizeNickname(req.Nickname)
	if nickname == "" {
		return ErrUserRequired
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return err
	}
	inviteeID, err := s.userIDByNickname(nickname)
	if err != nil {
		return err
	}
	if err := s.repo.InviteUser(groupID, userID, inviteeID); err != nil {
		return err
	}

	// Trigger Notification
	group, _ := s.repo.GetGroupByID(userID, groupID)
	if group != nil {
		content := "You are invited to join group: " + group.Title
		s.notifRepo.CreateNotification(&notification.Notification{
			UserID:  inviteeID,
			Type:    "group_invite",
			Content: content,
		})

		// Real-time broadcast
		s.hub.Broadcast <- &chat.Message{
			Type:       "notification",
			ReceiverID: &inviteeID,
			Content:    content,
		}
	}
	return nil
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
	if err := s.repo.RequestToJoin(groupID, userID); err != nil {
		return err
	}

	// Trigger Notification to Creator
	if group != nil {
		content := "A user has requested to join your group: " + group.Title
		s.notifRepo.CreateNotification(&notification.Notification{
			UserID:  group.CreatorID,
			Type:    "group_request",
			Content: content,
		})

		// Real-time broadcast
		s.hub.Broadcast <- &chat.Message{
			Type:       "notification",
			ReceiverID: &group.CreatorID,
			Content:    content,
		}
	}
	return nil
}

func (s *Service) RespondToJoinRequest(userID, groupID, requesterID, status string) error {
	switch status {
	case RequestAccepted, RequestDeclined:
	default:
		return ErrInvalidStatus
	}
	isCreator, err := s.repo.IsCreator(groupID, userID)
	if err != nil {
		return err
	}
	if !isCreator {
		return ErrUnauthorized
	}
	if err := s.repo.RespondToJoinRequest(groupID, requesterID, status); err != nil {
		if err == sql.ErrNoRows {
			return ErrGroupNotFound
		}
		return err
	}

	// Trigger Notification to Requester
	group, _ := s.repo.GetGroupByID(userID, groupID)
	if group != nil {
		content := "Your request to join group '" + group.Title + "' was " + status
		s.notifRepo.CreateNotification(&notification.Notification{
			UserID:  requesterID,
			Type:    "group_request_response",
			Content: content,
		})

		// Real-time broadcast
		s.hub.Broadcast <- &chat.Message{
			Type:       "notification",
			ReceiverID: &requesterID,
			Content:    content,
		}
	}
	return nil
}

func (s *Service) CreatePost(userID, groupID string, req CreatePostRequest) (*GroupPost, error) {
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return nil, ErrEmptyContent
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return nil, err
	}

	id, _ := uuid.NewV4()
	post := &GroupPost{ID: id.String(), GroupID: groupID, UserID: userID, Content: req.Content}
	if err := s.repo.CreatePost(post); err != nil {
		return nil, err
	}
	return s.repo.GetPostByID(post.ID)
}

func (s *Service) GetPost(userID, groupID, postID string) (*PostDetail, error) {
	if err := s.requireMember(groupID, userID); err != nil {
		return nil, err
	}
	post, err := s.repo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil || post.GroupID != groupID {
		return nil, ErrGroupNotFound
	}
	comments, err := s.repo.GetComments(postID)
	if err != nil {
		return nil, err
	}
	return &PostDetail{Post: post, Comments: comments}, nil
}

func (s *Service) CreateComment(userID, groupID, postID string, req CreateCommentRequest) (*GroupComment, error) {
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return nil, ErrEmptyContent
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return nil, err
	}
	post, err := s.repo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil || post.GroupID != groupID {
		return nil, ErrGroupNotFound
	}

	id, _ := uuid.NewV4()
	comment := &GroupComment{ID: id.String(), PostID: postID, UserID: userID, Content: req.Content}
	if err := s.repo.CreateComment(comment); err != nil {
		return nil, err
	}
	return s.repo.GetCommentByID(comment.ID)
}

func (s *Service) CreateEvent(userID, groupID string, req CreateEventRequest) (*GroupEvent, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	if req.Title == "" || strings.TrimSpace(req.EventTime) == "" {
		return nil, ErrEmptyEvent
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return nil, err
	}
	eventTime, err := time.Parse(time.RFC3339, req.EventTime)
	if err != nil {
		return nil, ErrEmptyEvent
	}
	if !eventTime.After(time.Now()) {
		return nil, ErrPastEvent
	}

	id, _ := uuid.NewV4()
	event := &GroupEvent{ID: id.String(), GroupID: groupID, CreatorID: userID, Title: req.Title, Description: req.Description, EventTime: eventTime}
	if err := s.repo.CreateEvent(event); err != nil {
		return nil, err
	}
	events, err := s.repo.GetEvents(groupID, userID)
	if err != nil {
		return nil, err
	}
	for _, item := range events {
		if item.ID == event.ID {
			return item, nil
		}
	}
	return event, nil
}



func (s *Service) RespondToEvent(userID, groupID, eventID string, req EventResponseRequest) error {
	switch req.Response {
	case "going", "not_going":
	default:
		return ErrInvalidStatus
	}
	if err := s.requireMember(groupID, userID); err != nil {
		return err
	}
	return s.repo.RespondToEvent(eventID, userID, req.Response)
}

func (s *Service) GetInvitations(userID string) ([]*Invitation, error) {
	return s.repo.GetInvitations(userID)
}

func (s *Service) FollowUser(followerID, followedID string) error {
	if followerID == followedID {
		return errors.New("cannot follow yourself")
	}
	if err := s.repo.CreateFollowRequest(followerID, followedID); err != nil {
		return err
	}

	// Trigger Notification
	content := "A user has requested to follow you"
	s.notifRepo.CreateNotification(&notification.Notification{
		UserID:   followedID,
		SourceID: &followerID,
		Type:     "follow_request",
		Content:  content,
	})

	// Real-time broadcast
	s.hub.Broadcast <- &chat.Message{
		Type:       "notification",
		ReceiverID: &followedID,
		Content:    content,
	}

	return nil
}

func (s *Service) AcceptFollowRequest(followerID, followedID string) error {
	if err := s.repo.CreateFollower(followerID, followedID); err != nil {
		return err
	}
	if err := s.repo.DeleteFollowRequest(followerID, followedID); err != nil {
		return err
	}

	// Trigger Notification to the new follower
	content := "Your follow request was accepted"
	s.notifRepo.CreateNotification(&notification.Notification{
		UserID:   followerID,
		SourceID: &followedID,
		Type:     "follow_accept",
		Content:  content,
	})

	// Real-time broadcast
	s.hub.Broadcast <- &chat.Message{
		Type:       "notification",
		ReceiverID: &followerID,
		Content:    content,
	}

	return nil
}

func (s *Service) DeclineFollowRequest(followerID, followedID string) error {
	return s.repo.DeleteFollowRequest(followerID, followedID)
}

func (s *Service) GetFollowers(userID string) ([]Author, error) {
	return s.repo.GetFollowers(userID)
}

func (s *Service) requireMember(groupID, userID string) error {
	group, err := s.repo.GetGroupByID(userID, groupID)
	if err != nil {
		return err
	}
	if group == nil {
		return ErrGroupNotFound
	}
	if !group.IsMember {
		return ErrUnauthorized
	}
	return nil
}

func (s *Service) userIDsByNicknames(nicknames []string) ([]string, error) {
	nicknames = uniqueNicknames(nicknames)
	userIDs := make([]string, 0, len(nicknames))
	for _, nickname := range nicknames {
		userID, err := s.userIDByNickname(nickname)
		if err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, nil
}

func (s *Service) userIDByNickname(nickname string) (string, error) {
	userID, err := s.repo.GetUserIDByNickname(nickname)
	if err != nil {
		return "", err
	}
	if userID == "" {
		return "", ErrUserNotFound
	}
	return userID, nil
}

func uniqueNicknames(values []string) []string {
	seen := make(map[string]bool)
	unique := []string{}
	for _, value := range values {
		value = normalizeNickname(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		unique = append(unique, value)
	}
	return unique
}

func normalizeNickname(value string) string {
	return strings.TrimPrefix(strings.TrimSpace(value), "@")
}





