import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Jarfi } from "../target/types/jarfi";

const PROGRAM_ID = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const keypairPath =
    process.env.ANCHOR_WALLET ?? resolve(homedir(), ".config/solana/id.json");

  const admin = loadKeypair(keypairPath);
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(
    readFileSync(resolve(__dirname, "../target/idl/jarfi.json"), "utf8"),
  );
  const program = new Program<Jarfi>(idl, provider);

  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  );

  const before = await connection.getAccountInfo(config);
  if (!before) throw new Error(`config ${config.toBase58()} not found`);
  console.log("Config before:", {
    address: config.toBase58(),
    dataLen: before.data.length,
    lamports: before.lamports,
  });
  if (before.data.length !== 88) {
    console.log("Config already at v2 size, skipping migration.");
    return;
  }

  const tx = await program.methods
    .migrateConfigV2()
    .accounts({
      admin: admin.publicKey,
      config,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  console.log("Migration tx:", tx);
  console.log(
    "Next: run `pnpm tsx scripts/set-usdc-mint.ts` to set allowed_usdc_mint via update_config.",
  );

  const after = await connection.getAccountInfo(config);
  console.log("Config after:", {
    dataLen: after?.data.length,
    lamports: after?.lamports,
  });

  const cfg = await program.account.config.fetch(config);
  console.log("Decoded config:", {
    version: cfg.version,
    admin: cfg.admin.toBase58(),
    allowedUsdcMint: cfg.allowedUsdcMint.toBase58(),
    creationFeeLamports: cfg.creationFeeLamports.toString(),
    withdrawFeeBps: cfg.withdrawFeeBps,
    feeEnabled: cfg.feeEnabled,
    paused: cfg.paused,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
