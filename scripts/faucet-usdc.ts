import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import * as fs from "fs"; import * as os from "os";

const FAUCET_PROGRAM = new PublicKey("4bXpkKSV8swHSnwqtzuboGPaPDeEgAn4Vt8GfarV5rZt");
const MINT = new PublicKey("F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd");
const MINT_AUTHORITY = new PublicKey("Fx1bCAyYpLMPVAjfq1pxbqKKkvDR3iYEpam1KbThRDYQ");
const FAUCET_CONFIG = new PublicKey("3ThaREisq3etoy9cvdzRgKypHsa8iTjMxj19AjETA1Fy");

const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8"))));
const conn = new Connection("https://api.devnet.solana.com", "confirmed");

const ata = getAssociatedTokenAddressSync(MINT, payer.publicKey);
const amount = 1_000_000_000n; // 1000 USDC at 6 decimals

const data = Buffer.alloc(9);
data.writeUInt8(1, 0); // MintTokens tag
data.writeBigUInt64LE(amount, 1);

const ix = new TransactionInstruction({
  programId: FAUCET_PROGRAM,
  keys: [
    { pubkey: MINT_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: MINT,           isWritable: true,  isSigner: false },
    { pubkey: ata,            isWritable: true,  isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: FAUCET_CONFIG,  isWritable: false, isSigner: false },
  ],
  data,
});

const tx = new Transaction()
  .add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, MINT))
  .add(ix);

(async () => {
  console.log("payer:", payer.publicKey.toBase58());
  console.log("ata:", ata.toBase58());
  const sig = await sendAndConfirmTransaction(conn, tx, [payer]);
  console.log("sig:", sig);
  const bal = await conn.getTokenAccountBalance(ata);
  console.log("balance:", bal.value.uiAmountString, "USDC");
})().catch(e => { console.error(e); process.exit(1); });
