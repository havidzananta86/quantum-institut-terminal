-- Migration 002: Add composite index for session token + expiry lookups (#111)
-- This speeds up qi_validate_token() which queries by token hash and checks expiry.

CREATE INDEX IF NOT EXISTS idx_token_expires
ON user_sessions (token, expires_at);
