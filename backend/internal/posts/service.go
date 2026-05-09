package posts

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofrs/uuid/v5"
)

const maxImageSize = 10 << 20

var (
	ErrEmptyPost        = errors.New("post cannot be empty")
	ErrEmptyComment     = errors.New("comment cannot be empty")
	ErrInvalidPrivacy   = errors.New("invalid privacy")
	ErrInvalidImage     = errors.New("invalid image")
	ErrPostNotFound     = errors.New("post not found")
	ErrUnauthorizedPost = errors.New("unauthorized")
	ErrInvalidSelection = errors.New("selected users must be followers")
)

type Service struct {
	repo      *Repository
	uploadDir string
}

func NewService(repo *Repository, uploadDir string) *Service {
	return &Service{repo: repo, uploadDir: uploadDir}
}

func (s *Service) CreatePost(userID string, req CreatePostRequest, fileHeader *multipart.FileHeader) (*Post, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Content = strings.TrimSpace(req.Content)
	if req.Privacy == "" {
		req.Privacy = PrivacyPublic
	}
	if !validPrivacy(req.Privacy) {
		return nil, ErrInvalidPrivacy
	}
	if req.Title == "" && req.Content == "" && fileHeader == nil {
		return nil, ErrEmptyPost
	}

	if req.Privacy == PrivacyPrivateSelected {
		if len(req.AllowedUserIDs) == 0 {
			return nil, ErrInvalidSelection
		}
		ok, err := s.repo.AreFollowers(userID, req.AllowedUserIDs)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrInvalidSelection
		}
	} else {
		req.AllowedUserIDs = nil
	}

	image, err := s.saveImage(fileHeader, "posts")
	if err != nil {
		return nil, err
	}

	id, _ := uuid.NewV4()
	post := &Post{
		ID:      id.String(),
		UserID:  userID,
		Title:   req.Title,
		Content: req.Content,
		Image:   image,
		Privacy: req.Privacy,
	}

	if err := s.repo.CreatePost(post, uniqueStrings(req.AllowedUserIDs)); err != nil {
		return nil, err
	}

	return s.repo.GetPostByID(post.ID)
}

func (s *Service) GetFeed(userID string) ([]*Post, error) {
	return s.repo.GetVisiblePosts(userID)
}

func (s *Service) GetFollowers(userID string) ([]*Follower, error) {
	return s.repo.GetFollowers(userID)
}

func (s *Service) GetPost(userID, postID string) (*PostDetailResponse, error) {
	canSee, err := s.CanUserSeePost(userID, postID)
	if err != nil {
		return nil, err
	}
	if !canSee {
		post, err := s.repo.GetPostByID(postID)
		if err != nil {
			return nil, err
		}
		if post == nil {
			return nil, ErrPostNotFound
		}
		return nil, ErrUnauthorizedPost
	}

	post, err := s.repo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	comments, err := s.repo.GetCommentsByPostID(postID)
	if err != nil {
		return nil, err
	}

	return &PostDetailResponse{Post: post, Comments: comments}, nil
}

func (s *Service) CreateComment(userID, postID string, req CreateCommentRequest, fileHeader *multipart.FileHeader) (*Comment, error) {
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" && fileHeader == nil {
		return nil, ErrEmptyComment
	}

	canSee, err := s.CanUserSeePost(userID, postID)
	if err != nil {
		return nil, err
	}
	if !canSee {
		post, err := s.repo.GetPostByID(postID)
		if err != nil {
			return nil, err
		}
		if post == nil {
			return nil, ErrPostNotFound
		}
		return nil, ErrUnauthorizedPost
	}

	image, err := s.saveImage(fileHeader, "comments")
	if err != nil {
		return nil, err
	}

	id, _ := uuid.NewV4()
	comment := &Comment{
		ID:      id.String(),
		PostID:  postID,
		UserID:  userID,
		Content: req.Content,
		Image:   image,
	}

	if err := s.repo.CreateComment(comment); err != nil {
		return nil, err
	}

	return s.repo.GetCommentByID(comment.ID)
}

func (s *Service) CanUserSeePost(viewerID, postID string) (bool, error) {
	return s.repo.CanUserSeePost(viewerID, postID)
}

func (s *Service) GetVisibleUploadPath(viewerID, requestPath string) (string, error) {
	cleanPath := filepath.ToSlash(filepath.Clean(strings.TrimPrefix(requestPath, "/")))
	if !strings.HasPrefix(cleanPath, "uploads/posts/") && !strings.HasPrefix(cleanPath, "uploads/comments/") {
		return "", ErrPostNotFound
	}

	postID, err := s.repo.GetPostIDByImagePath(cleanPath)
	if err != nil {
		return "", err
	}
	if postID == nil {
		return "", ErrPostNotFound
	}

	canSee, err := s.CanUserSeePost(viewerID, *postID)
	if err != nil {
		return "", err
	}
	if !canSee {
		return "", ErrUnauthorizedPost
	}

	fullPath := filepath.Join(s.uploadDir, strings.TrimPrefix(cleanPath, "uploads/"))
	return fullPath, nil
}

func (s *Service) saveImage(fileHeader *multipart.FileHeader, folder string) (*string, error) {
	if fileHeader == nil {
		return nil, nil
	}
	if fileHeader.Size > maxImageSize {
		return nil, ErrInvalidImage
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedImageExtension(ext) {
		return nil, ErrInvalidImage
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open image: %w", err)
	}
	defer file.Close()

	header := make([]byte, 512)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("failed to read image: %w", err)
	}
	if !allowedImageContentType(http.DetectContentType(header[:n])) {
		return nil, ErrInvalidImage
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("failed to read image: %w", err)
	}

	id, _ := uuid.NewV4()
	name := id.String() + ext
	relativePath := filepath.ToSlash(filepath.Join("uploads", folder, name))
	fullDir := filepath.Join(s.uploadDir, folder)
	fullPath := filepath.Join(fullDir, name)

	if err := os.MkdirAll(fullDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}

	dst, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to create image: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return nil, fmt.Errorf("failed to save image: %w", err)
	}

	return &relativePath, nil
}

func validPrivacy(privacy string) bool {
	return privacy == PrivacyPublic || privacy == PrivacyFollowers || privacy == PrivacyPrivateSelected
}

func allowedImageExtension(ext string) bool {
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp"
}

func allowedImageContentType(contentType string) bool {
	return contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/gif" || contentType == "image/webp"
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}
