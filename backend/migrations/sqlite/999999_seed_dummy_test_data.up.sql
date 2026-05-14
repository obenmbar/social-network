-- Seed users
INSERT INTO users (id, email, nickname, first_name, last_name, password_hash, date_of_birth, gender)
VALUES 
('user-uuid-1', 'test1@example.com', 'TestUser1', 'Test', 'One', '$2a$10$.avdQyhb18T5C0LZyxhJZunm6Pqk7svbfxYQLCy2ZZhKoBaNKf7GK', '1990-01-01', 'other'),
('user-uuid-2', 'test2@example.com', 'TestUser2', 'Test', 'Two', '$2a$10$.avdQyhb18T5C0LZyxhJZunm6Pqk7svbfxYQLCy2ZZhKoBaNKf7GK', '1990-01-01', 'other');

-- Seed followers (mutual follow to allow chat)
INSERT INTO followers (follower_id, followed_id)
VALUES 
('user-uuid-1', 'user-uuid-2'),
('user-uuid-2', 'user-uuid-1');
