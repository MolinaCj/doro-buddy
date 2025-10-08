// public/sw.js - DoroBuddy Service Worker
const CACHE_NAME = 'dorobuddy-v1.0.2';
const OFFLINE_URL = '/offline.html';

// Critical assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

// Assets to cache on first access (removed audio files to prevent issues)
const RUNTIME_CACHE_URLS = [
  // API routes (for offline fallback)
  '/api/tasks',
  '/api/sessions',
  '/api/settings',
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching precache assets');
        await cache.addAll(PRECACHE_ASSETS);
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
      } catch (error) {
        console.error('[SW] Precaching failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
        
        // Take control of all clients immediately
        await self.clients.claim();
        console.log('[SW] Service worker activated and claimed clients');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { method, url } = request;
  
  // Only handle GET requests
  if (method !== 'GET') {
    return;
  }

  // Parse URL
  const requestURL = new URL(url);
  const { pathname, origin } = requestURL;

  // Skip cross-origin requests
  if (origin !== self.location.origin) {
    return;
  }

  // Skip problematic files that might cause issues
  if (pathname.includes('/audio/') && (
    pathname.includes('fire.mp3') || // Old incorrect path
    pathname.includes('deep-focus/deep-focus.mp3') || // Old incorrect path
    pathname.includes('ding.mp3') || // Temporarily skip problematic files
    pathname.includes('gong.mp3') || // Temporarily skip problematic files
    pathname.includes('message-notif.mp3') // Temporarily skip problematic files
  )) {
    console.log('[SW] Skipping problematic audio file:', request.url);
    return;
  }

  // Skip screenshot files that don't exist
  if (pathname.includes('/screenshots/')) {
    console.log('[SW] Skipping screenshot file:', request.url);
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Handle navigation requests (pages)
        if (request.mode === 'navigate') {
          return await handleNavigationRequest(request);
        }

        // Handle API requests
        if (pathname.startsWith('/api/')) {
          return await handleApiRequest(request);
        }

        // Handle static assets
        if (pathname.startsWith('/icons/') || 
            pathname.startsWith('/audio/') || 
            pathname.includes('.')) {
          return await handleStaticAsset(request).catch(assetError => {
            console.warn('[SW] Static asset failed:', request.url, assetError);
            // For audio files, return a silent response instead of 404
            if (pathname.includes('/audio/')) {
              return new Response('', { 
                status: 200, 
                headers: { 'Content-Type': 'audio/mpeg' } 
              });
            }
            // Return a 404 response for other assets
            return new Response('Asset not found', { status: 404 });
          });
        }

        // Default: try network first, fallback to cache
        return await networkFirst(request);
      } catch (error) {
        console.error('[SW] Fetch handler error:', error);
        return new Response('Service Worker Error', { status: 500 });
      }
    })()
  );
});

// Handle navigation requests (HTML pages)
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache successful, complete responses only
    if (networkResponse.ok && networkResponse.status !== 206) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('[SW] Failed to cache navigation:', request.url, cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for navigation, trying cache');
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    const offlineResponse = await caches.match(OFFLINE_URL);
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

// Handle API requests
async function handleApiRequest(request) {
  try {
    // Try network first with timeout
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);

    // Cache successful, complete GET responses only
    if (networkResponse.ok && networkResponse.status !== 206 && request.method === 'GET') {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('[SW] Failed to cache API response:', request.url, cacheError);
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, trying cache:', error);

    // For GET requests, try cache
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Add offline indicator header
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Served-By', 'service-worker-cache');
        
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        });
      }
    }

    // Return offline-friendly error for failed API requests
    return new Response(
      JSON.stringify({
        error: 'You are offline. This action will be retried when connection is restored.',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets (images, audio, etc.)
async function handleStaticAsset(request) {
  try {
    // Cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try network with better error handling
    const networkResponse = await fetch(request).catch(fetchError => {
      console.warn('[SW] Network fetch failed for:', request.url, fetchError);
      // Return a basic 404 response instead of throwing
      return new Response('Not Found', { 
        status: 404, 
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/plain' }
      });
    });
    
    // Only cache successful, complete responses (not partial 206 responses)
    if (networkResponse.ok && networkResponse.status !== 206) {
      // Check if response is complete (not a partial response)
      const contentLength = networkResponse.headers.get('content-length');
      const contentRange = networkResponse.headers.get('content-range');
      const acceptRanges = networkResponse.headers.get('accept-ranges');
      
      // Only cache if it's not a partial response
      // Skip caching if:
      // 1. Has content-range header (partial response)
      // 2. Has accept-ranges header (supports partial requests)
      // 3. Content-length is 0 (empty response)
      if (!contentRange && !acceptRanges && contentLength && contentLength !== '0') {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone());
        } catch (cacheError) {
          console.warn('[SW] Failed to cache asset:', request.url, cacheError);
          // Continue without caching
        }
      } else {
        console.log('[SW] Skipping cache for partial response:', request.url);
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Static asset failed:', error);
    
    // Return placeholder for failed images
    if (request.url.includes('/icons/')) {
      return new Response('', { status: 404 });
    }
    
    throw error;
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache complete, successful responses
    if (networkResponse.ok && networkResponse.status !== 206) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('[SW] Failed to cache response:', request.url, cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Not found', { status: 404 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'dorobuddy-sync') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    console.log('[SW] Syncing offline data...');
    
    // Get offline actions from IndexedDB (you'll need to implement this)
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        // Remove from offline queue on success
        await removeOfflineAction(action.id);
      } catch (error) {
        console.error('[SW] Failed to sync action:', action, error);
      }
    }
    
    console.log('[SW] Offline sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Placeholder functions for offline data management
// You would implement these with IndexedDB
async function getOfflineActions() {
  // TODO: Implement with IndexedDB
  return [];
}

async function removeOfflineAction(id) {
  // TODO: Implement with IndexedDB
  console.log('[SW] Would remove offline action:', id);
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  const options = {
    body: event.data ? event.data.text() : 'Session reminder!',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-96x96.svg',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View App',
        icon: '/icons/icon-96x96.svg'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/icon-96x96.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('DoroBuddy', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle app installation
self.addEventListener('appinstalled', (event) => {
  console.log('[SW] App installed successfully');
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'dorobuddy-periodic-sync') {
    event.waitUntil(periodicSync());
  }
});

async function periodicSync() {
  try {
    console.log('[SW] Periodic sync triggered');
    
    // Sync cached data, clean old caches, etc.
    await cleanOldCaches();
    await syncOfflineData();
    
    console.log('[SW] Periodic sync completed');
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error);
  }
}

// Clean old cached data
async function cleanOldCaches() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const request of requests) {
      const response = await cache.match(request);
      const dateHeader = response?.headers.get('date');
      
      if (dateHeader) {
        const age = now - new Date(dateHeader).getTime();
        if (age > maxAge) {
          await cache.delete(request);
          console.log('[SW] Cleaned old cache entry:', request.url);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}