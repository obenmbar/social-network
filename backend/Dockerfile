FROM golang:1.26-alpine AS build

WORKDIR /src
RUN apk add --no-cache gcc musl-dev sqlite-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o /out/social-network ./cmd/server

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates sqlite-libs && adduser -D -H appuser

COPY --from=build /out/social-network /app/social-network
COPY migrations /app/migrations

RUN mkdir -p /app/data /app/uploads && chown -R appuser:appuser /app

USER appuser

ENV PORT=8080 \
    DB_PATH=/app/data/social_network.db \
    MIGRATIONS_PATH=/app/migrations/sqlite

EXPOSE 8080
CMD ["/app/social-network"]
