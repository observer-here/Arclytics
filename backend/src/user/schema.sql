CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  wallet TEXT,
  magic_issuer TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'web',
  created_at INTEGER NOT NULL,
  notified_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE TABLE IF NOT EXISTS watch_items (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  list TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, item_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_items_user ON watch_items (user_id);

CREATE TABLE IF NOT EXISTS watch_lists (
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, name)
);
