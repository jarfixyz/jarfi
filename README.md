# 🏺 JAR — Save together. Lock it. Grow it.

**jarfi.xyz** · Built on Solana · [Colosseum Frontier 2026](https://colosseum.com/frontier)

---

## What is JAR?

JAR is a savings jar you share with people you love.

Create a jar, set your unlock condition, share a link — anyone contributes by card, no crypto needed. Funds lock on-chain and earn passive yield via Marinade Finance. When the condition is met, the jar unlocks automatically.

---

## Two kinds of jar

**⚡ Quick jar** — Save for something specific. A motorcycle, a trip, a group gift. Set a goal amount, a deadline, or both. Smart contract unlocks automatically when the condition is met.

**🌱 Long jar** — Save for years. A newborn's future, a child's 18th birthday, a first apartment. Family contributes from anywhere in the world. Staking compounds quietly in the background.

Same product. Same mechanic. Different timescale.

---

## Unlock conditions

When creating a jar, you choose how it unlocks:

| Type | How it works |
|---|---|
| **By goal** | Unlocks automatically when balance reaches the target amount |
| **By date** | Unlocks automatically on the date you set |
| **Goal OR date** | Unlocks at whichever comes first — hit $5,000 early, it opens early |

The smart contract checks and triggers unlock automatically. No manual action needed.

---

## Jar creation flow

```
"Create jar"
      ↓
What's the unlock condition?
  ├── 🎯 Goal amount  (e.g. $5,000 for a motorcycle)
  ├── 📅 Date         (e.g. child's 18th birthday)
  └── 🎯+📅 Both      (whichever comes first)
      ↓
Set jar name + optional description
      ↓
Multisig? (optional — available on any jar type)
  └── Add co-owner wallets (e.g. both parents, group of friends)
      ↓
Jar created on-chain → share link
```

**Multisig** is available on any jar type. When enabled, unlocking requires approval from all co-owners. Useful for family jars where both parents should confirm, or group jars with shared ownership.

---

## The flow

```
Create jar → choose unlock condition (goal / date / both)
     ↓
Share link → anyone pays by card (no crypto, no registration)
     ↓
Funds lock on-chain + auto-stake via Marinade
     ↓
Yield accrues passively
     ↓
Condition met → smart contract unlocks automatically
     ↓
Push notification → contributor summary → balance released
```

---

## Real scenarios

**Motorcycle fund** — You want a motorcycle, it costs $5,000. Create a quick jar, set goal = $5,000, add a 6-month deadline as backup. Friends chip in for your birthday, you top it up monthly. The day the balance hits $5,000 — unlocks automatically. No waiting for the date.

**Birthday collection** — Friends want to pool money for a gift. One person creates a jar, sets a $300 goal and the date of the party. Everyone pays by card from the group chat link in 30 seconds. No Venmo math, no one fronting the money, no awkward follow-ups.

**Newborn jar** — Parents create a jar on day one. Unlock date = child's 18th birthday. Optional: multisig so both parents must approve. Anyone opens the link and contributes $20–$200 by card, leaving a personal message. Over 18 years, deposits + family contributions + Marinade staking compound into a meaningful sum. On the 18th birthday: one push notification, full contributor summary, one transfer.

---

## Why it works

| Problem | JAR |
|---|---|
| Savings earn nothing (<0.5% APY) | Auto-staking via Marinade (~6% APY, variable) |
| Family can't easily contribute | Anyone pays by card via shareable link |
| Funds get spent before the goal | Locked on-chain until condition is met |
| Manual unlock is a hassle | Smart contract triggers automatically |
| Shared jars need shared control | Optional multisig for any jar type |

---

## Yield — honest framing

JAR uses **Marinade Finance** for liquid staking on Solana. Current APY is approximately 6%, variable and not guaranteed.

- Yield comes from Solana validator rewards via Marinade's liquid staking
- APY fluctuates with network conditions — shown live in the app
- Smart contract not yet audited (OtterSec planned post-hackathon)
- Devnet only for hackathon; mainnet after audit
- Emergency withdrawal available to creator at all times

JAR is not a bank. Deposits are not insured. Only deposit what you're comfortable locking.

---

## Trust & custody

- **Who controls funds:** Jar creator (+ co-owners if multisig). Funds go to the on-chain vault, not to JAR.
- **Who triggers unlock:** Smart contract automatically when condition is met. Creator can trigger emergency withdrawal anytime.
- **If JAR disappears:** Contract is autonomous. Funds stay on-chain, accessible via direct contract interaction.
- **Contributions:** Non-revocable once sent.
- **Multisig unlock:** Requires all co-owners to approve before funds are released.

---

## Tech stack

| Layer | Tech |
|---|---|
| Blockchain | Solana |
| Smart contracts | Anchor framework |
| Staking | Marinade Finance |
| Mobile | React Native / Expo (iOS + Android) |
| Web dashboard | Next.js |
| Fiat onramp | MoonPay (min $10, no registration) |
| RPC | DoubleZero network |
| Push notifications | Firebase / Expo Push |

---

## Repo structure

```
jarfi/
├── jarfi-contract/       # Anchor smart contracts (Solana)
│   ├── programs/
│   └── tests/
├── jarfi-mobile/         # React Native + Expo (iOS + Android)
│   ├── screens/
│   └── components/
└── jarfi-web/            # Next.js landing + dashboard + gift page
    ├── app/
    └── components/
```

---

## Hackathon MVP scope

**In scope:**
- Jar creation with unlock type: goal / date / goal+date (first of two)
- Optional multisig co-owner on any jar
- Smart contract: create, deposit, gift_deposit, auto-unlock on condition, emergency_withdraw
- Marinade staking integration
- Mobile: create jar flow, jar detail, activity feed, push notifications
- Web dashboard: balance chart, staking forecast, contributors feed
- Gift page: jarfi.xyz/gift/[slug] with MoonPay widget
- DoubleZero RPC for all transactions

**Post-hackathon roadmap:**
- Spending card integration (Avici / Kast)
- Quest / allowance automation for children
- Mainnet deployment + OtterSec audit
- iOS / Android App Store submission
- KYC / custodial setup for child wallets

---

## Links

- **Demo:** [jarfi.xyz/dashboard](https://jarfi.xyz/dashboard)
- **Gift page example:** [jarfi.xyz/gift/anya](https://jarfi.xyz/gift/anya)
- **Colosseum:** [colosseum.com/frontier](https://colosseum.com/frontier)

---

*JAR is a hackathon project. Not financial advice. Smart contract not yet audited. Use at your own risk.*
