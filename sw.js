/* ============================================================
    🚀 MINDSET ELITE - PWA SERVICE WORKER v1.2
    Cache de Alta Disponibilidade & Performance Offline
   ============================================================ */

const CACHE_NAME = 'mindset-elite-v1.2';
const ASSETS = [
    '/',
    '/index.html',
    '/membros.html',
    '/participantes.html',
    '/videos.html',
    '/links.html',
    '/formulario.html',
    '/global.css',
    '/manifest.json',
    '/layout.v3.js'
];

// 1. INSTALAÇÃO: Armazena os ativos essenciais
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(' [SW] Sincronizando Ativos Elite...');
            return cache.addAll(ASSETS);
        })
    );
});

// 2. ATIVAÇÃO: Limpa versões obsoletas para evitar bugs visuais
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log(' [SW] Removendo Cache Antigo:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Híbrida Inteligente
self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // IGNORAR: Requisições de API (Vagas, Clima, etc) devem ser sempre em tempo real
    if (url.includes('/vagas') || url.includes('/inscrever') || url.includes('api.openweathermap.org')) {
        return e.respondWith(fetch(e.request));
    }

    // ESTRATÉGIA: Stale-While-Revalidate
    // Entrega o cache (velocidade) e atualiza em background (frescor)
    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((cachedResponse) => {
                const fetchedResponse = fetch(e.request).then((networkResponse) => {
                    if (networkResponse.ok) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => cachedResponse); // Se cair a net, volta pro cache

                return cachedResponse || fetchedResponse;
            });
        })
    );
});
