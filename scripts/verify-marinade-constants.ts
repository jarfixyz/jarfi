// scripts/verify-marinade-constants.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const RPC = "https://api.devnet.solana.com";
const PROG = new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
const STATE = new PublicKey("8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC");

const expected = {
  MSOL_MINT:             "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  MSOL_MINT_AUTHORITY:   "3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM",
  RESERVE_PDA:           "Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN",
  LIQ_POOL_SOL_LEG_PDA:  "UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q",
  LIQ_POOL_MSOL_LEG:     "7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE",
  LIQ_POOL_MSOL_LEG_AUTH:"EyaSjUtSgo9aRD1f8LWXwdvkpDTmXAW54yoSHZRF14WL",
  TREASURY_MSOL_ACCOUNT: "8ZUcztoAEhpAeC2ixWewJKQJsSUGYSGPVAjkhDJYf5Gd",
};

function disc(name: string): number[] {
  return Array.from(createHash("sha256").update(`global:${name}`).digest().slice(0, 8));
}

async function main() {
  const conn = new Connection(RPC);

  // 1) Program executable
  const progAcc = await conn.getAccountInfo(PROG);
  if (!progAcc?.executable) throw new Error("program not executable");
  console.log("OK program executable");

  // 2) State exists, owned by program
  const stAcc = await conn.getAccountInfo(STATE);
  if (!stAcc) throw new Error("state missing");
  if (!stAcc.owner.equals(PROG)) throw new Error("state wrong owner");
  console.log("OK state owner");

  // 3) Decode msol_mint and treasury_msol_account from State data.
  // Layout (Borsh, no alignment padding):
  //   disc(8) + msol_mint(32) + admin_authority(32) + operational_sol_account(32) = 104
  //   → treasury_msol_account starts at 104 (ends at 136).
  const data = stAcc.data;
  if (data.length < 136) throw new Error(`state data too short: ${data.length} bytes`);
  const msolMint = new PublicKey(data.slice(8, 40));
  const treasury = new PublicKey(data.slice(104, 136));
  console.log("on-chain msol_mint:", msolMint.toBase58());
  console.log("on-chain treasury:",  treasury.toBase58());

  if (msolMint.toBase58() !== expected.MSOL_MINT) {
    throw new Error(`MISMATCH msol_mint: expected ${expected.MSOL_MINT}, got ${msolMint.toBase58()}`);
  }
  if (treasury.toBase58() !== expected.TREASURY_MSOL_ACCOUNT) {
    throw new Error(`MISMATCH treasury_msol: expected ${expected.TREASURY_MSOL_ACCOUNT}, got ${treasury.toBase58()}`);
  }

  // 4) Recompute PDAs
  const [mintAuth] = PublicKey.findProgramAddressSync(
    [STATE.toBuffer(), Buffer.from("st_mint")], PROG);
  const [reserve] = PublicKey.findProgramAddressSync(
    [STATE.toBuffer(), Buffer.from("reserve")], PROG);
  const [liqSol] = PublicKey.findProgramAddressSync(
    [STATE.toBuffer(), Buffer.from("liq_sol")], PROG);
  const [liqMsolAuth] = PublicKey.findProgramAddressSync(
    [STATE.toBuffer(), Buffer.from("liq_st_sol_authority")], PROG);

  const mismatches: string[] = [];
  for (const [name, got, want] of [
    ["MSOL_MINT_AUTHORITY", mintAuth.toBase58(), expected.MSOL_MINT_AUTHORITY],
    ["RESERVE_PDA",         reserve.toBase58(),  expected.RESERVE_PDA],
    ["LIQ_POOL_SOL_LEG_PDA",liqSol.toBase58(),   expected.LIQ_POOL_SOL_LEG_PDA],
    ["LIQ_POOL_MSOL_LEG_AUTH", liqMsolAuth.toBase58(), expected.LIQ_POOL_MSOL_LEG_AUTH],
  ]) {
    if (got === want) {
      console.log(name, "got=", got, "OK");
    } else {
      const msg = `${name} MISMATCH: expected ${want}, got ${got}`;
      console.error(msg);
      mismatches.push(msg);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`PDA verification failed: ${mismatches.join("; ")}`);
  }

  // 5) Verify LIQ_POOL_MSOL_LEG is an SPL token account whose mint == MSOL_MINT.
  const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const liqMsolLeg = new PublicKey(expected.LIQ_POOL_MSOL_LEG);
  const liqMsolLegAcc = await conn.getAccountInfo(liqMsolLeg);
  if (!liqMsolLegAcc) throw new Error(`LIQ_POOL_MSOL_LEG account missing: ${liqMsolLeg.toBase58()}`);
  if (!liqMsolLegAcc.owner.equals(TOKEN_PROGRAM)) {
    throw new Error(`LIQ_POOL_MSOL_LEG not owned by SPL Token: owner=${liqMsolLegAcc.owner.toBase58()}`);
  }
  if (liqMsolLegAcc.data.length < 32) {
    throw new Error(`LIQ_POOL_MSOL_LEG token account data too short: ${liqMsolLegAcc.data.length}`);
  }
  const liqMsolLegMint = new PublicKey(liqMsolLegAcc.data.slice(0, 32));
  if (liqMsolLegMint.toBase58() !== expected.MSOL_MINT) {
    throw new Error(`LIQ_POOL_MSOL_LEG mint mismatch: expected ${expected.MSOL_MINT}, got ${liqMsolLegMint.toBase58()}`);
  }
  console.log("LIQ_POOL_MSOL_LEG got=", liqMsolLeg.toBase58(), "OK (SPL token account, mint=MSOL_MINT)");

  // 6) Discriminators
  console.log("disc(deposit)        =", disc("deposit"));
  console.log("disc(liquid_unstake) =", disc("liquid_unstake"));
}

main().catch((e) => { console.error(e); process.exit(1); });
