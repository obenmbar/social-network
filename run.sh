#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Starting Social Network Services..."

find_free_port() {
  local port="$1"

  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
  done

  echo "$port"
}

BACKEND_PORT="${PORT:-8080}"
BACKEND_PORT="$(find_free_port "$BACKEND_PORT")"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
WS_URL="ws://127.0.0.1:${BACKEND_PORT}/ws"

# Start backend in the background
echo "-> Starting Backend (Go)..."
cd backend
PORT="$BACKEND_PORT" go run cmd/server/main.go &
BACKEND_PID=$!
cd "$ROOT_DIR"

sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start."
  exit 1
fi

# Start frontend in the background
echo "-> Starting Frontend (Next.js)..."
cd frontend
if [ ! -d node_modules ]; then
  echo "-> Installing frontend dependencies..."
  npm install
fi
BACKEND_URL="$BACKEND_URL" NEXT_PUBLIC_WS_URL="$WS_URL" npm run dev -- -H 127.0.0.1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "Services are running!"
echo "Backend: $BACKEND_URL"
echo "Frontend: check the Next.js output above for the active port, usually http://127.0.0.1:3000"
echo "Press Ctrl+C to stop both."

# Trap termination signals to kill both processes gracefully.
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Keep script running while background processes are alive.
wait
