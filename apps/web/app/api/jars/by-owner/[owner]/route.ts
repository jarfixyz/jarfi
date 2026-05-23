import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublicKey } from "@solana/web3.js";
import { createDb } from "@/lib/db/client";
import { getJarsByOwner } from "@/lib/db/jars";

interface MetaPeek {
  title: string | null;
  coverUrl: string | null;
}

async function metaFromR2(jarPda: string): Promise<MetaPeek> {
  try {
    const { env } = getCloudflareContext();
    const obj = await env.METADATA_BUCKET.get(`metadata/${jarPda}.json`);
    if (!obj) return { title: null, coverUrl: null };
    const body = (await obj.json()) as {
      title?: string;
      coverUrl?: string | null;
    };
    const title =
      typeof body.title === "string" && body.title.trim() ? body.title : null;
    const coverUrl =
      typeof body.coverUrl === "string" && body.coverUrl ? body.coverUrl : null;
    return { title, coverUrl };
  } catch {
    return { title: null, coverUrl: null };
  }
}

interface Params {
  params: Promise<{ owner: string }>;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { owner } = await params;
  try {
    new PublicKey(owner);
  } catch {
    return new Response("bad owner", { status: 400 });
  }

  const { env } = getCloudflareContext();
  const db = createDb(env.DB);
  const rows = await getJarsByOwner(db, owner);

  const metas = await Promise.all(rows.map((r) => metaFromR2(r.jarPda)));

  const out = rows.map((r, i) => ({
    pda: r.jarPda,
    asset: r.asset,
    totalContributed: r.totalContributed,
    goalAmount: r.goalAmount,
    status: r.status,
    title: metas[i].title,
    coverUrl: metas[i].coverUrl,
    stakingEnabled: r.asset === "sol",
    unlockTimestamp: r.unlockTimestamp,
  }));

  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
