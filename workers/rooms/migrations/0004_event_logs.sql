CREATE TABLE IF NOT EXISTS event_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  room_id TEXT,
  player_id TEXT,
  account_id TEXT,
  meta_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_logs_room_time ON event_logs(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_logs_type_time ON event_logs(event_type, created_at);
