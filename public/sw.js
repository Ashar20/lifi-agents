// Service Worker for Push Notifications
// Handles background push events even when browser tab is closed

const CACHE_NAME = 'lifi-agents-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'LI.FI Agents Alert',
    body: 'New opportunity detected!',
    icon: '/lifi-icon.png',
    badge: '/lifi-badge.png',
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/lifi-icon.png',
    badge: data.badge || '/lifi-badge.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: crypto.randomUUID(),
      ...data,
    },
    actions: [
      { action: 'view', title: '👀 View', icon: '/icons/view.png' },
      { action: 'dismiss', title: '❌ Dismiss', icon: '/icons/dismiss.png' },
    ],
    requireInteraction: true, // Keep notification visible until user interacts
    tag: data.tag || 'lifi-alert', // Group similar notifications
    renotify: true, // Vibrate again for same tag
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes('localhost:3000') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow('http://localhost:3000');
        }
      })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Background sync (for when coming back online)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-opportunities') {
    event.waitUntil(syncOpportunities());
  }
});

async function syncOpportunities() {
  try {
    const response = await fetch('http://localhost:3001/api/opportunities');
    const data = await response.json();
    
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OPPORTUNITIES_SYNCED',
        data,
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'check-opportunities') {
    event.waitUntil(syncOpportunities());
  }
});
