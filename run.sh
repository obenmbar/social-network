#!/bin/bash

echo "Starting Social Network Services..."

# Start backend in the background
echo "-> Starting Backend (Go)..."
cd backend
go run cmd/server/main.go &
BACKEND_PID=$!
cd ..

# Start frontend in the background
echo "-> Starting Frontend (Next.js)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Services are running!"
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."

# Trap termination signals to kill both processes gracefully.
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Keep script running while background processes are alive.
wait
