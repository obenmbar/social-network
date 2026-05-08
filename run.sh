#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Starting Social Network Services..."

# Start backend in the background
echo "-> Starting Backend (Go)..."
cd backend
go run cmd/server/main.go &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Start frontend in the background
echo "-> Starting Frontend (Next.js)..."
cd frontend
if [ ! -d node_modules ]; then
  echo "-> Installing frontend dependencies..."
  npm install
fi
npm run dev -- -H 127.0.0.1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "Services are running!"
echo "Backend: http://localhost:8080"
echo "Frontend: check the Next.js output above for the active port, usually http://127.0.0.1:3000"
echo "Press Ctrl+C to stop both."

# Trap termination signals to kill both processes gracefully.
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Keep script running while background processes are alive.
wait
