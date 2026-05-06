const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://jarfi.up.railway.app'

export async function subscribeToPush(ownerPubkey: string): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) return

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let publicKey: string
  try {
    const res = await fetch(`${API_URL}/push/vapid-public-key`)
    if (!res.ok) return
    publicKey = (await res.json()).publicKey
  } catch {
    return
  }

  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_pubkey: ownerPubkey, subscription: sub.toJSON() }),
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
