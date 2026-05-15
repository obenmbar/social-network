package groups

import "time"

const (
	RoleCreator = "creator"
	RoleMember  = "member"

	InvitationPending  = "pending"
	InvitationAccepted = "accepted"
	InvitationDeclined = "declined"

	RequestPending  = "pending"
	RequestAccepted = "accepted"
	RequestDeclined = "declined"
)

type Author struct {
	ID           string     `json:"id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Nickname     *string    `json:"nickname,omitempty"`
	Avatar       *string    `json:"avatar,omitempty"`
	LastActivity *time.Time `json:"last_activity,omitempty"`
}

type Group struct {
	ID           string     `json:"id"`
	CreatorID    string     `json:"creator_id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	CreatedAt    time.Time  `json:"created_at"`
	Creator      Author     `json:"creator"`
	MemberCount  int        `json:"member_count"`
	IsMember     bool       `json:"is_member"`
	HasRequest   bool       `json:"has_request"`
	HasInvite    bool       `json:"has_invite"`
	LastActivity *time.Time `json:"last_activity,omitempty"`
}

type GroupPost struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Author    Author    `json:"author"`
}

type GroupComment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Author    Author    `json:"author"`
}

type GroupEvent struct {
	ID            string    `json:"id"`
	GroupID       string    `json:"group_id"`
	CreatorID     string    `json:"creator_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	EventTime     time.Time `json:"event_time"`
	CreatedAt     time.Time `json:"created_at"`
	Creator       Author    `json:"creator"`
	MyResponse    *string   `json:"my_response,omitempty"`
	GoingCount    int       `json:"going_count"`
	NotGoingCount int       `json:"not_going_count"`
}

type Invitation struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	InviterID string    `json:"inviter_id"`
	InviteeID string    `json:"invitee_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	Group     Group     `json:"group"`
}

type JoinRequest struct {
	ID        string    `json:"id"`
	GroupID   string    `json:"group_id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	Group     Group     `json:"group"`
	User      Author    `json:"user"`
}

type GroupDetail struct {
	Group    *Group         `json:"group"`
	Posts    []*GroupPost   `json:"posts"`
	Events   []*GroupEvent  `json:"events"`
	Members  []Author       `json:"members"`
	Requests []*JoinRequest `json:"requests,omitempty"`
}

type PostDetail struct {
	Post     *GroupPost      `json:"post"`
	Comments []*GroupComment `json:"comments"`
}

type CreateGroupRequest struct {
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	InviteeNicknames []string `json:"invitee_nicknames"`
}

type InviteRequest struct {
	Nickname string `json:"nickname"`
}

type CreatePostRequest struct {
	Content string `json:"content"`
}

type CreateCommentRequest struct {
	Content string `json:"content"`
}

type CreateEventRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	EventTime   string `json:"event_time"`
}

type EventResponseRequest struct {
	Response string `json:"response"`
}
