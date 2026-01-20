CREATE TABLE IF NOT EXISTS public_rooms (
  room_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  players INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_rooms_last_seen ON public_rooms(last_seen_at);
