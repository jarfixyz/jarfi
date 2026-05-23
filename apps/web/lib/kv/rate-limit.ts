export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const current = await kv.get(bucket);
  const count = current ? Number(current) : 0;
  if (count >= limit) return false;
  await kv.put(bucket, String(count + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}
