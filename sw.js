/* ============================================================
    🚀 MINDSET ELITE - PWA SERVICE WORKER v1.2
    Cache Inteligente & Offline de Alta Performance
   ============================================================ */

const CACHE_NAME = 'mindset-elite-v1.2'; // Mude a versão sempre que alterar o CSS/JS
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

// INSTALAÇÃO: Armazena os arquivos no cache local
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Força o novo SW a assumir o controle imediatamente
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(' [SW] Sincronizando Ativos Elite no Cache...');
            return cache.addAll(ASSETS);
        })
    );
});

// ATIVAÇÃO: Remove caches antigos para evitar conflitos de estilo
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log(' [SW] Removendo Cache Obsoleto:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Assume o controle de todas as abas abertas
    );
});

// INTERCEPTAÇÃO: Estratégia "Stale-While-Revalidate" (Velocidade Máxima)
self.addEventListener('fetch', (e) => {
    // Ignora requisições de API (o formulário deve ser sempre via rede real)
    if (e.request.url.includes('/vagas') || e.request.url.includes('/inscrever') || e.request.url.includes('api.openweathermap.org')) {
        return e.respondWith(fetch(e.request));
    }

    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((cachedResponse) => {
                const fetchedResponse = fetch(e.request).then((networkResponse) => {
                    // Atualiza o cache com a versão nova da rede
                    if (networkResponse.ok) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Se falhar a rede totalmente, já temos o cache
                    return cachedResponse;
                });

                // Retorna o cache IMEDIATAMENTE ou espera a rede se não houver cache
                return cachedResponse || fetchedResponse;
            });
        })
    );
});
