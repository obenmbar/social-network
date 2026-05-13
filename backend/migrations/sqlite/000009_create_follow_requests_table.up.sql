CREATE TABLE IF NOT EXISTS follow_requests (
    follower_id TEXT NOT NULL,
    followed_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE notifications ADD COLUMN source_id TEXT;
