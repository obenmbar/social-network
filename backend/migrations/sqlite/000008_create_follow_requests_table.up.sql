CREATE TABLE IF NOT EXISTS follow_requests (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (requester_id != target_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_requests_pending_pair
ON follow_requests(requester_id, target_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_follow_requests_target_status
ON follow_requests(target_id, status);
