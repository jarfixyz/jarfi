# Operator runbook

Manual steps that require human credentials, real infrastructure, or costs.
Claude writes the code; you run these when the code is ready to ship.

Status legend: 🟡 ready when you are · ⏳ blocked on earlier step · ✅ done

---

## Plan 1 — Anchor program devnet deploy  🟡

Prereqs:
- Solana CLI installed and `~/.config/solana/id.json` funded with devnet SOL
  (`solana airdrop 2 -u devnet`).
- `anchor` 0.32.1 installed.

Steps from repo root:

```bash
anchor build
anchor deploy --provider.cluster devnet
pnpm tsx scripts/deploy-devnet.ts
```

Expected:
1. `anchor deploy` prints a program ID — it must match
   `GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF` in
   `packages/sdk/src/constants.ts` and `programs/jarfi/src/lib.rs`. If it
   differs, the keypair drifted — restore `target/deploy/jarfi-keypair.json`
   before redeploying.
2. `deploy-devnet.ts` initializes the protocol config PDA idempotently (admin
   = wallet, creation fee = 0, withdraw fee = 250 bps). Reruns exit cleanly.

Cost: a few devnet SOL (free via airdrop).

---

## Plan 2 — Cloudflare resource provisioning  🟡

Prereqs:
- `wrangler` logged in to your Cloudflare account (`wrangler login`).
- Helius account with a devnet API key.

### 1. Create D1, KV, R2

```bash
cd apps/web
wrangler d1 create jarfi-db
wrangler kv namespace create jarfi-kv
wrangler r2 bucket create jarfi-metadata
```

Each command prints an ID. Copy them into `apps/web/wrangler.toml`,
replacing `REPLACE_WITH_D1_ID_AFTER_CREATE` and
`REPLACE_WITH_KV_ID_AFTER_CREATE`.

### 2. Apply D1 migration

```bash
wrangler d1 migrations apply jarfi-db --local
wrangler d1 migrations apply jarfi-db --remote
```

Expected: `0001_initial.sql` applied. Verify with:

```bash
wrangler d1 execute jarfi-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Should list: `short_links`, `jars_cache`, `contributions_cache`, `events`,
`indexer_state`.

### 3. Set secrets

```bash
wrangler secret put CRON_SECRET      # generate with: openssl rand -hex 32
wrangler secret put HELIUS_API_KEY   # paste from Helius dashboard
```

Rotation: regenerate `CRON_SECRET` quarterly. `HELIUS_API_KEY` rotates on
Helius dashboard schedule.

### 4. Commit the filled-in wrangler.toml

```bash
git add apps/web/wrangler.toml
git commit -m "chore(web): wire real CF resource IDs"
```

Cost: D1, KV, R2 are free tier for our volumes. Helius free plan covers
devnet smoke testing.

---

## Plan 2 — First deploy + smoke test  ⏳ (needs CF bootstrap)

```bash
cd apps/web
pnpm cf:deploy
```

Expected: `Worker deployed to <subdomain>.workers.dev`.

Smoke test the cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<subdomain>.workers.dev/api/cron/index
```

Expected JSON:
```json
{"ok":true,"signaturesProcessed":0,"eventsApplied":0,"lastSlot":0}
```

After the Plan 1 devnet deploy is done, submit a test `create_jar` tx (use
a one-off `pnpm tsx` snippet against `@jarfi/sdk`) and rerun the cron curl.
Expected: `signaturesProcessed ≥ 1`, `eventsApplied ≥ 1`, and a row shows up:

```bash
wrangler d1 execute jarfi-db --remote --command "SELECT * FROM jars_cache"
```

---

## Plan 3 — (to be filled in when code is written)

_Design system + landing page. Will likely need: DNS for a custom domain,
social OG image assets, landing page copy review._

---

## Plan 4 — (to be filled in when code is written)

_App flows. Will likely need: wallet adapter config, real devnet smoke
test of each flow, optional Vercel/CF Pages preview deploys._

---

## Shared: local dev secrets

`apps/web/.dev.vars` (git-ignored) is the local equivalent of `wrangler
secret put`. Copy it from `.dev.vars.example` once that file exists and
fill in `CRON_SECRET`, `HELIUS_API_KEY`, and any other per-environment
values.
