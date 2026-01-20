ALTER TABLE sponsor_campaigns_v2 ADD COLUMN intro_asset_url TEXT;
ALTER TABLE sponsor_campaigns_v2 ADD COLUMN results_asset_url TEXT;
ALTER TABLE impression_ledger ADD COLUMN is_streamer INTEGER NOT NULL DEFAULT 0;
