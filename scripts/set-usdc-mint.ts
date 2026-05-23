import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Jarfi } from "../target/types/jarfi";

const PROGRAM_ID = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");
const DEVNET_USDC = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const keypairPath =
    process.env.ANCHOR_WALLET ?? resolve(homedir(), ".config/solana/id.json");
  const admin = loadKeypair(keypairPath);
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new anchor.Wallet(admin),
    { commitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const idl = JSON.parse(
    readFileSync(resolve(__dirname, "../target/idl/jarfi.json"), "utf8"),
  );
  const program = new Program<Jarfi>(idl, provider);
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  );

  const tx = await program.methods
    .updateConfig(null, null, null, null, DEVNET_USDC, null)
    .accounts({ admin: admin.publicKey, config })
    .signers([admin])
    .rpc();
  console.log("update_config tx:", tx);

  const cfg = await program.account.config.fetch(config);
  console.log("allowed_usdc_mint:", cfg.allowedUsdcMint.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
