self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'JAR', {
      body: data.body ?? '',
      icon: '/favicon.ico',
      data: data.data ?? {},
      actions: [
        { action: 'confirm', title: 'Підтвердити' },
        { action: 'later', title: 'Пізніше' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'later') return
  const { jar_pubkey, amount_usdc } = event.notification.data ?? {}
  const url = jar_pubkey
    ? `/dashboard?confirm=${jar_pubkey}&amount=${amount_usdc}`
    : '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
