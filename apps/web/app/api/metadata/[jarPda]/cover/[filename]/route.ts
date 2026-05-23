import { getCloudflareContext } from "@opennextjs/cloudflare";

const FILENAME_REGEX = /^[0-9a-f]{16}\.(webp|jpg)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jarPda: string; filename: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const { jarPda, filename } = await params;

  if (!FILENAME_REGEX.test(filename)) {
    return new Response("invalid filename", { status: 400 });
  }

  const obj = await env.METADATA_BUCKET.get(`covers/${jarPda}/${filename}`);
  if (!obj) return new Response("not found", { status: 404 });

  const contentType = filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(obj.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
