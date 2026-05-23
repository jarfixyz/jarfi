CREATE TABLE short_links (
  short_id TEXT PRIMARY KEY,
  jar_pda TEXT NOT NULL UNIQUE,
  owner_wallet TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_short_owner ON short_links(owner_wallet);

CREATE TABLE jars_cache (
  jar_pda TEXT PRIMARY KEY,
  jar_type TEXT NOT NULL,
  asset TEXT NOT NULL,
  owner_wallet TEXT NOT NULL,
  goal_amount TEXT NOT NULL,
  unlock_timestamp INTEGER,
  total_contributed TEXT NOT NULL,
  total_contributors INTEGER NOT NULL,
  status TEXT NOT NULL,
  metadata_uri TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  cached_at INTEGER NOT NULL,
  last_onchain_slot INTEGER NOT NULL
);

CREATE TABLE contributions_cache (
  jar_pda TEXT NOT NULL,
  donor_wallet TEXT NOT NULL,
  amount TEXT NOT NULL,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  refunded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (jar_pda, donor_wallet)
);
CREATE INDEX idx_contrib_jar_time ON contributions_cache(jar_pda, last_at DESC);
CREATE INDEX idx_contrib_donor ON contributions_cache(donor_wallet);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jar_pda TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor_wallet TEXT NOT NULL,
  amount TEXT,
  metadata_json TEXT,
  signature TEXT NOT NULL,
  slot INTEGER NOT NULL,
  block_time INTEGER NOT NULL,
  UNIQUE(signature, kind)
);
CREATE INDEX idx_events_jar ON events(jar_pda, slot DESC);

CREATE TABLE indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
