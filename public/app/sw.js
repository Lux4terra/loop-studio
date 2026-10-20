// Loop Studio: the newest copy of the app opens whenever the network answers within a moment; otherwise the copy kept
// on the device opens at once. Data calls are never cached here.
const CACHE = "loop-studio-f79b3ff32b";
const SHELL = ["./", "tokens.css?v=f79b3ff32b", "shell.css?v=f79b3ff32b", "shell.js?v=f79b3ff32b", "paint.js?v=f79b3ff32b", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/app/")) return;
  if (e.request.mode === "navigate" || u.pathname === "/app/" || u.pathname === "/app/index.html") {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), kept = await c.match("./");
      const fresh = fetch(e.request, { cache: "no-store" }).then(r => { if (r.ok) c.put("./", r.clone()); return r; });
      if (!kept) return fresh.catch(() => Response.error());
      // the newest copy if it arrives within 2.5 seconds; the kept one otherwise, refreshed behind it
      const late = new Promise(res => setTimeout(() => res(null), 2500));
      const r = await Promise.race([fresh.catch(() => null), late]);
      if (r && r.ok) return r;
      e.waitUntil(fresh.catch(() => {})); return kept;
    })());
    return;
  }
  // everything else under /app/ carries its version in its address, so a kept copy is always the right one
  e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })));
});
// phone alerts, ready for when Studio sends them: show them, and open the right app when tapped
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Studio", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Studio", { body: d.body || "", icon: "/app/icon-192.png", badge: "/app/icon-192.png", tag: d.tag || undefined, data: { app: d.app || "" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const app = (e.notification.data && e.notification.data.app) || "", url = "/app/" + (app ? "#/" + app : "");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.includes("/app/"));
    return c ? c.navigate(url).then(w => (w || c).focus()) : self.clients.openWindow(url);
  }));
});
