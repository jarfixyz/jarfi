const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://jarfi.up.railway.app'

export async function subscribeToPush(ownerPubkey: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let vapidPublicKey: string
  try {
    const res = await fetch(`${API_URL}/push/vapid-public-key`)
    if (!res.ok) return false
    vapidPublicKey = (await res.json()).publicKey
  } catch {
    return false
  }

  const currentKeyBytes = urlBase64ToUint8Array(vapidPublicKey)

  // Reuse existing subscription only if it was created with the same VAPID key.
  // Mismatch happens when VAPID keys rotate — must unsubscribe and re-create.
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    const existingKey = sub.options?.applicationServerKey
      ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer)
      : null
    const keysMatch = existingKey &&
      existingKey.length === currentKeyBytes.length &&
      existingKey.every((b, i) => b === currentKeyBytes[i])
    if (!keysMatch) {
      await sub.unsubscribe()
      sub = null
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: currentKeyBytes,
    })
  }

  const res = await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_pubkey: ownerPubkey, subscription: sub.toJSON() }),
  })
  return res.ok
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
