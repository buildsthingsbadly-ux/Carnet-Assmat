/* =====================================================================================
   IMPRESSION / PDF · SAUVEGARDE · RÉGLAGES · MISES À JOUR RÉGLEMENTAIRES · AIDE · DÉMARRAGE
   ===================================================================================== */
'use strict';
(window.__V=window.__V||{})['io']='3.29.0';   /* version du fichier : écrite par tools/build.py */
const APP_VERSION = '3.29.0';

/* ---------------------------------- Impression / PDF ---------------------------------- */
let _pc = null;
function askPrintChoice(themeId, title){ persistTheme(themeId); _pc = {themeId, title}; openOverlay('pc-overlay'); }
function pcCancel(){ _pc=null; closeOverlay('pc-overlay'); }
function pcConfirm(mode){
  if(!_pc) return;
  const {themeId, title} = _pc; _pc=null; closeOverlay('pc-overlay');
  if(themeId==='abattement') printAbattement(title, mode); else printRecap(themeId, title, mode);
}
function recapHeader(title, mode, sub){
  let h = '<h1>'+esc(title)+'</h1><div class="meta">Carnet Assmat · édité le '+new Date().toLocaleDateString('fr-FR')+(sub?' · '+esc(sub):'')+' · réglementation version '+esc(REG.version)+'</div>';
  if(mode==='pdf') h += '<div class="meta">Choisissez « Enregistrer au format PDF » comme imprimante.</div>';
  return h;
}
function doPrint(html){
  $('print-recap').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(()=>{ window.print(); setTimeout(()=>document.body.classList.remove('printing'), 500); }, 60);
}
function visible(el){ return !!(el.offsetParent || el.getClientRects().length); }
function printRecap(themeId, title, mode){
  const th = $('theme-'+themeId), rows=[], res=[];
  const wasAll = th.classList.contains('all'); th.classList.add('all');
  th.querySelectorAll('.field, .toggle-row').forEach(el=>{
    if(!visible(el) || el.closest('.stub') || el.closest('.kid-picker')) return;
    if(el.classList.contains('toggle-row')){
      const q=el.querySelector('.q'), on=el.querySelector('.seg button.on');
      if(q && on) rows.push([q.textContent.trim(), on.textContent.trim()]);
    } else {
      const l=el.querySelector('label'), i=el.querySelector('input,select');
      if(l && i && i.value!=='' && i.type!=='file'){ let v=i.value; if(i.type==='date') v=fmtDate(v); if(i.type==='month') v=fmtMonth(v); rows.push([l.textContent.trim(), v]); }
    }
  });
  th.querySelectorAll('.result-line').forEach(el=>{
    if(!visible(el)) return;
    const l=el.querySelector('.lbl'), v=el.querySelector('.val');
    if(l && v && v.textContent.trim()!=='—') res.push([l.textContent.replace(/\s+/g,' ').trim(), v.textContent.trim(), el.classList.contains('total')]);
  });
  const k = PICKER_THEMES.includes(themeId) ? selKey(themeId) : null;
  const c = k && k!=='libre' ? getContrat(k) : null;
  let h = recapHeader(title, mode, c ? contratLabel(c) : '');
  h += '<h3>Informations saisies</h3><table>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>').join('')+'</table>';
  h += '<h3>Résultats</h3><table>'+res.map(r=>'<tr class="'+(r[2]?'tot':'')+'"><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>').join('')+'</table>';
  const lg = th.querySelector('.stub .legal');
  if(lg) h += '<div class="legal-p">'+esc(lg.textContent)+'</div>';
  h += '<div class="legal-p">Estimation indicative établie avec la réglementation connue à cette date ; les montants officiels sont ceux calculés par Pajemploi, la CAF/MSA ou l\'administration fiscale.</div>';
  if(!wasAll) th.classList.remove('all');
  doPrint(h);
}
function printAbattement(title, mode){
  const nb = seg('ab-nbenfants')+1, a = abYear(), T = abTauxBase();
  let h = recapHeader(title, mode, 'Revenus '+(a||'—')+' · abattement '+fmtEUR(T.eff)+' par jour complet');
  for(let i=1;i<=nb;i++){
    h += '<h3>'+esc(val('ab-c'+i+'-nom')||'Enfant '+i)+(val('ab-c'+i+'-employeur')?' — '+esc(val('ab-c'+i+'-employeur')):'')+(seg('ab-c'+i+'-hand')?' (enfant handicapé : abattement majoré)':'')+(seg('ab-c'+i+'-h24')?' (accueil continu de 24 h)':'')+'</h3>';
    if(val('ab-c'+i+'-debut')||val('ab-c'+i+'-fin')) h += '<div class="meta">Contrat : '+(fmtDate(val('ab-c'+i+'-debut'))||'—')+' au '+(fmtDate(val('ab-c'+i+'-fin'))||'—')+'</div>';
    h += '<table><tr><td><b>Mois</b></td><td><b>Sommes perçues</b></td><td><b>Jours ≥8 h / h &lt;8 h</b></td><td><b>Abattement</b></td><td><b>Imposable</b></td></tr>';
    for(let m=0;m<13;m++){
      if(!abSlotActive(i,m,a)) continue;
      const s = num('ab-c'+i+'-m'+m+'-sal')+num('ab-c'+i+'-m'+m+'-ind')+num('ab-c'+i+'-m'+m+'-av');
      const j8 = num('ab-c'+i+'-m'+m+'-j8'), hm8 = num('ab-c'+i+'-m'+m+'-hm8');
      if(!s && !j8 && !hm8) continue;
      h += '<tr><td>'+$('ab-c'+i+'-m'+m+'-row').firstChild.textContent+'</td><td>'+fmtEUR(s)+'</td><td>'+fmtNum(j8,1)+' j / '+fmtNum(hm8,2)+' h</td><td>'+$('ab-c'+i+'-m'+m+'-abatt').textContent+'</td><td>'+$('ab-c'+i+'-m'+m+'-decl').textContent+'</td></tr>';
    }
    h += '<tr class="tot"><td>Total</td><td>'+$('out-ab-c'+i+'-sal').textContent+'</td><td></td><td>'+$('out-ab-c'+i+'-abatt').textContent+'</td><td>'+$('out-ab-c'+i+'-decl').textContent+'</td></tr></table>';
  }
  h += '<h3>Synthèse</h3><table>'
    + '<tr><td>Total des sommes perçues</td><td>'+$('out-ab-total-sal').textContent+'</td></tr>'
    + '<tr><td>Total de l\'abattement</td><td>'+$('out-ab-total-abatt').textContent+'</td></tr>'
    + '<tr><td>Régime ordinaire (salaires seuls)</td><td>'+$('out-ab-commun').textContent+'</td></tr>'
    + '<tr class="tot"><td>Montant imposable à déclarer (régime spécial)</td><td>'+$('out-ab-total-decl').textContent+'</td></tr>'
    + '<tr><td>Case 1AJ / 1BJ</td><td>'+$('out-ab-1aj').textContent+'</td></tr><tr><td>Case 1GA / 1HA</td><td>'+$('out-ab-1ga').textContent+'</td></tr></table>';
  h += '<div class="legal-p">'+esc(document.querySelector('#theme-abattement .legal').textContent)+'</div>';
  doPrint(h);
}

