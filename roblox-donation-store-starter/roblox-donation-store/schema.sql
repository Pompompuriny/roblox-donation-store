CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  picture TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS donation_intents (
  user_id TEXT NOT NULL,
  pass_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','verified','already_owned','expired')),
  created_at INTEGER NOT NULL,
  verified_at INTEGER,
  notified_at INTEGER,
  notify_state TEXT NOT NULL DEFAULT 'none',
  notify_attempt_at INTEGER,
  last_check_at INTEGER,
  PRIMARY KEY (user_id, pass_id)
);
CREATE INDEX IF NOT EXISTS idx_pending ON donation_intents(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notify ON donation_intents(notify_state, verified_at);
