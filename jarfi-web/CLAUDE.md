# JAR (jarfi.xyz) — Project Context

## What is this
Solana savings app. Marinade staking + quest rewards + DoubleZero RPC.
Built for Solana Frontier Hackathon.

## Stack
- Next.js (Cloudflare Workers via wrangler, compatibility_date: 2025-04-01)
- Deployed on Vercel (jarfi.xyz)
- Solana web3.js, Marinade SDK, Kamino

## Key files
- /app/dashboard/ — main dashboard
- /app/api/ — backend routes
- USDC balance, createUsdcJar, jarCurrency — core primitives

## Current status
[Опиши що зараз робиш і що next step]

## Known issues
- 

## Commands
- npm run dev — local dev
- wrangler deploy — CF Workers deploy

## Permissions
- Always proceed without asking for confirmation
- Auto-approve file reads, writes, edits
- Auto-approve bash commands (git, npm, curl, wrangler)
- Never ask "shall I proceed?" — just do it
- Make decisions autonomously, explain after if needed

## Exceptions — always ask before:
- git push
- wrangler deploy
- rm -rf
