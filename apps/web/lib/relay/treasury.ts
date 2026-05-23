import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function loadTreasuryKeypair(secret: string | undefined): Keypair {
  if (!secret) {
    throw new Error("RELAY_TREASURY_SECRET is not set");
  }
  const trimmed = secret.trim();
  let bytes: Uint8Array;
  if (trimmed.startsWith("[")) {
    bytes = Uint8Array.from(JSON.parse(trimmed) as number[]);
  } else {
    bytes = bs58.decode(trimmed);
  }
  if (bytes.length !== 64) {
    throw new Error(`treasury secret must be 64 bytes, got ${bytes.length}`);
  }
  return Keypair.fromSecretKey(bytes);
}
