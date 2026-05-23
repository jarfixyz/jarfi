CREATE TABLE transak_deposits (
  id TEXT PRIMARY KEY,
  jar_pda TEXT NOT NULL,
  short_id TEXT,
  asset TEXT NOT NULL,
  amount_uiu TEXT NOT NULL,
  donor_name TEXT,
  ephemeral_pubkey TEXT NOT NULL UNIQUE,
  ephemeral_secret_ct TEXT NOT NULL,
  ephemeral_secret_iv TEXT NOT NULL,
  status TEXT NOT NULL,
  transak_order_id TEXT,
  contribute_signature TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_transak_status ON transak_deposits(status, updated_at);
CREATE INDEX idx_transak_jar ON transak_deposits(jar_pda);
