import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

export const shortLinks = sqliteTable(
  "short_links",
  {
    shortId: text("short_id").primaryKey(),
    jarPda: text("jar_pda").notNull().unique(),
    ownerWallet: text("owner_wallet").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    ownerIdx: index("idx_short_owner").on(t.ownerWallet),
  }),
);

export const jarsCache = sqliteTable("jars_cache", {
  jarPda: text("jar_pda").primaryKey(),
  jarType: text("jar_type").notNull(),
  asset: text("asset").notNull(),
  ownerWallet: text("owner_wallet").notNull(),
  goalAmount: text("goal_amount").notNull(),
  unlockTimestamp: integer("unlock_timestamp"),
  totalContributed: text("total_contributed").notNull(),
  totalContributors: integer("total_contributors").notNull(),
  status: text("status").notNull(),
  metadataUri: text("metadata_uri").notNull(),
  metadataHash: text("metadata_hash").notNull(),
  cachedAt: integer("cached_at").notNull(),
  lastOnchainSlot: integer("last_onchain_slot").notNull(),
  lastDirectSig: text("last_direct_sig"),
});

export const contributionsCache = sqliteTable(
  "contributions_cache",
  {
    jarPda: text("jar_pda").notNull(),
    donorWallet: text("donor_wallet").notNull(),
    amount: text("amount").notNull(),
    firstAt: integer("first_at").notNull(),
    lastAt: integer("last_at").notNull(),
    refunded: integer("refunded").notNull().default(0),
    donorName: text("donor_name"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.jarPda, t.donorWallet] }),
    jarTimeIdx: index("idx_contrib_jar_time").on(t.jarPda, t.lastAt),
    donorIdx: index("idx_contrib_donor").on(t.donorWallet),
  }),
);

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jarPda: text("jar_pda").notNull(),
    kind: text("kind").notNull(),
    actorWallet: text("actor_wallet").notNull(),
    amount: text("amount"),
    metadataJson: text("metadata_json"),
    signature: text("signature").notNull(),
    slot: integer("slot").notNull(),
    blockTime: integer("block_time").notNull(),
  },
  (t) => ({
    jarIdx: index("idx_events_jar").on(t.jarPda, t.slot),
    dedupe: index("idx_events_signature_kind").on(t.signature, t.kind),
  }),
);

export const indexerState = sqliteTable("indexer_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const transakDeposits = sqliteTable(
  "transak_deposits",
  {
    id: text("id").primaryKey(),
    jarPda: text("jar_pda").notNull(),
    shortId: text("short_id"),
    asset: text("asset").notNull(),
    amountUiu: text("amount_uiu").notNull(),
    donorName: text("donor_name"),
    ephemeralPubkey: text("ephemeral_pubkey").notNull().unique(),
    ephemeralSecretCt: text("ephemeral_secret_ct").notNull(),
    ephemeralSecretIv: text("ephemeral_secret_iv").notNull(),
    status: text("status").notNull(),
    transakOrderId: text("transak_order_id"),
    contributeSignature: text("contribute_signature"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    statusIdx: index("idx_transak_status").on(t.status, t.updatedAt),
    jarIdx: index("idx_transak_jar").on(t.jarPda),
  }),
);
