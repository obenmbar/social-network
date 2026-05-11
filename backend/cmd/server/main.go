package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"social-network/internal/auth"
	"social-network/internal/groups"
	"social-network/internal/middleware"
	"social-network/internal/posts"
	"social-network/pkg/db/sqlite"
)

func main() {
	// Resolve project root (backend/) from this source file's location.
	// runtime.Caller works correctly with `go run`.
	_, srcFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(srcFile), "..", "..")

	dbPath := getEnv("DB_PATH", filepath.Join(projectRoot, "data", "social_network.db"))
	migrationsPath := getEnv("MIGRATIONS_PATH", filepath.Join(projectRoot, "migrations", "sqlite"))
	port := strings.TrimPrefix(getEnv("PORT", "8080"), ":")
	/* git */

	// 1. Initialize Database
	db, err := sqlite.Connect(dbPath)
	if err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}
	defer db.Close()

	// 2. Run Migrations
	if err := sqlite.RunMigrations(db, migrationsPath); err != nil {
		log.Fatalf("Could not run migrations: %v", err)
	}
	log.Println("Migrations completed successfully.")

	// 3. Manual Dependency Injection
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService)
	postsRepo := posts.NewRepository(db)
	postsService := posts.NewService(postsRepo, filepath.Join(projectRoot, "uploads"))
	postsHandler := posts.NewHandler(postsService)
	groupsRepo := groups.NewRepository(db)
	groupsService := groups.NewService(groupsRepo)
	groupsHandler := groups.NewHandler(groupsService)

	// Middlewares
	rateLimitRequests := getEnvInt("RATE_LIMIT_REQUESTS", 20)
	rateLimitWindow := getEnvDuration("RATE_LIMIT_WINDOW", 10*time.Second)
	rateLimiter := middleware.NewRateLimiter(rateLimitRequests, rateLimitWindow)
	sessionAuth := middleware.SessionMiddleware(authService)

	// 4. Set up Routing (http.ServeMux)
	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("/register", authHandler.Register)
	mux.HandleFunc("/login", authHandler.Login)

	// Protected routes
	mux.Handle("/me", sessionAuth(http.HandlerFunc(authHandler.Me)))
	mux.Handle("/logout", sessionAuth(http.HandlerFunc(authHandler.Logout)))
	mux.Handle("/followers", sessionAuth(http.HandlerFunc(groupsHandler.Followers)))
	mux.Handle("/posts", sessionAuth(http.HandlerFunc(postsHandler.CreatePost)))
	mux.Handle("/posts/feed", sessionAuth(http.HandlerFunc(postsHandler.Feed)))
	mux.Handle("/posts/{id}", sessionAuth(http.HandlerFunc(postsHandler.GetPost)))
	mux.Handle("/posts/{id}/comments", sessionAuth(http.HandlerFunc(postsHandler.CreateComment)))
	mux.Handle("/groups", sessionAuth(http.HandlerFunc(groupsHandler.Groups)))
	mux.Handle("/groups/invitations", sessionAuth(http.HandlerFunc(groupsHandler.Invitations)))
	mux.Handle("/groups/{id}", sessionAuth(http.HandlerFunc(groupsHandler.GetGroup)))
	mux.Handle("/groups/{id}/invite", sessionAuth(http.HandlerFunc(groupsHandler.InviteUser)))
	mux.Handle("/groups/{id}/invitations/{status}", sessionAuth(http.HandlerFunc(groupsHandler.RespondToInvitation)))
	mux.Handle("/groups/{id}/requests", sessionAuth(http.HandlerFunc(groupsHandler.RequestToJoin)))
	mux.Handle("/groups/{id}/requests/{userID}/{status}", sessionAuth(http.HandlerFunc(groupsHandler.RespondToJoinRequest)))
	mux.Handle("/groups/{id}/posts", sessionAuth(http.HandlerFunc(groupsHandler.CreatePost)))
	mux.Handle("/groups/{id}/posts/{postID}", sessionAuth(http.HandlerFunc(groupsHandler.GetPost)))
	mux.Handle("/groups/{id}/posts/{postID}/comments", sessionAuth(http.HandlerFunc(groupsHandler.CreateComment)))
	mux.Handle("/groups/{id}/events", sessionAuth(http.HandlerFunc(groupsHandler.CreateEvent)))
	mux.Handle("/groups/{id}/events/{eventID}/responses", sessionAuth(http.HandlerFunc(groupsHandler.RespondToEvent)))

	// Uploaded media
	mux.Handle("/uploads/", sessionAuth(http.HandlerFunc(postsHandler.ServeUpload)))

	handler := middleware.RequestHeaderSizeMiddleware(16 << 10)(rateLimiter.Middleware()(mux))

	// 5. Start Server
	addr := ":" + port
	log.Printf("Server starting on http://localhost%s", addr)
	server := &http.Server{
		Addr:           addr,
		Handler:        handler,
		ErrorLog:       log.New(os.Stderr, "http: ", log.LstdFlags),
		MaxHeaderBytes: 16 << 10,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		log.Printf("Invalid %s=%q; using %d", key, value, fallback)
		return fallback
	}

	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 {
		log.Printf("Invalid %s=%q; using %s", key, value, fallback)
		return fallback
	}

	return parsed
}
