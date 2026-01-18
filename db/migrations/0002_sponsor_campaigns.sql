CREATE TABLE IF NOT EXISTS twitch_top250_cache (
  rank INTEGER PRIMARY KEY,
  broadcaster_id TEXT NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  viewer_count INTEGER NOT NULL,
  sampled_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  brand_name TEXT NOT NULL,
  click_url TEXT NOT NULL,
  tagline TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL,
  standard_games_remaining INTEGER NOT NULL DEFAULT 0,
  streamer_viewer_credits_remaining INTEGER NOT NULL DEFAULT 0,
  purchased_json TEXT NOT NULL,
  contact_email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsor_impressions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL,
  viewers INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL
);
