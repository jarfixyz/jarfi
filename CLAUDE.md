# JAR (jarfi.xyz) — Project Context

## What is this
Solana savings jar app. Users create on-chain vaults (jars), invite family to gift via credit card (Transak fiat onramp), funds earn yield via Kamino (USDC) or Marinade (SOL). Built for Solana Frontier Hackathon.

## Stack
- **Contract**: Anchor (Rust) · Solana devnet · Program `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`
- **Backend**: Node.js / Express · Railway (`https://jarfi.up.railway.app`)
- **Web**: Next.js 15 · Cloudflare Pages (`jarfi.xyz`) via `@cloudflare/next-on-pages` + wrangler
- **Onramp**: Transak (card/Apple Pay → USDC on Solana)
- **Yield**: Kamino Lend (USDC, ~8% APY) · Marinade (SOL, ~6.85% APY)
- **Swap**: Jupiter V6 API (USDC→SOL for SOL jars) + Jupiter Terminal widget (UI)
- **Auth**: Wallet-only — Phantom / Solflare via `@solana/wallet-adapter` (Privy removed 2026-05-04)
- **RPC**: Ankr devnet fallback (`rpc.ankr.com/solana_devnet`) · GetBlock.io planned

## Repo structure
```
jarfi/
├── jarfi-contract/   Anchor program (Rust)
├── jarfi-backend/    Express API (Railway)
└── jarfi-web/        Next.js app (Cloudflare Pages)
```

## Deploy
- **Web**: `cd jarfi-web && npm run deploy`
  (runs `@cloudflare/next-on-pages` then `wrangler pages deploy`)
  Cloudflare auto-deploy from GitHub often fails — prefer manual deploy
- **Backend**: auto-deploys on Railway from `main` branch (root dir: `jarfi-backend/`)
- **Contract**: `cd jarfi-contract && anchor build && anchor deploy`

## Key env vars
- Railway: `SERVER_WALLET_SECRET`, `TRANSAK_API_SECRET`, `SOLANA_RPC_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- Cloudflare Pages: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_TRANSAK_API_KEY`, `NEXT_PUBLIC_ENV`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_NETWORK`
- Optional: `DB_PATH` (Railway persistent volume path for SQLite, e.g. `/data/jarfi.db`)

> ⚠️ `NEXT_PUBLIC_SOLANA_RPC_URL` not yet set in Cloudflare Pages — falls back to Ankr devnet.
> Set it to GetBlock.io devnet endpoint to fix reliability.

## Current status (2026-05-04) — UI POLISH + BUG FIXES ✅

### Phases (all complete)
- Phase 1 (USDC Foundation) — ✅
- Phase 2 (Kamino staking) — ✅
- Phase 3 (Jupiter Terminal swap widget) — ✅
- Phase 4 (Recurring deposits + push notifications) — ✅
- Phase 5 (Group Trip jar) — ✅

### Session fixes + features (2026-05-04)
- ✅ **Auth**: Privy removed — wallet-only (Phantom/Solflare)
- ✅ **MoonPay webhook** (`/api/moonpay-webhook`): forwards raw body + signature header to backend
- ✅ **Dashboard**: Swap/New Jar buttons hidden when wallet not connected
- ✅ **Dashboard**: Stats/forecast hidden when 0 jars (avoids "fake data" confusion)
- ✅ **Jar creation step 2**: "No goal — save by time" option + contextual hints on all steps
- ✅ **Jar creation step 5**: button text/state reflects actual wallet connection
- ✅ **RPC fix**: `providers.tsx` defaults to devnet when `NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet"`
- ✅ **RPC fallback**: Ankr devnet instead of flaky `api.devnet.solana.com`
- ✅ **Jar creation**: `createScheduleApi`/`createGroupApi` isolated — backend failure doesn't break jar creation
- ✅ **Jar list refresh**: `fetchJarByPubkey` immediately after creation + localStorage pubkey cache fallback
- ✅ **Jar detail panel**: full view per jar (future value, yield block, contributors, projection, gift link)
- ✅ **Landing page**: full redesign per jar3-2/jar3-3 design (Nav, Hero, Jar types, Onramp, Recurring, Share, Calculator, FAQ)
- ✅ **Dashboard redesign** per jar3-3:
  - Page bg `#F5F5F2`, surfaces white
  - Sidebar: "Savings" / "Insights" sections + live APY pill
  - Portfolio card: horizontal bar (5 metrics)
  - Yield strip: live monthly earnings
  - Jar cards: colored cover gradient + type badge + lock + Chart ↗ button
  - Inline chart panel: SVG projection (Jarfi vs Bank) per jar
  - Add jar dashed card
  - Bottom grid: Activity | Schedules + Forecast

### Still needed before mainnet launch
- [ ] **Set `NEXT_PUBLIC_SOLANA_RPC_URL`** in Cloudflare Pages → GetBlock.io devnet endpoint
- [ ] Mainnet contract deploy (`anchor deploy --provider.cluster mainnet-beta`)
- [ ] Update PROGRAM_ID in `jarfi-web/lib/program.ts` + `jarfi-backend/index.js` after mainnet deploy
- [ ] Railway env vars: `SOLANA_NETWORK=mainnet`, `DB_PATH=/data/jarfi.db`, `GUARDARIAN_WEBHOOK_SECRET`
- [ ] Railway persistent volume for SQLite (`DB_PATH`)
- [ ] Server wallet funded with USDC for recurring auto-deposits
- [ ] Transak production API key (currently staging, `NEXT_PUBLIC_ENV=staging`)

