const COVER_URL_REGEX =
  /^\/api\/metadata\/([^/]+)\/cover\/([0-9a-f]{16})\.(webp|jpg)$/;

interface ParsedCoverUrl {
  jarPda: string;
  hash16: string;
  ext: "webp" | "jpg";
}

export function parseCoverUrl(url: unknown): ParsedCoverUrl | null {
  if (typeof url !== "string") return null;
  const m = url.match(COVER_URL_REGEX);
  if (!m) return null;
  return { jarPda: m[1], hash16: m[2], ext: m[3] as "webp" | "jpg" };
}
