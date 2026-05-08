package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"social-network/internal/auth"
	"social-network/internal/middleware"
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

	// Middlewares
	rateLimiter := middleware.NewRateLimiter(20, time.Minute)
	sessionAuth := middleware.SessionMiddleware(authRepo)

	// 4. Set up Routing (http.ServeMux)
	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("/register", authHandler.Register)
	mux.HandleFunc("/login", authHandler.Login)

	// Protected routes
	mux.Handle("/me", sessionAuth(http.HandlerFunc(authHandler.Me)))
	mux.Handle("/logout", sessionAuth(http.HandlerFunc(authHandler.Logout)))

	handler := rateLimiter.Middleware()(mux)

	// 5. Start Server
	addr := ":" + port
	log.Printf("Server starting on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
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
