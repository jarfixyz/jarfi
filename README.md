# jarfi

Onchain savings jars — save together, grow automatically.

**[jarfi.xyz](https://jarfi.xyz)**

---

## What is jarfi?

Jarfi lets you create savings jars on Solana. Set a goal or a date, invite anyone to contribute via card or Apple Pay, and watch your money earn yield automatically.

- **Shared jars** — one link, anyone contributes. No wallet, no sign-up required.
- **Gifting** — send a link in the family chat. Grandma pays by card, funds land onchain.
- **Automatic yield** — USDC earns ~8% APY via Kamino, SOL earns ~6.85% via Marinade.
- **Recurring deposits** — set it once, your jar tops up on autopilot.

---

## How it works

```
Create a jar → set goal or unlock date
      ↓
Share the link → anyone pays by card or Apple Pay
      ↓
Funds land onchain + auto-stake for yield
      ↓
Condition met → withdraw to any wallet or bank
```

---

## Jar types

| Type | Description |
|---|---|
| **Time-lock** | Unlocks on a set date — perfect for milestones (18th birthday, graduation) |
| **Goal** | Unlocks when balance reaches the target amount |
| **Goal + date** | Unlocks at whichever comes first |
| **Gift** | Share a link, collect contributions, no deadline required |

---

## Why it works

| Problem | jarfi |
|---|---|
| Savings earn nothing | Auto-staking via Kamino (~8% APY) and Marinade (~6.85% APY) |
| Family can't easily contribute | Anyone pays by card — no wallet, no registration |
| Funds get spent before the goal | Locked on-chain until unlock condition is met |
| Shared saving is hard to coordinate | One link, one jar, everyone contributes |

---

## Stack

| Layer | Tech |
|---|---|
| Contract | Anchor (Rust) · Solana |
| Backend | Node.js / Express · Railway |
| Web | Next.js 15 · Cloudflare Pages |
| Yield | Kamino Lend (USDC) · Marinade (SOL) |
| Swap | Jupiter V6 |

Program ID: `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`

---

## Repo structure

```
jarfi/
├── jarfi-contract/   Anchor smart contracts (Solana)
├── jarfi-backend/    Express API (Railway)
└── jarfi-web/        Next.js web app (Cloudflare Pages)
```

---

## In development

- Mobile app (Solana Mobile)
- Payment cards — spend directly from your jars

---

## Local dev

```bash
# Web
cd jarfi-web && npm install && npm run dev

# Backend
cd jarfi-backend && node index.js
```

## Deploy

```bash
# Web — Cloudflare Pages
cd jarfi-web && npm run deploy

# Backend — auto-deploys on Railway from main branch

# Contract
cd jarfi-contract && anchor build && anchor deploy
```

---

*Not financial advice. Smart contract not yet audited for mainnet.*
