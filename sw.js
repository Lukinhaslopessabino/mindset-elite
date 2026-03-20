/* ============================================================
    🚀 MINDSET ELITE - PWA SERVICE WORKER v1.4 (ESTÁVEL)
    Correção de Erro de Acesso (ERR_FAILED) & Domínio Oficial
   ============================================================ */

const CACHE_NAME = 'mindset-elite-v1.4'; // Versão atualizada para forçar limpeza

// Lista de ativos - Removido o "./" para evitar erro de resolução em domínios .com.br
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
            console.log('%c [SW] Ecossistema Elite Sincronizado!', 'color: #00e0ff;');
            // Usamos map para tentar adicionar um por um e não travar se um arquivo (ex: logo) faltar
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

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Network-First para evitar ERR_FAILED
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Ignorar APIs e extensões de navegador
    if (url.host.includes('api.openweathermap.org') || !e.request.url.startsWith('http')) {
        return; 
    }

    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // Se a rede funcionar, clona para o cache e entrega
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Se a rede falhar (ERR_FAILED), tenta o cache
                return caches.match(e.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    
                    // Se não tiver nem cache nem rede, e for uma página, manda pro início
                    if (e.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});
