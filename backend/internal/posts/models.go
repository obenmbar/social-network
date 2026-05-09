package posts

import "time"

const (
	PrivacyPublic          = "public"
	PrivacyFollowers       = "followers"
	PrivacyPrivateSelected = "private_selected"
)

type Post struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Image     *string   `json:"image,omitempty"`
	Privacy   string    `json:"privacy"`
	CreatedAt time.Time `json:"created_at"`
	Author    Author    `json:"author"`
}

type Author struct {
	ID        string  `json:"id"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Nickname  *string `json:"nickname,omitempty"`
	Avatar    *string `json:"avatar,omitempty"`
}

type Follower struct {
	ID        string  `json:"id"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Nickname  *string `json:"nickname,omitempty"`
	Avatar    *string `json:"avatar,omitempty"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	Image     *string   `json:"image,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	Author    Author    `json:"author"`
}

type CreatePostRequest struct {
	Title          string   `json:"title"`
	Content        string   `json:"content"`
	Privacy        string   `json:"privacy"`
	AllowedUserIDs []string `json:"allowed_user_ids"`
}

type CreateCommentRequest struct {
	Content string `json:"content"`
}

type PostDetailResponse struct {
	Post     *Post      `json:"post"`
	Comments []*Comment `json:"comments"`
}
