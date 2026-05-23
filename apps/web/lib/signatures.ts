import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

export function buildChallenge(
  jarPda: string,
  contentHash: string,
  jarCount: number,
): string {
  return `jarfi:metadata-upload\njar=${jarPda}\ncount=${jarCount}\nhash=${contentHash}`;
}

export function buildDonorNameChallenge(
  jarPda: string,
  donorWallet: string,
  name: string,
  nonce: string,
): string {
  return `jarfi:donor-name\njar=${jarPda}\ndonor=${donorWallet}\nname=${name}\nnonce=${nonce}`;
}

export function verifyWalletSignature(
  challenge: string,
  signatureBase58: string,
  walletBase58: string,
): boolean {
  try {
    const msg = new TextEncoder().encode(challenge);
    const sig = bs58.decode(signatureBase58);
    const pubkey = new PublicKey(walletBase58).toBytes();
    return nacl.sign.detached.verify(msg, sig, pubkey);
  } catch {
    return false;
  }
}
