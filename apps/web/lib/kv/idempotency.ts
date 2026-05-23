export async function claimNonce(
  kv: KVNamespace,
  nonce: string,
  ttlSeconds = 600,
): Promise<boolean> {
  const key = `nonce:${nonce}`;
  const existing = await kv.get(key);
  if (existing) return false;
  await kv.put(key, "1", { expirationTtl: ttlSeconds });
  return true;
}