/* ---------------------------------- Sauvegarde (copie de sécurité) ---------------------------------- */
/* Copie de sécurité chiffrée : AES-GCM 256 bits, clé dérivée du mot de passe (PBKDF2-SHA256, 250 000 tours) */
function u8b64(u){ let s=''; for(let i=0;i<u.length;i+=8192) s += String.fromCharCode(...u.subarray(i, i+8192)); return btoa(s); }
function b64u8(b){ return Uint8Array.from(atob(b), c=>c.charCodeAt(0)); }
async function cleMdp(mdp, salt){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function chiffrerCopie(txt, mdp){
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, await cleMdp(mdp, salt), new TextEncoder().encode(txt));
  return {app:'carnet-assmat', chiffre:1, algo:'AES-GCM-256 / PBKDF2-SHA256-250000', exportedAt:new Date().toISOString(), salt:u8b64(salt), iv:u8b64(iv), data:u8b64(new Uint8Array(ct))};
}
async function dechiffrerCopie(o, mdp){
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64u8(o.iv)}, await cleMdp(mdp, b64u8(o.salt)), b64u8(o.data));
  return new TextDecoder().decode(pt);
}
/* Adresse du carnet (pour la reprendre sur un autre appareil) */
function appAdresse(){ try{ if(/^https?:$/.test(location.protocol)) return location.origin + location.pathname.replace(/index\.html$/, ''); }catch(e){} return ''; }
/* Ce que contient un état : enfants, mois validés, dernière modification */
function etatResume(S){
  S = S || {}; let mois = 0; Object.values(S.journal||{}).forEach(j=>{ mois += Object.keys(j||{}).length; });
  return {enfants: (S.contrats||[]).map(c=>c.enfant||'Enfant'), mois, le: S._savedAt || ''};
}
function etatResumeTxt(r){
  return (r.enfants.length ? r.enfants.length+' enfant(s) ('+r.enfants.slice(0,4).join(', ')+(r.enfants.length>4?'…':'')+')' : 'aucun enfant')+', '+r.mois+' mois validé(s)'
    + (r.le ? ', modifié le '+new Date(r.le).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '');
}
async function syncExport(){
  let nPj = 0; try{ nPj = Object.keys(await pjAll()).length; }catch(e){}
  if(!(window.crypto && crypto.subtle)){ syncExportGo(null); return; }
  // sans mot de passe : confirmation, la copie serait lisible par n'importe qui
  _confirmNoCb = ()=>showConfirmDialog('Copie sans mot de passe ?', 'Toute personne qui obtient ce fichier pourra lire les fiches des familles'+(nPj ? ' et les '+nPj+' pièce(s) jointe(s) (certificats médicaux…)' : '')+'. À réserver à une copie gardée chez vous, sur votre ordinateur.', ()=>syncExportGo(null), 'Oui, sans mot de passe', 'Non, revenir');
  showConfirmDialog('Faire une copie de sécurité', 'La copie contient les fiches des enfants et des familles'+(nPj ? ' et '+nPj+' pièce(s) jointe(s) (certificats médicaux, ordonnances…)' : '')+'. Protégez-la par un mot de passe : elle sera illisible pour toute autre personne.\n\nEnsuite, envoyez-la à VOUS-MÊME (votre Google Drive ou iCloud, ou un mail à votre adresse), jamais aux parents.',
    ()=>askText('Mot de passe de la copie', 'Au moins 8 caractères. Notez-le sur papier et rangez-le avec vos contrats : sans lui, la copie ne pourra pas être restaurée, et personne ne peut le retrouver.', '', p=>{
      if(!p || p.length < 8){ toast('Mot de passe trop court (8 caractères au moins) : copie non faite.'); return; }
      setTimeout(()=>askText('Retapez le mot de passe', 'Pour éviter une faute de frappe.', '', p2=>{
        if(p2 !== p){ toast('Les deux mots de passe sont différents : copie non faite. Recommencez.'); return; }
        syncExportGo(p);
      }, {type:'password'}), 60);
    }, {type:'password'}),
    'Avec un mot de passe (conseillé)', 'Sans mot de passe');
}
async function syncExportGo(mdp){
  persistTheme(CURRENT);
  const now = new Date(), adr = appAdresse();
  // pièces jointes du suivi (photos de certificats, tickets…) incluses dans la copie
  let pj = {};
  try{ const all = await pjAll(); for(const id of Object.keys(all)){ pj[id] = {nom: all[id].nom, type: all[id].type, t: all[id].t, data: await blobToB64(all[id].blob)}; } }catch(e){ pj = {}; }
  const payload = { app:'carnet-assmat', version:2, appVersion:APP_VERSION, exportedAt: now.toISOString(), ouvrir: adr, state: STATE, pj };
  let texte;
  if(mdp){
    const clair = JSON.stringify(payload), o = await chiffrerCopie(clair, mdp);
    // relecture immédiate : la copie doit pouvoir être restaurée avec ce mot de passe
    try{ if(await dechiffrerCopie(o, mdp) !== clair) throw new Error('relecture'); }
    catch(e){ toast('⚠️ La copie n’a pas pu être vérifiée : elle n’a pas été faite. Recommencez.'); return; }
    o.ouvrir = adr; texte = JSON.stringify(o);
  } else texte = JSON.stringify(payload, null, 1);
  const blob = new Blob([texte], {type:'application/json'}), mo = blob.size/1048576;
  const name = 'copie-carnet-assmat-'+iso(today())+(mdp ? '-protegee' : '')+'.json';
  const msg = 'Copie de sécurité du Carnet Assmat du '+now.toLocaleDateString('fr-FR')+'. Ce fichier ne s’ouvre pas tout seul. Pour reprendre vos données : ouvrez '+(adr || 'le Carnet Assmat')+', puis Outils ▸ Mes données ▸ « Restaurer une copie »'+(mdp ? ' (le mot de passe sera demandé)' : '')+'.';
  // menu « Partager » (Drive, mail…) : si le type .json est refusé par le téléphone, on l'envoie comme texte, sous le même nom
  let file = null;
  if(typeof File==='function' && navigator.canShare){
    for(const t of ['application/json', 'text/plain']){ try{ const f = new File([blob], name, {type:t}); if(navigator.canShare({files:[f]})){ file = f; break; } }catch(e){} }
  }
  const apres = ()=>syncOuEstCopie(now, mo);
  if(file){
    navigator.share({files:[file], title:'Copie de sécurité Carnet Assmat', text:msg}).then(apres)
      .catch(err=>{ if(err && err.name==='AbortError'){ toast('Copie annulée : rien n’a été envoyé.'); return; } download(blob, name); apres(); });
  } else { download(blob, name); apres(); }
}
/* Une copie ne protège que si elle est rangée AILLEURS que sur l'appareil */
function syncOuEstCopie(now, mo){
  const lourd = mo > 20 ? '\n\nTaille : '+fmtNum(mo,1)+' Mo, trop lourd pour la plupart des mails : préférez Google Drive ou iCloud.' : '';
  _confirmNoCb = ()=>{
    STATE.lastExportLocal = now.toISOString(); saveNow(); renderDonnees(); if(CURRENT==='home') renderHome();
    showConfirmDialog('Copie restée sur ce téléphone', 'Elle ne vous protège pas si le téléphone est perdu, volé ou cassé. Refaites la copie et choisissez Google Drive, iCloud ou un mail à vous-même. (Le fichier est aussi dans « Fichiers ▸ Téléchargements » : vous pouvez le partager de là.)', ()=>syncExport(), 'Refaire la copie', 'Plus tard');
  };
  showConfirmDialog('Où est rangée votre copie ?', 'Elle ne vous protège que si elle est AILLEURS que sur ce téléphone : votre Google Drive ou iCloud, un mail envoyé à vous-même, un ordinateur ou une clé USB.'+lourd,
    ()=>{ STATE.lastExport = now.toISOString(); delete STATE.lastExportLocal; saveNow(); renderDonnees(); if(CURRENT==='home') renderHome(); toast('Copie de sécurité notée. Gardez bien votre mot de passe.'); },
    'Ailleurs (Drive, mail, ordinateur…)', 'Restée sur ce téléphone');
}
function download(blob, name){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function syncImportPick(){ $('sync-file-input').click(); }
function syncImportFile(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = e=>{
    let p; try{ p = JSON.parse(e.target.result); }catch(err){ toast('Ce fichier n’est pas une copie du Carnet Assmat (illisible).'); return; }
    if(p && p.app==='carnet-assmat' && p.chiffre){
      askText('Copie protégée', 'Entrez le mot de passe choisi lors de la copie.', '', async m=>{
        if(!m) return;
        try{ syncImportData(JSON.parse(await dechiffrerCopie(p, m))); }catch(err){ toast('Mot de passe incorrect, ou fichier abîmé.'); }
      }, {type:'password'});
      return;
    }
    syncImportData(p);
  };
  r.readAsText(file);
  $('sync-file-input').value = '';
}
function syncImportData(p){
  let newState = null, label = '';
  if(p && p.app==='carnet-assmat' && p.state){ newState = Object.assign(clone(STATE_DEFAULT), p.state); label = 'copie du '+new Date(p.exportedAt).toLocaleString('fr-FR'); }
  else if(p && p.app==='carnet-calcul-assmat' && p.data){
    // ancienne version du carnet
    newState = clone(STATE); label = 'sauvegarde de l\'ancienne version';
    const keep = STATE; STATE = newState;
    try{
      if(p.data['assmat-abattement-v1']) legacyAbToForm(JSON.parse(p.data['assmat-abattement-v1']));
      if(p.data['assmat-cmg-v1']) legacyCmgToForm(JSON.parse(p.data['assmat-cmg-v1']));
      if(p.data['assmat-cmg-historique-v1']) STATE.cmgHistory = (JSON.parse(p.data['assmat-cmg-historique-v1'])||[]).map(h=>({id:h.id,label:h.label,savedAt:h.savedAt,form:legacyCmgForm(h.state)}));
    }catch(err){}
    newState = STATE; STATE = keep;
  }
  if(!newState){ toast('Ce fichier ne vient pas du Carnet Assmat.'); return; }
  const depuisCode = lockActive(), demo = isDemo();
  const rC = etatResume(newState), rA = etatResume(STATE), aDonnees = !demo && (STATE.contrats||[]).length > 0;
  const plusAncienne = aDonnees && rC.le && rA.le && rC.le < rA.le;
  const msg = 'Fichier : '+label+'.\n\nDans la copie : '+etatResumeTxt(rC)+'.\nSur cet appareil'+(demo ? ' (exemple en cours : il sera fermé)' : '')+' : '+etatResumeTxt(demo ? {enfants:[], mois:0, le:''} : rA)+'.'
    + (plusAncienne ? '\n\n⚠️ Cette copie est PLUS ANCIENNE que les données de cet appareil : ce que vous avez saisi depuis sera remplacé.' : '')
    + (aDonnees ? '\n\nLes données actuelles sont gardées de côté : vous pourrez annuler cette restauration (Outils ▸ Mes données).' : '')
    + (depuisCode ? '\n\nLe code de verrouillage sera supprimé : vous pourrez en choisir un nouveau dans Réglages.' : (newState.settings && newState.settings.pin ? '\n\nLa copie contient un code de verrouillage : il sera demandé à l’ouverture.' : ''));
  showConfirmDialog(plusAncienne ? 'Restaurer une copie plus ancienne ?' : 'Restaurer cette copie ?', msg, ()=>restaurerGo(newState, p.pj, depuisCode), 'Oui, restaurer', 'Annuler');
}
const AVANT_RESTAU = STORE_KEY+'-avant-restauration';
async function restaurerGo(newState, pj, depuisCode){
  const etaitDemo = isDemo();
  // données actuelles gardées de côté pour pouvoir annuler (sauf en exemple)
  if(!etaitDemo && (STATE.contrats||[]).length){
    const av = JSON.stringify(STATE);
    try{ localStorage.setItem(AVANT_RESTAU, av); localStorage.setItem(AVANT_RESTAU+'-le', new Date().toISOString()); }catch(e){}
    await idbSaveState(AVANT_RESTAU, av);
  }
  // restauration pendant l'exemple : on sort de l'exemple, la copie devient les vraies données
  if(etaitDemo){
    try{ localStorage.removeItem(DEMO_FLAG); localStorage.removeItem(DEMO_KEY); localStorage.removeItem(STORE_KEY+'-avant-demo'); }catch(e){}
    await idbSaveState(DEMO_KEY, ''); await idbSaveState(STORE_KEY+'-avant-demo', '');
  }
  STATE = newState; STATE.settings = Object.assign(clone(STATE_DEFAULT.settings), STATE.settings||{}); migrateState();
  if(depuisCode) STATE.settings.pin = '';
  let nPj = 0, ko = 0;
  if(pj) for(const id of Object.keys(pj)){ try{ const x = pj[id]; await pjPutRaw(id, {blob: await b64ToBlob(x.data), nom:x.nom, type:x.type, t:x.t}); nPj++; }catch(e){ ko++; } }
  saveNow();
  const msg = 'Copie restaurée'+(nPj ? ' ('+nPj+' pièce(s) jointe(s))' : '')+'.'+(ko ? ' ⚠️ '+ko+' pièce(s) jointe(s) illisible(s).' : '')+(depuisCode ? ' Code de verrouillage supprimé.' : '');
  if(etaitDemo){ try{ sessionStorage.setItem('carnet-toast', msg); }catch(e){} setTimeout(()=>location.reload(), 500); return; }
  regBuild(); applyTheme(); CURRENT='home'; showHome(); renderDonnees(); toast(msg);
  if(lockActive()) closeOverlay('lock-overlay');
}
async function annulerRestauration(){
  let av = null; try{ av = localStorage.getItem(AVANT_RESTAU); }catch(e){}
  if(!av) av = await idbLoadState(AVANT_RESTAU);
  let S = null; try{ S = av ? JSON.parse(av) : null; }catch(e){}
  if(!S){ toast('Rien à annuler.'); return; }
  showConfirmDialog('Annuler la restauration ?', 'Le carnet revient aux données d’avant la restauration : '+etatResumeTxt(etatResume(S))+'.', async ()=>{
    STATE = Object.assign(clone(STATE_DEFAULT), S); STATE.settings = Object.assign(clone(STATE_DEFAULT.settings), STATE.settings||{}); migrateState(); saveNow();
    try{ localStorage.removeItem(AVANT_RESTAU); localStorage.removeItem(AVANT_RESTAU+'-le'); }catch(e){}
    await idbSaveState(AVANT_RESTAU, '');
    regBuild(); applyTheme(); CURRENT='home'; showHome(); renderDonnees(); toast('Restauration annulée : données d’avant remises en place.');
  }, 'Oui, revenir en arrière', 'Non');
}
/* Encadré « Mes données » : dernière copie, copie restée sur l'appareil, annulation possible, adresse du carnet */
function renderDonnees(){
  const se = $('sync-status');
  if(se){
    const j = STATE.lastExport ? Math.floor((Date.now()-new Date(STATE.lastExport))/86400000) : null;
    let h = STATE.lastExport ? 'Dernière copie rangée ailleurs : le <b>'+new Date(STATE.lastExport).toLocaleDateString('fr-FR')+'</b> ('+(j<1 ? 'aujourd’hui' : 'il y a '+j+' jour'+(j>1?'s':''))+').' : '<b>Aucune copie de sécurité rangée ailleurs</b> : si cet appareil est perdu ou cassé, tout est perdu.';
    if(STATE.lastExportLocal && (!STATE.lastExport || STATE.lastExportLocal > STATE.lastExport)) h += ' Une copie plus récente est restée sur ce téléphone : elle ne protège pas en cas de perte.';
    se.innerHTML = h;
  }
  const ru = $('restore-undo');
  if(ru){
    let le = null; try{ le = localStorage.getItem(AVANT_RESTAU+'-le'); }catch(e){}
    if(le && (Date.now()-new Date(le))/86400000 > 30){ try{ localStorage.removeItem(AVANT_RESTAU); localStorage.removeItem(AVANT_RESTAU+'-le'); }catch(e){} idbSaveState(AVANT_RESTAU, ''); le = null; }
    ru.innerHTML = le ? '<div class="info-box" style="margin-top:8px">Restauration faite le '+new Date(le).toLocaleDateString('fr-FR')+'. Les données d’avant sont gardées 30 jours. <button type="button" class="btn small" onclick="annulerRestauration()">↺ Annuler la restauration</button></div>' : '';
  }
  const ad = $('app-adresse'); if(ad) ad.textContent = appAdresse() || 'l’adresse où vous avez ouvert le carnet';
  // QR code de l'adresse publiée (icons/qr-adresse.svg, fabriqué par tools/qr_adresse.py) : seulement s'il correspond à cette adresse
  show('app-qr-wrap', appAdresse()==='https://buildsthingsbadly-ux.github.io/Carnet-Assmat/');
}
function envoyerAdresse(){
  const adr = appAdresse(); if(!adr){ toast('Adresse inconnue dans cette version « fichier ».'); return; }
  const txt = 'Carnet Assmat : ouvrez cette adresse sur la tablette ou le nouveau téléphone, installez le carnet, puis Outils ▸ Mes données ▸ « Restaurer une copie ».';
  if(navigator.share) navigator.share({title:'Carnet Assmat', text:txt, url:adr}).catch(()=>{});
  else copierAdresse();
}
function copierAdresse(){
  const adr = appAdresse(); if(!adr) return;
  try{ navigator.clipboard.writeText(adr).then(()=>toast('Adresse copiée : '+adr), ()=>toast('Adresse : '+adr)); }catch(e){ toast('Adresse : '+adr); }
}
function lockActive(){ const o = $('lock-overlay'); return !!(o && o.classList.contains('show')); }
function wipeAll(){
  showConfirmDialog('Tout effacer ?', 'Tous les enfants, calculs, réglages et pièces jointes (photos de certificats…) enregistrés sur cet appareil seront supprimés définitivement. Faites une copie de sécurité avant si besoin. Continuer ?', async ()=>{
    STATE = clone(STATE_DEFAULT);
    // pièces jointes et copies cachées (avant l'exemple, avant une restauration, données abîmées) : effacées aussi
    try{ await pjClear(); }catch(e){}
    try{ Object.keys(localStorage).filter(k=>k.indexOf(STORE_KEY+'-')===0).forEach(k=>localStorage.removeItem(k)); }catch(e){}
    for(const k of [STORE_KEY+'-avant-demo', AVANT_RESTAU]) await idbSaveState(k, '');
    saveNow(); regBuild(); applyTheme(); CURRENT='home'; showHome(); renderDonnees(); toast('Données effacées.');
  }, 'Oui, tout effacer', 'Annuler');
}

/* ---------------------------------- Réglages ---------------------------------- */
const PROFIL_FIELDS = ['civ','nom','adresse','tel','email','agrementNum','agrementDate','agrementDuree','assurance','assuranceAuto','pasTaux'];
function applyTheme(){
  const t = STATE.settings.theme;
  if(t===1) document.documentElement.dataset.theme='light'; else if(t===2) document.documentElement.dataset.theme='dark'; else delete document.documentElement.dataset.theme;
}
function renderSettings(){
  setSegVal('set-am', STATE.settings.am); setVal('set-drom', STATE.settings.drom||''); setSegVal('set-theme', STATE.settings.theme); setSegVal('set-autoreg', STATE.settings.autoreg);
  setVal('set-agrement', STATE.settings.agrement); setVal('set-regurl', STATE.settings.regUrl);
  PROFIL_FIELDS.forEach(k=>setVal('prof-'+k, (STATE.profil||{})[k] || (k==='civ' ? 'F' : '')));
  { const fm = $('reg-fold-moi'); if(fm && !(STATE.profil||{}).nom) fm.open = true; }
  setVal('set-zone', STATE.settings.zone||''); setVal('set-rappel', STATE.settings.rappel||'18:30'); setVal('set-conservation', STATE.settings.conservation||5);
  setVal('set-pin-new', ''); setSegVal('set-suivi', STATE.settings.suivi===0 ? 1 : 0); setSegVal('set-font', STATE.settings.font||0);
  regRenderStatus(); regRenderTable(); congesRender(); absEnfRender();
}
function absEnfRender(){
  const sel = $('absenf-cid'); if(sel){ const v = sel.value; sel.innerHTML = STATE.contrats.concat(STATE.calc ? [STATE.calc] : []).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.id==='calc' ? 'Calcul sans fiche' : (c.enfant||'Enfant'))+'</option>').join(''); if(v) sel.value = v; }
  show('absenf-wrap', STATE.contrats.length>0);
  const L = STATE.settings.absEnf || [];
  setHTML('absenf-list', L.length ? L.map((p,i)=>{ const c = getContrat(p.cid); return '<div class="result-line"><span class="lbl">'+esc(c ? c.enfant : 'Enfant supprimé')+' : du '+fmtDate(p.du)+' au '+fmtDate(p.au)+'</span><span class="val"><button type="button" class="btn small" onclick="absEnfDel('+i+')" aria-label="Retirer cette absence">Retirer</button></span></div>'; }).join('') : '<p class="hint">Aucune absence notée.</p>');
}
function absEnfAdd(){
  const cid = val('absenf-cid'), du = val('absenf-du'), au = val('absenf-au') || du;
  if(!getContrat(cid)){ toast('Choisissez l\u2019enfant.'); return; }
  if(!parseD(du)){ toast('Choisissez le premier jour d\u2019absence.'); return; }
  if(au < du){ toast('La date de fin est avant la date de début.'); return; }
  STATE.settings.absEnf = (STATE.settings.absEnf||[]).concat([{cid, du, au}]).sort((a,b)=>a.du<b.du?-1:1);
  setVal('absenf-du',''); setVal('absenf-au','');
  auditLog(cid, 'Absence prévue de l\u2019enfant du '+fmtDate(du)+' au '+fmtDate(au)); saveState(); absEnfRender();
  toast('Absence notée : le salaire reste dû, l\u2019entretien et les repas ne sont pas comptés ces jours-là.');
}
function absEnfDel(i){
  const L = STATE.settings.absEnf || []; const p = L[i]; if(!p) return;
  L.splice(i,1); auditLog(p.cid, 'Absence prévue retirée ('+fmtDate(p.du)+' – '+fmtDate(p.au)+')'); saveState(); absEnfRender();
}
/* Mes congés payés : périodes communes à tous les contrats (utile sans suivi au jour le jour) */
function congesRender(){
  const L = STATE.settings.conges || [];
  setHTML('conges-list', L.length ? L.map((p,i)=>'<div class="result-line"><span class="lbl">Du '+fmtDate(p.du)+' au '+fmtDate(p.au)+'</span><span class="val"><button type="button" class="btn small" onclick="congesDel('+i+')" aria-label="Retirer cette période">Retirer</button></span></div>').join('') : '<p class="hint">Aucune période notée.</p>');
}
function congesAdd(){
  const du = val('conges-du'), au = val('conges-au') || du;
  if(!parseD(du)){ toast('Choisissez la date du premier jour de congé.'); return; }
  if(au < du){ toast('La date de fin est avant la date de début.'); return; }
  STATE.settings.conges = (STATE.settings.conges||[]).concat([{du, au}]).sort((a,b)=>a.du<b.du?-1:1);
  setVal('conges-du',''); setVal('conges-au','');
  auditLog('', 'Congés notés du '+fmtDate(du)+' au '+fmtDate(au)); saveState(); congesRender();
  toast('Congés notés : les jours prévus au planning pendant cette période comptent comme congés payés.');
}
function congesDel(i){
  const L = STATE.settings.conges || []; const p = L[i]; if(!p) return;
  L.splice(i,1); auditLog('', 'Congés retirés ('+fmtDate(p.du)+' – '+fmtDate(p.au)+')'); saveState(); congesRender();
}
function settingsChanged(){
  const amBefore = STATE.settings.am, dromBefore = STATE.settings.drom||'';
  STATE.settings.am = seg('set-am'); STATE.settings.theme = seg('set-theme'); STATE.settings.autoreg = seg('set-autoreg');
  STATE.settings.agrement = parseInt(val('set-agrement')) || ''; STATE.settings.drom = val('set-drom'); STATE.settings.regUrl = val('set-regurl').trim();
  if(amBefore !== STATE.settings.am || dromBefore !== STATE.settings.drom) Object.keys(_feriesCache).forEach(k=>delete _feriesCache[k]);
  STATE.profil = STATE.profil || {};
  PROFIL_FIELDS.forEach(k=>STATE.profil[k] = val('prof-'+k).trim());
  const z = val('set-zone'); if(z !== STATE.settings.zone){ STATE.settings.zone = z; if(z) loadVacances(z, true); }
  STATE.settings.rappel = val('set-rappel') || '18:30';
  STATE.settings.conservation = parseInt(val('set-conservation')) || 5;
  STATE.settings.suivi = seg('set-suivi')===1 ? 0 : 1; STATE.settings.font = seg('set-font'); applyFontSize();
  applyTheme(); saveState();
}

