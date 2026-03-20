const CACHE_NAME = 'mindset-elite-v1';
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

// Instalação: Salva os arquivos essenciais no navegador
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(' [SW] Realizando Cache dos Ativos...');
            return cache.addAll(ASSETS);
        })
    );
});

// Ativação: Limpa caches de versões anteriores
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// Interceptação: Tenta a rede, se falhar, entrega o cache
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
