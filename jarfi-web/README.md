# jarfi

Onchain savings jars — save together, grow automatically.

## What is jarfi?

Jarfi lets you create savings jars on Solana. Set a goal or a date, invite anyone to contribute via card or Apple Pay, and watch your money earn yield automatically through DeFi staking.

- **Shared jars** — anyone with a link can contribute. No wallet, no sign-up required.
- **Gifting** — send one link. Family and friends pay by card, funds land onchain instantly.
- **Automatic yield** — USDC earns ~8% APY via Kamino, SOL earns ~6.85% via Marinade.
- **Recurring deposits** — set it once, your jar grows on autopilot.

## Stack

| Layer | Tech |
|---|---|
| Contract | Anchor (Rust) · Solana |
| Backend | Node.js / Express · Railway |
| Web | Next.js 15 · Cloudflare Pages |
| Onramp | Card / Apple Pay → USDC on Solana |
| Yield | Kamino Lend (USDC) · Marinade (SOL) |

Program ID: `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`

## In development

- Mobile app (Solana Mobile)
- Payment cards — spend directly from your jars

## Local dev

```bash
cd jarfi-web && npm run dev
```

## Deploy

```bash
# Web — Cloudflare Pages (preferred over auto-deploy)
cd jarfi-web && npm run deploy

# Backend — auto-deploys on Railway from main branch (root: jarfi-backend/)

# Contract
cd jarfi-contract && anchor build && anchor deploy
```
