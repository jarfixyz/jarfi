# JAR — Implementation Plan

> Last updated: 2026-04-23
> Hackathon: Colosseum Frontier 2026

---

## Current status

| Repo | Status | Notes |
|---|---|---|
| `jarfi-contract` | ~80% done | Missing: `goal_amount` field, goal-mode unlock, `emergency_withdraw` |
| `jarfi-backend` | Stub only | One endpoint — generates a keypair, port 3000 |
| `jarfi-web` | UI 100%, data mocked | MoonPay webhook is a placeholder |
| `jarfi-mobile` | Not started | Default Expo template |

---

## Dependency order

```
Phase 1 — Contract (fix gaps)
        ↓
Phase 2 — Backend  ←→  Phase 3a-b — Web wallet + reads   [parallel]
        ↓
Phase 3c-e — Web create / gift / feed
        ↓
Phase 4 — Mobile   [4a-b design system can start parallel with Phase 3]
        ↓
Phase 5 — DoubleZero RPC (last)
```

---

## Phase 1 — Contract (`jarfi-contract`)

> Do this first. Everything downstream depends on the contract being feature-complete.

- [x] **1a** — Add `goal_amount: u64` to `Jar` struct and `create_jar` instruction args
- [x] **1b** — Fix `unlock_jar` to support goal-based and combined unlock modes
  - `mode = 0` → date only (current behavior)
  - `mode = 1` → goal only: unlock when `balance >= goal_amount`
  - `mode = 2` → either/first: unlock when date passed OR balance >= goal
- [x] **1c** — Add `emergency_withdraw` instruction (owner bypasses unlock, withdraws anytime)
- [x] **1d** — Add tests for goal unlock and emergency withdraw

---

## Phase 2 — Backend (`jarfi-backend`)

- [x] **2a** — Replace keypair stub with real `createJar` on-chain call, return jar pubkey
- [x] **2b** — `GET /jar/:pubkey` → fetch Jar account from devnet, return balance/status/contributors
- [x] **2c** — Move MoonPay webhook here (from `jarfi-web`): verify signature → call `gift_deposit` on-chain

---

## Phase 3 — Web on-chain integration (`jarfi-web`)

> 3a–3b can start in parallel with Phase 2

- [x] **3a** — Install `@solana/wallet-adapter-react` + wallets, add `WalletProvider` to `layout.tsx`, add connect button to dashboard
- [x] **3b** — Replace mock `JARS[]` with live PDA fetches by owner wallet
- [x] **3c** — Wire "Create Jar" modal → call `createJar` instruction on-chain
- [x] **3d** — Wire gift page → real MoonPay SDK; on settlement → backend webhook → `gift_deposit`
- [x] **3e** — Replace `ACTIVITY` + `CONTRIBUTORS` mock arrays with real `Contribution` account fetches

---

## Phase 4 — Mobile (`jarfi-mobile`)

> 4a–4b (design + screens) can start in parallel with Phase 3

- [ ] **4a** — Port JAR design system (colors, fonts) from `tailwind.config.js` to RN stylesheet, replace `constants/theme.ts`
- [ ] **4b** — Replace Expo boilerplate with JAR screens:
  - Tab 1: Dashboard (total balance, staking earned, jar list)
  - Tab 2: My Jars (cards with progress bars)
  - Screen: Jar detail (chart, contributors, gift link, unlock info)
  - Modal: Create jar flow
- [ ] **4c** — Add `@solana/mobile-wallet-adapter` for iOS/Android wallet connection
- [ ] **4d** — Expo Push Notifications (trigger on: gift received, jar unlocked, staking reward)

---

## Phase 5 — DoubleZero RPC

> Do last — everything else works on regular devnet first

- [ ] **5a** — Swap `clusterApiUrl('devnet')` with DoubleZero endpoint in `jarfi-web`
- [ ] **5b** — Same swap in `jarfi-mobile`

---

## Post-hackathon roadmap

- [ ] Spending card integration (Avici / Kast)
- [ ] Quest / allowance automation for child wallets
- [ ] Mainnet deployment + OtterSec audit
- [ ] iOS / Android App Store submission
- [ ] KYC / custodial setup for child wallets
