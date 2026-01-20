CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsor_campaigns_v2 (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  creative_url TEXT NOT NULL,
  click_url TEXT NOT NULL,
  tagline TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at INTEGER,
  ends_at INTEGER
);

CREATE TABLE IF NOT EXISTS sponsor_balances (
  sponsor_id TEXT PRIMARY KEY,
  credits_remaining INTEGER NOT NULL,
  credits_purchased_total INTEGER NOT NULL,
  credits_spent_total INTEGER NOT NULL,
  current_weight INTEGER NOT NULL DEFAULT 0,
  games_since_last_placement INTEGER NOT NULL DEFAULT 0,
  last_shown_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impression_ledger (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  impressions_debited INTEGER NOT NULL,
  players_count INTEGER NOT NULL,
  streamer_mode INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  is_streamer INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  sponsor_id_selected TEXT,
  sponsor_placement_shown INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_v2_sponsor ON sponsor_campaigns_v2(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_balances_remaining ON sponsor_balances(credits_remaining);
CREATE INDEX IF NOT EXISTS idx_impression_ledger_sponsor ON impression_ledger(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
