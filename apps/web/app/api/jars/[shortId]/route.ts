import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { getShortLinkById } from "@/lib/db/shortlinks";
import { getJarByPda } from "@/lib/db/jars";
import { getCachedJar, setCachedJar } from "@/lib/kv/jar-cache";


interface Params {
  params: Promise<{ shortId: string }>;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { shortId } = await params;
  const { env } = getCloudflareContext();

  const cached = await getCachedJar(env.KV, shortId);
  if (cached) {
    return new Response(cached, {
      headers: { "content-type": "application/json" },
    });
  }

  const db = createDb(env.DB);
  const link = await getShortLinkById(db, shortId);
  if (!link) return new Response("not found", { status: 404 });

  const jar = await getJarByPda(db, link.jarPda);
  if (!jar) return new Response("jar not indexed yet", { status: 404 });

  const payload = JSON.stringify({
    shortId,
    jarPda: link.jarPda,
    jar,
  });
  await setCachedJar(env.KV, shortId, payload);
  return new Response(payload, {
    headers: { "content-type": "application/json" },
  });
}
