import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jarPda: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const { jarPda } = await params;
  const pda = jarPda.replace(/\.json$/, "");
  const obj = await env.METADATA_BUCKET.get(`metadata/${pda}.json`);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=30",
    },
  });
}
