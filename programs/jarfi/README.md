# jarfi Solana program

Anchor program for the jarfi savings service. Source of truth for the on-chain
state machine.

See `docs/superpowers/specs/2026-04-14-solana-jars-design.md` for the full
design.

## Instructions

| Instruction | Signer | Description |
|---|---|---|
| `initialize_config` | payer | One-time protocol bootstrap |
| `update_config` | admin | Toggle fees / pause / adjust rates |
| `propose_admin` / `accept_admin` | admin / new admin | Two-step admin handoff |
| `init_user_state` | user | One-time per user — holds `jar_count` |
| `create_jar` | user | Create a Flexible or TimeLocked jar (SOL or USDC) |
| `update_metadata` | jar owner | Rotate the off-chain metadata URI and hash |
| `contribute_sol` | anyone | Contribute lamports to a SOL jar |
| `contribute_spl` | anyone | Contribute tokens to a USDC jar |
| `withdraw` | jar owner | Withdraw to owner minus protocol fee |
| `cancel_jar` | jar owner | Cancel a TimeLocked jar before unlock |
| `refund` | jar owner | Refund a cancelled jar's contributors |
| `close_jar` | jar owner | Reclaim rent once a jar is fully settled |
| `withdraw_treasury` | admin | Drain accumulated fees from the treasury |

## Accounts

- `Config` (singleton) — admin, fees, pause flag
- `Treasury` (singleton) — system-owned PDA collecting protocol fees
- `UserState` (per user) — jar count
- `Jar` (per user + id) — jar state; SOL lamports live directly on the PDA
- `Contribution` (per donor + jar) — tracks donor total for refunds

## Tests

```bash
anchor test
```

39 tests cover every instruction plus two end-to-end integration flows.
