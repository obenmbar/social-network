package auth

import (
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	SessionCookieName = "session_token"
)

// SetSessionCookie stores only the compact opaque session token in the browser.
func SetSessionCookie(w http.ResponseWriter, r *http.Request, token string, expiresAt time.Time) {
	http.SetCookie(w, sessionCookie(r, token, expiresAt, 0, "/"))
}

// ClearSessionCookie expires the current cookie and common legacy path variants.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	expiresAt := time.Unix(0, 0)
	http.SetCookie(w, sessionCookie(r, "", expiresAt, -1, "/"))
	http.SetCookie(w, sessionCookie(r, "", expiresAt, -1, "/api"))
}

func sessionCookie(r *http.Request, value string, expiresAt time.Time, maxAge int, path string) *http.Cookie {
	return &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     path,
		Expires:  expiresAt,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secureCookie(r),
		SameSite: http.SameSiteLaxMode,
	}
}

func secureCookie(r *http.Request) bool {
	if strings.EqualFold(os.Getenv("COOKIE_SECURE"), "false") {
		return false
	}
	if strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true") {
		return true
	}
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
