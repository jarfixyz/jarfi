interface PutResult {
  key: string;
  size: number;
}

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set<"image/webp" | "image/jpeg">([
  "image/webp",
  "image/jpeg",
]);

export async function putMetadataJson(
  bucket: R2Bucket,
  jarPda: string,
  json: unknown,
): Promise<PutResult> {
  const key = `metadata/${jarPda}.json`;
  const body = JSON.stringify(json);
  await bucket.put(key, body, {
    httpMetadata: { contentType: "application/json" },
  });
  return { key, size: body.length };
}

export async function putCover(
  bucket: R2Bucket,
  jarPda: string,
  hash16: string,
  file: ArrayBuffer,
  contentType: string,
): Promise<PutResult> {
  if (!ALLOWED_COVER_TYPES.has(contentType as "image/webp" | "image/jpeg")) {
    throw new Error(`unsupported cover type ${contentType}`);
  }
  if (file.byteLength > MAX_COVER_BYTES) {
    throw new Error(`cover too large: ${file.byteLength}`);
  }
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  const key = `covers/${jarPda}/${hash16}.${ext}`;
  await bucket.put(key, file, { httpMetadata: { contentType } });
  return { key, size: file.byteLength };
}
