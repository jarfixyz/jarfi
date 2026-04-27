# JAR — Master Checklist
> Last updated: 2026-04-26

---

## Smart Contract (`jarfi-contract`)
Program ID: `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW` · Solana devnet

- [x] `create_jar` — mode 0/1/2, goal_amount, unlock_date, child_wallet
- [x] `deposit` — adds to balance
- [x] `gift_deposit` — stores Contribution account (jar, contributor, amount, comment)
- [x] `unlock_jar` — mode 0 (date), mode 1 (goal), mode 2 (either/first)
- [x] `emergency_withdraw` — owner bypasses all conditions
- [x] 14 tests passing
- [ ] **Marinade CPI** — staking_shares is a mock, no real Marinade calls
- [ ] **Multisig** — not in contract

---

## Backend (`jarfi-backend`)
Node.js / Express · `https://jarfi.up.railway.app`

- [x] `POST /jar/create` → on-chain createJar
- [x] `GET /jar/:pubkey` → fetch Jar + Contributions from devnet
- [x] `POST /transak-webhook` → JWT verify → gift_deposit on-chain
- [x] **Deployed on Railway** — auto-deploys from `main` branch (`jarfi-backend/` root)
- [x] `NEXT_PUBLIC_BACKEND_URL` = `https://jarfi.up.railway.app` → set in Cloudflare Pages ✅
- [ ] **`TRANSAK_API_SECRET`** → set in Railway env vars (Partner Access Token from Transak dashboard) ← TODO tomorrow

---

## Web (`jarfi-web`)
Next.js 15 · Live at jarfi.xyz · Cloudflare Pages

- [x] Landing page
- [x] Dashboard — wallet connect (Phantom, Solflare)
- [x] Live jar fetches by owner wallet (PDA reads via Anchor)
- [x] Create jar modal → browser wallet signs `createJar`
- [x] Gift page — `jarfi.xyz/gift/[slug]` — Transak widget (card/Apple Pay → USDC on Solana)
- [x] Gift page reads real jar data from on-chain when slug is a Solana pubkey
- [x] Contributors / activity feed (live Contribution account fetches)
- [x] Deployed at jarfi.xyz with git auto-deploy (Cloudflare Pages)
- [x] `NEXT_PUBLIC_BACKEND_URL` = `https://jarfi.up.railway.app` → set in Cloudflare Pages ✅
- [x] `NEXT_PUBLIC_TRANSAK_API_KEY` → set in Cloudflare Pages ✅
- [x] `NEXT_PUBLIC_ENV` = `staging` → set in Cloudflare Pages ✅
- [x] Marinade APY — real from API (6.85%), gift page fetches live
- [ ] **Push notifications** — not started

---

## Mobile (`jarfi-mobile`)
> ❌ Out of hackathon scope — skipped

---

## DoubleZero RPC
> Mention only — add "Powered by DoubleZero" to README, no code changes needed

---

## Post-hackathon
- [ ] Multisig co-owner (contract + web + mobile)
- [ ] Real Marinade CPI integration
- [ ] Spending card (Avici / Kast)
- [ ] Quest / allowance automation
- [ ] Mainnet + OtterSec audit
- [ ] App Store / Play Store
- [ ] KYC / custodial child wallets

---

## Priority order — hackathon focus
```
1. ✅ Transak fiat onramp — TransakWidget, GiftClient, /transak-webhook
2. ✅ Backend deployed on Railway — jarfi.up.railway.app

3. TODO TOMORROW — Set 3 env vars in Cloudflare Pages:
   NEXT_PUBLIC_BACKEND_URL=https://jarfi.up.railway.app
   NEXT_PUBLIC_TRANSAK_API_KEY=06d758b0-ea53-47fe-934d-7940a975ed67
   NEXT_PUBLIC_ENV=staging
   → Then set TRANSAK_API_SECRET in Railway env vars

4. Verify gift page + wallet connect work on jarfi.xyz

5. Marinade — show real APY from Marinade API

6. README — add "Powered by DoubleZero" mention

7. UI polish before submission
```
