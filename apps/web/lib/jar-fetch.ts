import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Connection, PublicKey } from "@solana/web3.js";
import { JarfiClient } from "@jarfi/sdk";
import type { JarAccount } from "@jarfi/sdk";
import { createDb } from "@/lib/db/client";
import { getShortLinkById, getShortLinkByJar } from "@/lib/db/shortlinks";
import { getJarByPda as getJarCacheByPda } from "@/lib/db/jars";
import { buildDemoJar, isDemoShortId } from "./demo-jar";
import type { JarMetadata } from "./metadata";

export interface JarPayload {
  pda: string;
  shortId: string | null;
  owner: string;
  jarType: "flexible" | "timeLocked";
  asset: "sol" | "usdc";
  goalAmount: string;
  unlockTimestamp: number | null;
  totalContributed: string;
  totalContributors: number;
  status: "active" | "withdrawn" | "cancelled";
  metadata: JarMetadata;
  metadataUri: string;
  /** 0 = None, 1 = MarginFi, 2 = MarinadeSol */
  stakeProtocol: number;
}

const FALLBACK_METADATA = (title: string): JarMetadata => ({
  version: 1,
  title,
  description: "",
  coverUrl: null,
  disableContributors: false,
});

function extractJarPdaFromSelfUri(uri: string): string | null {
  const m = uri.match(/\/api\/metadata\/([^/?#]+?)(?:\.json)?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

async function readMetadataFromR2(jarPda: string): Promise<string | null> {
  try {
    const { env } = getCloudflareContext();
    const obj = await env.METADATA_BUCKET.get(`metadata/${jarPda}.json`);
    if (!obj) return null;
    return await obj.text();
  } catch {
    return null;
  }
}

function rpcUrl(): string {
  const { env } = getCloudflareContext();
  const key = env.HELIUS_API_KEY;
  if (key) return env.HELIUS_RPC.replace("REPLACE_LOCAL_DEV", key);
  return env.PUBLIC_RPC;
}

function readonlyClient(): JarfiClient {
  const conn = new Connection(rpcUrl(), { commitment: "confirmed" });
  return JarfiClient.readonly(conn);
}

function mapJarStatus(status: JarAccount["status"]): JarPayload["status"] {
  const key = typeof status === "string" ? status : Object.keys(status ?? {})[0];
  if (key === "withdrawn") return "withdrawn";
  if (key === "cancelled") return "cancelled";
  return "active";
}

function mapJarType(t: JarAccount["jarType"]): JarPayload["jarType"] {
  const key = typeof t === "string" ? t : Object.keys(t ?? {})[0];
  return key === "timeLocked" ? "timeLocked" : "flexible";
}

function mapAsset(a: JarAccount["asset"]): JarPayload["asset"] {
  const key = typeof a === "string" ? a : Object.keys(a ?? {})[0];
  return key === "usdc" ? "usdc" : "sol";
}

async function fetchJarOnChain(pda: string): Promise<{
  jar: JarAccount;
  lamports: number;
  pubkey: PublicKey;
} | null> {
  try {
    const pubkey = new PublicKey(pda);
    const client = readonlyClient();
    const res = await client.fetchJar(pubkey);
    if (!res) return null;
    return { jar: res.account, lamports: res.lamports, pubkey };
  } catch (e) {
    console.error("fetchJarOnChain failed", pda, e);
    return null;
  }
}

async function payloadFromCache(
  pda: string,
  shortId: string | null,
): Promise<JarPayload | null> {
  const { env } = getCloudflareContext();
  const db = createDb(env.DB);
  const row = await getJarCacheByPda(db, pda);
  if (!row) return null;
  const metadata = await fetchMetadata(row.metadataUri, "Untitled jar");
  return {
    pda,
    shortId,
    owner: row.ownerWallet,
    jarType: row.jarType as JarPayload["jarType"],
    asset: row.asset as JarPayload["asset"],
    goalAmount: row.goalAmount,
    unlockTimestamp: row.unlockTimestamp ?? null,
    totalContributed: row.totalContributed,
    totalContributors: row.totalContributors,
    status: row.status as JarPayload["status"],
    metadata,
    metadataUri: row.metadataUri,
    stakeProtocol: 0,
  };
}

async function fetchMetadata(uri: string, fallbackTitle: string): Promise<JarMetadata> {
  const parseBody = (text: string): JarMetadata => {
    const body = JSON.parse(text) as Partial<JarMetadata>;
    return {
      version: 1,
      title: body.title ?? fallbackTitle,
      description: body.description ?? "",
      coverUrl: body.coverUrl ?? null,
      disableContributors: body.disableContributors ?? false,
    };
  };
  try {
    const jarPda = extractJarPdaFromSelfUri(uri);
    if (jarPda) {
      const fromR2 = await readMetadataFromR2(jarPda);
      if (fromR2) return parseBody(fromR2);
      return FALLBACK_METADATA(fallbackTitle);
    }
    const res = await fetch(uri, { next: { revalidate: 30 } });
    if (!res.ok) return FALLBACK_METADATA(fallbackTitle);
    return parseBody(await res.text());
  } catch {
    return FALLBACK_METADATA(fallbackTitle);
  }
}

function buildPayload(
  onChain: JarAccount,
  _lamports: number,
  pda: string,
  shortId: string | null,
  metadata: JarMetadata,
): JarPayload {
  const unlockTs = Number(onChain.unlockTimestamp.toString());
  const asset = mapAsset(onChain.asset);
  return {
    pda,
    shortId,
    owner: onChain.owner.toBase58(),
    jarType: mapJarType(onChain.jarType),
    asset,
    goalAmount: onChain.goalAmount.toString(),
    unlockTimestamp: unlockTs || null,
    totalContributed: onChain.totalContributed.toString(),
    totalContributors: onChain.totalContributors,
    status: mapJarStatus(onChain.status),
    metadata,
    metadataUri: onChain.metadataUri,
    stakeProtocol: onChain.stakeProtocol ?? 0,
  };
}

export async function fetchJarByShortId(
  shortId: string,
): Promise<JarPayload | null> {
  if (isDemoShortId(shortId)) return buildDemoJar();
  const { env } = getCloudflareContext();
  const db = createDb(env.DB);
  const link = await getShortLinkById(db, shortId);
  if (!link) return null;
  const chain = await fetchJarOnChain(link.jarPda);
  if (chain) {
    const metadata = await fetchMetadata(chain.jar.metadataUri, "Untitled jar");
    return buildPayload(chain.jar, chain.lamports, link.jarPda, shortId, metadata);
  }
  return payloadFromCache(link.jarPda, shortId);
}

export async function fetchJarByPda(
  pda: string,
): Promise<JarPayload | null> {
  const { env } = getCloudflareContext();
  const db = createDb(env.DB);
  const link = await getShortLinkByJar(db, pda).catch(() => null);
  const shortId = link?.shortId ?? null;

  const chain = await fetchJarOnChain(pda);
  if (chain) {
    const metadata = await fetchMetadata(chain.jar.metadataUri, "Untitled jar");
    return buildPayload(chain.jar, chain.lamports, pda, shortId, metadata);
  }
  return payloadFromCache(pda, shortId);
}
