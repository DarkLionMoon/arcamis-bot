CREATE TABLE IF NOT EXISTS minecraft_status_messages (
  channel_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