/* ---------------------------------- Mises à jour réglementaires ---------------------------------- */
function regRenderStatus(){
  const jours = STATE.regCheckedAt ? Math.floor((Date.now()-new Date(STATE.regCheckedAt))/86400000) : null;
  const txt = 'Réglementation : version du <b>'+fmtDate(REG.version)+'</b>'+(STATE.regRemote ? ' (téléchargée)' : ' (intégrée à l\u2019application)')+'. '
    + (jours===null ? '<b>Aucune mise à jour faite depuis ce téléphone.</b>' : 'Dernière vérification : '+new Date(STATE.regCheckedAt).toLocaleDateString('fr-FR')+(jours>35 ? ' — <b>il y a plus d\u2019un mois, pensez à mettre à jour.</b>' : '.'))
    + (Object.keys(STATE.regManual||{}).length ? ' Vous avez modifié certaines valeurs à la main (elles priment).' : '')
    + (STATE.regRemote ? ' <a href="#" onclick="regResetRemote();return false;">Revenir à la réglementation intégrée</a>' : '');
  setHTML('reg-status', txt); setHTML('reg-home-status', txt);
}
function regResetRemote(){
  showConfirmDialog('Revenir à la réglementation intégrée ?', 'La réglementation téléchargée sera oubliée : les calculs utiliseront celle livrée avec l\u2019application (version du '+fmtDate(REG_DEFAULT.version)+'). Vos valeurs saisies à la main sont gardées. Vous pourrez la télécharger à nouveau à tout moment.', ()=>{
    const before = regSnapshot(); STATE.regRemote = null; regBuild(); saveNow(); regRenderStatus(); regRenderTable();
    if(CURRENT!=='home') recalc(CURRENT); else renderHome();
    const ch = regDiff(before); toast(ch.length ? ch.length+' valeur(s) remise(s) à la version intégrée.' : 'Réglementation intégrée rétablie.');
  }, 'Oui, revenir', 'Annuler');
}
function regSnapshot(){ const s={}; Object.keys(REG.params).forEach(k=>s[k]=JSON.stringify(REG.params[k].values.map(x=>[x.du,x.v]))); return s; }
function regDiff(before){
  const out=[];
  Object.keys(REG.params).forEach(k=>{
    const p = REG.params[k];
    const old = before[k] ? JSON.parse(before[k]) : [];
    p.values.forEach(x=>{
      const o = old.find(y=>y[0]===x.du);
      if(!o || JSON.stringify(o[1])!==JSON.stringify(x.v)) out.push({k, cat:p.cat, label:p.label, du:x.du, v:x.v, old:o?o[1]:null, unit:p.unit});
    });
  });
  return out;
}
function fmtRegV(v, unit){
  if(v && typeof v==='object' && !Array.isArray(v)) return Object.keys(v).map(k=>(EVT_LABELS[k]||k)+' : '+v[k]).join(' · ');
  if(Array.isArray(v)) return v.map(x=>typeof x==='object'?(x.mois?x.mois+' mois':x.jours+' j'):String(x).replace('.',',')).join(' · ');
  if(unit==='ratio') return fmtNum(v*100,2)+' %';
  if(typeof v==='number') return (unit && unit.indexOf('€')===0 ? fmtEUR(v)+unit.slice(1) : fmtNum(v, v%1?2:0)+' '+(unit||''));
  return String(v);
}
/* Conséquences concrètes pour les contrats enregistrés */
function regImpacts(changes){
  const out=[];
  const keys = new Set(changes.map(c=>c.k));
  STATE.contrats.forEach(c=>{
    const nom = esc(c.enfant||'Enfant');
    if(keys.has('salMin') || keys.has('salMinTitre')){
      const ch = changes.find(x=>x.k===(c.titre?'salMinTitre':'salMin'));
      if(ch && (parseFloat(c.taux)||0) < ch.v) out.push('<b>'+nom+'</b> : le salaire horaire ('+fmtEUR(parseFloat(c.taux)||0)+') est sous le nouveau minimum ('+fmtEUR(ch.v)+' à partir du '+fmtDate(ch.du)+'). Le carnet applique le minimum d\'office ; faites signer un avenant.');
    }
    if((keys.has('mg')||keys.has('iePct')||keys.has('iePlancher')) && c.ieMode===0) out.push('<b>'+nom+'</b> : l\'indemnité d\'entretien (minimum légal automatique) est recalculée.');
  });
  if(keys.has('smic')) out.push('Impôts : l\'abattement par jour suit le SMIC du 1er janvier de l\'année des revenus.');
  if([...keys].some(k=>k.indexOf('cmg')===0)) out.push('Aide CMG : le nouveau barème s\'applique aux mois concernés.');
  if(keys.has('netRatio')||keys.has('netRatioAM')) out.push('Les salaires nets estimés sont recalculés.');
  return out;
}
function showRegNews(all, changes){
  let h='';
  if(changes && changes.length){
    const byCat={};
    changes.forEach(c=>(byCat[c.cat]=byCat[c.cat]||[]).push(c));
    h += '<p>Nouvelles valeurs <b>appliquées automatiquement</b> aux calculs concernés, à partir de leur date d\'effet :</p>';
    Object.keys(byCat).forEach(cat=>{
      h += '<div class="section-label">'+esc(REG.categories[cat]||cat)+'</div>';
      byCat[cat].forEach(c=>{ h += '<div class="reg-row"><div class="rl">'+esc(c.label)+'</div><div class="rv">à partir du <b>'+fmtDate(c.du)+'</b> : <b>'+esc(fmtRegV(c.v,c.unit))+'</b>'+(c.old!==null?' (avant : '+esc(fmtRegV(c.old,c.unit))+')':'')+'</div></div>'; });
    });
    const imp = regImpacts(changes);
    if(imp.length) h += '<div class="section-label">Ce que ça change pour vous</div><div class="alerts">'+imp.map(x=>'<div class="alert warn">'+x+'</div>').join('')+'</div>';
  }
  const log = REG.changelog.slice(0, all ? 12 : 4);
  if(log.length){
    h += '<div class="section-label">Dernières évolutions</div>';
    log.forEach(l=>{ h += '<div class="reg-row"><div class="rv"><b>'+fmtDate(l.date)+'</b> · '+esc((l.cats||[]).map(c=>REG.categories[c]||c).join(', '))+'</div><div class="rl">'+esc(l.text)+'</div></div>'; });
  }
  h += '<p class="hint" style="margin-top:12px">Sources officielles à consulter en cas de doute : <a href="https://www.pajemploi.urssaf.fr/" target="_blank" rel="noopener">Pajemploi</a> · <a href="https://www.service-public.fr/particuliers/vosdroits/F2300" target="_blank" rel="noopener">Service-public (SMIC)</a> · <a href="https://www.urssaf.fr/accueil/actualites.html" target="_blank" rel="noopener">Urssaf</a> · <a href="https://www.impots.gouv.fr/" target="_blank" rel="noopener">impots.gouv</a> · <a href="https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000044594539" target="_blank" rel="noopener">Convention collective (Légifrance)</a></p>';
  setHTML('news-body', h); openOverlay('news-overlay');
}
async function regCheckUpdates(silent){
  const url = (STATE.settings.regUrl || 'reglementation.json');
  if(!navigator.onLine){ if(!silent) toast('Pas de connexion internet : réessayez plus tard.'); return; }
  if(location.protocol==='file:' && !STATE.settings.regUrl){
    if(!silent) showConfirmDialog('Mise à jour en ligne indisponible', 'Le carnet est ouvert comme un simple fichier : il ne peut pas télécharger la réglementation. Installez-le comme application (voir Aide) ou importez un fichier de réglementation. Voulez-vous ouvrir les sources officielles pour vérifier vous-même ?', ()=>showRegNews(true), 'Voir les sources', 'Fermer');
    return;
  }
  if(!silent) toast('Recherche des mises à jour…');
  try{
    const resp = await fetch(url + (url.indexOf('?')>=0?'&':'?') + 't=' + Date.now(), {cache:'no-store'});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    regApplyRemote(data, silent, !!STATE.settings.regUrl);
  }catch(e){
    STATE.regCheckedAt = STATE.regCheckedAt || null;
    if(!silent) showConfirmDialog('Recherche impossible', 'La source de réglementation n\'a pas répondu ('+e.message+'). Vos calculs utilisent la réglementation intégrée (version du '+fmtDate(REG.version)+'). Voulez-vous voir les sources officielles pour vérifier ?', ()=>showRegNews(true), 'Voir les sources', 'Fermer');
  }
}
function regValidate(d){
  if(!d || d.schema!==1 || typeof d.params!=='object' || !d.version) return false;
  return Object.values(d.params).every(p=>p && Array.isArray(p.values) && p.values.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.du) && x.v!==undefined));
}
/* Bornes de vraisemblance : une faute de frappe (SMIC à 1202, taux à 7,8 au lieu de 0,078…) est refusée */
const REG_BORNES = {smic:[5,30], salMin:[2,15], salMinTitre:[2,15], mg:[2,10], netRatio:[0.6,0.95], netRatioAM:[0.6,0.95], pss:[2000,10000],
  iePct:[0.5,1], iePctPM:[0.5,1], ieHeuresRef:[6,12], iePlancher:[1,10], cmgCHR:[2,15], cmgPlafondH:[4,25], cmgPlafond:[3000,20000], cmgPlancher:[0,3000],
  kmBaremeAdmin:[0.1,1], kmBaremeFiscal:[0.2,2], repasAvantage:[2,15], cpDixieme:[0.05,0.2], cpParMois:[2,3], cpMax:[24,36], ruptureDiviseur:[40,200],
  hsReduction:[0,0.3], csgNonDed:[0,0.1], assietteCsg:[0.9,1], seuilMaj:[35,50], majMin:[0,100], majFerie:[0,100], majPremierMai:[50,200], majReposHebdo:[0,100],
  abatMult:[1,10], abatMultMaj:[1,10], abatMult24:[1,10], abatHeuresJour:[6,12], hMaxJour:[8,24], hMaxSemaine:[35,60], agrementMax:[1,8], hsExoPlafond:[1000,20000]};
