import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "node:fs";

const JAR = new PublicKey("7Bh7ctK16kdYq33RkE7RqgtGXdMiyvrvggWURTnbZigV");
const PROG = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");
const MSOL = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(Keypair.generate()), { commitment: "confirmed" });
  const idl = JSON.parse(readFileSync("/Users/admin/Desktop/jarfi/target/idl/jarfi.json", "utf8")) as Idl;
  const program = new Program(idl, provider);

  const jar: any = await program.account.jar.fetch(JAR);
  console.log("owner:        ", jar.owner.toBase58());
  console.log("id:           ", jar.id.toString());
  console.log("jarType:      ", JSON.stringify(jar.jarType));
  console.log("asset:        ", JSON.stringify(jar.asset));
  console.log("autoStake:    ", jar.autoStake);
  console.log("stakeProtocol:", jar.stakeProtocol, "(0=None 1=MarginFiUsdc 2=MarinadeSol)");
  console.log("goalAmount:   ", jar.goalAmount.toString(), "lamports");
  console.log("unlock_ts:    ", jar.unlockTimestamp.toString(), "=", new Date(jar.unlockTimestamp.toNumber()*1000).toISOString());
  console.log("totalContrib: ", jar.totalContributed.toString());
  console.log("contributors: ", jar.totalContributors);
  console.log("principalTot: ", jar.principalTotal.toString());
  console.log("sharesTotal:  ", jar.sharesTotal.toString());
  console.log("status:       ", JSON.stringify(jar.status));
  console.log("metadataUri:  ", jar.metadataUri);
  console.log("marinade_acc: ", jar.marginfiAccount.toBase58());

  // mSOL ATA balance
  if (jar.stakeProtocol === 2) {
    const ata = getAssociatedTokenAddressSync(MSOL, JAR, true);
    console.log("\nmSOL ATA:     ", ata.toBase58());
    const ataInfo = await conn.getAccountInfo(ata);
    if (!ataInfo) {
      console.log("ATA: NOT CREATED");
    } else {
      const bal = await conn.getTokenAccountBalance(ata);
      console.log("ATA balance:  ", bal.value.uiAmountString, "mSOL", `(raw: ${bal.value.amount})`);
    }
  }

  // recent signatures
  console.log("\nRecent signatures:");
  const sigs = await conn.getSignaturesForAddress(JAR, { limit: 10 });
  for (const s of sigs) {
    console.log(" ", s.signature, s.err ? "ERR" : "ok", s.blockTime ? new Date(s.blockTime*1000).toISOString() : "");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
