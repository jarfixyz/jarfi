# 🏺 JAR — Save for what matters.

> On-chain vaults with yield. Any goal. Everyone included.

**[jarfi.xyz](https://jarfi.xyz) · Built on Solana · Colosseum Frontier 2026**

---

## The Problem

In traditional banking, structured savings products exist — term deposits, goal accounts, family savings plans with conditions and schedules. They're imperfect, but the concept is proven: lock money for a purpose, earn yield, share access with family.

On-chain, this doesn't exist in a consumer-friendly form.

There's no product that lets you create a vault with APY, set unlock conditions, and allow anyone — including people with no crypto experience — to top it up in two taps. JAR brings this to Solana.

---

## The Solution

JAR is an on-chain savings app. Create a jar, set a goal and an unlock date — and every deposit auto-stakes to earn yield. Anyone can contribute: family, friends, anyone with a card. No wallet required to send money in.

The result is a savings product that works like a family savings account — except it's transparent, on-chain, and earns real yield.

---

## Real Example: Saving for a Child

## 🧒 Real Example: Saving for a Child

Most money saved for children never actually gets saved.

Here's what usually happens — and what JAR changes.

---

### The Three Paths

**Path 1 — The Default**
Birthday money. Holiday envelopes. "We'll put it aside someday."
In reality: it gets spent. On groceries, on a bill, on nothing memorable.
Years pass. Your child turns 18.

**Result: ~$0**

---

**Path 2 — A Traditional Savings Account**
A parent opens a savings account. Deposits $50/month. Only they can add money — grandparents have no easy way in. Interest is ~0.5% APY. The money is technically there, but it barely moves.

**$50/month × 18 years at 0.5% APY → ~$11,400**

---

**Path 3 — A JAR**
A parent deposits $50/month. Grandma sends $100 on every birthday and holiday — two taps from a link, card payment, no registration, done. Auto-staking runs in the background at ~6.2% APY via Marinade Finance. Every contribution, every message, saved on-chain.

**$50/month + $200/year from family × 18 years → ~$22,800**

---

### The Numbers

| Who contributes | Traditional bank (0.5% APY) | JAR (~6.2% APY) |
|---|---|---|
| $50/month (parent only) | ~$11,400 | **~$18,400** |
| $50/month + $200/year (family) | ~$12,600 | **~$22,800** |
| $100/month + $400/year (family) | ~$25,200 | **~$45,600** |
| $200/month + $400/year (family) | ~$46,800 | **~$85,000** |

> Estimates based on monthly compounding over 18 years.

The difference isn't a rounding error.
It's a first apartment deposit vs. a weekend trip.

---

### How the unlock works

Funds are locked on-chain — enforced by the smart contract — until **you decide the moment has come**. That can be:

- 📅 **A date** — the child's 18th birthday. Set it once, the contract handles the rest.
- 🎯 **A goal amount** — "when we hit $10,000, we're going to Japan." Balance reaches the target → the jar unlocks automatically.
- 🔐 **Multi-sig** — if two parents are set as co-owners, any early unlock requires **both signatures**. No one can break the jar alone.

On the unlock date: one push notification. Full summary — total saved, breakdown by every contributor, every message left over the years, total staking earnings. One tap sends everything to the child's wallet. Automatic. On-chain.

---

### What this actually feels like

You set it up once. Every month it runs quietly.

Grandparents don't need a crypto wallet. They don't need to understand Solana. They open a link, write an amount, add "Happy Birthday Anya 🎂", pay by card. That's it.

Years later, your child opens an app and sees:

> *$34,000. From 47 contributions. From 6 people who loved you.*

**That's not a savings account. That's a time capsule with compound interest.**
---

## Features

### 🔒 Time-locked Vaults
Funds locked on-chain until the chosen unlock date. The smart contract enforces it.

### 📈 Auto-staking Yield
Every deposit immediately starts earning yield (via Marinade Finance or Kamino — integration TBD). No user action required. Interest compounds automatically.

### 👥 Anyone Can Contribute
Share a link. Anyone opens `jarfi.xyz/gift/anya`, pays by regular card, leaves a message. Like topping up a phone — two taps, done. No wallet, no registration, no crypto knowledge needed.

### ✅ Quest Rewards
Parent creates recurring tasks with rewards: *"Weekly homework — $3."* Every Sunday a push arrives. One tap confirms — payment goes on-chain instantly. Allowance, automated.

### 💳 Child Spending Card
Separate spending balance (not the locked jar). Virtual Solana card via Avici or Kast (partnership in progress). Parent sets daily and weekly limits. Every transaction sends a push to the parent.

### 📊 Dashboard + Mobile Apps
Full real-time overview on web and mobile: balance chart, yield forecast, contributor feed with messages, spending card controls. iOS and Android.

---

## Jar Modes

| Mode | Use Case |
|------|----------|
| 👧 **For a Child** | Long-term savings with time-lock, quests, spending card |
| ✈️ **Group Jar** | Shared goal — trip, gift, family round |
| 🎁 **Gift Jar** | One-time collection for an event |
| 🏦 **Solo Jar** | Personal goal with auto-yield and time-lock |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solana + Anchor |
| Staking / Yield | Marinade Finance or Kamino (TBD) |
| Mobile | React Native + Expo (iOS + Android) |
| Web dashboard | Next.js + Recharts |
| Push notifications | Firebase Cloud Messaging via Expo |
| Onramp | MoonPay SDK (fiat → USDC) |
| Spending card | Avici / Kast (partnership in progress) |
| Wallet | Phantom via Solana Wallet Adapter |
| RPC | DoubleZero node |
| Child wallet | Custodial — generated at jar creation, controlled by parent |

---

## Project Structure

```
jarfi/
├── contracts/     # Anchor smart contracts
├── app/           # React Native + Expo mobile app
├── web/           # Next.js dashboard (jarfi.xyz/dashboard)
├── backend/       # Node.js API + Firebase functions
└── docs/          # Architecture, pitch deck
```

---

## Live Demo

- **Dashboard:** [jarfi.xyz/dashboard](https://jarfi.xyz/dashboard) *(interactive mockup)*
- **Gift page example:** `jarfi.xyz/gift/anya`

---

## Team

Built by [@jarfixyz](https://twitter.com/jarfixyz) · [Superteam Ukraine](https://superteam.fun/ukraine)

---

## Links

- 🌐 [jarfi.xyz](https://jarfi.xyz)
- 🐦 [@jarfixyz](https://twitter.com/jarfixyz)
- 🏆 [Colosseum Frontier 2026](https://colosseum.com/frontier)
