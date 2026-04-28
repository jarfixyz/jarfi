# JAR (jarfi.xyz) — Project Context

## What is this
Solana savings jar app. Users create on-chain vaults (jars), invite family to gift via credit card (Transak fiat onramp), funds earn yield via Kamino (USDC) or Marinade (SOL). Built for Solana Frontier Hackathon.

## Stack
- **Contract**: Anchor (Rust) · Solana devnet · Program `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`
- **Backend**: Node.js / Express · Railway (`https://jarfi.up.railway.app`)
- **Web**: Next.js 15 · Cloudflare Pages (`jarfi.xyz`) via `@cloudflare/next-on-pages` + wrangler
- **Onramp**: Transak (card/Apple Pay → USDC on Solana)
- **Yield**: Kamino Lend (USDC, ~8% APY) · Marinade (SOL, ~6.85% APY)
- **Swap**: Jupiter Terminal (embedded widget, Phase 3)

## Repo structure
```
jarfi/
├── jarfi-contract/   Anchor program
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
- Railway: `SERVER_WALLET_SECRET`, `TRANSAK_API_SECRET`, `SOLANA_RPC_URL`
- Cloudflare Pages: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_TRANSAK_API_KEY`, `NEXT_PUBLIC_ENV`

## Core primitives (Phase 1 — done)
- `jar_currency: u8` — 0=USDC, 1=SOL
- `usdc_balance: u64` — USDC micro-units (6 dec)
- `usdc_vault: Pubkey` — jar's USDC ATA (vault authority PDA = `[b"vault", jar.pubkey]`)
- `createUsdcJar` / `depositUsdc` / `withdrawUsdc` / `giftDepositUsdc` — on-chain instructions
- `GET /apy` — live Kamino + Marinade APY from backend

## Current status (2026-04-28)
- Phase 1 (USDC Foundation) — ✅ done
- Phase 2 (Kamino staking) — ✅ done
- Phase 3 (Jupiter Terminal swap widget) — ✅ done
- Phase 4 (Recurring deposits + push notifications) — ✅ done
  - 4A (schedule engine) — ✅ done
  - 4B (VAPID web push) — ✅ done
  - 4C (service worker + push permission in web) — ✅ done
  - 4D (UI: recurring toggle in create jar modal) — ✅ done
- Phase 5 (Group Trip jar) — ✅ done
- Transak API Secret — ✅ set in Railway
- Cloudflare Pages auto-deploy — ✅ fixed with jarfi-web/.npmrc (legacy-peer-deps=true)

## Phase 4A — what was done
- `jarfi-backend/scheduleService.js` — schedule engine:
  - `addSchedule({ jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute })` → builds cron expr, saves to `schedules.json`
  - `getSchedulesByOwner(owner_pubkey)` / `deleteSchedule(id)`
  - `savePushSubscription(owner_pubkey, subscription)` / `getPushSubscription(owner_pubkey)` → `push-subscriptions.json`
  - `startCronRunner(onFire)` — runs node-cron tasks, re-syncs every 60s
- New endpoints in `index.js`:
  - `POST /schedule/create` — body: `{ jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute }`
  - `GET /schedule/:owner_pubkey`
  - `DELETE /schedule/:id`
  - `POST /push/subscribe` — body: `{ owner_pubkey, subscription }`
- cron runner starts with server, placeholder callback (logs); Phase 4B will wire real VAPID push

## Phase 4B — what to do next
1. Generate VAPID keys: `npx web-push generate-vapid-keys` → add to Railway env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
2. In `scheduleService.js` or `index.js`: import `web-push`, configure with VAPID keys
3. Replace the placeholder `onFire` callback in `app.listen` with real `webpush.sendNotification(subscription, payload)`
4. Push payload: `{ title: "Час поповнити банку 🏺", body: "$10 → Jar abcd…1234", data: { jar_pubkey, amount_usdc } }`
5. `GET /push/vapid-public-key` — expose public key for frontend subscription

## Phase 4C — what to do next (web)
- `jarfi-web/public/sw.js` — service worker:
  - `push` event: show notification with "Підтвердити" / "Пізніше" actions
  - `notificationclick`: open `/dashboard?confirm=JAR_PUBKEY&amount=AMOUNT`
- `jarfi-web/lib/push.ts` — `subscribeToPush(ownerPubkey)`: registers SW, calls `Notification.requestPermission()`, calls `POST /push/subscribe`
- Dashboard: on wallet connect → call `subscribeToPush()`
- URL `/dashboard?confirm=...` → auto-open wallet pop-up for deposit

## Phase 4D — what to do next (web UI)
- In `NewJarModal` (dashboard/page.tsx): toggle "Регулярний внесок від мене"
- Fields: amount ($), frequency (weekly/monthly), day (1-28), time (HH:MM)
- Preview label: "Буду відкладати $100 кожного 5-го числа о 10:00"
- On jar create: also `POST /schedule/create`
- Dashboard section "Мої автовнески": `GET /schedule/:owner_pubkey` → list with "Зупинити" button

## Known issues
- Cloudflare Pages auto-deploy used to fail on peer-dep conflict — fixed with `.npmrc`
- Marinade CPI in contract is a mock (staking_shares field exists but no real CPI calls)
- Jupiter swap for SOL jars (when Transak sends USDC → needs swap before deposit) — TODO in backend
- `schedules.json` and `push-subscriptions.json` on Railway are ephemeral (reset on deploy) — fine for hackathon MVP

## Commands
```bash
# Local dev
cd jarfi-web && npm run dev

# Manual Cloudflare deploy (preferred)
cd jarfi-web && npm run deploy

# Backend local
cd jarfi-backend && node index.js

# Contract build + test
cd jarfi-contract && anchor build && anchor test
```

## USDC addresses
- Devnet USDC mint:  `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Mainnet USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Kamino Lend program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Kamino mainnet market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