function regHorsBornes(d){
  const out = [];
  Object.keys((d && d.params) || {}).forEach(k=>{
    const p = d.params[k], b = REG_BORNES[k] || (/^cot/.test(k) ? [0,0.25] : null), ref = (REG_DEFAULT.params[k] || {}).values, last = ref && ref[ref.length-1];
    (p.values||[]).forEach(x=>{
      if(typeof x.v!=='number') return;
      if(!isFinite(x.v) || (b && (x.v < b[0] || x.v > b[1])) || (!b && last && typeof last.v==='number' && last.v > 0 && (x.v > last.v*3 || x.v < last.v/3)))
        out.push(((REG_DEFAULT.params[k]||{}).label || k)+' = '+x.v+' (au '+fmtDate(x.du)+')');
    });
  });
  return out;
}
function regApplyRemote(data, silent, demander){
  if(!regValidate(data)){ if(!silent) toast('Fichier de réglementation invalide : rien n\'a été modifié.'); return; }
  const hb = regHorsBornes(data);
  if(hb.length){ logError('réglementation refusée : '+hb.slice(0,3).join(' ; ')); if(!silent) showConfirmDialog('Réglementation refusée', 'Ce fichier contient des valeurs invraisemblables : rien n’a été modifié, vos calculs restent ceux d’avant.\n\n'+hb.slice(0,6).join('\n'), ()=>{}, 'Compris', 'Fermer'); return; }
  // autre source que celle du carnet (adresse choisie dans Réglages, ou fichier importé) : on montre d'abord ce qui change
  if(demander){
    const avant = regSnapshot(), garde = STATE.regRemote; STATE.regRemote = data; regBuild();
    const ch = regDiff(avant); STATE.regRemote = garde; regBuild();
    if(!ch.length){ if(!silent) toast('Rien ne change avec ce fichier.'); return; }
    showConfirmDialog('Appliquer ces '+ch.length+' changement(s) ?', 'Ce fichier ne vient pas de la source habituelle du carnet. Vérifiez les valeurs avant de les appliquer à tous vos calculs :\n\n'
      + ch.slice(0,10).map(c=>'• '+c.label+' : '+(c.old===null ? '' : JSON.stringify(c.old)+' → ')+JSON.stringify(c.v)+' (au '+fmtDate(c.du)+')').join('\n')+(ch.length>10 ? '\n…' : ''),
      ()=>regApplyRemote(data, silent, false), 'Oui, appliquer', 'Non');
    return;
  }
  const before = regSnapshot();
  STATE.regRemote = data; STATE.regCheckedAt = new Date().toISOString();
  regBuild(); saveNow();
  const changes = regDiff(before);
  regRenderStatus();
  if(CURRENT!=='home') recalc(CURRENT); else renderHome();
  if(changes.length) showRegNews(false, changes);
  else if(!silent) toast('Réglementation à jour (version du '+fmtDate(REG.version)+').');
}
function regImportPick(){ $('reg-file-input').click(); }
function regImportFile(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = e=>{ try{ regApplyRemote(JSON.parse(e.target.result), false, true); }catch(err){ toast('Fichier illisible.'); } if(CURRENT==='reglages') regRenderTable(); };
  r.readAsText(file); $('reg-file-input').value='';
}
function regRenderTable(){
  const cats = {};
  Object.keys(REG.params).forEach(k=>{ const p=REG.params[k]; (cats[p.cat]=cats[p.cat]||[]).push(k); });
  let h='';
  Object.keys(REG.categories).forEach(cat=>{
    if(!cats[cat]) return;
    h += '<details class="reg-cat help"><summary>'+esc(REG.categories[cat])+'</summary><div>';
    cats[cat].forEach(k=>{
      const p = REG.params[k], cur = R(k), du = Rdu(k), nx = Rnext(k);
      h += '<div class="reg-row" id="regrow-'+k+'"><div class="rl">'+esc(p.label)+(p.src?' <a class="reg-ic" href="'+esc(p.src)+'" target="_blank" rel="noopener" aria-label="Source officielle : '+esc(p.label)+'">↗</a>':'')+'</div>'
        + '<div class="rv">En vigueur : <b>'+esc(fmtRegV(cur,p.unit))+'</b> depuis le '+fmtDate(du)+(nx?' · prochaine valeur : <b>'+esc(fmtRegV(nx.v,p.unit))+'</b> le '+fmtDate(nx.du):'')
        + ' <a class="reg-ic" href="#" onclick="regEdit(\''+k+'\');return false;" aria-label="Modifier : '+esc(p.label)+'">✎</a></div>'
        + '<div class="rv">Historique : '+p.values.map(x=>fmtDate(x.du)+' → '+esc(fmtRegV(x.v,p.unit))+(x.manual?' <span class="manual">(saisi à la main)</span>':'')).join(' ; ')+'</div>'
        + (p.note?'<div class="hint">'+esc(p.note)+'</div>':'')+'</div>';
    });
    h += '</div></details>';
  });
  if(Object.keys(STATE.regManual||{}).length) h += '<button class="btn small danger" onclick="regClearManual()">Supprimer mes valeurs saisies à la main</button>';
  setHTML('reg-table', h);
}
function regEdit(k){
  const p = REG.params[k], cur = R(k);
  const isArr = Array.isArray(cur) && typeof cur[0]==='number';
  if(cur && typeof cur==='object' && !isArr){ toast('Cette valeur se modifie par fichier de réglementation.'); return; }
  const pct = p.unit==='ratio', montre = x=>pct ? fmtNum(x*100, 4).replace(/,?0+$/,'') : String(x).replace('.',',');
  askText('Date d\u2019effet : '+p.label, 'À partir de quel jour la nouvelle valeur s\u2019applique-t-elle ? (valeur actuelle : '+fmtRegV(cur, p.unit)+')', iso(today()), du=>{
    if(!parseD(du)){ toast('Date non reconnue.'); return; }
    askText('Nouvelle valeur : '+p.label, (pct ? 'En pourcentage (ex. 1,04 pour 1,04 %).' : isArr ? 'Plusieurs nombres séparés par « ; ».' : 'Unité : '+(p.unit||'—')+'.')+' Elle s\u2019appliquera à partir du '+fmtDate(du)+', à tous les calculs concernés.', isArr ? cur.map(montre).join(' ; ') : montre(cur), txt=>{
      const lire = s=>parseFloat(String(s).trim().replace(/\s/g,'').replace(',','.'));
      let v = isArr ? String(txt||'').split(';').map(lire) : lire(txt);
      if(isArr ? v.some(isNaN) : isNaN(v)){ toast('Valeur non reconnue.'); return; }
      if(pct) v = Math.round(v/100*1e8)/1e8;
      if(!isArr && v<0){ toast('Une valeur négative n\u2019est pas possible.'); return; }
      if(!isArr && typeof cur==='number' && cur>0 && (v > cur*3 || v < cur/3)){ if(!confirm('Cette valeur est très différente de l\u2019actuelle ('+fmtRegV(cur,p.unit)+'). La garder quand même ?')) return; }
      STATE.regManual[k] = (STATE.regManual[k]||[]).filter(x=>x.du!==du).concat([{du, v}]);
      auditLog('', 'Réglementation modifiée à la main : '+p.label+' = '+fmtRegV(v,p.unit)+' à partir du '+fmtDate(du));
      regBuild(); saveNow(); regRenderTable(); regRenderStatus();
      if(CURRENT!=='home' && CURRENT!=='reglages') recalc(CURRENT);
      toast('Valeur ajoutée : elle s\u2019applique à partir du '+fmtDate(du)+' dans tous les calculs.');
    });
  }, {type:'date'});
}
function regClearManual(){
  showConfirmDialog('Supprimer vos valeurs ?', 'Les valeurs saisies à la main seront supprimées ; les valeurs officielles du carnet s\'appliqueront.', ()=>{ STATE.regManual={}; regBuild(); saveNow(); regRenderTable(); regRenderStatus(); }, 'Oui', 'Annuler');
}

