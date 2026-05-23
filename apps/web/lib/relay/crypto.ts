function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asBuf(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

async function importKey(rawB64: string): Promise<CryptoKey> {
  const raw = b64decode(rawB64);
  if (raw.length !== 32) {
    throw new Error("RELAY_ENC_KEY must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", asBuf(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(
  plaintext: Uint8Array,
  rawKeyB64: string,
): Promise<{ ct: string; iv: string }> {
  const key = await importKey(rawKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBuf(iv) },
    key,
    asBuf(plaintext),
  );
  return { ct: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

export async function decryptSecret(
  ctB64: string,
  ivB64: string,
  rawKeyB64: string,
): Promise<Uint8Array> {
  const key = await importKey(rawKeyB64);
  const iv = b64decode(ivB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuf(iv) },
    key,
    asBuf(b64decode(ctB64)),
  );
  return new Uint8Array(pt);
}
