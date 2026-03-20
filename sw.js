/* ============================================================
    🚀 MINDSET ELITE - PWA SERVICE WORKER v1.4 (ESTÁVEL)
    Otimizado para Domínio Oficial & Performance Offline
   ============================================================ */

const CACHE_NAME = 'mindset-elite-v1.4';

// Lista de ativos estratégicos para cache imediato
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
    '/layout.v3.js',
    '/logo.png' // Essencial para a identidade visual offline
];

// 1. INSTALAÇÃO: Armazena os ativos essenciais
self.addEventListener('install', (e) => {
    self.skipWaiting(); 
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('%c [SW] Ecossistema Elite Sincronizado!', 'color: #00e0ff; font-weight: bold;');
            return Promise.all(
                ASSETS.map(url => {
                    return cache.add(url).catch(err => console.warn(`[SW] Falha ao cachear: ${url}`, err));
                })
            );
        })
    );
});

// 2. ATIVAÇÃO: Limpa versões obsoletas e assume controle imediato
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

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Network-First com Fallback de Cache
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Ignorar requisições de API (Clima/Vagas) e Extensões para não corromper o cache
    if (
        url.host.includes('api.openweathermap.org') || 
        url.host.includes('onrender.com') || 
        !e.request.url.startsWith('http')
    ) {
        return; 
    }

    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // Se a rede retornar OK, atualiza o cache e entrega a resposta
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Se a rede falhar (OFFLINE), busca no cache
                return caches.match(e.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    
                    // Se for uma navegação de página e não houver cache, volta para a home
                    if (e.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});
