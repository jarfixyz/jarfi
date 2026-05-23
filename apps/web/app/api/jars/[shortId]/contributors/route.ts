import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { getShortLinkById } from "@/lib/db/shortlinks";
import { getJarByPda } from "@/lib/db/jars";
import { listContributorsForJar } from "@/lib/db/contributions";
import { buildDemoContributors, isDemoShortId } from "@/lib/demo-jar";


interface Params {
  params: Promise<{ shortId: string }>;
}

export async function GET(
  _req: Request,
  { params }: Params,
): Promise<Response> {
  const { shortId } = await params;
  if (isDemoShortId(shortId)) {
    return new Response(JSON.stringify(buildDemoContributors()), {
      headers: { "content-type": "application/json" },
    });
  }
  const { env } = getCloudflareContext();
  const db = createDb(env.DB);

  // Accept either a shortId or a raw jar PDA for archival URLs.
  const link = await getShortLinkById(db, shortId);
  let jarPda = link?.jarPda ?? null;
  if (!jarPda) {
    const viaPda = await getJarByPda(db, shortId);
    if (viaPda) jarPda = viaPda.jarPda;
  }
  if (!jarPda) return new Response("not found", { status: 404 });

  const rows = await listContributorsForJar(db, jarPda, 50);
  const body = rows.map((r) => ({
    donor: r.donorWallet,
    amount: r.amount,
    firstAt: r.firstAt,
    lastAt: r.lastAt,
    refunded: r.refunded === 1,
    donorName: r.donorName ?? null,
  }));
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
