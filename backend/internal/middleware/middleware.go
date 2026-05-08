package middleware

import (
	"context"
	"net"
	"net/http"
	"sync"
	"time"

	"social-network/internal/auth"
)

type contextKey string

const UserIDKey contextKey = "userID"

// SessionMiddleware intercepts requests, reads the session ID from the Cookie,
// checks validity via the repository, and injects UserID into the context.
func SessionMiddleware(repo *auth.Repository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("session_token")
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			session, err := repo.GetSessionByToken(cookie.Value)
			if err != nil || session == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			if time.Now().After(session.ExpiresAt) {
				http.Error(w, "Session expired", http.StatusUnauthorized)
				return
			}

			// Valid session, add UserID to context
			ctx := context.WithValue(r.Context(), UserIDKey, session.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type client struct {
	requests int
	lastSeen time.Time
}

type RateLimiter struct {
	clients map[string]*client
	mu      sync.Mutex
	limit   int
	window  time.Duration
}

// NewRateLimiter creates a new rate limiter and starts a background cleanup routine.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*client),
		limit:   limit,
		window:  window,
	}

	// Background routine to clean up stale clients and prevent memory leaks
	go func() {
		for {
			time.Sleep(window)
			rl.mu.Lock()
			for ip, c := range rl.clients {
				if time.Since(c.lastSeen) > window {
					delete(rl.clients, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

// Middleware returns the HTTP middleware that enforces the rate limit.
func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				// Fallback to RemoteAddr if port is missing
				ip = r.RemoteAddr
			}

			rl.mu.Lock()
			c, exists := rl.clients[ip]
			if !exists {
				c = &client{requests: 0, lastSeen: time.Now()}
				rl.clients[ip] = c
			}

			// Reset window if it has passed
			if time.Since(c.lastSeen) > rl.window {
				c.requests = 0
				c.lastSeen = time.Now()
			}

			c.requests++

			if c.requests > rl.limit {
				rl.mu.Unlock()
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
