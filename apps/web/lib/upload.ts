import bs58 from "bs58";
import type { JarMetadata } from "./metadata";

interface UploadJarMetadataArgs {
  jarPda: string;
  wallet: string;
  signature: string;
  nonce: string;
  jarCount: number;
  metadataJson: string;
  cover?: Blob | null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SignUploadArgs {
  jarPda: string;
  jarCount: number;
  metadata: JarMetadata;
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
}

interface SignedUpload {
  metadataJson: string;
  signature: string;
}

export async function signMetadataUpload(
  args: SignUploadArgs,
): Promise<SignedUpload> {
  const metadataJson = JSON.stringify(args.metadata);
  const bytes = new TextEncoder().encode(metadataJson);
  const contentHash = await sha256Hex(bytes);
  const challenge = `jarfi:metadata-upload\njar=${args.jarPda}\ncount=${args.jarCount}\nhash=${contentHash}`;
  const sig = await args.signMessage(new TextEncoder().encode(challenge));
  return { metadataJson, signature: bs58.encode(sig) };
}

interface UploadJarMetadataResult {
  metadataUri: string;
}

export async function uploadJarMetadata(
  args: UploadJarMetadataArgs,
): Promise<UploadJarMetadataResult> {
  const fd = new FormData();
  fd.set("jarPda", args.jarPda);
  fd.set("wallet", args.wallet);
  fd.set("signature", args.signature);
  fd.set("nonce", args.nonce);
  fd.set("jarCount", String(args.jarCount));
  fd.set("metadata", args.metadataJson);
  if (args.cover) fd.set("cover", args.cover);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/metadata/upload", {
        method: "PUT",
        body: fd,
      });
      if (!res.ok) {
        throw new Error(`upload failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as UploadJarMetadataResult;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("upload failed after retries");
}
