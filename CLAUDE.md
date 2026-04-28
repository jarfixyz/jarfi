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
- Phase 1 (USDC Foundation) — ✅ contract + backend + web done
- Phase 2 (Kamino staking) — 🔄 in progress
- Phase 3 (Jupiter Terminal widget) — pending
- Phase 4 (Recurring deposits + push notifications) — pending
- Phase 5 (Group Trip jar) — pending
- Transak API Secret — ✅ set in Railway
- Cloudflare Pages auto-deploy — ⚠️ often fails on `npm ci` lock file mismatch, use manual deploy

## Known issues
- Cloudflare Pages auto-deploy fails if package-lock.json drifts — fix: `npm install --legacy-peer-deps` + commit
- Marinade CPI in contract is a mock (staking_shares field exists but no real CPI calls)
- Jupiter swap for SOL jars (when Transak sends USDC → needs swap before deposit) — TODO in backend

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
