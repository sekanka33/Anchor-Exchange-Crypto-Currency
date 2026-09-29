-- Indexes for hot lookups that were sequential scans:
--  * webhook handler looks a deposit up by provider_reference
--  * email verification / password reset look users up by token
--  * every list endpoint filters by user_id and sorts by created_at DESC
CREATE INDEX IF NOT EXISTS idx_deposits_provider_reference ON deposits (provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token) WHERE verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created ON withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_created ON deposits (user_id, created_at DESC);
