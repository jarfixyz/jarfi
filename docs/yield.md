# Yield & Staking

Jarfi automatically puts your savings to work. Here's how it works.

---

## What is yield?

When you deposit USDC into a Jarfi jar, the funds are automatically staked in **Kamino Finance** — a leading DeFi lending protocol on Solana.

Kamino lends your USDC to other users who pay interest. That interest flows back to you as yield (APY).

You don't need to do anything — it happens automatically when funds arrive.

---

## Current APY

| Asset | Protocol | Est. APY |
|-------|----------|----------|
| USDC | Kamino Lend | ~4–8% (live rate) |
| SOL | Marinade Finance | ~6.85% |

The dashboard shows the live rate fetched from DeFi Llama. APY fluctuates based on market conditions.

---

## How yield accrues

- Yield is calculated continuously based on the principal in the jar
- It compounds over time — the longer the jar is locked, the more it earns
- The projected balance at unlock date is shown on each jar's detail view

**Formula:** `balance × (1 + APY)^years`

---

## When do I receive the yield?

The yield is added to your USDC balance when you withdraw (break the jar). You receive the principal plus all accumulated yield in one transaction.

---

## Kamino Finance

[Kamino](https://kamino.finance) is a Solana DeFi protocol with over $500M TVL. It provides permissionless USDC lending with competitive interest rates.

Jarfi uses Kamino's public SDK to deposit and withdraw funds on your behalf via the server keypair.

---

## Risks

- **Smart contract risk:** Kamino and Jarfi contracts are open source but not yet audited. Use amounts you're comfortable with.
- **APY variability:** Yield rates change with market conditions. Past rates don't guarantee future returns.
- **Devnet:** During beta, all transactions are on Solana devnet with test USDC — no real money.
