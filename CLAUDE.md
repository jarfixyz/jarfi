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
- Cloudflare Pages: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_TRANSAK_API_KEY`, `NEXT_PUBLIC_ENV`
- Optional: `DB_PATH` (Railway persistent volume path for SQLite, e.g. `/data/jarfi.db`)

## Current status (2026-04-29) — ALL PHASES COMPLETE ✅

### Phases
- Phase 1 (USDC Foundation) — ✅
- Phase 2 (Kamino staking) — ✅
- Phase 3 (Jupiter Terminal swap widget) — ✅
- Phase 4 (Recurring deposits + push notifications) — ✅
  - 4A schedule engine · 4B VAPID push · 4C service worker · 4D recurring UI
- Phase 5 (Group Trip jar) — ✅

### Polish / known issues (all resolved 2026-04-29)
- ✅ Contract `deposit`: now transfers SOL on-chain via system_program CPI (was mock)
- ✅ Marinade staking: `marinadeService.js` + `record_marinade_stake` instruction
- ✅ Jupiter swap: `jupiterService.js` — USDC→SOL for SOL jar Transak webhook
- ✅ Persistent storage: SQLite (`better-sqlite3`) replaces ephemeral JSON files
- ✅ Dashboard stats: computed from real on-chain data (was hardcoded)
- ✅ `?confirm=` flow: banner + "Поповнити" button opens Transak widget
- ✅ Recurring deposit: cron auto-executes deposit + Kamino stake; push on result

### Remaining minor notes
- Marinade SDK devnet compatibility untested — staking may need mainnet to work end-to-end
- Server wallet needs USDC balance for recurring auto-deposits to execute (by design)
- `DB_PATH` env var should point to a Railway persistent volume for data survival across redeploys

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
POST /jar/deposit-sol           deposit SOL + async Marinade stake
POST /transak-webhook           Transak order completed → deposit
POST /moonpay-webhook           MoonPay order completed → deposit
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
/                    landing page
/dashboard           main app (wallet required for live data)
/gift/[jar]          public gift page (Transak widget)
/trip/[jar]          public group trip page (join flow)
```

## Contract instructions
```
createJar            SOL jar
createUsdcJar        USDC jar (creates ATA vault)
deposit              SOL deposit (real system_program transfer)
depositUsdc          USDC deposit from user wallet
giftDepositUsdc      USDC deposit from server (Transak/onramp)
giftDeposit          SOL gift (legacy compat)
withdrawUsdc         withdraw USDC after unlock
unlockJar            check unlock conditions
recordMarinadeStake  update staking_shares (called by backend after SDK stake)
setKaminoObligation  store Kamino obligation pubkey
createQuest          create spending quest
approveQuest         approve quest payout
setSpendingLimit     set daily/weekly limits
emergencyWithdraw    emergency unlock
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
- Kamino mainnet market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
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
