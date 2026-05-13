package followers

import "time"

const (
	RequestPending  = "pending"
	RequestAccepted = "accepted"
	RequestDeclined = "declined"

	StatusSelf      = "self"
	StatusFollowing = "following"
	StatusPending   = "pending"
	StatusNone      = "none"
)

type UserSummary struct {
	ID           string  `json:"id"`
	FirstName    string  `json:"first_name"`
	LastName     string  `json:"last_name"`
	Nickname     *string `json:"nickname,omitempty"`
	Avatar       *string `json:"avatar,omitempty"`
	IsPublic     bool    `json:"is_public"`
	FollowStatus string  `json:"follow_status"`
}

type Profile struct {
	ID             string        `json:"id"`
	Email          *string       `json:"email,omitempty"`
	FirstName      string        `json:"first_name"`
	LastName       string        `json:"last_name"`
	DateOfBirth    *string       `json:"date_of_birth,omitempty"`
	Gender         *string       `json:"gender,omitempty"`
	Avatar         *string       `json:"avatar,omitempty"`
	Nickname       *string       `json:"nickname,omitempty"`
	AboutMe        *string       `json:"about_me,omitempty"`
	IsPublic       bool          `json:"is_public"`
	CreatedAt      time.Time     `json:"created_at"`
	CanViewDetails bool          `json:"can_view_details"`
	FollowStatus   string        `json:"follow_status"`
	Followers      []UserSummary `json:"followers,omitempty"`
	Following      []UserSummary `json:"following,omitempty"`
}

type FollowRequest struct {
	ID        string      `json:"id"`
	Status    string      `json:"status"`
	CreatedAt time.Time   `json:"created_at"`
	Requester UserSummary `json:"requester"`
}

type FollowResponse struct {
	Status string `json:"status"`
}

type UpdateVisibilityRequest struct {
	IsPublic bool `json:"is_public"`
}