/* ---------------------------------- Aide ---------------------------------- */
const AIDE = [
  ['Je débute : comprendre les calculs', 'La rubrique <b>Outils ▸ Se former</b> explique pas à pas, avec des exemples chiffrés, le contrat, le salaire mensualisé, la paie de chaque mois, les absences, les congés et la fin du contrat. Comptez environ une heure en tout, chapitre par chapitre. <br><button type="button" class="btn small" style="margin-top:6px" onclick="showTheme(\'formation\')">Ouvrir la formation</button>'],
  ['Mes données, l\u2019éditeur et les limites du carnet', 'Tout reste sur ce téléphone ; l\u2019application est indépendante des organismes officiels. <br><button type="button" class="btn small" style="margin-top:6px" onclick="showTheme(\'apropos\')">À propos et confidentialité</button>'],
  ['Comment commencer ?', 'Sur l\'accueil, touchez <b>« Ajouter un enfant »</b> et répondez aux questions (prénom, dates, planning, tarif). Recommencez pour chaque enfant (4 en cours au maximum). Ensuite, chaque calcul se remplit tout seul : choisissez l\'enfant en haut de l\'écran. Pour un calcul ponctuel, choisissez « Saisie libre ». Renseignez aussi une fois « Mes coordonnées » (Réglages) pour les documents.'],
  ['Chaque mois : 3 étapes', 'Dans l\'onglet <b>Mois</b>, chaque enfant a sa carte avec 3 étapes, à faire dans l\'ordre :<br>1. <b>Vérifier et valider les chiffres</b> : le résultat et le bloc orange « Ce que les parents recopient sur Pajemploi » sont en haut ; ne corrigez en dessous que ce qui a changé (absence, heures en plus, jour férié, congés). Touchez « Valider ce mois » : le mois est gardé et sert ensuite aux congés, à la fin de contrat et aux impôts.<br>2. <b>Envoyer aux parents</b> : le récapitulatif part par SMS ou mail. Ce sont les parents qui déclarent sur Pajemploi, entre le 25 et le 5.<br>3. <b>Salaire reçu</b> : notez la date du paiement.<br>Si le bulletin Pajemploi donne un autre net, corrigez le mois et validez-le à nouveau.'],
  ['Année incomplète : semaines sans accueil pas encore connues', 'Souvent, les parents ne connaissent pas à l\'avance toutes leurs dates de vacances. Dans la fiche de l\'enfant, répondez « Pas encore » : le contrat indique seulement le <b>nombre</b> de semaines d\'accueil par an, et c\'est lui qui fixe le salaire mensualisé (juste dès le premier mois). Ensuite, à chaque fois que les parents vous donnent une semaine sans accueil, touchez <b>📅 Semaine sans accueil</b> (onglet Enfants, ou sur la carte du mois) : l\'entretien et les repas de ce mois sont recalculés. En attendant, le carnet compte les congés avec le nombre de semaines du contrat (jamais plus) et vous rappelle combien de semaines restent à noter avant la date anniversaire. En fin de contrat, il vous prévient si des semaines semblent manquer, car la régularisation serait sinon trop élevée. Bon à savoir : prévoyez dans le contrat un délai pour que les parents vous préviennent (par exemple un mois).'],
  ['Une semaine sur deux, rythmes irréguliers : le calcul du salaire', 'Le salaire mensualisé est toujours : heures d\'une semaine moyenne × nombre de semaines payées ÷ 12.<br>• <b>Une semaine sur deux, année complète</b> : moyenne des semaines 1 et 2 × 52 ÷ 12 (une semaine sans accueil compte pour 0 h). Exemple : 50 h et 32 h → 41 h × 52 ÷ 12 = 177,67 h.<br>• <b>Une semaine sur deux, année incomplète</b> : moyenne des seules semaines où l\'enfant vient × nombre de ces semaines ÷ 12. Exemple : le mercredi une semaine sur deux pendant la période scolaire = 8 h × 18 semaines ÷ 12 = 12 h (et non 36 semaines, qui doublerait le salaire).<br>• <b>Autre rythme</b> (cycle de 3 ou 4 semaines, horaires différents pendant les vacances) : indiquez le total d\'heures prévu sur l\'année ; le salaire est ce total ÷ 12. Ces trois méthodes donnent le même résultat pour un même planning : ce sont des façons équivalentes de calculer la moyenne prévue par la convention collective.<br>Un accueil vraiment occasionnel, sans planning, ne se mensualise pas : il se paie aux heures faites.'],
  ['Comprendre un résultat (fiche explicative)', 'Sous chaque résultat, le bouton <b>🧾 Comprendre ce résultat</b> ouvre une fiche en mots simples : ce qui a été pris en compte, chaque calcul avec ses chiffres, le résultat et ce qu\'il faut retenir. Dans l\'onglet <b>Mois</b>, le lien « Comprendre ces chiffres » fait de même pour chaque enfant, avec ou sans suivi au jour le jour. La fiche s\'imprime ou s\'enregistre en PDF (bouton en bas de la fiche) : pratique pour l\'expliquer aux parents ou la garder avec vos papiers.'],
  ['Le suivi au jour le jour (facultatif)', 'Chaque soir, ouvrez <b>Suivi au jour le jour</b> : pour une journée normale, un appui sur <b>« Conforme »</b> (ou « Tout conforme » pour tous les enfants). En cas de changement, touchez « Noter un changement ou une absence » : heures réelles, motif d\'absence, repas, kilomètres, frais avancés avec photo du ticket, certificat, note. En fin de mois, l\'étape 1 de l\'onglet <b>Mois</b> reprend ces vrais chiffres ; une fois le mois validé, les journées ne se modifient plus, sauf par une régularisation tracée. Sans suivi, tous les calculs partent du planning : notez alors vos semaines de congés dans <b>Réglages</b>.'],
  ['Un contrat déjà commencé', 'Vous pouvez ajouter un enfant accueilli depuis longtemps. Indiquez la vraie date de début du contrat, puis ouvrez « Contrat déjà commencé : reprendre les compteurs » : date à partir de laquelle vous suivez l\'enfant dans le carnet, salaires déjà versés, congés restants, absences pour maladie déjà déduites. Les calculs (congés, fin de contrat, absences) en tiennent compte et le suivi ne vous demande rien avant cette date.'],
  ['Avenant ou correction ?', 'Quand vous modifiez le planning ou le salaire d\'un enfant, le carnet demande s\'il s\'agit d\'un <b>avenant</b> (à partir d\'une date : les mois d\'avant restent calculés avec les anciennes valeurs, et un avenant au milieu d\'un mois est réparti sur les deux périodes) ou d\'une <b>correction</b> d\'erreur (tout est recalculé).'],
  ['Que devient un contrat terminé ?', 'Touchez « Fin de contrat » sur la carte de l\'enfant et indiquez le dernier jour (fin du préavis). Le contrat reste affiché jusqu\'à cette date, puis <b>se range tout seul</b> dans « Contrats terminés » : il <b>libère sa place</b> pour un nouvel enfant mais <b>garde toutes ses données</b> (mois validés, calculs, documents), utiles pour vos impôts, une attestation ou un litige. Inutile de le supprimer. Une suppression efface tout définitivement : faites d\'abord une copie de sécurité. Conservez vos justificatifs au moins 5 ans.'],
  ['Les documents', 'Le thème « Documents » prépare, pour chaque enfant : la fiche d\'embauche (ce qu\'il faut saisir à la CAF et sur Pajemploi), le contrat de travail, les autorisations, l\'avenant, le récapitulatif annuel, les lettres de retrait ou de démission, le certificat de travail et le reçu pour solde de tout compte. Tout se pré-remplit à partir de « Mes coordonnées » et du contrat. Ce sont des modèles à relire et signer.'],
  ['Année complète ou incomplète ?', '<b>Année complète</b> : l\'enfant vient toutes les semaines de l\'année, sauf pendant vos congés payés. Le salaire est calculé sur 52 semaines et vos congés payés sont compris dedans.<br><b>Année incomplète</b> : l\'enfant ne vient pas certaines semaines en plus de vos congés (vacances scolaires, par exemple). Le salaire est calculé sur les seules semaines d\'accueil, et les congés payés sont payés en plus.'],
  ['Brut, net : quelle différence ?', 'Le <b>brut</b> est le salaire avant cotisations sociales. Le <b>net</b> est ce que vous recevez vraiment (environ 78 % du brut). Le carnet donne une estimation ; le montant exact est celui calculé par Pajemploi.'],
  ['Le salaire mensualisé', 'Pour que vous touchiez la même somme chaque mois, on « lisse » les heures de l\'année : heures par semaine × nombre de semaines ÷ 12 × salaire horaire. Le salaire horaire ne peut jamais être inférieur au minimum légal : le carnet vous prévient et applique le minimum d\'office.'],
  ['Heures complémentaires et majorées', 'Les heures en plus du contrat sont payées au tarif normal jusqu\'à 45 h dans la semaine. Au-delà de 45 h, elles sont <b>majorées</b> (10 % au minimum). Elles sont exonérées d\'impôt dans une limite annuelle.'],
  ['Les indemnités d\'entretien', 'Elles remboursent vos frais (eau, chauffage, jouets, produits…). Elles sont dues pour chaque jour où l\'enfant est présent, au minimum 90 % du « minimum garanti » pour 9 h d\'accueil, calculé selon la durée de la journée, jamais moins de 2,65 € par jour. Ce n\'est pas du salaire : pas de cotisations.'],
  ['Les congés payés', 'Vous gagnez 2,5 jours ouvrables par mois d\'accueil (30 jours par an au maximum), du 1er juin au 31 mai. Un arrêt maladie donne aussi des congés (2 jours par mois). On prend d\'abord les jours les plus anciens. Le montant payé est le plus avantageux pour vous entre le « maintien de salaire » et 10 % des salaires de l\'année. Si vous ne notez pas vos journées, indiquez vos périodes de congés dans <b>Réglages ▸ Mes congés payés</b> : elles sont décomptées automatiquement et l\'entretien n\'est pas compté ces jours-là.'],
  ['Absences et mois incomplet', 'La méthode de la Cour de cassation sert à retirer du salaire mensualisé les heures d\'une absence <b>non payée</b> :<br>✅ arrivée ou départ en cours de mois, premier mois avec adaptation (obligatoire depuis 2022) ;<br>✅ votre arrêt maladie, accident du travail, maternité ou paternité (vous êtes indemnisée par la CPAM et l\'IRCEM) ;<br>✅ congé sans solde ou congés payés pas encore acquis, votre enfant malade, autre absence non payée ;<br>✅ événement familial, seulement pour les jours pris au-delà de ceux prévus par la loi ;<br>✅ enfant accueilli malade avec certificat : 5 jours au plus par période de 12 mois (plus en cas d\'hospitalisation ou de maladie de 14 jours et plus).<br>⛔ On ne déduit <b>jamais</b> : l\'absence de l\'enfant voulue par les parents ou une fermeture qu\'ils imposent, l\'enfant malade sans certificat ou au-delà des 5 jours, vos congés payés en année complète, les semaines non prévues en année incomplète, les jours fériés chômés, les événements familiaux dans la limite légale.<br>Le thème « Mois incomplet &amp; absences » vous guide motif par motif.'],
  ['Impôt sur le revenu (prélèvement à la source)', 'Par défaut, le carnet considère que vous n\'êtes pas imposable (c\'est le cas le plus fréquent grâce à l\'abattement des assistantes maternelles) : aucun impôt n\'est retenu. Si vous êtes imposée, indiquez dans Réglages ▸ Ma paie le taux de votre bulletin Pajemploi : Pajemploi retient alors l\'impôt sur le salaire net et le prélève chez les parents, qui vous versent le salaire après impôt plus les indemnités. Avec Pajemploi+, Pajemploi vous verse directement le salaire après impôt. Le crédit d\'impôt et l\'aide CMG des parents ne changent pas.'],
  ['Calculer un salaire sans fiche ni suivi', 'Outils ▸ « Salaire mensualisé » ▸ « Calcul rapide » : heures, jours, salaire horaire et, si vous voulez, jours d\'accueil, entretien, repas et mode de paiement des congés. Vous obtenez le salaire mensualisé, l\'entretien, les repas, le total à verser et les chiffres Pajemploi d\'un mois complet. « ➜ Salaire d\'un mois » prépare le mois choisi avec ses vrais jours et ses jours fériés ; pour une absence, indiquez les jours et heures non travaillés : la retenue se calcule toute seule. Ces chiffres remplissent aussi « Mois incomplet », « Indemnités d\'entretien », « Congés payés » et « Fin de contrat » en saisie libre. « ➜ Calcul complet sans fiche » prépare un contrat de calcul à partir de ces chiffres.'],
  ['Vérifier tous les calculs sans créer de fiche', 'Outils ▸ « Calcul complet sans fiche » : décrivez un contrat en 5 étapes (prénom facultatif), puis ouvrez chaque outil dans l\'ordre : salaire mensualisé, contrat imprimé, salaire de chaque mois et chiffres Pajemploi, absences, entretien, récapitulatif aux parents, aide CMG, congés payés, fin de contrat, certificat et solde de tout compte. Ce calcul n\'apparaît ni dans vos enfants, ni dans vos alertes, ni dans vos impôts. Dans chaque outil, « Saisie libre » reste possible pour un calcul ponctuel case par case.'],
  ['Heures en plus et jour de repos', 'La limite de 45 h se compte semaine par semaine : dans « Salaire du mois », « Calculer semaine par semaine » sépare tout seul les heures complémentaires (salaire normal) et majorées (au moins +10 %). Un accueil exceptionnel le jour du repos hebdomadaire (souvent le dimanche) est majoré de 25 %, ou compensé par un repos payé allongé d\'autant. Au plus 13 h par jour (11 h de repos entre deux journées) et 24 h de repos consécutif chaque semaine.'],
  ['Jours de fractionnement', 'Si une partie de votre congé principal (les 4 premières semaines) est prise entre le 1er novembre et le 30 avril, vous avez droit à 1 jour de congé en plus (3 à 5 jours pris à cette période) ou 2 jours (6 jours et plus), sauf si vous y avez renoncé par écrit. Le carnet le signale et l\'ajoute aux congés restants en fin de contrat.'],
  ['Jours fériés', 'Un jour férié non travaillé qui tombe un jour d\'accueil prévu est payé (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée). Le 1er mai travaillé est payé double ; un autre jour férié travaillé est majoré de 10 %. Le contrat dit si les fériés (sauf le 1er mai) sont chômés ou travaillés : le carnet applique ce choix tout seul. Pas d\'entretien ni de repas un férié chômé. Pendant vos congés, un férié chômé ne compte pas comme jour de congé, même s\'il tombe un samedi. Un férié pendant votre arrêt maladie n\'est pas payé par les parents. Année incomplète : un férié pendant une semaine sans accueil ne change rien (déjà compris dans la mensualisation). Le carnet connaît tous les jours fériés, y compris ceux d\'Alsace-Moselle (Vendredi saint, 26 décembre) et des départements d\'outre-mer (abolition de l\'esclavage), à activer dans les Réglages. Lundi de Pentecôte : travaillé sans supplément seulement s\'il a été fixé par écrit comme journée de solidarité.'],
  ['Fin de contrat', 'Préavis : 8 jours si moins de 3 mois d\'ancienneté, 15 jours jusqu\'à 1 an, 1 mois au-delà. Les parents qui retirent l\'enfant après 9 mois doivent l\'indemnité de rupture (1/80ᵉ de tous les salaires bruts du contrat), sauf faute grave. Il faut aussi payer les congés non pris et, en année incomplète, faire la régularisation. Documents : certificat de travail, attestation France Travail, solde de tout compte.'],
  ['Impôts : l\'abattement', 'Vous avez droit à un régime spécial : on déduit, pour chaque enfant et chaque jour de présence, 3 fois le SMIC horaire (4 fois pour un enfant handicapé). <b>Attention</b> : le montant pré-rempli sur votre déclaration ne tient pas compte de cet abattement. Il faut le corriger vous-même. Le carnet vous donne les chiffres à mettre et vérifie si le régime ordinaire n\'est pas plus avantageux.'],
  ['L\'aide CMG des parents', 'La CAF (ou la MSA) aide les parents à vous payer : c\'est le complément de libre choix du mode de garde (CMG). Il dépend de leurs revenus, du nombre d\'enfants et des heures d\'accueil. Le carnet l\'estime pour vous aider à présenter votre tarif. Les cotisations sociales sont aussi prises en charge.'],
  ['Pajemploi', 'Chaque mois, ce sont les parents (vos employeurs) qui déclarent votre salaire sur Pajemploi, entre le 25 du mois et le 5 du mois suivant. « Salaire du mois &amp; Pajemploi » donne exactement les chiffres à recopier : heures, jours d\'activité, jours de congés, salaire net, indemnités ; le bouton « Envoyer le récapitulatif aux parents » les leur transmet (un seul message pour les frères et sœurs de la même famille, mais une déclaration Pajemploi par enfant). Avec <b>Pajemploi+</b>, Pajemploi vous verse directement le salaire et prélève les parents.'],
  ['Agrément et durées maximales', 'Votre agrément fixe le nombre d\'enfants accueillis en même temps (4 en général). Au plus 13 h par jour (11 h de repos obligatoire) et 48 h par semaine en moyenne (plus seulement avec votre accord écrit, 2 250 h par an au maximum). Le carnet vous alerte en cas de dépassement.'],
  ['Les mises à jour de la loi', 'Chaque montant légal (SMIC, minimum garanti, salaire minimum, barème CMG, abattement…) est enregistré avec sa <b>date d\'effet</b>. Le bouton « Rechercher les mises à jour » télécharge les nouvelles valeurs : elles s\'appliquent automatiquement aux calculs concernés, à partir de la bonne date, et le carnet vous dit ce qui change pour chaque enfant. Vous pouvez aussi ajouter une valeur vous-même (Réglages ▸ ✎).'],
  ['Mes données et mon téléphone', 'Tout est enregistré <b>uniquement sur votre téléphone</b> : rien n\'est envoyé sur internet. Protégez le téléphone lui-même par un code, un schéma ou une empreinte : le code du carnet cache l\'écran mais ne chiffre pas les données. N\'ouvrez le carnet que dans une seule fenêtre à la fois. Si le téléphone est perdu, volé ou cassé, ou si vous effacez les données du navigateur, vous perdez tout, sauf si vous avez une <b>copie de sécurité rangée ailleurs</b>. Faites-la au moins une fois par mois (Outils ▸ Mes données ▸ « Faire une copie de sécurité ») et envoyez-la à vous-même : Google Drive, iCloud ou un mail à votre adresse, jamais aux parents. Notez le mot de passe sur papier. Le fichier ne s\'ouvre pas tout seul : sur le nouvel appareil, ouvrez le carnet puis « Restaurer une copie ».'],
  ['Passer sur une tablette ou un nouveau téléphone', '1. Sur l\'ancien appareil (s\'il marche encore) : « Faire une copie de sécurité », puis envoyez-la sur votre Google Drive ou par mail à vous-même.<br>2. Sur le nouvel appareil : ouvrez l\'adresse du carnet (Outils ▸ Mes données ▸ « M\'envoyer l\'adresse du carnet ») et installez-le.<br>3. Récupérez le fichier : dans Drive, touchez-le puis ⋮ ▸ Télécharger ; dans un mail, enregistrez la pièce jointe.<br>4. Dans le carnet : « Restaurer une copie », choisissez le fichier, tapez le mot de passe.<br>5. Ensuite, saisissez seulement sur le nouvel appareil : le téléphone et la tablette <b>ne se synchronisent pas</b>. En cas d\'erreur, « Annuler la restauration » remet les données d\'avant (30 jours).'],
  ['Avant de vendre ou donner votre téléphone', 'Faites une copie de sécurité et vérifiez qu\'elle est bien sur votre Drive ou dans vos mails, puis Réglages ▸ « Tout effacer » : les fiches, les calculs et les photos de certificats sont supprimés de l\'appareil.'],
  ['Installer l\'application sur Android', '1. Ouvrez l\'adresse du carnet dans <b>Chrome</b>.<br>2. Touchez le menu <b>⋮</b> en haut à droite.<br>3. Choisissez <b>« Installer l\'application »</b> (ou « Ajouter à l\'écran d\'accueil »).<br>L\'icône apparaît avec vos autres applications ; le carnet fonctionne ensuite même sans internet.'],
  ['Reprendre là où j\'en étais', 'Tout ce que vous saisissez est enregistré au fur et à mesure, sur chaque écran. Si vous quittez l\'application (appel, écran éteint, fermeture), elle rouvre <b>au même endroit</b> : même écran, même enfant, même mois, fiche ou journée en cours de saisie comprise. Après une longue absence, elle rouvre sur « Aujourd\'hui » et propose de reprendre. Les données de la version « fichier » et celles de l\'application installée sont séparées : passez de l\'une à l\'autre avec « Copie de sécurité » puis « Restaurer une copie ». Même principe pour changer de téléphone.'],
  ['Mises à jour de l\'application', 'Quand une nouvelle version est disponible, un bandeau « Mettre à jour » apparaît en bas de l\'écran. Vos données ne sont jamais touchées par une mise à jour. Les valeurs légales, elles, se mettent à jour séparément (Outils ▸ Réglementation).'],
  ['Départ à la retraite', 'Depuis 2023, l\'assistante maternelle qui part volontairement à la retraite après au moins 10 ans d\'activité a droit à une indemnité conventionnelle calculée sur l\'ensemble de sa carrière (salaires des 5 dernières années, tous employeurs). Le carnet ne la calcule pas : renseignez-vous auprès de l\'IRCEM et de Pajemploi. Pour chaque employeur, la fin de contrat suit les règles de la démission (préavis), sans indemnité de rupture.'],
  ['iPhone et iPad', 'Ouvrez l\'adresse du carnet dans <b>Safari</b>, touchez <b>Partager</b> (carré avec une flèche) puis <b>« Sur l\'écran d\'accueil »</b>. Important : sur iPhone, un site non installé peut voir ses données effacées après quelques semaines sans visite ; installez donc l\'application et faites des copies de sécurité régulières.'],
  ['Outre-mer', 'Le carnet utilise les valeurs de la métropole. À Mayotte, le SMIC et certaines règles diffèrent : vérifiez les montants auprès de Pajemploi avant de vous en servir.'],
  ['Limites du carnet', 'Les résultats sont des <b>estimations</b> établies avec la réglementation connue. En cas de litige, les montants officiels sont ceux de Pajemploi, de la CAF/MSA, de l\'administration fiscale et de la convention collective. Pour un conseil personnalisé : votre relais petite enfance (RPE), la DREETS, ou un syndicat/une association d\'assistants maternels.']
];
function renderAide(){
  setHTML('aide-content', AIDE.map(a=>'<details class="help"><summary>'+a[0]+'</summary><div>'+a[1]+'</div></details>').join('')
    + '<details class="help"><summary>📖 Lexique : tous les mots expliqués</summary><div>'+(typeof lexiqueHTML==='function'?lexiqueHTML():'')+'</div></details>'
    + ((STATE.errors||[]).length ? '<button class="btn small" onclick="copyErrorReport()">Copier le rapport technique ('+STATE.errors.length+')</button>' : '')
    + '<p class="hint" style="margin-top:14px">Carnet Assmat version '+APP_VERSION+' · réglementation du '+fmtDate(REG.version)+'.</p>');
}

