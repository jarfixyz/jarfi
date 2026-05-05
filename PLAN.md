# Jarfi — Master Plan
> Last updated: 2026-05-05
> Hackathon: Colosseum Frontier · Deadline: May 11, 2026

---

## Current status

**Live:** [jarfi.xyz](https://jarfi.xyz) · Backend: [jarfi.up.railway.app](https://jarfi.up.railway.app)

**Stack**
- Contract: Anchor (Rust) · Solana devnet · `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`
- Backend: Node.js/Express · Railway (auto-deploy from `main`)
- Web: Next.js 15 · Cloudflare Pages (`npm run deploy` → jarfi.xyz)
- RPC: GetBlock.io devnet `https://go.getblock.us/6ec82c00025b49dd90266ca1d4a03596`
- Onramp: Transak staging · card/Apple Pay → USDC on Solana
- Yield: Kamino Lend (USDC ~8% APY) · Marinade (SOL ~6.85% APY)

---

## What's done ✅

### Smart Contract
- [x] `create_jar` (mode 0/1/2), `create_usdc_jar`
- [x] `deposit`, `deposit_usdc`, `gift_deposit`, `gift_deposit_usdc`
- [x] `unlock_jar` — mode 0 (date), 1 (goal), 2 (either/first)
- [x] `withdraw_usdc`, `emergency_withdraw`
- [x] `record_marinade_stake`, `set_kamino_obligation`
- [x] 14/14 tests passing

### Backend
- [x] `POST /jar/create` — USDC + SOL modes
- [x] `GET /jar/:pubkey` — on-chain state + Kamino yield + jar meta
- [x] `GET /apy` — live Kamino + Marinade APY
- [x] `POST /transak-webhook` — JWT verify → gift_deposit_usdc on-chain
- [x] Kamino auto-stake after deposit (async)
- [x] Marinade auto-stake for SOL jars (async)
- [x] Jupiter swap USDC→SOL for SOL jar deposits
- [x] `POST/GET/DELETE /schedule/*` — recurring reminder engine (node-cron)
- [x] `POST /push/subscribe`, `GET /push/vapid-public-key` — web push
- [x] `POST/GET /group/*` — group trip data model
- [x] Webhook dedup by `transakOrderId || partnerOrderId`
- [x] Staking failures log as `console.error` (visible in Railway logs)
- [x] `jarType` stored in SQLite meta, returned in GET /jar/:pubkey
- [x] Server wallet: `GRNxkJZDookw7zzauJ87EqE6NFfFro3Sf2Mujk99cyTs` (persistent)

### Web
- [x] Landing page (jar3-3 design)
- [x] Dashboard — wallet-only auth (Phantom, Solflare)
- [x] **Jar type system** — `lib/jarTypes.ts`: Goal, Date, Goal by Date, Shared
- [x] **Create flow** — type picker → per-type wizard (name → goal → date → reminder → security → review)
  - Goal Jar: goal required, date optional
  - Date Jar: date required, family approval step
  - Goal by Date: both required, suggested monthly amount
  - Shared Jar: goal/date optional, creator withdraws anytime
  - Guide Me: 2-question flow → recommended type
- [x] Monthly contribution reminders (not "auto-deposit" — user approves every payment)
- [x] Family approval UI — invite link (frontend only; onchain enforcement is post-hackathon)
- [x] Dashboard jar cards — type badge (🎯📅🏁🎁), SHARED hides progress bar without goal
- [x] Gift page — type badge, progress bar only for Goal/GoalByDate, goal-reached banner
- [x] Gift page — Transak widget (card/Apple Pay → USDC)
- [x] Contributors / activity feed
- [x] Push notifications — service worker, confirm banner with manual/auto distinction
- [x] Group Trip page (`/trip/[jar]`)
- [x] Deploy: `npm run deploy` → **jarfi.xyz** (--branch main, production)

---

## Hackathon checklist (before May 11)

- [x] Registered on Colosseum
- [x] Pitch video
- [x] RPC → GetBlock.io (web + backend)
- [ ] **Demo video** — create jar → share link → gift → show yield
- [ ] **Weekly update post** on Colosseum
- [ ] **Superteam Ukraine** registration (up to $10k bonus)
- [ ] **Full regression test** — all 4 jar types on devnet
- [ ] **Fund server wallet** with devnet USDC (for recurring reminder flow)
- [ ] **Re-seed demo jars** after Railway redeploy: `POST /jar/meta` for anya/japan/moto
- [ ] **README update** — add new jar types, family approval, reminder wording

---

## Known issues (not blocking hackathon)

| Issue | Status |
|-------|--------|
| Vault balance vs on-chain mismatch for display | Low priority |
| VAPID vars must be in Railway service vars (not shared) | Check Railway logs |
| Transak: staging API key only | Needs production key for real payments |
| SQLite on Railway: no persistent volume | Data lost on redeploy → re-seed demo jars |
| Marinade devnet: SDK compatibility unverified | SOL jars only |
| Server wallet: needs devnet USDC | Fund for recurring reminder demo |

---

## Mainnet plan (target: May 7–8)

1. Deploy contract: `cd jarfi-contract && anchor deploy --provider.cluster mainnet`
2. Update `PROGRAM_ID` in `jarfi-web/lib/program.ts` + `jarfi-backend/index.js`
3. Railway env: `SOLANA_NETWORK=mainnet`, `SOLANA_RPC_URL=<getblock mainnet>`, `DB_PATH=/data/jarfi.db`
4. Set Railway **persistent volume** for SQLite (`DB_PATH=/data/jarfi.db`)
5. Transak production API key: `NEXT_PUBLIC_ENV=production`
6. GetBlock.io **mainnet** endpoint in `.env.local` → rebuild + deploy
7. Fund mainnet server wallet with real SOL + USDC
8. Smoke test all 4 jar types on mainnet

---

## Post-hackathon roadmap

### Contract
- [ ] Dedicated SHARED_JAR mode (currently: mode=0, unlockDate=1)
- [ ] Multisig / co-signer enforcement for family approval
- [ ] `partial_withdraw_usdc` for group jars
- [ ] OtterSec audit before mainnet public launch

### Product
- [ ] Image upload — jar cover image (Cloudflare R2 or similar)
- [ ] Co-signer invite → wallet connect → onchain approval
- [ ] Email notifications (requires user email field)
- [ ] Transak offramp — USDC → EUR/UAH to bank card
- [ ] Solana Pay QR — spend from jar in store
- [ ] Mobile app (Solana Mobile)
- [ ] Virtual card (Avici / Kast)

### Infrastructure
- [ ] PostgreSQL or persistent SQLite volume (no data loss on redeploy)
- [ ] KYC (Sumsub) for large withdrawals
- [ ] Multisig treasury (Squads Protocol) for group jars

---

## Jar type → contract mapping

| Jar Type | Contract mode | unlockDate | Notes |
|----------|--------------|------------|-------|
| Goal Jar | 1 | 0 (or optional) | Unlocks when goal reached |
| Date Jar | 0 | required | Unlocks on date |
| Goal by Date | 2 | required | Unlocks on goal OR date, first |
| Shared Jar | 0 | 1 (epoch past) | Unlock succeeds immediately → withdraw anytime |

---

## Deploy commands

```bash
# Web → jarfi.xyz (production)
cd jarfi-web && npm run deploy

# Backend → Railway (auto from main push)
git push origin main

# Contract
cd jarfi-contract && anchor build && anchor deploy
```
