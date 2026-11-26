/* Rider Stretch: funziona offline dopo la prima apertura e, quando c'è rete, carica sempre la versione più recente */
const CACHE = "rider-stretch-v5";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* Pagina: prima la rete (versione nuova), poi la copia salvata se sei offline o la rete è lenta */
  if (req.mode === "navigate") {
    const net = fetch(new Request(url.href, { cache: "no-cache", credentials: "same-origin" })).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy));
      }
      return res;
    });
    e.waitUntil(net.catch(() => {}));
    const fallback = () => caches.match("./index.html").then((hit) => hit || caches.match("./")).then((hit) => hit || net);
    const quick = Promise.race([
      net.then((res) => (res.ok ? res : null)).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000))
    ]);
    e.respondWith(quick.then((res) => res || fallback()));
    return;
  }

  /* Icone e manifest: prima la copia salvata */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
