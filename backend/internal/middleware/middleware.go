package middleware

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"social-network/internal/auth"
)

type contextKey string

const UserIDKey contextKey = "userID"

const maxRequestHeaderBytes = 16 << 10

// SessionMiddleware intercepts requests, reads the session ID from the Cookie,
// checks validity via the service, and injects UserID into the context.
func SessionMiddleware(authService *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(auth.SessionCookieName)
			if err != nil {
				writeUnauthorized(w, r, "Unauthorized")
				return
			}

			if len(cookie.Value) == 0 || len(cookie.Value) > 256 {
				log.Printf("rejecting invalid session cookie length: remote=%s path=%s cookie_len=%d", r.RemoteAddr, r.URL.Path, len(cookie.Value))
				writeUnauthorized(w, r, "Unauthorized")
				return
			}

			session, err := authService.ValidateSession(cookie.Value)
			if err != nil {
				if err.Error() == "session expired or invalid" {
					writeUnauthorized(w, r, "Session expired")
				} else {
					log.Printf("failed to validate session: remote=%s path=%s err=%v", r.RemoteAddr, r.URL.Path, err)
					writeUnauthorized(w, r, "Unauthorized")
				}
				return
			}

			// Valid session, add UserID to context
			ctx := context.WithValue(r.Context(), UserIDKey, session.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequestHeaderSizeMiddleware(limit int) func(http.Handler) http.Handler {
	if limit <= 0 {
		limit = maxRequestHeaderBytes
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			size := requestHeaderSize(r)
			if size > limit {
				auth.ClearSessionCookie(w, r)
				writeJSONError(w, "Request headers too large", http.StatusRequestHeaderFieldsTooLarge)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func requestHeaderSize(r *http.Request) int {
	size := len(r.Method) + len(r.URL.RequestURI()) + len(r.Proto) + 4
	for name, values := range r.Header {
		for _, value := range values {
			size += len(name) + len(value) + 4
		}
	}
	return size
}

func writeUnauthorized(w http.ResponseWriter, r *http.Request, message string) {
	auth.ClearSessionCookie(w, r)
	writeJSONError(w, message, http.StatusUnauthorized)
}

func writeJSONError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
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
