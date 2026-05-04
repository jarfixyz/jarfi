# jarfi

Onchain savings jars — save together, grow automatically.

**[jarfi.xyz](https://jarfi.xyz)**

---

## The idea

Most people save alone. They open a bank account, set up a transfer, and slowly watch the number grow — or not. The problem is that saving alone is hard. There's no accountability, no shared purpose, and certainly no excitement.

Jarfi flips this. You create a jar for something that matters — your child's future, a family trip, a friend's birthday gift — and share one link. Anyone with a phone can contribute in 30 seconds using their regular card or Apple Pay. No crypto wallet. No registration. Just tap, pay, done.

Meanwhile, the money isn't sitting idle. Every deposit automatically earns yield through onchain staking — around 8% APY for USDC, 6.85% for SOL. It compounds silently in the background until the jar unlocks.

---

## What is jarfi?

Jarfi lets you create savings jars on Solana. Set a goal or a date, invite anyone to contribute via card or Apple Pay, and watch your money earn yield automatically.

- **Shared jars** — one link, anyone contributes. No wallet, no sign-up required.
- **Gifting** — send a link in the family chat. Grandma pays by card, funds land onchain.
- **Automatic yield** — USDC earns ~8% APY via Kamino, SOL earns ~6.85% via Marinade.
- **Recurring deposits** — set it once, your jar tops up on autopilot.

---

## Real scenarios

**Eva's 18th birthday.** A parent creates a jar the day Eva is born. Unlock date: January 2034. They share the link with grandparents, aunts, family friends. Over 10 years, small contributions from a dozen people — $25 here, $100 at Christmas — compound at 8% APY. By the time Eva turns 18, the jar holds $38,000+. One push notification, one withdrawal.

**Japan trip.** Four friends want to save for a trip together. One creates a goal jar: $4,000, split four ways. Each sets up a recurring monthly deposit. Progress is visible. The jar unlocks the moment the goal is hit — no waiting, no manual transfers between group members.

**Birthday collection.** Twenty colleagues want to pool money for a gift. One person creates a jar, shares the link in Slack. Everyone pays $15–$50 by card during lunch. The money is collected, on-chain, in minutes. No spreadsheets, no Venmo requests, no one fronting the full amount.

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

Contributors need nothing — no wallet, no account. They open a URL, pick an amount, and pay. The conversion from fiat to USDC happens automatically. The jar owner controls the funds; contributors can track progress through the same link.

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

*Not financial advice. Smart contract not yet audited for mainnet.*
