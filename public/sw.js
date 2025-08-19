// public/sw.js
const CACHE_NAME = 'lunara-afiliados-v1';
const urlsToCache = [
  '/',
  '/pages/DashboardPage',
  '/pages/AgendaPage',
  '/pages/PacientesPage',
  '/pages/RelatoriosPage',
  '/pages/TerapiasPage',
  '/imagens/logo.webp',
  '/css/style.css',
  '/js/script.js'
];

// Instalação: cache dos arquivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Ativação: limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch: serve do cache ou rede
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});