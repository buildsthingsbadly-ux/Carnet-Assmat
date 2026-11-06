/* Service worker : le carnet fonctionne hors connexion.
   - Fichiers de l'appli : servis depuis le cache de leur version ; une nouvelle version s'installe entière.
   - reglementation.json : toujours demandé au réseau d'abord (pour avoir les dernières valeurs légales). */
const CACHE = 'carnet-assmat-3.29.0-c4bf53c7';
const FILES = ['./','./index.html','./app.css','./reg.js','./js/core.js','./js/contrats.js','./js/themes.js','./js/fiscal.js','./js/suivi.js','./js/docs.js','./js/io.js','./js/plus.js','./js/fiche.js','./js/formation.js','./js/shell.js',
  './manifest.webmanifest','./fonts/fraunces-600.woff2','./fonts/worksans.woff2','./fonts/ibmplexmono-500.woff2','./fonts/ibmplexmono-600.woff2','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/qr-adresse.svg','./reglementation.json'];
// la nouvelle version attend l'accord de l'utilisatrice (bandeau « Mettre à jour ») ; la toute première installation est immédiate
// cache:'reload' : on télécharge toujours les fichiers frais, jamais une copie gardée par le navigateur (sinon une
// nouvelle version pourrait être enregistrée avec un ancien fichier)
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(u=>new Request(u, {cache:'reload'}))))); });
self.addEventListener('message', e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  if(url.pathname.endsWith('reglementation.json')){
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put('./reglementation.json', cp)); return r; }).catch(()=>caches.match('./reglementation.json')));
    return;
  }
  // fichiers de l'appli : uniquement ceux de CETTE version (installés d'un bloc). Jamais de remplacement en
  // arrière-plan : une nouvelle version arrive entière, par le bandeau « Mettre à jour », sans mélange de fichiers.
  e.respondWith(caches.open(CACHE).then(c=>c.match(req, {ignoreSearch:true})).then(hit=>{
    if(hit) return hit;
    return fetch(req).then(r=>{ if(r && r.ok && url.origin===location.origin){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req, cp)); } return r; });
  }));
});
