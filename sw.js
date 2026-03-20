/* ============================================================
    🚀 MINDSET ELITE - PWA SERVICE WORKER v1.3 (ESTÁVEL)
    Cache de Alta Disponibilidade & Performance Offline
   ============================================================ */

const CACHE_NAME = 'mindset-elite-v1.3';

// Lista de ativos otimizada (Caminhos relativos para maior compatibilidade)
const ASSETS = [
    './',
    './index.html',
    './membros.html',
    './participantes.html',
    './videos.html',
    './links.html',
    './formulario.html',
    './global.css',
    './manifest.json',
    './layout.v3.js',
    './logo.png',
    './banner.jpg'
];

// 1. INSTALAÇÃO: Armazena os ativos essenciais
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('%c [SW] Sincronizando Ecossistema Elite...', 'color: #00e0ff;');
            return cache.addAll(ASSETS);
        })
    );
});

// 2. ATIVAÇÃO: Limpa versões obsoletas
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Removendo Cache Antigo:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Stale-While-Revalidate
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // IGNORAR: Requisições de API (Clima deve ser sempre tempo real)
    if (url.host.includes('api.openweathermap.org') || url.pathname.includes('/vagas')) {
        return; 
    }

    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((cachedResponse) => {
                const fetchedResponse = fetch(e.request).then((networkResponse) => {
                    // Se a rede responder, atualiza o cache em background
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Se a rede falhar totalmente, tenta entregar o que tiver no cache
                    return cachedResponse;
                });

                // Retorna o cache imediatamente (velocidade) ou espera a rede se não houver cache
                return cachedResponse || fetchedResponse;
            });
        })
    );
});
