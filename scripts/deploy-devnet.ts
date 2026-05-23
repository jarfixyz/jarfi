import {
  AnchorProvider,
  Program,
  Wallet,
  BN,
  type Idl,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveConfigPda,
  deriveTreasuryPda,
} from "../packages/sdk/src/pdas";
import { PROGRAM_ID } from "../packages/sdk/src/constants";

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const keypairPath = process.env.ANCHOR_WALLET;
  if (!keypairPath) throw new Error("ANCHOR_WALLET env var required");

  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(rpc, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(admin), {
    commitment: "confirmed",
  });

  const idl = JSON.parse(
    readFileSync(resolve("target/idl/jarfi.json"), "utf8"),
  ) as Idl;
  const programId = PROGRAM_ID;
  const program = new Program(idl, provider);

  const balance = await connection.getBalance(admin.publicKey);
  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.log("Airdropping 2 SOL for deploy admin…");
    const sig = await connection.requestAirdrop(
      admin.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, "confirmed");
  }

  const [config] = deriveConfigPda(programId);
  const [treasury] = deriveTreasuryPda(programId);

  const existing = await connection.getAccountInfo(config);
  if (existing) {
    console.log("Config already initialized at", config.toBase58());
    return;
  }

  console.log("Initializing config…");
  await program.methods
    .initializeConfig(new BN(0), 250, anchor.web3.PublicKey.default)
    .accounts({
      payer: admin.publicKey,
      admin: admin.publicKey,
      config,
      treasury,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();

  writeFileSync(
    resolve("deploy-devnet.json"),
    JSON.stringify(
      {
        programId: programId.toBase58(),
        admin: admin.publicKey.toBase58(),
        config: config.toBase58(),
        treasury: treasury.toBase58(),
      },
      null,
      2,
    ),
  );
  console.log("Deployed and initialized:", programId.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
