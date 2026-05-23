// One-shot migration: re-runs migrate_config_v2 to grow the existing devnet
// config from V2 (120 bytes) to V3 (Config::SIZE post-auto-stake = 217 bytes).
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

async function main() {
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

  const before = await conn.getAccountInfo(config);
  console.log("config size before:", before?.data.length);

  const sig = await program.methods
    .migrateConfigV2()
    .accounts({
      admin: admin.publicKey,
      config,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();
  console.log("sig:", sig);
  const after = await conn.getAccountInfo(config);
  console.log("config size after:", after?.data.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
