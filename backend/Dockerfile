FROM golang:1.26-alpine

WORKDIR /app

RUN apk add --no-cache gcc musl-dev sqlite-dev

COPY . .

RUN go mod download
RUN CGO_ENABLED=1 go build -o social-network ./cmd/server

ENV PORT=8080
ENV DB_PATH=/app/data/social_network.db
ENV MIGRATIONS_PATH=/app/migrations/sqlite

EXPOSE 8080

CMD ["./social-network"]