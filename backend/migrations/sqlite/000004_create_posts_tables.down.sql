DROP INDEX IF EXISTS idx_comments_post_id;
DROP INDEX IF EXISTS idx_post_allowed_users_user_id;
DROP INDEX IF EXISTS idx_posts_privacy;
DROP INDEX IF EXISTS idx_posts_created_at;
DROP INDEX IF EXISTS idx_posts_user_id;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_allowed_users;
DROP TABLE IF EXISTS posts;
