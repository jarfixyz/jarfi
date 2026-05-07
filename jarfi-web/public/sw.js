// Take control immediately — don't wait for old SW to expire
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Jarfi', {
      body: data.body ?? '',
      icon: '/favicon-32.png',
      badge: '/favicon-32.png',
      data: data.data ?? {},
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'later') return
  const { jar_pubkey, amount_usdc, manual } = event.notification.data ?? {}
  const url = jar_pubkey
    ? `/dashboard?confirm=${jar_pubkey}&amount=${amount_usdc}${manual ? '&manual=1' : ''}`
    : '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
