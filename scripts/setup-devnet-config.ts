// Idempotent: ensure devnet config has auto-stake fields set and USDC mint
// configured.
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const PROGRAM_ID = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");
const USDC_MINT = new PublicKey("F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd");
const MARGINFI_PROGRAM = new PublicKey("A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4");
const MARGINFI_GROUP = new PublicKey("52NC7T3NTPFFwoxJDFk9mbKcA7675DJ39H1iPNz5RjSV");
const USDC_BANK = new PublicKey("GhV6ZftLXv3o38CHMhX6nu8GkxS3kvrHSSCVpGFTysUC");

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const keypairPath = process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/id.json`;
  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const conn = new Connection(rpc, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" });

  const idl = JSON.parse(readFileSync(resolve("target/idl/jarfi.json"), "utf8")) as Idl;
  const program = new Program(idl, provider);
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID);

  // 1) Ensure allowed_usdc_mint is set.
  const cfgAcc: any = await program.account.config.fetch(config);
  console.log("admin:", admin.publicKey.toBase58());
  console.log("config.admin:", cfgAcc.admin.toBase58());
  console.log("allowed_usdc_mint:", cfgAcc.allowedUsdcMint.toBase58());
  console.log("auto_stake_enabled:", cfgAcc.autoStakeEnabled);

  if (!cfgAcc.allowedUsdcMint.equals(USDC_MINT)) {
    console.log("Setting allowed_usdc_mint...");
    const sig = await program.methods
      .updateConfig(null, null, null, null, USDC_MINT)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
    console.log("  sig:", sig);
  }

  // 2) Ensure auto-stake fields set.
  if (!cfgAcc.autoStakeEnabled
    || !cfgAcc.marginfiProgram.equals(MARGINFI_PROGRAM)
    || !cfgAcc.marginfiGroup.equals(MARGINFI_GROUP)
    || !cfgAcc.marginfiUsdcBank.equals(USDC_BANK)) {
    console.log("Setting marginfi config...");
    const sig = await program.methods
      .updateMarginfiConfig({
        autoStakeEnabled: true,
        marginfiProgram: MARGINFI_PROGRAM,
        marginfiGroup: MARGINFI_GROUP,
        marginfiUsdcBank: USDC_BANK,
      })
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
    console.log("  sig:", sig);
  }

  const final: any = await program.account.config.fetch(config);
  console.log("\nFINAL config:");
  console.log("  admin:", final.admin.toBase58());
  console.log("  allowedUsdcMint:", final.allowedUsdcMint.toBase58());
  console.log("  autoStakeEnabled:", final.autoStakeEnabled);
  console.log("  marginfiProgram:", final.marginfiProgram.toBase58());
  console.log("  marginfiGroup:", final.marginfiGroup.toBase58());
  console.log("  marginfiUsdcBank:", final.marginfiUsdcBank.toBase58());
  console.log("treasury:", treasury.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });
