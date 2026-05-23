# Scripts

## deploy-devnet.ts

Deploys the compiled program to Solana devnet and initializes the protocol
config PDA with the current wallet as admin. The creation fee is set to 0
lamports and the withdraw fee to 250 bps (2.5%).

Prerequisites:
- `ANCHOR_WALLET` env var pointing at a funded Solana keypair (devnet SOL)
- `anchor build` has produced `target/idl/jarfi.json`
- `anchor deploy --provider.cluster devnet` has been run

Run:

    anchor deploy --provider.cluster devnet
    pnpm tsx scripts/deploy-devnet.ts

The script is idempotent: if the config PDA already exists it exits cleanly.
The deployed program ID is pinned in `packages/sdk/src/constants.ts`.