/* ---------------------------------- Application installable (PWA) ---------------------------------- */
let _installEvt = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _installEvt = e; show('install-box', true); });
window.addEventListener('appinstalled', ()=>{ show('install-box', false); toast('Application installée.'); });
function installApp(){ if(_installEvt){ _installEvt.prompt(); _installEvt.userChoice.finally(()=>{ _installEvt=null; show('install-box', false); }); } }
/* Service worker : voir shell.js (proposition de mise à jour sans perte de données) */
/* Enregistrement immédiat quand l'appli passe en arrière-plan (téléphone) */
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden'){ if(CURRENT!=='home') persistTheme(CURRENT); saveNow(); } });
window.addEventListener('pagehide', ()=>{ if(CURRENT!=='home') persistTheme(CURRENT); saveNow(); });

/* ---------------------------------- Code de verrouillage ---------------------------------- */
async function pinHash(p){
  try{ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('carnet-assmat:'+p)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  catch(e){ let h=0; for(const ch of 'carnet-assmat:'+p){ h=((h<<5)-h+ch.charCodeAt(0))|0; } return 'x'+h; }
}
async function setPin(){
  const p = val('set-pin-new').trim();
  if(!/^\d{4,8}$/.test(p)){ toast('Le code doit avoir 4 à 8 chiffres.'); return; }
  STATE.settings.pin = await pinHash(p); saveNow(); setVal('set-pin-new',''); toast('Code enregistré : il sera demandé à l\'ouverture.');
}
function removePin(){ showConfirmDialog('Supprimer le code ?', 'Le carnet s\'ouvrira sans code.', ()=>{ STATE.settings.pin=''; saveNow(); toast('Code supprimé.'); }, 'Supprimer', 'Annuler'); }
function lockNow(){ setVal('lock-input',''); setTxt('lock-msg',''); openOverlay('lock-overlay'); setTimeout(()=>{ const i=$('lock-input'); if(i) i.focus(); }, 100); }
async function unlock(){
  if(await pinHash(val('lock-input').trim()) === STATE.settings.pin){ closeOverlay('lock-overlay'); }
  else { setTxt('lock-msg', 'Code incorrect. Code oublié ? Restaurez votre dernière copie de sécurité (ci-dessous) : le code sera supprimé et vous pourrez en choisir un nouveau.'); }
}
let _hiddenAt = 0;
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden') _hiddenAt = Date.now();
  else if(STATE.settings.pin && _hiddenAt && Date.now()-_hiddenAt > 5*60000) lockNow();
});

