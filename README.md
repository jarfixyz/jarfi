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

A parent creates a jar for their newborn. They deposit $50/month. Grandparents top it up on birthdays and holidays — two taps from a link, pay by card, done. Staking runs in the background.

Money that would have been spent on gifts becomes a real financial head start.

| Contribution | At 18th birthday |
|---|---|
| $50 / month | **~$18,400** |
| $100 / month | **~$34,200** |
| $200 / month | **~$65,800** |

*Estimates based on ~6% APY, compounded over 18 years.*

vs. the same money sitting in a 0.5% savings account — or spent on forgotten gifts.

On the unlock date: one notification, full summary of every contributor and message, funds released to the child's wallet. Automatic. On-chain.

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
