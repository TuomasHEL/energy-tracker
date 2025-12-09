// Clear Ground - Service Worker
const CACHE_NAME = 'clear-ground-v3.9';
const BASE_PATH = '/energy-tracker/';

// Static assets to cache immediately
const STATIC_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'styles.css',
    BASE_PATH + 'app.js',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'icons/icon.svg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Static assets cached');
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Cache-first for static assets, network-first for API
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    
    // API calls - network only (app handles offline with localStorage cache)
    if (url.hostname.includes('script.google.com')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Return offline response for API calls
                return new Response(JSON.stringify({ 
                    error: 'offline',
                    message: 'You are offline. Data will sync when connection is restored.'
                }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }
    
    // Static assets - Cache first, then network
    if (STATIC_ASSETS.some(asset => event.request.url.includes(asset.replace(BASE_PATH, '')))) {
        event.respondWith(
            caches.match(event.request)
                .then(cached => {
                    if (cached) {
                        // Return cached, but also update cache in background
                        fetch(event.request)
                            .then(response => {
                                if (response.ok) {
                                    caches.open(CACHE_NAME)
                                        .then(cache => cache.put(event.request, response));
                                }
                            })
                            .catch(() => {}); // Ignore network errors for background update
                        return cached;
                    }
                    // Not in cache, fetch from network
                    return fetch(event.request)
                        .then(response => {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, responseClone));
                            return response;
                        });
                })
        );
        return;
    }
    
    // Other requests - Network first with cache fallback
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseClone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('Background sync triggered');
}
