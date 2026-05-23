# @jarfi/sdk

TypeScript client for the jarfi Solana program. Used by the Cloudflare Worker
indexer (Plan 2) and the Next.js frontend (Plans 3 and 4).

## Usage

```ts
import { Connection } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { JarfiClient, deriveJarPda } from "@jarfi/sdk";

const client = new JarfiClient(new Connection(rpcUrl), wallet);

await client.initUserState(owner);
await client.createJar(owner, new BN(0), {
  jarType: "flexible",
  asset: "sol",
  goalAmount: new BN(3_000_000_000),
  unlockTimestamp: new BN(0),
  metadataUri: "ipfs://bafy/...",
  metadataHash: new Uint8Array(32),
});

const [jar] = deriveJarPda(owner, new BN(0));
await client.contributeSol(donor, jar, new BN(1_000_000_000));
await client.withdraw(owner, jar);
```

## Modules

- `constants` — program ID, PDA seeds, protocol limits
- `pdas` — pure functions deriving each PDA address
- `types` — TypeScript mirrors of on-chain account structs
- `client` — `JarfiClient` ergonomic wrapper around `anchor.Program`
- `events` — `parseLogs` for indexer consumption

## Jar IDs

Each user has a `UserState` PDA holding a monotonic `jarCount`. New jars are
derived from the current count, so the next jar ID is always
`fetchUserJarCount(owner)`. Callers should read this before constructing a
`createJar` call.

## Tests

```bash
pnpm -F @jarfi/sdk test
```
