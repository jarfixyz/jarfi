import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { getShortLinkById } from "@/lib/db/shortlinks";
import { getJarByPda } from "@/lib/db/jars";
import { listContributorsForJar } from "@/lib/db/contributions";


interface Params {
  params: Promise<{ shortId: string }>;
}

export async function GET(
  _req: Request,
  { params }: Params,
): Promise<Response> {
  const { shortId } = await params;
  const { env } = getCloudflareContext();
  const db = createDb(env.DB);

  const link = await getShortLinkById(db, shortId);
  let jarPda = link?.jarPda ?? null;
  if (!jarPda) {
    const viaPda = await getJarByPda(db, shortId);
    if (viaPda) jarPda = viaPda.jarPda;
  }
  if (!jarPda) return new Response("not found", { status: 404 });

  const rows = await listContributorsForJar(db, jarPda, 500);
  const body = rows
    .filter((r) => r.refunded !== 1)
    .map((r) => ({ donor: r.donorWallet, amount: r.amount }));
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
