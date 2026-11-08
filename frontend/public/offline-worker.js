/* Local static-asset cache only. No accounts, telemetry uploads or external services. */
const BUILD = "__MF_BUILD_ID__";
const CACHE = "mission-forge-offline-" + BUILD;
const MODEL_FILES = ["nrlmsise-browser.mjs", "central-gravity.wasm", "full-engine.js", "full-engine.json", "LICENSE-QUICKJS.txt", "LICENSE-OCEAN-LOADING.txt", "LICENSE-NRLMSISE.txt", "tsofa/TSOFA.js", "tsofa/TSOFAException.js", "tsofa/TSOFAFailedConvergenceException.js", "tsofa/TSOFAIllegalParameter.js", "tsofa/TSOFAInternalError.js", "tsofa/LICENSE-readable.txt"];
self.addEventListener("install", event => event.waitUntil((async () => {
  const manifest = await (await fetch("/asset-manifest.json", {
    cache: "reload"
  })).json();
  const dataset = await (await fetch("/science/planetary-data.json", {
    cache: "reload"
  })).json();
  const assets = ["/", "/index.html", "/manifest.webmanifest", "/mission-forge-icon.svg", "/asset-manifest.json", "/build-info.json", ...Object.values(manifest.files).filter(path => /\.(js|css)$/.test(path)), ...MODEL_FILES.map(name => "/science/models/" + name), ...dataset.sources.map(s => "/science/sources/" + s.file), "/science/sources/EGM96.cof", "/science/sources/LICENSE-GMAT.txt", "/science/planetary-data.json", "/science/analysis.csv", "/science/atmospheres.csv", "/science/egm96.json", "/science/advanced-validation-results.json", "/science/orekit-reference.json", "/science/precision-reference.json", "/science/de421.json", "/science/ocean-loading.blq", "/science/ocean-reference.json", "/science/tpsx-user.json", "/science/arcjet-cases.json", "/science/sources/fes2004_Cnm-Snm-8x8.dat", "/science/msis-reference.json", "/science/frame-reference.json", "/science/showcase-replay.json", "/textures/earth_atmos_2048.jpg", "/textures/earth_clouds_1024.png", "/textures/moon_1024.jpg"];
  const cache = await caches.open(CACHE);
  try {
    await cache.addAll([...new Set(assets)]);
    const identity = await (await cache.match('/build-info.json')).json();
    if (identity.id !== BUILD) throw Error('Build identity mismatch');
    const expected = new Map(identity.assets.map(a => [a.path, a.sha256]));
    for (const asset of new Set(assets)) {
      if (asset === '/' || asset === '/build-info.json') continue;
      const response = await cache.match(asset),
        bytes = await response.arrayBuffer();
      const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
      if (actual !== expected.get(asset)) throw Error('Offline asset integrity mismatch: ' + asset);
    }
    await cache.put('/_missionforge-offline-inventory', new Response(JSON.stringify({
      assets: [...new Set(assets)]
    })));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('mission-forge-offline-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    // Submission handouts are private, including requests from old bookmarks.
    if (/^\/submission(?:\/|$)/.test(new URL(event.request.url).pathname)) {
      return new Response("Submission documents are not publicly distributed.", {
        status: 410, headers: {"Content-Type": "text/plain", "Cache-Control": "no-store"}
      });
    }
    const cache = await caches.open(CACHE);
    // Serve a consistent installed build; updates use a new versioned cache.
    const installed = await cache.match(event.request, {
      ignoreSearch: event.request.mode === 'navigate'
    });
    if (installed) return installed;
    try {
      return await fetch(event.request);
    } catch (error) {
      const cached = await cache.match(event.request, {
        ignoreSearch: event.request.mode === "navigate"
      });
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const home = await cache.match("/index.html");
        if (home) return home;
      }
      throw error;
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
  if (event.data?.type === 'STATUS') event.waitUntil((async () => {
    const cache = await caches.open(CACHE),
      inventory = await cache.match('/_missionforge-offline-inventory');
    const assets = inventory ? (await inventory.json()).assets : [];
    const present = await Promise.all(assets.map(asset => cache.match(asset).then(Boolean)));
    event.ports[0]?.postMessage({
      build: BUILD,
      cache: CACHE,
      count: present.filter(Boolean).length,
      ready: assets.length > 0 && present.every(Boolean)
    });
  })());
});
