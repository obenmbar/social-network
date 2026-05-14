package posts

import (
	"errors"
	"mime/multipart"
	"testing"
)

func TestSaveImageRejectsOversizedImage(t *testing.T) {
	service := NewService(nil, t.TempDir())
	fileHeader := &multipart.FileHeader{
		Filename: "large.png",
		Size:     maxImageSize + 1,
	}

	path, err := service.saveImage(fileHeader, "comments")
	if path != nil {
		t.Fatalf("expected no saved image path, got %q", *path)
	}
	if !errors.Is(err, ErrImageTooLarge) {
		t.Fatalf("expected ErrImageTooLarge, got %v", err)
	}
}
