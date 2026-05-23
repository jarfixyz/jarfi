// One-shot admin tool: set Config.min_auto_stake_lock_days.
// Usage: pnpm exec tsx scripts/set-min-lock.ts <days>
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

async function main() {
  const days = parseInt(process.argv[2] ?? "0", 10);
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const keypairPath = process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/id.json`;
  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const conn = new Connection(rpc, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" });

  const idl = JSON.parse(readFileSync(resolve("target/idl/jarfi.json"), "utf8")) as Idl;
  const program = new Program(idl, provider);
  const programId = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

  const before: any = await program.account.config.fetch(config);
  console.log("min_auto_stake_lock_days before:", before.minAutoStakeLockDays);

  const sig = await program.methods
    .updateConfig(null, null, null, null, null, days)
    .accounts({ admin: admin.publicKey, config })
    .signers([admin])
    .rpc();
  console.log("sig:", sig);

  const after: any = await program.account.config.fetch(config);
  console.log("min_auto_stake_lock_days after:", after.minAutoStakeLockDays);
}

main().catch((e) => { console.error(e); process.exit(1); });