### Hackathon checklist (before May 11, 2026)
- [ ] Register on Colosseum: colosseum.com/frontier
- [ ] Pitch video (2-3 min): problem → solution → demo
- [ ] Technical demo video: create jar → gift → approve flow
- [ ] Weekly update post on Colosseum
- [ ] Superteam Ukraine registration (up to $10k bonus)
- [ ] "Powered by DoubleZero" in README
- [ ] Check GitHub commit history is spread evenly

## Design system

### Dashboard (jar3-3 tokens — inline styles)
```
--page-bg:    #F5F5F2   (warm off-white)
--surface:    #FFFFFF
--surface-2:  #F0F0EC
--border:     #E2E2DC
--green:      #059669
--green-bg:   #ECFDF5
--green-dim:  rgba(5,150,105,.12)
--text-2:     #555555
--text-3:     #999999
```

### Landing / globals.css vars (legacy, kept for landing page)
```
--bg:             #FFFFFF
--bg-muted:       #F7F8F7
--text-primary:   #111111
--text-secondary: #666666
--text-tertiary:  #999999
--border:         #EAEAEA
--green:          #1F8A5B
```

### Key design principles
- Primary number = FUTURE VALUE (green, large)
- Current balance = secondary
- No APY/yield jargon on landing
- "Save together. Grow automatically." — core tagline
- Emotional, family-friendly tone
- New components → inline styles with dashboard tokens
- Old components → keep Tailwind (sol-* / surface-* aliases still work)

## Demo jars on devnet (real on-chain)
- `jarfi.xyz/gift/anya` → pubkey `FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC` (Anya's Future 🎁, mode 0, unlock 2036)
- `jarfi.xyz/gift/japan` → pubkey `ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4` (Japan Trip ✈️, mode 1, goal $1000)
- `jarfi.xyz/gift/moto` → pubkey `28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc` (Motorcycle Fund 🏍️, mode 2, $5000/6mo)

> After Railway redeploy, re-seed demo jar names: `POST /jar/meta` for each pubkey.

## Backend files
| File | Purpose |
|------|---------|
| `index.js` | Express server, all API routes |
| `db.js` | SQLite schema + queries (WAL mode) |
| `scheduleService.js` | Cron schedule CRUD + runner |
| `groupService.js` | Group trip CRUD |
| `kaminoService.js` | Kamino Lend USDC staking |
| `marinadeService.js` | Marinade SOL liquid staking |
| `jupiterService.js` | Jupiter V6 swap USDC→SOL |

## Backend API
```
GET  /                          health check
GET  /apy                       live APY (Kamino + Marinade)
POST /jar/create                create jar on-chain (server wallet)
GET  /jar/:pubkey               jar + contributions + Kamino yield
POST /jar/meta                  save jar name/emoji (SQLite)
POST /jar/deposit-sol           deposit SOL + async Marinade stake
POST /transak-webhook           Transak order completed → deposit
POST /moonpay-webhook           MoonPay order completed → deposit (full impl)
POST /guardarian-webhook        Guardarian order completed → deposit
POST /schedule/create           create recurring deposit schedule
GET  /schedule/:owner_pubkey    list active schedules
DELETE /schedule/:id            deactivate schedule
POST /push/subscribe            save push subscription
GET  /push/vapid-public-key     expose VAPID public key
POST /group/create              create group trip jar
GET  /group/:jar_pubkey         group + members + on-chain contributions
POST /group/:jar_pubkey/join    join group trip
GET  /group/by-owner/:pubkey    list groups by member
```

## Web routes
```
/                    landing page (redesigned per jar3-3)
/dashboard           main app — wallet required; full redesign per jar3-3
/gift/[jar]          public gift page (Transak widget)
/trip/[jar]          public group trip page (join flow)
/api/moonpay-webhook forwards to backend (edge runtime)
```

## Contract instructions
```
createJar            SOL jar
createUsdcJar        USDC jar (creates ATA vault)
deposit              SOL deposit
depositUsdc          USDC deposit from user wallet
giftDepositUsdc      USDC deposit from server (Transak/onramp)
giftDeposit          SOL gift (legacy compat)
withdrawUsdc         withdraw USDC after unlock
unlockJar            check unlock conditions
recordMarinadeStake  update staking_shares (called by backend after SDK stake)
setKaminoObligation  store Kamino obligation pubkey
createQuest          create spending quest (on-chain only, no UI yet)
approveQuest         approve quest payout (on-chain only)
setSpendingLimit     set daily/weekly limits (on-chain only)
emergencyWithdraw    emergency unlock (on-chain only)
```

## Core on-chain types
- `jar_currency: u8` — 0=USDC, 1=SOL
- `usdc_balance: u64` — USDC micro-units (6 dec)
- `staking_shares: u64` — mSOL lamports (SOL mode) or Kamino shares (USDC mode)
- `usdc_vault: Pubkey` — jar's USDC ATA (vault authority PDA = `[b"vault", jar.pubkey]`)
- `kamino_obligation: Pubkey` — Kamino obligation account

## USDC / program addresses
- Devnet USDC mint:  `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Mainnet USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Kamino Lend program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Kamino mainnet market: `7u3HeHxYDLhnCoErrtycNokbQYbWGkZwyTDt1v`
- Marinade program: `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD`
- Jupiter V6 API: `https://quote-api.jup.ag/v6`

## Commands
```bash
# Local dev
cd jarfi-web && npm run dev

# Manual Cloudflare deploy (preferred)
cd jarfi-web && npm run deploy

# Backend local
cd jarfi-backend && node index.js

# Contract build + deploy
cd jarfi-contract && anchor build && anchor deploy
```
