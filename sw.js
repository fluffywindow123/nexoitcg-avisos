const routes = new Set(['tasks','subjects','events','schedule']);
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  const destination = routes.has(payload.destination) ? payload.destination : 'tasks';
  event.waitUntil(self.registration.showNotification('NexoITCG', {
    body: typeof payload.body === 'string' ? payload.body.slice(0,240) : 'Hay novedades de tu escuela. Abre NexoITCG para verlas.',
    icon: new URL('./icon.png',self.registration.scope).href,
    tag: typeof payload.id === 'string' ? payload.id.slice(0,120) : 'nexo-update',
    data:{destination}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = routes.has(event.notification.data?.destination) ? event.notification.data.destination : 'tasks';
  // Browsers may refuse custom schemes in a worker. Use a same-origin bridge
  // with an explicit native-app link, never a portal URL from the payload.
  const url = new URL('./',self.registration.scope); url.searchParams.set('open',destination);
  event.waitUntil(clients.openWindow(url.href));
});
