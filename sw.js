// Service worker : met les fichiers de l'app en cache pour l'ouvrir hors ligne.
// ⚠️ À CHAQUE modification de l'app, changez VERSION (v1 -> v2 -> …) :
// c'est ce qui déclenche la mise à jour sur le téléphone.
const VERSION = 'v2';
const CACHE = `meteo-seuils-${VERSION}`;
const FICHIERS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/api.js', './js/db.js', './js/settings.js', './js/dates.js', './js/series.js',
  './js/thresholds.js', './js/store.js', './js/questions.js', './js/ui-questions.js', './js/ui-search.js', './js/ui-table.js', './js/ui-heatmap.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' = on contourne le cache HTTP du navigateur pour récupérer les vrais nouveaux fichiers
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) => Promise.all(
      noms.filter((n) => n.startsWith('meteo-seuils-') && n !== CACHE).map((n) => caches.delete(n)),
    )),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Seuls les fichiers de l'app passent par ici ; les appels Open-Meteo vont directement sur le réseau.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => (
      req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
    ))),
  );
});
