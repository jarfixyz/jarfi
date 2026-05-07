const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://jarfi.up.railway.app'

let cachedVapidKey: string | null = null

export async function subscribeToPush(ownerPubkey: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    console.warn('[push] ServiceWorker or PushManager not supported')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('[push] permission not granted:', permission)
    return false
  }

  let reg: ServiceWorkerRegistration
  try {
    reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
  } catch (e) {
    console.error('[push] SW registration failed:', e)
    return false
  }

  if (!cachedVapidKey) {
    try {
      const res = await fetch(`${API_URL}/push/vapid-public-key`)
      if (!res.ok) { console.error('[push] vapid key fetch failed:', res.status); return false }
      cachedVapidKey = (await res.json()).publicKey
    } catch (e) {
      console.error('[push] vapid key fetch error:', e)
      return false
    }
  }
  const vapidPublicKey = cachedVapidKey!

  const currentKeyBytes = urlBase64ToUint8Array(vapidPublicKey)

  // Reuse existing subscription only if VAPID key matches; recreate if rotated
  let sub: PushSubscription | null
  try {
    sub = await reg.pushManager.getSubscription()
    if (sub) {
      const existingKey = sub.options?.applicationServerKey
        ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer)
        : null
      const keysMatch = existingKey &&
        existingKey.length === currentKeyBytes.length &&
        existingKey.every((b, i) => b === currentKeyBytes[i])
      if (!keysMatch) {
        console.log('[push] VAPID key mismatch — resubscribing')
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
  } catch (e) {
    console.error('[push] pushManager subscribe failed:', e)
    return false
  }

  try {
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_pubkey: ownerPubkey, subscription: sub.toJSON() }),
    })
    if (!res.ok) {
      console.error('[push] backend subscribe failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('[push] backend subscribe error:', e)
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
