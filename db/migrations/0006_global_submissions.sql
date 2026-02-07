CREATE TABLE IF NOT EXISTS global_submissions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  creator_handle TEXT,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_global_submissions_platform ON global_submissions(platform);
CREATE INDEX IF NOT EXISTS idx_global_submissions_creator ON global_submissions(creator_handle);
