const TTL_SECONDS = 10;

export async function getCachedJar(
  kv: KVNamespace,
  shortId: string,
): Promise<string | null> {
  return kv.get(`jar:${shortId}`);
}

export async function setCachedJar(
  kv: KVNamespace,
  shortId: string,
  payload: string,
): Promise<void> {
  await kv.put(`jar:${shortId}`, payload, { expirationTtl: TTL_SECONDS });
}