/* ---------------------------------- Démarrage ---------------------------------- */
function init(){
  const st = loadState();
  regBuild(); applyTheme();
  buildWeek('ct-wA','ct-wA'); buildWeek('ct-wB','ct-wB');
  buildCpPeriods(); buildFinAvenants(); buildAbattement(); buildCmg(); fillMotifSelect();
  initSegs(document); rememberSegDefaults();
  // choix de l'enfant et dates qui changent l'indemnité de rupture
  ['fin-qui','fin-faute'].forEach(id=>$(id).addEventListener('click', ()=>{ finAutoRupture(); VIS.fin(); CALC.fin(); }));
  $('sync-file-input').addEventListener('change', e=>syncImportFile(e.target.files[0]));
  $('reg-file-input').addEventListener('change', e=>regImportFile(e.target.files[0]));
  try{ history.replaceState({theme:'home'}, '', '#'); }catch(e){}
  showHome(true);
  if(STATE.settings.pin) lockNow();
  try{ const tm = sessionStorage.getItem('carnet-toast'); if(tm){ sessionStorage.removeItem('carnet-toast'); setTimeout(()=>toast(tm), 900); } }catch(e){}
  if(STATE.settings.zone && !((STATE.vacances||{})[STATE.settings.zone]||[]).length && navigator.onLine) loadVacances(STATE.settings.zone, true);
  if(st==='migrated') toast('Vos données de l\'ancienne version (impôts, CMG) ont été reprises.');
  if(!storageOK) toast('⚠️ Ce navigateur n\'autorise pas l\'enregistrement (navigation privée ?).');
  if(STATE.settings.autoreg && (!STATE.regCheckedAt || (Date.now()-new Date(STATE.regCheckedAt))/86400000 >= 7)) setTimeout(()=>regCheckUpdates(true), 1500);
}
/* init() est lancé à la fin de shell.js, une fois tous les modules chargés */
