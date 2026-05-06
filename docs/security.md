# Security

---

## Non-custodial

Jarfi is **non-custodial** — we never hold your funds. All USDC is held in a smart contract on Solana. Only you (or the conditions you set) can unlock the jar.

Jarfi cannot:
- Move funds from your jar
- Change your unlock conditions
- Access your wallet seed phrase

---

## Smart contract

The Jarfi contract is written in Rust using the Anchor framework and deployed on Solana.

**Program ID (devnet):** `HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW`

Source code: [github.com/jarfixyz/jarfi](https://github.com/jarfixyz/jarfi)

The contract enforces:
- Unlock conditions (date and/or goal)
- USDC vault ownership (only the vault authority PDA can move funds)
- Contribution recording

---

## Server wallet

Jarfi uses a server-side keypair to:
- Create jars on behalf of users (as the jar owner)
- Process incoming Transak payments (move USDC from server wallet → jar vault)

The server wallet **never has access to your jar's USDC** — it can only deposit into vaults, not withdraw. Withdrawals require your wallet signature.

---

## Seed phrase

Your wallet seed phrase is never seen by Jarfi. If you lose your seed phrase, you lose access to your wallet and your jars. Store it safely offline.

---

## Devnet vs Mainnet

During beta, Jarfi runs on **Solana devnet** — a test network with no real money. All USDC is test USDC with no real value.

Mainnet launch will require a separate wallet setup and real USDC.

---

## Audit status

The Jarfi smart contract has **not been audited** by a third party. Use at your own risk, and only deposit amounts you are comfortable losing. A security audit is planned before mainnet launch.
