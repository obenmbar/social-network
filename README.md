# Social Network

Facebook-like social network project with a Go/SQLite backend and a Next.js frontend.

## Features

- Sessions and cookie authentication
- Public/private profiles, followers, and follow requests
- Posts, comments, image/GIF uploads, and post visibility rules
- Groups with invitations, join requests, posts, comments, events, and votes
- Private and group chat over Gorilla WebSocket
- Notifications for follow and group workflows

## Local Development

Backend:

```bash
cd backend
PORT=8080 COOKIE_SECURE=false go run cmd/server/main.go
```

Frontend:

```bash
cd frontend
BACKEND_URL=http://localhost:8080 NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws npm run dev
```

Or use the helper:

```bash
./run.sh
```

## Docker

```bash
docker compose up --build
```

Frontend: http://localhost:3000

Backend: http://localhost:8080

The backend stores SQLite data and uploads in named Docker volumes.

## Environment

Copy `.env.example` when you need explicit local or container configuration.

- `PORT`: backend port
- `DB_PATH`: SQLite database path
- `MIGRATIONS_PATH`: migration directory
- `BACKEND_URL`: frontend server-side API proxy target
- `NEXT_PUBLIC_WS_URL`: browser WebSocket URL
- `COOKIE_SECURE`: set `true` behind HTTPS
- `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW`: basic request throttling

## Validation Commands

```bash
cd backend && go test ./...
cd frontend && npm run lint
cd frontend && npm run build
```

## WebSocket Messages

Private chat messages include `receiver_id` and `content`.

Group chat messages include `group_id` and `content`.

Server-side session state always overrides `sender_id`; clients must not rely on user-supplied sender values.
