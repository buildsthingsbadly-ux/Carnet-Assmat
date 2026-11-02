/* =====================================================================================
   CONTRATS (jusqu'à 8 enfants en cours), ACCUEIL, POINTS D'ATTENTION, NAVIGATION
   ===================================================================================== */
'use strict';
// contrats en cours au même moment (l'agrément limite les enfants présents EN MÊME TEMPS, pas le nombre de contrats :
// accueil périscolaire, mercredis, alternance… ; contrôle jour par jour dans les points d'attention)
const MAX_ENFANTS = 8;

function newContrat(){
  return { id:'c'+Date.now().toString(36), enfant:'', famille:'', naissance:'', handicap:0,
    debut:'', fin:'', type:0, semaines:'', titre:0, alterne:0, alterneRef:0, wA:['','','','','','',''], wB:['','','','','','',''],
    taux:'', maj:'', ieMode:0, ieMontant:'', repasMode:0, repasPrix:'', km:'', cpMode:1,
    // coordonnées (facultatives, servent aux documents)
    enfantNom:'', parent1:'', parent2:'', adresse:'', tel:'', email:'', adaptation:'', paiementJour:'',
    kmTaux:'', horaires:0, tA:[], tB:[], semOff:[], hist:[], rep:null };
}
function getContrat(id){ return STATE.contrats.find(c=>c.id===id) || null; }
function contratLabel(c){ return (c.enfant||'Enfant sans nom') + (c.famille ? ' ('+c.famille+')' : '') + (contratTermine(c) ? ' — terminé' : ''); }
/* Un contrat dont la date de fin est passée se range tout seul dans « Contrats terminés » :
   il ne compte plus parmi les 4 places, mais toutes ses données restent conservées. */
function contratTermine(c, when){ const fin = parseD(c.fin); return !!(fin && fin < (when ? parseD(when) : today())); }
function contratsEnCours(){ return STATE.contrats.filter(c=>!contratTermine(c)); }
function placesMax(){ return Math.max(MAX_ENFANTS, parseInt(STATE.settings.agrement)||MAX_ENFANTS); }
function contratActif(c, when){
  const d = when ? parseD(when) : today();
  const deb = parseD(c.debut), fin = parseD(c.fin);
  if(deb && d < deb) return false;
  if(fin && d > fin) return false;
  return true;
}
/* ---------- Journal des mois validés (un enregistrement par enfant et par mois) ---------- */
function journalOf(id){ return (STATE.journal && STATE.journal[id]) || {}; }
/* Totaux sur une période (mois 'AAAA-MM' inclus) */
function journalTotals(id, fromM, toM){
  const t = {n:0, brut:0, net:0, netImp:0, ie:0, repas:0, km:0, hReel:0, hContrat:0, brutMensu:0, hDecl:0, jCP:0, cpMontant:0, cp12:0, j8:0, hm8:0, mois:[]};
  const c = typeof getContrat==='function' ? getContrat(id) : null;
  Object.entries(journalOf(id)).sort().forEach(([m, r])=>{
    if(fromM && m < fromM) return;
    if(toM && m > toM) return;
    t.n++; t.mois.push(m);
    ['brut','net','netImp','ie','repas','km','hReel','hContrat','brutMensu','hDecl','jCP','cpMontant','j8','hm8'].forEach(k=>t[k]+= +r[k]||0);
    // congés payés par 12ᵉ (versés d'avance chaque mois) : enregistrés à part depuis la 3.7.0 ; avant, déduits du contrat
    const cc = c ? paramsAt(c, parseD(m)) : null;
    t.cp12 += r.cp12!==undefined ? (+r.cp12||0) : (cc && cc.type===1 && cc.cpMode===0 ? (+r.cpMontant||0) : 0);
  });
  return t;
}
/* ---------- Avenants : chaque modification datée garde les anciennes valeurs pour les mois passés ---------- */
const PARAM_KEYS = ['type','semaines','semOffAVenir','hAn','jAn','titre','alterne','alterneRef','wA','wB','tA','tB','horaires','semOff','taux','maj','ieMode','ieMontant','repasMode','repasPrix','km','kmTaux','cpMode'];
function paramsAt(c, when){
  if(!c || !Array.isArray(c.hist) || !c.hist.length) return c;
  const k = iso(parseD(when) || today());
  const h = c.hist.slice().sort((a,b)=>a.jusqua<b.jusqua?-1:1).find(x=>k <= x.jusqua);
  return h ? Object.assign({}, c, clone(h.p)) : c;
}
/* Date de début de l'alternance en vigueur au jour d : début du contrat, ou date d'effet de l'avenant qui a mis
   en place l'alternance (un avenant qui change seulement le tarif ne décale pas les semaines A et B). */
function debutAlternance(c, d){
  const H = Array.isArray(c.hist) ? c.hist.slice().sort((a,b)=>a.jusqua<b.jusqua?-1:1) : [];
  if(!H.length) return parseD(c.debut);
  const k = iso(parseD(d) || today());
  // versions successives : [début, fin, paramètres]
  const V = []; let from = c.debut || '';
  H.forEach(h=>{ V.push([from, h.jusqua, h.p]); from = iso(addDays(parseD(h.jusqua), 1)); });
  V.push([from, '9999-12-31', c]);
  let i = V.findIndex(v=>k <= v[1]); if(i<0) i = V.length-1;
  while(i>0 && V[i-1][2] && V[i-1][2].alterne) i--;
  return parseD(V[i][0]) || parseD(c.debut);
}
function paramsOf(c){ const p={}; PARAM_KEYS.forEach(k=>p[k]=clone(c[k]===undefined?null:c[k])); return p; }
/* Heures « HH:MM » <-> minutes */
function hmToMin(t){ const m=/^(\d{1,2}):(\d{2})/.exec(t||''); return m ? (+m[1])*60+(+m[2]) : null; }
function minToHM(n){ if(n===null||n===undefined||isNaN(n)) return ''; n=Math.round(n); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function fmtH(min){ if(!min) return '0 h'; const sg=min<0?'-':''; min=Math.abs(Math.round(min)); return sg+Math.floor(min/60)+' h'+(min%60?String(min%60).padStart(2,'0'):''); }
function wNums(w){ return (w||[]).map(x=>{ const v=parseFloat(String(x).replace(',','.')); return isNaN(v)||v<0?0:v; }); }

/* Tout ce qui découle d'un contrat, à une date donnée (minimum légal, MG… en vigueur ce jour-là) */
function derive(c, when){
  const d = when ? parseD(when) : today();
  c = paramsAt(c, d);
  const A = wNums(c.wA), B = c.alterne ? wNums(c.wB) : A;
  const sum = a=>a.reduce((s,x)=>s+x,0), cnt = a=>a.filter(x=>x>0).length;
  const hA=sum(A), hB=sum(B), jA=cnt(A), jB=cnt(B);
  const seuil = R('seuilMaj', d);
  const majA=Math.max(0,hA-seuil), majB=Math.max(0,hB-seuil);
  const semaines = c.type===1 ? (parseFloat(c.semaines)||0) : 52;
  const {moyH, moyJ, moyMaj} = rythmeMoyen(c.type, c.alterne, hA, hB, jA, jB, majA, majB), moyNorm = moyH-moyMaj;
  let hNormMensu = moyNorm*semaines/12, hMajMensu = moyMaj*semaines/12;
  let joursMensu = moyJ*semaines/12;
  // planning irrégulier : total d'heures (et de jours) prévu sur l'année ÷ 12, méthode équivalente admise
  const hAn = parseFloat(String(c.hAn||'').replace(',','.'))||0, jAn = parseFloat(String(c.jAn||'').replace(',','.'))||0;
  const methode = hAn>0 ? 'annuel' : (c.alterne ? 'alterne' : 'semaine');
  if(hAn>0){ hMajMensu = Math.min(hMajMensu, hAn/12); hNormMensu = hAn/12 - hMajMensu; if(jAn>0) joursMensu = jAn/12; }
  const tauxMin = R(c.titre ? 'salMinTitre' : 'salMin', d);
  const tauxSaisi = parseFloat(c.taux)||0;
  const tauxEff = tauxSaisi ? Math.max(tauxSaisi, tauxMin) : 0;
  const tauxReleve = tauxSaisi>0 && tauxSaisi < tauxMin - 1e-9;
  const majPct = Math.max(parseFloat(c.maj)||R('majMin',d), R('majMin',d));
  const brutBase = hNormMensu*tauxEff + hMajMensu*tauxEff*(1+majPct/100);
  const cp12 = (c.type===1 && c.cpMode===0) ? brutBase*(R('cpDixieme', d)||0.10) : 0;
  const brut = brutBase + cp12;
  const net = netMensualise(brut, hMajMensu*tauxEff*(1+majPct/100), d);
  // Indemnité d'entretien : moyenne par jour d'accueil sur le planning (A et B)
  const jours = A.filter(x=>x>0).concat(B.filter(x=>x>0));
  let ieSum=0, ieSousMin=false;
  jours.forEach(h=>{
    const leg = ieLegalJour(h, d), prevu = ieContratJour(c, h, d);
    if(prevu && prevu < leg-1e-9) ieSousMin = true;
    ieSum += Math.max(prevu, leg);
  });
  const ieJour = jours.length ? ieSum/jours.length : 0;
  const ieMois = ieJour*joursMensu;
  const repasMois = c.repasMode===1 ? (parseFloat(c.repasPrix)||0)*joursMensu : 0;
  const km = parseFloat(c.km)||0;
  const maxJour = Math.max(0, ...A, ...B);
  return { A,B,hA,hB,jA,jB,moyH,moyJ,moyMaj,moyNorm,semaines,hNormMensu,hMajMensu,hMensu:hNormMensu+hMajMensu,joursMensu,
    tauxMin,tauxSaisi,tauxEff,tauxReleve,majPct,brutBase,cp12,brut,net,ieJour,ieMois,ieSousMin,repasMois,km,
    totalNet: net+ieMois+repasMois+km, maxJour, hMaxSem: Math.max(hA,hB), hDayAvg: (moyJ? moyH/moyJ : 0), methode, hAn, jAn };
}
/* Semaine moyenne servant à la mensualisation.
   Année complète : moyenne des semaines A et B (52 semaines du calendrier, une semaine B vide compte).
   Année incomplète : « semaines » = semaines où l'enfant vient ; on fait donc la moyenne des seules semaines
   d'accueil (ex. le mercredi une semaine sur deux : 8 h × semaines d'accueil ÷ 12, et non 4 h). */
function rythmeMoyen(type, alterne, hA, hB, jA, jB, majA, majB){
  let W = alterne ? [[hA,jA,majA],[hB,jB,majB]] : [[hA,jA,majA]];
  if(type===1 && alterne){ const nz = W.filter(w=>w[0]>0); if(nz.length) W = nz; }
  const avg = k=>W.reduce((s,w)=>s+w[k],0)/W.length;
  return {moyH: avg(0), moyJ: avg(1), moyMaj: avg(2)};
}
/* Semaine A ou B pour un contrat alterné.
   alterneRef : 0 = la semaine du début du contrat est A ; 1 = semaines paires (n° ISO) = A ; 2 = semaines impaires = A */
function weekIsB(c, d){
  if(!c.alterne) return false;
  const ref = +c.alterneRef || 0;
  if(ref===1 || ref===2){ const pair = isoWeek(d)%2===0; return ref===1 ? !pair : pair; }
  const r = debutAlternance(c, d) || parseD(c.debut) || new Date(2024,0,1);
  const diff = Math.round((mondayOf(d)-mondayOf(r))/(7*86400000));
  return Math.abs(diff)%2===1;
}
/* Jours prévus par le planning dans un mois donné (dans les dates du contrat) */
/* Année incomplète : semaines sans accueil cochées dans le contrat (lundi de chaque semaine) */
function semaineSansAccueil(c, d){ return c.type===1 && Array.isArray(c.semOff) && c.semOff.includes(iso(mondayOf(d))); }
function isoWeek(d){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const n=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-n); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/86400000+1)/7); }
function plannedDays(c, y, m, opts){
  opts = opts||{};
  const out=[], deb=parseD(c.debut), fin=parseD(c.fin);
  const A=wNums(c.wA), B=c.alterne?wNums(c.wB):A;
  for(let day=1; day<=daysInMonth(y,m); day++){
    const d = new Date(y,m,day);
    if(deb && d<deb) continue;
    if(fin && d>fin) continue;
    const cc = paramsAt(c, d);
    const AA = cc===c ? A : wNums(cc.wA), BB = cc===c ? B : (cc.alterne ? wNums(cc.wB) : AA);
    const h = (weekIsB(cc,d)?BB:AA)[dowIdx(d)];
    if(!h) continue;
    if(semaineSansAccueil(cc, d)) continue;
    const f = ferieName(d);
    if(f && opts.skipFeries) continue;
    out.push({d, h, ferie:f});
  }
  return out;
}
function ancienneteTxt(deb, fin){
  const a=parseD(deb), b=fin?parseD(fin):today();
  if(!a||!b||b<a) return '—';
  const m = monthsBetween(a,b), y=Math.floor(m/12), r=m%12;
  return (y? y+' an'+(y>1?'s':'')+(r?' et ':'') : '') + (r||!y ? r+' mois' : '');
}
function finEssai(c){
  const deb=parseD(c.debut); if(!deb) return null;
  const dv = derive(c, deb);
  const e = R('essai', deb) || [3,2];
  const mois = Math.max(dv.jA, dv.jB) >= 4 ? e[1] : e[0];
  return addDays(addMonths(deb, mois), -1);
}

/* ---------- Navigation (avec le bouton « retour » d'Android) ---------- */
const THEME_TITLES = { parents:'Pour les parents', contrat:'Enfant & contrat', mensu:'Salaire mensualisé', mois:'Salaire du mois', ccass:'Mois incomplet',
  cp:'Congés payés', ie:'Indemnités d\'entretien', fin:'Fin de contrat', abattement:'Impôts', cmg:'Aide CMG', reglages:'Réglages', aide:'Aide', docs:'Documents', suivi:'Suivi & paie', formation:'Se former' };
let CURRENT = 'home';
function showTheme(id, opts){
  opts = opts||{};
  if(CURRENT !== 'home' && CURRENT !== id) persistTheme(CURRENT);
  $('home').style.display='none';
  document.querySelectorAll('.theme').forEach(t=>t.classList.remove('active'));
  $('theme-'+id).classList.add('active');
  document.body.classList.add('in-theme');
  $('topbar-title').innerHTML = '<span class="tag">Carnet Assmat</span>'+esc(THEME_TITLES[id]||'');
  CURRENT = id;
  if(!opts.fromHistory){ try{ history.pushState({theme:id}, '', '#'+id); }catch(e){} }
  window.scrollTo(0,0);
  onThemeOpen(id);
  if(typeof afterNavigate==='function') afterNavigate();
}
function showHome(fromHistory, tab){
  if(CURRENT !== 'home') persistTheme(CURRENT);
  if(tab && typeof HOME_TAB!=='undefined') HOME_TAB = tab;
  document.querySelectorAll('.theme').forEach(t=>t.classList.remove('active'));
  $('home').style.display='block';
  document.body.classList.remove('in-theme');
  CURRENT = 'home';
  if(!fromHistory){ try{ history.replaceState({theme:'home', tab:(typeof HOME_TAB!=='undefined'?HOME_TAB:'accueil')}, '', '#'); }catch(e){} }
  window.scrollTo(0,0);
  renderHome();
  if(typeof afterNavigate==='function') afterNavigate();
}
function goBack(){
  if(history.state && history.state.theme && history.state.theme!=='home') history.back();
  else showHome();
}
window.addEventListener('popstate', e=>{
  const open = anyOverlayOpen();
  if(open.length){ open.forEach(o=>o.classList.remove('show')); try{ history.pushState({theme:CURRENT},'', '#'+CURRENT);}catch(_){} return; }
  const t = e.state && e.state.theme;
  if(t && t!=='home' && $('theme-'+t)) showTheme(t, {fromHistory:true});
  else showHome(true, e.state && e.state.tab);
});

/* =====================================================================================
   ACCUEIL : cartes enfants, total du mois, points d'attention
   ===================================================================================== */
function renderHome(){
  const wrap = $('kids');
  const now = today();
  let html = '';
  const enCours = contratsEnCours(), termines = STATE.contrats.filter(c=>contratTermine(c));
  enCours.forEach(c=>{
    const dv = derive(c, now);
    const actif = contratActif(c, now);
    const nbMois = Object.keys(journalOf(c.id)).length;
    const pill = '<span class="pill '+(c.type===1?'inc':'')+'">'+(c.type===1?'Année incomplète':'Année complète')+'</span>'
      + (actif ? '' : ' <span class="pill off">À venir</span>')
      + (c.fin ? ' <span class="pill off">fin le '+fmtDate(c.fin)+'</span>' : '');
    html += '<div class="kid'+(actif?'':' inactive')+'">'
      + '<div class="kname">'+esc(c.enfant||'Sans prénom')+'</div>'
      + '<div class="kfam">'+esc(c.famille||'Famille ?')+' · '+pill+'</div>'
      + '<div class="kline"><span>Planning</span><b>'+fmtNum(dv.moyH,2)+' h/sem · '+fmtNum(dv.moyJ, Math.abs(dv.moyJ - Math.round(dv.moyJ)) < 0.05 ? 0 : 1)+' j/sem</b></div>'
      + '<div class="kline"><span>Salaire mensuel brut</span><b>'+(dv.brut?fmtEUR(dv.brut):'—')+'</b></div>'
      + '<div class="kline"><span>Salaire net estimé</span><b>'+(dv.net?fmtEUR(dv.net):'—')+'</b></div>'
      + '<div class="kline"><span>Entretien (moyenne/mois)</span><b>'+(dv.ieMois?fmtEUR(dv.ieMois):'—')+'</b></div>'
      + '<div class="kline"><span>Mois validés</span><b>'+nbMois+'</b></div>'
      + '<div class="kactions"><button class="btn small primary" onclick="openFor(\'mois\',\''+c.id+'\')">Ce mois-ci</button>'
      + (c.type===1 ? '<button class="btn small" onclick="noterSemaineOff(\''+c.id+'\')">📅 Semaine sans accueil</button>' : '')
      + '<button class="btn small" onclick="openDocs(\''+c.id+'\')">📄 Documents</button>'
      + '<button class="btn small" onclick="editContrat(\''+c.id+'\')">✎ Modifier</button>'
      + '<button class="btn small" onclick="terminerContrat(\''+c.id+'\')">Fin de contrat</button></div>'
      + '</div>';
  });
  const max = placesMax();
  if(enCours.length < max){
    html += '<button class="kid add" onclick="editContrat(null)"><span style="font-size:1.6rem">＋</span>Ajouter un enfant<span class="hint">'+(enCours.length? (parseInt(STATE.settings.agrement) ? 'Agrément : '+parseInt(STATE.settings.agrement)+' enfants en même temps' : 'Agrément : à renseigner (Réglages)') : 'Commencez par là')+'</span></button>';
  }
  wrap.innerHTML = html;
  // Contrats terminés : rangés automatiquement, données conservées
  let th = '';
  if(termines.length){
    th = '<details class="help" style="margin-top:12px"><summary>📁 Contrats terminés ('+termines.length+') — données conservées</summary><div>'
      + '<p class="hint" style="margin:0 0 10px">Un contrat se range ici tout seul le lendemain de sa date de fin : il libère sa place mais garde ses mois validés, ses calculs et ses documents (utiles pour les impôts, une attestation ou un litige). Conservez-les au moins 5 ans.</p>'
      + termines.map(c=>{
          const tot = journalTotals(c.id);
          return '<div class="kid" style="margin-bottom:8px"><div class="kname">'+esc(c.enfant||'Sans prénom')+'</div>'
            + '<div class="kfam">'+esc(c.famille||'')+' · du '+(fmtDate(c.debut)||'?')+' au '+fmtDate(c.fin)+'</div>'
            + '<div class="kline"><span>Mois validés</span><b>'+tot.n+'</b></div>'
            + '<div class="kline"><span>Total des salaires bruts enregistrés</span><b>'+fmtEUR(tot.brut)+'</b></div>'
            + '<div class="kactions"><button class="btn small" onclick="openDocs(\''+c.id+'\')">📄 Documents</button>'
            + '<button class="btn small" onclick="openFor(\'fin\',\''+c.id+'\')">Fin de contrat</button>'
            + '<button class="btn small" onclick="editContrat(\''+c.id+'\')">Voir</button>'
            + '<button class="btn small danger" onclick="deleteContrat(\''+c.id+'\')">Supprimer</button></div></div>';
        }).join('')
      + '</div></details>';
  }
  setHTML('kids-termines', th);

  // Total du mois (contrats actifs)
  const actifs = STATE.contrats.filter(c=>contratActif(c, now));
  if(actifs.length){
    let brut=0, net=0, ie=0, rep=0, km=0;
    actifs.forEach(c=>{ const dv=derive(c,now); brut+=dv.brut; net+=dv.net; ie+=dv.ieMois; rep+=dv.repasMois; km+=dv.km; });
    $('month-total').innerHTML =
      '<div class="mt-row"><span>Mes revenus habituels d\'un mois ('+actifs.length+' enfant'+(actifs.length>1?'s':'')+')</span></div>'
      + '<div class="mt-row"><span>Salaires bruts</span><b>'+fmtEUR(brut)+'</b></div>'
      + '<div class="mt-row"><span>Salaires nets (estimation)</span><b>'+fmtEUR(net)+'</b></div>'
      + '<div class="mt-row"><span>Indemnités d\'entretien (mois moyen : le montant réel suit les jours de présence)</span><b>'+fmtEUR(ie)+'</b></div>'
      + (rep? '<div class="mt-row"><span>Repas</span><b>'+fmtEUR(rep)+'</b></div>' : '')
      + (km? '<div class="mt-row"><span>Frais kilométriques</span><b>'+fmtEUR(km)+'</b></div>' : '')
      + '<div class="mt-row mt-big"><span>Total perçu (net)</span><b>'+fmtEUR(net+ie+rep+km)+'</b></div>';
    show('month-total', true);
  } else show('month-total', false);

  $('home-intro').style.display = STATE.contrats.length ? 'none' : 'block';
  renderAlerts();
  if(typeof renderTabs==='function') renderTabs();
  regRenderStatus();
  const se = $('sync-status');
  if(se) se.textContent = STATE.lastExport ? 'Dernière copie de sécurité : '+new Date(STATE.lastExport).toLocaleDateString('fr-FR')+'.' : 'Aucune copie de sécurité faite depuis cet appareil.';
}

/* Année incomplète : semaines d'accueil de l'année du contrat (date anniversaire), passées et à venir */
function bilanSemaines(c, ref){
  const deb = parseD(c.debut); if(!deb || c.type!==1) return null;
  const t = ref || today();
  let an = new Date(t.getFullYear(), deb.getMonth(), deb.getDate()); if(an > t) an = new Date(t.getFullYear()-1, deb.getMonth(), deb.getDate()); if(an < deb) an = deb;
  const finAn = addDays(new Date(an.getFullYear()+1, an.getMonth(), an.getDate()), -1), fin = parseD(c.fin);
  let passees = 0, avenir = 0, off = 0;
  for(let w = mondayOf(an); w <= finAn; w = addDays(w, 7)){
    // une semaine à cheval sur deux années de contrat compte pour l'année où tombe la majorité de ses jours
    let h = 0, nbJ = 0;
    for(let i=0;i<7;i++){ const d = addDays(w, i); if(d < an || d > finAn || !inContract(c, d)) continue; nbJ++; h += plannedDay(c, d).min; }
    if(nbJ < 4) continue;
    if(semaineSansAccueil(paramsAt(c, w), w)) off++;
    if(h > 0){ if(addDays(w, 6) < t) passees++; else avenir++; }
  }
  const sem = parseFloat(paramsAt(c, t).semaines)||0;
  return {debut: an, fin: finAn, passees, avenir, off, semaines: sem, aPlacer: Math.max(0, Math.round(passees + avenir - sem)), depasse: passees > sem, finContrat: !!(fin && fin <= finAn)};
}
/* Noter une semaine sans accueil (année incomplète), quand les parents la donnent */
function noterSemaineOff(cid){
  const c = getContrat(cid); if(!c) return;
  askText('Semaine sans accueil', 'Choisissez un jour de la semaine où '+(c.enfant||'l\u2019enfant')+' ne vient pas. Toute la semaine (du lundi au dimanche) sera notée sans accueil ; refaites la même chose pour l\u2019annuler.', iso(today()), v=>{
    const d = parseD(v); if(!d){ toast('Date non reconnue.'); return; }
    const k = iso(mondayOf(d));
    const bascule = arr=>{ arr = Array.isArray(arr) ? arr.slice() : []; return arr.includes(k) ? arr.filter(x=>x!==k) : arr.concat([k]); };
    const avant = (paramsAt(c, d).semOff||[]).includes(k);
    // la semaine peut tomber dans une période couverte par un ancien avenant : on met à jour la bonne version
    const H = (c.hist||[]).slice().sort((x,y)=>x.jusqua<y.jusqua?-1:1).find(h=>iso(d) <= h.jusqua && h.p);
    if(H) H.p.semOff = bascule(H.p.semOff); else c.semOff = bascule(c.semOff);
    auditLog(c.id, 'Semaine du '+fmtDate(k)+' : '+(avant ? 'accueil rétabli' : 'sans accueil'));
    saveState(); if(typeof renderHome==='function' && CURRENT==='home') renderHome();
    const b = bilanSemaines(c);
    toast('Semaine du lundi '+fmtDate(k)+' : '+(avant ? 'accueil rétabli.' : 'sans accueil (pas d\u2019entretien ni de repas).')+(b && b.aPlacer ? ' Encore '+b.aPlacer+' semaine(s) sans accueil à noter cette année.' : ''));
  }, {type:'date'});
}
/* Entretien dû pour chaque durée de journée du planning (montant du contrat, jamais moins que le minimum légal) */
function ieParDuree(c, when){
  const d = when ? parseD(when) : today(), cc = paramsAt(c, d);
  const H = [...new Set(wNums(cc.wA).concat(cc.alterne ? wNums(cc.wB) : []).filter(h=>h>0))].sort((a,b)=>a-b);
  return H.map(h=>({h, v: ieJourMontant(cc, h, d), leg: ieLegalJour(h, d), prevu: ieContratJour(cc, h, d)}));
}
/* Contrat commencé bien avant sa saisie dans le carnet, sans aucun compteur repris */
function contratCreeLe(c){ const t = parseInt(String(c.id||'').slice(1), 36); return t > 1.5e12 && t < 4e12 ? new Date(t) : null; }
function repriseAFaire(c){
  if(!c || c.repVu || !contratActif(c, today())) return false;
  if(REP_KEYS.some(k=>(c.rep||{})[k]!==undefined && (c.rep||{})[k]!=='' && (c.rep||{})[k]!==null)) return false;
  const deb = parseD(c.debut), cree = contratCreeLe(c);   // date de saisie inconnue (contrat ancien, exemple) : pas de rappel
  return !!(deb && cree && (cree - deb)/86400000 > 45);
}
function repriseOuvrir(cid){
  editContrat(cid);
  setTimeout(()=>{ if(CURRENT!=='contrat') return; ctStep(1); const d = $('ct-rep-wrap'); if(d){ d.open = true; d.scrollIntoView({block:'start'}); } }, 120);
}
function repriseRien(cid){ const c = getContrat(cid); if(!c) return; c.repVu = 1; saveState(); renderHome(); toast('Noté : rien à reprendre pour '+(c.enfant||'cet enfant')+'.'); }
/* Année complète : congés pris (ou notés à venir) au-delà des jours acquis à la date du dernier jour de congé.
   Les jours en plus ne sont pas payés par le salaire mensualisé, sauf accord des parents (congé sans solde). */
function cpAuDelaAcquis(c){
  const t = today();
  if(!c || c.type===1 || !contratActif(c, t)) return null;
  const startN = new Date(t.getMonth()>=5 ? t.getFullYear() : t.getFullYear()-1, 5, 1), finN = new Date(startN.getFullYear()+1, 4, 31);
  const sN = iso(startN), fN = iso(finN), days = ((STATE.suivi||{})[c.id]||{}).days || {};
  const derniers = ((STATE.settings||{}).conges||[]).filter(p=>p && p.du && p.au && p.du<=fN && p.au>=sN).map(p=>p.au<fN ? p.au : fN)
    .concat(Object.keys(days).filter(k=>k>=sN && k<=fN && (ST[days[k].st]||{}).cp)).sort();
  if(!derniers.length) return null;
  let H = parseD(derniers[derniers.length-1]);
  const deb = parseD(c.debut), fin = parseD(c.fin);
  if(fin && fin < H) H = fin;
  if(H < addDays(t, -62)) return null;                  // congés anciens : déjà réglés avec les salaires de l'époque
  let d = new Date(startN), pris = parseFloat((c.rep||{}).cpPrisN)||0;
  while(d <= H){
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
    if(!(deb && deb > last) && !(fin && fin < d)) pris += suiviMonth(c, isoMonth(d), {sansCP:true}).T.cpOuv || 0;
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }
  const PP = cpRefPeriods(Object.assign({}, c, {fin: iso(H)}), H), P1 = PP.find(x=>x.k==='n1'), Pn = PP.find(x=>x.k==='n');
  const rp = c.rep || {}, rel = (rp.cpReliquat!==undefined && rp.cpReliquat!=='') ? (parseFloat(rp.cpReliquat)||0) : null;
  const acq1 = rel!==null ? rel : (P1 && P1.s ? joursAcquisCP(iso(P1.s), iso(P1.e), 0, false, c) : 0);
  const acqN = Pn && Pn.s ? joursAcquisCP(iso(Pn.s), iso(Pn.e), 0, true, c) : 0;
  const trop = Math.floor(pris - acq1 - acqN + 1e-9);
  return trop > 0 ? {trop, pris, acquis: Math.floor((acq1 + acqN)*10)/10, jusqua: H} : null;
}
function computeAlerts(){
  const out = [], now = today(), mNow = now.getMonth();
  const actifs = STATE.contrats.filter(c=>contratActif(c, now));
  STATE.contrats.forEach(c=>{
    const nom = '<b>'+esc(c.enfant||'Enfant')+'</b>';
    const dv = derive(c, now);
    if(!contratActif(c, now) && parseD(c.fin) && parseD(c.fin) < now) return;
    if(repriseAFaire(c)) out.push({lvl:'warn', html:nom+' : le contrat a commencé le '+fmtDate(c.debut)+', avant que vous utilisiez le carnet. Indiquez ce qui s\u2019est passé avant (congés restants ou déjà pris, jours d\u2019enfant malade déjà retirés) : sinon le solde de congés et la fin de contrat seront faux.',
      act:'<button class="btn small" onclick="repriseOuvrir(\''+c.id+'\')">Compléter</button> <button class="btn small" onclick="repriseRien(\''+c.id+'\')">Rien à reprendre</button>'});
    const cpTrop = cpAuDelaAcquis(c);
    if(cpTrop) out.push({lvl:'warn', html:nom+' : '+cpTrop.pris+' jours de congés payés pris ou prévus depuis le 1er juin, pour environ '+fmtNum(cpTrop.acquis, 1)+' jours acquis au '+fmtDate(iso(cpTrop.jusqua))+'. Les <b>'+cpTrop.trop+' jour(s) en plus</b> ne sont pas payés par le salaire mensualisé, sauf accord écrit des parents : ils se retirent comme un congé sans solde.',
      act:'<button class="btn small" onclick="showTheme(\'ccass\')">Mois incomplet</button> <button class="btn small" onclick="showTheme(\'cp\')">Congés payés</button>'});
    // Année incomplète : semaines sans accueil pas encore notées, ou accueil au-delà du contrat
    if(c.type===1 && contratActif(c, now) && (parseFloat(c.semaines)||0) > 0){
      const b = bilanSemaines(c);
      if(b && b.depasse) out.push({lvl:'warn', html:nom+' est déjà venu '+b.passees+' semaines depuis le '+fmtDate(iso(b.debut))+', pour '+b.semaines+' prévues au contrat sur l\u2019année. Si c\u2019est exact, les heures en plus se régularisent (ou un avenant est à prévoir) ; sinon, notez les semaines sans accueil oubliées.',
        act:'<button class="btn small" onclick="noterSemaineOff(\''+c.id+'\')">📅 Noter une semaine sans accueil</button>'});
      else if(b && b.aPlacer && (c.semOffAVenir || b.aPlacer >= 4)) out.push({lvl: b.aPlacer > b.avenir/2 ? 'warn' : 'info', html:nom+' : '+b.aPlacer+' semaine(s) sans accueil restent à noter d\u2019ici le '+fmtDate(iso(b.fin))+' (contrat : '+b.semaines+' semaines d\u2019accueil par an, '+b.off+' déjà notées). Notez-les dès que les parents les donnent : l\u2019entretien, les repas, les congés et la régularisation en dépendent.',
        act:'<button class="btn small" onclick="noterSemaineOff(\''+c.id+'\')">📅 Noter une semaine sans accueil</button>'});
    }
    // Salaire minimum (appliqué d'office)
    if(dv.tauxReleve){
      out.push({lvl:'err', html:'Le salaire horaire de '+nom+' ('+fmtEUR(dv.tauxSaisi)+') est inférieur au minimum légal en vigueur depuis le '+fmtDate(Rdu(c.titre?'salMinTitre':'salMin'))+' ('+fmtEUR(dv.tauxMin)+'). Les calculs appliquent automatiquement '+fmtEUR(dv.tauxMin)+'. Il faut signer un avenant avec la famille.',
        act:'<button class="btn small" onclick="raiseToMin(\''+c.id+'\')">Mettre le contrat au minimum</button>'});
    }
    const nx = Rnext(c.titre?'salMinTitre':'salMin', now);
    if(nx && dv.tauxSaisi && dv.tauxSaisi < nx.v && (parseD(nx.du)-now)/86400000 < 75){
      out.push({lvl:'warn', html:'À partir du '+fmtDate(nx.du)+', le salaire minimum passe à '+fmtEUR(nx.v)+' de l\'heure : le tarif de '+nom+' ('+fmtEUR(dv.tauxSaisi)+') devra être augmenté.'});
    }
    if(!dv.tauxSaisi) out.push({lvl:'warn', html:'Le salaire horaire de '+nom+' n\'est pas renseigné.', act:'<button class="btn small" onclick="editContrat(\''+c.id+'\')">Compléter</button>'});
    if(c.type===1 && !(parseFloat(c.semaines)>0)) out.push({lvl:'warn', html:'Indiquez le nombre de semaines d\'accueil par an pour '+nom+' (année incomplète).', act:'<button class="btn small" onclick="editContrat(\''+c.id+'\')">Compléter</button>'});
    if(dv.ieSousMin) out.push({lvl:'warn', html:'L\'indemnité d\'entretien prévue pour '+nom+' ('+fmtEUR(parseFloat(c.ieMontant))+'/jour) est inférieure au minimum légal pour au moins une journée du planning. Les calculs appliquent le minimum.'});
    if(dv.maxJour > R('hMaxJour')) out.push({lvl:'err', html:'Le planning de '+nom+' compte une journée de '+fmtNum(dv.maxJour,2)+' h : au-delà de '+R('hMaxJour')+' h, le repos quotidien de 11 h n\'est plus respecté.'});
    if(dv.moyH > R('hMaxSemaine')) out.push({lvl:'err', html:'Le planning de '+nom+' dépasse en moyenne '+R('hMaxSemaine')+' h par semaine : ce n\'est possible qu\'avec votre accord écrit et dans la limite de 2 250 h par an.'});
    else if(dv.hMaxSem > R('hMaxSemaine')) out.push({lvl:'info', html:'Une semaine du planning de '+nom+' dépasse '+R('hMaxSemaine')+' h : c\'est admis tant que la moyenne sur 4 mois reste sous '+R('hMaxSemaine')+' h (ici '+fmtNum(dv.moyH,2)+' h).'});
    else if(dv.hMaxSem > R('seuilMaj')) out.push({lvl:'info', html:'Le planning de '+nom+' dépasse 45 h par semaine : les heures au-delà sont majorées (déjà comptées dans le salaire mensualisé).'});
    // Période d'essai
    const fe = finEssai(c);
    if(fe && fe >= now && parseD(c.debut) <= now) out.push({lvl:'info', html:'Période d\'essai de '+nom+' en cours jusqu\'au '+fe.toLocaleDateString('fr-FR')+'.'});
    // Fin prévue
    const fin = parseD(c.fin);
    if(fin && fin >= now && (fin-now)/86400000 <= 60){
      out.push({lvl:'warn', html:'Le contrat de '+nom+' se termine le '+fin.toLocaleDateString('fr-FR')+'. Pensez au préavis, aux congés payés'+(c.type===1?', à la régularisation (obligatoire en année incomplète)':'')+' et aux documents de fin de contrat.',
        act:'<button class="btn small" onclick="openFor(\'fin\',\''+c.id+'\')">Calculer la fin de contrat</button>'});
    }
    // Âge et CMG
    const nais = parseD(c.naissance);
    if(nais){
      const six = new Date(nais.getFullYear()+R('cmgAgeMax'), nais.getMonth(), nais.getDate());
      const dd = (six-now)/86400000;
      if(dd>=0 && dd<=90) out.push({lvl:'info', html:nom+' aura '+R('cmgAgeMax')+' ans le '+six.toLocaleDateString('fr-FR')+' : l\'aide CMG des parents s\'arrête alors (sauf famille monoparentale, jusqu\'à 12 ans). Prévenez la famille.'});
    }
    // Date anniversaire du contrat : remise à zéro du compteur d'absences pour maladie
    const deb = parseD(c.debut);
    if(deb && deb < now && deb.getMonth()===mNow && deb.getFullYear()<now.getFullYear()){
      out.push({lvl:'info', html:'Ce mois-ci, le contrat de '+nom+' a un an de plus ('+ancienneteTxt(c.debut)+' d\'ancienneté). Le compteur des 5 jours d\'absence pour maladie de l\'enfant repart à zéro le '+new Date(now.getFullYear(), deb.getMonth(), deb.getDate()).toLocaleDateString('fr-FR')+'.'});
    }
  });
  // Déclaration Pajemploi du mois (fenêtre du 25 au 5) : une par enfant depuis 2026
  const jour = now.getDate();
  if(jour >= 25 || jour <= 5){
    const mDecl = jour >= 25 ? isoMonth(now) : isoMonth(new Date(now.getFullYear(), now.getMonth()-1, 1));
    STATE.contrats.filter(c=>{ const deb=parseD(c.debut), fin=parseD(c.fin); return (!deb || isoMonth(deb) <= mDecl) && (!fin || isoMonth(fin) >= mDecl); })
      .filter(c=>!journalOf(c.id)[mDecl]).forEach(c=>{
        out.push({lvl:'warn', html:'Mois '+deMoisTxt(mDecl)+' pour <b>'+esc(c.enfant||'Enfant')+'</b> : les parents le déclarent sur Pajemploi entre le 25 et le 5. Vérifiez et validez les chiffres, puis envoyez-les aux parents.',
          act:'<button class="btn small" onclick="preparerDeclaration(\''+c.id+'\',\''+mDecl+'\')">Vérifier les chiffres</button>'});
      });
  }
  // Contrats terminés depuis moins de 2 mois : documents de fin
  STATE.contrats.filter(c=>contratTermine(c) && (now-parseD(c.fin))/86400000 <= 60).forEach(c=>{
    out.push({lvl:'info', html:'Contrat de <b>'+esc(c.enfant||'Enfant')+'</b> terminé le '+fmtDate(c.fin)+' : dernière déclaration Pajemploi (répondre « oui » à « fin de contrat »), certificat de travail, attestation France Travail et reçu pour solde de tout compte.',
      act:'<button class="btn small" onclick="openDocs(\''+c.id+'\')">Documents</button>'});
  });
  // Renouvellement de l'agrément (tous les 5 ans ; demande au moins 4 mois avant l'échéance)
  const ag = parseD((STATE.profil||{}).agrementDate);
  if(ag){
    const ech = new Date(ag.getFullYear()+(parseInt((STATE.profil||{}).agrementDuree)||5), ag.getMonth(), ag.getDate()), dd = (ech-now)/86400000;
    if(dd <= 180) out.push({lvl: dd<=120?'err':'warn', html:'Votre agrément arrive à échéance le '+ech.toLocaleDateString('fr-FR')+' : demandez son renouvellement au service PMI du département au moins 4 mois avant.'});
  }
  if(typeof suiviAlerts==='function') suiviAlerts(out);
  try{ const mo = JSON.stringify(STATE).length/1024/1024;
    if(mo > 4) out.push({lvl:'info', html:'Vos données occupent '+fmtNum(mo,1)+' Mo : elles sont gardées dans le stockage étendu du téléphone. Pensez aux copies de sécurité ; les contrats terminés depuis plus de 5 ans peuvent être supprimés.', act:'<button class="btn small" onclick="syncExport()">Copie de sécurité</button>'}); }catch(e){}
  const cons = parseInt(STATE.settings.conservation)||5;
  STATE.contrats.filter(c=>contratTermine(c) && (now-parseD(c.fin))/86400000 > cons*365-60).forEach(c=>{
    out.push({lvl:'info', html:'Le contrat de <b>'+esc(c.enfant||'')+'</b> est terminé depuis près de '+cons+' ans (durée de conservation choisie). Vous pouvez exporter ses documents puis le supprimer ; rien n\'est jamais effacé automatiquement.', act:'<button class="btn small" onclick="syncExport()">Copie de sécurité</button>'});
  });
  // Agrément : nombre d'enfants présents le même jour
  const agr = parseInt(STATE.settings.agrement)||R('agrementMax');
  // jour par jour sur les deux semaines à venir (une semaine A et une semaine B, semaines sans accueil et avenants compris)
  const vus = {};
  for(let k=0;k<14;k++){
    const dd = addDays(today(), k), i = dowIdx(dd);
    const n = STATE.contrats.filter(c=>inContract(c, dd) && plannedDay(c, dd).min>0).length;
    if(n <= agr || vus[i]) continue; vus[i] = 1;
    { out.push({lvl:'err', html:'Le '+dd.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'})+', '+n+' enfants sont prévus alors que votre agrément en autorise '+agr+'. Vérifiez que leurs horaires ne se chevauchent pas.'}); break; }
  }
  // Rappels de calendrier
  if((mNow===4 || mNow===5) && actifs.length) out.push({lvl:'info', html:'Juin approche : la période de congés payés se termine le 31 mai. Comparez le maintien de salaire et les 10 % (année complète), ou faites payer les congés si votre contrat prévoit un paiement en juin (année incomplète).', act:'<button class="btn small" onclick="showTheme(\'cp\')">Congés payés</button>'});
  if(mNow>=3 && mNow<=5) out.push({lvl:'info', html:'Période de déclaration des revenus : calculez votre abattement fiscal avant de valider votre déclaration.', act:'<button class="btn small" onclick="showTheme(\'abattement\')">Impôts : abattement</button>'});
  if(STATE.contrats.length && (!STATE.lastExport || (Date.now()-new Date(STATE.lastExport))/86400000 > 60))
    out.push({lvl:'info', html:'Pensez à faire une copie de sécurité de vos données (en cas de perte ou de changement de téléphone).', act:'<button class="btn small" onclick="syncExport()">Faire une copie</button>'});
  if(!STATE.regCheckedAt || (Date.now()-new Date(STATE.regCheckedAt))/86400000 > 45)
    out.push({lvl:'info', html: STATE.regCheckedAt ? 'La réglementation n\'a pas été vérifiée depuis plus de 45 jours.' : 'Le carnet contient la réglementation de sa dernière version. Vérifiez s\'il existe des valeurs plus récentes (une seconde, avec internet).', act:'<button class="btn small" onclick="regCheckUpdates(false)">Rechercher les mises à jour</button>'});
  return out;
}
function renderAlerts(){
  const list = computeAlerts();
  const order = {err:0, warn:1, info:2};
  list.sort((a,b)=>order[a.lvl]-order[b.lvl]);
  $('alerts').innerHTML = list.map(a=>'<div class="alert '+a.lvl+'">'+(a.lvl==='err'?'⛔ ':a.lvl==='warn'?'⚠️ ':'ℹ️ ')+a.html+(a.act?'<div class="a-act">'+a.act+'</div>':'')+'</div>').join('');
  show('alerts-wrap', list.length>0);
}
function raiseToMin(id){
  const c = getContrat(id); if(!c) return;
  const dv = derive(c);
  showConfirmDialog('Avenant de salaire', 'Passer le salaire horaire de '+(c.enfant||'cet enfant')+' de '+fmtEUR(dv.tauxSaisi)+' à '+fmtEUR(dv.tauxMin)+' ? Pensez à faire signer un avenant au contrat par la famille.', ()=>{
    c.taux = String(dv.tauxMin); saveState(); renderHome(); toast('Contrat mis à jour.');
  }, 'Oui, mettre à jour', 'Annuler');
}
function deleteContrat(id){
  const c = getContrat(id); if(!c) return;
  const n = Object.keys(journalOf(id)).length;
  showConfirmDialog('Supprimer définitivement ?', 'Le contrat de '+contratLabel(c)+', ses '+n+' mois validés et ses calculs seront effacés de ce téléphone, sans retour possible. Inutile de supprimer un contrat terminé : il libère déjà sa place tout seul. Les saisies d\'impôts et de CMG sont conservées. Si vous continuez, faites d\'abord une copie de sécurité (gardez vos justificatifs au moins 5 ans).', ()=>{
    STATE.contrats = STATE.contrats.filter(x=>x.id!==id);
    if(STATE.journal) delete STATE.journal[id];
    Object.keys(STATE.forms).forEach(t=>{ if(STATE.forms[t]) delete STATE.forms[t][id]; });
    Object.keys(STATE.sel).forEach(t=>{ if(STATE.sel[t]===id) STATE.sel[t]='libre'; });
    saveState(); renderHome(); toast('Contrat supprimé.');
  }, 'Oui, supprimer définitivement', 'Annuler');
}
function terminerContrat(id){
  const c = getContrat(id); if(!c) return;
  askText('Fin du contrat de '+(c.enfant||'l\'enfant'), 'Date du dernier jour du contrat (dernier jour du préavis), au format AAAA-MM-JJ. Le contrat reste affiché jusqu\'à cette date, puis se range tout seul dans « Contrats terminés » avec toutes ses données. Ensuite : calcul de fin de contrat et documents.', c.fin || iso(addDays(today(), 30)), v=>{
    const d = parseD((v||'').trim()); if(!d){ toast('Date non reconnue (AAAA-MM-JJ).'); return; }
    c.fin = iso(d); saveState(); openFor('fin', id);
    toast('Fin de contrat enregistrée au '+d.toLocaleDateString('fr-FR')+'.');
  });
}
function preparerDeclaration(id, m){
  STATE.sel.mois = id; if(STATE.forms.mois) delete STATE.forms.mois[id];
  showTheme('mois');
  const c = getContrat(id); if(c && m){ setVal('mois-mois', m); moisFillFromContract(c, m); VIS.mois(); CALC.mois(); persistTheme('mois'); }
}
function openFor(theme, id){ STATE.sel[theme] = id; delete (STATE.forms[theme]||{})[id]; showTheme(theme); }

/* =====================================================================================
   ASSISTANT « ENFANT & CONTRAT »
   ===================================================================================== */
let CT = null, CT_STEP = 0, CT_IS_NEW = true;
const CT_TEXT = ['enfant','famille','naissance','debut','fin','semaines','hAn','jAn','taux','maj','ieMontant','repasPrix','km',
  'enfantNom','parent1','parent2','adresse','tel','email','adaptation','paiementJour','kmTaux'];
const REP_KEYS = ['date','cumulBrut','cpReliquat','cpPrisN','mal','regulVerse','regulHeures'];
function buildWeek(containerId, prefix){
  let h='';
  DOW_SHORT.forEach((n,i)=>{ h += '<div class="wday"><div class="dname">'+n+'</div><input type="number" inputmode="decimal" step="0.25" min="0" max="24" id="'+prefix+i+'" placeholder="—">'
    + '<input type="time" class="tm" id="'+prefix+i+'s" aria-label="arrivée '+n+'"><input type="time" class="tm" id="'+prefix+i+'e" aria-label="départ '+n+'"></div>'; });
  $(containerId).innerHTML = h;
}
function editContrat(id, force){
  const dr = STATE.ui && STATE.ui.ctDraft;
  if(!force && dr && ((dr.isNew && !id) || (!dr.isNew && dr.ct && dr.ct.id===id))){
    _confirmNoCb = ()=>{ delete STATE.ui.ctDraft; saveState(); editContrat(id, true); };
    showConfirmDialog('Reprendre la saisie ?', 'Une fiche commencée pour « '+(dr.ct.enfant||'un enfant')+' » n\'a pas été enregistrée. Voulez-vous la reprendre là où vous l\'aviez laissée ?', ()=>restoreContratDraft(dr), 'Oui, reprendre', 'Non, repartir de zéro');
    return;
  }
  if(!id && contratsEnCours().length >= placesMax()){ toast(placesMax()+' enfants en cours au maximum. Un contrat terminé libère sa place automatiquement.'); return; }
  CT_IS_NEW = !id;
  CT = id ? clone(getContrat(id)) : Object.assign(newContrat(), {horaires:1});
  setTxt('ct-title', CT_IS_NEW ? 'Nouvel enfant' : 'Modifier : '+(CT.enfant||'enfant'));
  CT_TEXT.forEach(k=>setVal('ct-'+k, CT[k]));
  setSegVal('ct-handicap', CT.handicap); setSegVal('ct-type', CT.type); setSegVal('ct-titre', CT.titre);
  setSegVal('ct-semConnues', CT.semOffAVenir ? 1 : 0); if(CT.hAn) { const d=$('ct-irreg-wrap'); if(d) d.open = true; }
  setSegVal('ct-alterne', CT.alterne); setSegVal('ct-alterneRef', CT.alterneRef||0); setSegVal('ct-ieMode', CT.ieMode); setSegVal('ct-repasMode', CT.repasMode); setSegVal('ct-cpMode', CT.cpMode); setSegVal('ct-pjPlus', CT.pjPlus||0);
  for(let i=0;i<7;i++){ setVal('ct-wA'+i, CT.wA[i]); setVal('ct-wB'+i, CT.wB[i]);
    ['A','B'].forEach(w=>{ const t=(CT['t'+w]||[])[i]||[]; setVal('ct-w'+w+i+'s', t[0]||''); setVal('ct-w'+w+i+'e', t[1]||''); }); }
  setSegVal('ct-horaires', CT.horaires||0);
  const rp = CT.rep||{}; REP_KEYS.forEach(k=>setVal('ct-rep-'+k, rp[k]));
  CT._orig = id ? paramsOf(CT) : null;
  CT_STEP = 0;
  showTheme('contrat');
  ctRefresh();
}
function ctRead(){
  if(!CT) return;
  CT_TEXT.forEach(k=>CT[k]=val('ct-'+k).trim());
  CT.handicap=seg('ct-handicap'); CT.type=seg('ct-type'); CT.titre=seg('ct-titre'); CT.alterne=seg('ct-alterne'); CT.alterneRef=seg('ct-alterneRef');
  CT.semOffAVenir = CT.type===1 && seg('ct-semConnues')===1 ? 1 : 0;
  CT.ieMode=seg('ct-ieMode'); CT.repasMode=seg('ct-repasMode'); CT.cpMode=seg('ct-cpMode'); CT.pjPlus=seg('ct-pjPlus');
  CT.horaires = seg('ct-horaires');
  CT.tA = CT.tA||[]; CT.tB = CT.tB||[];
  for(let i=0;i<7;i++){
    ['A','B'].forEach(w=>{
      const s=val('ct-w'+w+i+'s'), e=val('ct-w'+w+i+'e');
      CT['t'+w][i] = (s||e) ? [s,e] : null;
      if(CT.horaires){ const a=hmToMin(s), b=hmToMin(e); setVal('ct-w'+w+i, (a!==null && b!==null && b>a) ? round2((b-a)/60) : ''); }
    });
    CT.wA[i]=val('ct-wA'+i); CT.wB[i]=val('ct-wB'+i);
  }
  const rep = {}; let anyRep=false; REP_KEYS.forEach(k=>{ rep[k]=val('ct-rep-'+k).trim(); if(rep[k]) anyRep=true; });
  CT.rep = anyRep ? rep : null;
}
function ctRefresh(){
  ctRead();
  document.querySelectorAll('#theme-contrat .step').forEach(s=>s.classList.toggle('active', +s.dataset.step===CT_STEP));
  document.querySelectorAll('#ct-steps span').forEach((s,i)=>s.classList.toggle('on', i<=CT_STEP));
  $('ct-prev').style.visibility = CT_STEP===0 ? 'hidden' : 'visible';
  $('ct-next').textContent = CT_STEP===4 ? '✔ Enregistrer' : 'Suivant →';
  show('ct-semaines-wrap', CT.type===1);
  show('ct-semConnues-row', CT.type===1, 'flex');
  setTxt('ct-semoff-label', CT.semOffAVenir ? 'Facultatif : touchez seulement les semaines sans accueil déjà connues' : 'Touchez les semaines où l\u2019enfant ne vient pas (vacances scolaires, vos congés…)');
  show('ct-semoff-wrap', CT.type===1);
  setHTML('ct-semConnues-hint', CT.semOffAVenir
    ? 'D\u2019accord : cochez ci-dessous seulement les semaines déjà connues (ou aucune). Ensuite, dès que les parents vous donnent une semaine sans accueil, notez-la avec le bouton « 📅 Semaine sans accueil » (onglet Enfants ou Mois). En attendant, le carnet estime les congés et la régularisation avec le nombre de semaines du contrat, et vous rappelle combien de semaines restent à placer. Prévoyez dans le contrat le délai dans lequel les parents vous préviennent.'
    : 'Le salaire mensualisé ne dépend que du nombre de semaines : il est juste dès maintenant. Les dates servent à l\u2019entretien et aux repas de chaque mois, aux congés et à la régularisation.');
  if(CT.type===1) ctRenderWeeks();
  show('ct-cpMode-row', CT.type===1, 'flex');
  setTxt('ct-type-hint', CT.type===1
    ? '« Une partie de l\'année » = l\'enfant ne vient pas certaines semaines en plus de vos congés (ex. vacances scolaires). Le salaire est calculé sur les seules semaines d\'accueil.'
    : '« Toute l\'année » = l\'enfant vient toutes les semaines, sauf pendant vos 5 semaines de congés payés (année complète, 52 semaines payées).');
  if($('ct-type-hint')) $('ct-type-hint').insertAdjacentHTML('beforeend', ' <a href="#" onclick="fmOuvrir(\'contrat\');return false;">Comprendre la différence</a>');
  show('ct-wB-wrap', CT.alterne===1); show('ct-alterneRef-row', CT.alterne===1, 'flex');
  if(CT.alterne===1){
    const t0 = today(), wk = isoWeek(t0), nxt = addDays(mondayOf(t0), 7);
    const lab = d=>'la semaine du lundi '+d.toLocaleDateString('fr-FR',{day:'numeric', month:'long'})+' (n° '+isoWeek(d)+') est une <b>semaine '+(weekIsB(CT, d)?'2':'1')+'</b>';
    // avenant qui met en place l'alternance sur un contrat qui n'en avait pas : les « semaines 1 » partent de la date d'effet
    const nouvelleAlt = !CT_IS_NEW && CT._orig && !CT._orig.alterne;
    setHTML('ct-alterneRef-hint', ((CT.alterneRef||0)===0 && nouvelleAlt
      ? 'L’alternance commencera à la <b>date de l’avenant</b> (demandée à l’enregistrement) : la semaine de cette date sera une semaine 1. '
      : 'Vérifiez avec les parents : '+lab(mondayOf(t0))+', '+lab(nxt)+'. ')
      + ((CT.alterneRef||0) ? 'Le numéro de la semaine est indiqué sur la plupart des calendriers et agendas. ' : '')
      + (CT.type===1 ? 'L’enfant ne vient qu’une semaine sur deux ? Remplissez la semaine 1 et laissez la semaine 2 vide : seules les semaines où l’enfant vient comptent dans le salaire. ' : 'Une semaine 2 vide compte comme une semaine sans heures : le salaire est la moyenne des deux semaines. ')
      + ((CT.alterneRef||0) ? 'Attention : certaines années ont 53 semaines (comme 2026). La semaine 53 et la semaine 1 de l’année suivante sont alors toutes les deux impaires, donc deux semaines du même type se suivent. Si cela ne convient pas, choisissez la première réponse.' : ''));
  }
  $('ct-wA').classList.toggle('with-times', CT.horaires===1); $('ct-wB').classList.toggle('with-times', CT.horaires===1);
  for(let i=0;i<7;i++){ ['A','B'].forEach(w=>{ const inp=$('ct-w'+w+i); if(inp) inp.readOnly = CT.horaires===1; }); }
  const debD = parseD(CT.debut), repVisible = !!(debD && (today()-debD)/86400000 > 20); show('ct-rep-wrap', repVisible);
  if(repVisible && !$('ct-rep-wrap').dataset.vu){ $('ct-rep-wrap').dataset.vu = '1'; if(!REP_KEYS.some(k=>(CT.rep||{})[k])) $('ct-rep-wrap').open = true; }
  if(!repVisible) delete $('ct-rep-wrap').dataset.vu;
  show('ct-rep-regul', CT.type===1);
  setTxt('ct-wA-label', CT.alterne ? 'Semaine 1 : heures d\u2019accueil de chaque jour' : 'Nombre d\'heures d\'accueil pour chaque jour de la semaine');
  show('ct-ieMontant-wrap', CT.ieMode===1 || CT.ieMode===2);
  setTxt('ct-ieMontant-label', CT.ieMode===2 ? 'Montant pour une journée de 9 h ou plus (€)' : 'Montant par jour d\'accueil (€)');
  show('ct-repasPrix-wrap', CT.repasMode===1);
  for(let i=0;i<7;i++){
    ['A','B'].forEach(w=>{ const inp=$('ct-w'+w+i); if(inp) inp.parentElement.classList.toggle('filled', parseFloat(inp.value)>0); });
  }
  ['A','B'].forEach(w=>{
    const hm = x=>{ const m = Math.round(x*60), h = Math.floor(m/60), r = m%60; return h+' h'+(r ? ' '+String(r).padStart(2,'0') : ''); };
    const J = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], parts = [];
    for(let i=0;i<7;i++){ const v = parseFloat(String(val('ct-w'+w+i)).replace(',','.')); if(v>0) parts.push(J[i]+' '+hm(v)); }
    setTxt('ct-w'+w+'-conv', parts.length ? 'Soit : '+parts.join(' · ') : '');
  });
  const dv = derive(CT, today());
  show('ct-maj-wrap', dv.hMaxSem > R('seuilMaj'));
  setHTML('ct-planning-sum', dv.moyH
    ? (CT.alterne ? 'Semaine 1 : '+(dv.hA ? '<b>'+fmtNum(dv.hA,2)+' h</b> sur '+dv.jA+' jour'+(dv.jA>1?'s':'') : '<b>pas d\u2019accueil</b>')+' · Semaine 2 : '+(dv.hB ? '<b>'+fmtNum(dv.hB,2)+' h</b> sur '+dv.jB+' jour'+(dv.jB>1?'s':'') : '<b>pas d\u2019accueil</b>')+'. ' : 'Total : <b>'+fmtNum(dv.hA,2)+' h par semaine</b> sur <b>'+dv.jA+' jours</b>. ')
      + 'Durée moyenne d\'une journée : '+fmtNum(dv.hDayAvg,2)+' h.'
    : 'Indiquez les heures de chaque jour d\'accueil.');
  const warns = [];
  if(dv.maxJour > R('hMaxJour')) warns.push('Une journée dépasse '+R('hMaxJour')+' h : impossible avec 11 h de repos obligatoire entre deux journées.');
  if(dv.moyH > R('hMaxSemaine')) warns.push('Plus de '+R('hMaxSemaine')+' h par semaine en moyenne : possible seulement avec votre accord écrit (2 250 h par an au maximum).');
  if(dv.hMaxSem > R('seuilMaj')) warns.push('Plus de '+R('seuilMaj')+' h par semaine : les heures au-delà seront payées avec une majoration ('+R('majMin')+' % minimum).');
  const semVide = CT.alterne && (!dv.hA || !dv.hB);
  if(CT.type===1 && semVide && (parseFloat(CT.semaines)||0) > 26) warns.push('Accueil une semaine sur deux : l\u2019enfant vient au plus 26 semaines par an. Le nombre de semaines du contrat ('+CT.semaines+') doit compter <b>seulement les semaines où il vient</b> (ex. période scolaire de 36 semaines, une sur deux : 18). Sinon le salaire serait doublé.');
  if(CT.type===0 && semVide) warns.push('Année complète avec une semaine sur deux sans accueil : le salaire est la moyenne des deux semaines (une semaine vide compte pour 0 h). Si l\u2019enfant ne vient vraiment qu\u2019une semaine sur deux, choisissez plutôt « Non, une partie de l\u2019année » avec le nombre de semaines où il vient.');
  if(dv.hAn>0){ const hPlan = dv.moyH*(CT.type===1 ? (parseFloat(CT.semaines)||0) : 52); if(hPlan && Math.abs(hPlan - dv.hAn)/hPlan > 0.15) warns.push('Planning irrégulier : le total annuel ('+fmtNum(dv.hAn,2)+' h) est très différent de la semaine type × semaines ('+fmtNum(hPlan,2)+' h). Vérifiez le total : c\u2019est lui qui fixe le salaire.'); }
  setHTML('ct-planning-warn', warns.join('<br>')); show('ct-planning-warn', warns.length>0);
  setHTML('ct-taux-hint', 'Minimum légal aujourd\'hui : <b>'+fmtEUR(dv.tauxMin)+'</b> brut de l\'heure'+(CT.titre?' (avec titre AM-AP)':'')+' — en vigueur depuis le '+fmtDate(Rdu(CT.titre?'salMinTitre':'salMin'))+'.'
    + (dv.tauxReleve ? ' <span style="color:var(--error)">Votre tarif est en dessous : '+fmtEUR(dv.tauxMin)+' sera appliqué.</span>' : '')
    + ' <a href="#" onclick="setVal(\'ct-taux\','+dv.tauxMin+');ctRefresh();return false;">Mettre le minimum</a>');
  if(CT_STEP===4) ctRecap(dv);
  $('ct-extra').innerHTML = CT_IS_NEW ? '' : '<button class="btn small" onclick="ctSave()">✔ Enregistrer maintenant</button>';
  if(typeof uiSaveDraft==='function') uiSaveDraft();
}
/* Calendrier des semaines sans accueil (année incomplète) : 12 mois à partir du début du contrat
   (ou de la rentrée en cours si le contrat a commencé il y a plus d'un an) */
function ctRenderWeeks(){
  if(!Array.isArray(CT.semOff)) CT.semOff = [];
  const deb = parseD(CT.debut) || today();
  let start = mondayOf(deb);
  if((today()-deb)/86400000 > 330) start = mondayOf(new Date(today().getFullYear() - (today().getMonth()<7?1:0), 8, 1));
  let h='', off=0, vides=0;
  const A = wNums(CT.wA), B = CT.alterne ? wNums(CT.wB) : A, sA = A.reduce((s,x)=>s+x,0), sB = B.reduce((s,x)=>s+x,0);
  for(let i=0;i<52;i++){
    const w = addDays(start, 7*i), k = iso(w), isOff = CT.semOff.includes(k);
    const estB = weekIsB(CT, w), vide = !isOff && CT.alterne && !(estB ? sB : sA);
    if(isOff) off++; else if(vide) vides++;
    h += '<button type="button" class="chip'+(isOff||vide?'':' on')+'" style="min-height:34px;padding:5px 9px;font-size:.74rem'+(vide?';opacity:.6':'')+'" onclick="ctToggleWeek(\''+k+'\')" title="Semaine du lundi '+w.toLocaleDateString('fr-FR')+' (n° '+isoWeek(w)+') : '+(isOff?'pas d\u2019accueil':vide?'semaine '+(estB?'2':'1')+', pas d\u2019heures prévues':'accueil')+'">'+w.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+(CT.alterne?' · sem. '+(estB?'2':'1'):'')+'</button>';
  }
  setHTML('ct-semoff', h);
  // semaines où l'enfant vient vraiment (une semaine B sans heures ne compte pas)
  const prog = 52-off-vides;
  setHTML('ct-semoff-info', 'Chaque case est une semaine (date du lundi)'+(CT.alterne?', avec son type (sem. 1 ou sem. 2)':'')+'. En vert : l\u2019enfant vient. Sur ces 52 semaines : <b>'+prog+' semaines où l\u2019enfant vient</b>, '+off+' sans accueil'+(vides ? ', '+vides+' semaines '+(sA?'2':'1')+' sans heures prévues (grisées)' : '')+'. '
    + (off || vides ? '<a href="#" onclick="setVal(\'ct-semaines\','+prog+');ctRefresh();return false;">Utiliser '+prog+' comme nombre de semaines</a>. ' : '')
    + 'Ce calendrier sert à compter les vrais jours d\'accueil de chaque mois (entretien, repas, impôts, régularisation).');
}
function ctToggleWeek(k){
  ctRead();
  if(!Array.isArray(CT.semOff)) CT.semOff = [];
  CT.semOff = CT.semOff.includes(k) ? CT.semOff.filter(x=>x!==k) : CT.semOff.concat([k]);
  ctRenderWeeks();
}
function ctRecap(dv){
  const fe = finEssai(CT);
  const lines = [
    ['Enfant', esc(CT.enfant||'—')+(CT.famille?' · '+esc(CT.famille):'')],
    ['Type de contrat', CT.type===1 ? 'Année incomplète ('+(dv.semaines||'?')+' semaines)' : 'Année complète (52 semaines)'],
    ['Heures par semaine (moyenne)', fmtNum(dv.moyH,2)+' h'],
    ['Heures payées chaque mois', fmtNum(dv.hMensu,2)+' h'+(dv.hMajMensu?' (dont '+fmtNum(dv.hMajMensu,2)+' h majorées)':'')],
    ['Calcul', dv.methode==='annuel' ? fmtNum(dv.hAn,2)+' h prévues sur l\u2019année ÷ 12' : fmtNum(dv.moyH,2)+' h'+(CT.alterne ? ' (moyenne des semaines '+(CT.type===1 && (!dv.hA||!dv.hB) ? 'où l\u2019enfant vient' : '1 et 2')+')' : '')+' × '+(CT.type===1 ? (dv.semaines||'?')+' semaines' : '52 semaines')+' ÷ 12'],
    ['Jours d\'accueil par mois (moyenne)', fmtNum(dv.joursMensu,2)+' j'],
    ['Salaire horaire appliqué', fmtEUR(dv.tauxEff)+(dv.tauxReleve?' <span class="badge warn">relevé au minimum</span>':'')],
  ];
  let h = '';
  lines.forEach(l=>{ h+='<div class="result-line"><span class="lbl">'+l[0]+'</span><span class="val">'+l[1]+'</span></div>'; });
  if(dv.cp12) h+='<div class="result-line"><span class="lbl">dont congés payés (10 % chaque mois)</span><span class="val">'+fmtEUR(dv.cp12)+'</span></div>';
  h+='<div class="result-line total"><span class="lbl">Salaire mensuel brut</span><span class="val">'+fmtEUR(dv.brut)+'</span></div>';
  h+='<div class="result-line"><span class="lbl">Salaire mensuel net (estimation)</span><span class="val">'+fmtEUR(dv.net)+'</span></div>';
  h+='<div class="result-line"><span class="lbl">Indemnité d\'entretien moyenne par jour</span><span class="val">'+fmtEUR(dv.ieJour)+'</span></div>';
  if(CT && (CT.ieMode===1 || CT.ieMode===2) && ieContrat(CT)){
    const P = ieParDuree(CT);
    h += P.map(x=>'<div class="result-line"><span class="lbl">&nbsp;&nbsp;↳ Journée de '+fmtH(x.h*60)+'</span><span class="val">'+fmtEUR(x.v)+(x.v > x.prevu + 1e-9 ? ' (minimum légal)' : '')+'</span></div>').join('');
    if(P.some(x=>x.v > x.prevu + 1e-9)){
      const maxLeg = Math.max(...P.map(x=>x.leg));
      h += '<div class="warn-box">Le montant prévu ('+fmtEUR(ieContrat(CT))+') est inférieur au minimum légal pour certaines journées : le carnet appliquera le minimum ces jours-là. Pour un montant unique valable tous les jours, prévoyez au moins <b>'+fmtEUR(maxLeg)+'</b>.</div>';
    }
  }
  h+='<div class="result-line"><span class="lbl">Indemnités d\'entretien (moyenne par mois)</span><span class="val">'+fmtEUR(dv.ieMois)+'</span></div>'
    + '<div class="hint">Moyenne pour se faire une idée : l\u2019entretien est payé pour chaque jour où l\u2019enfant vient, donc le montant réel change d\u2019un mois à l\u2019autre (onglet Mois).</div>';
  if(dv.repasMois) h+='<div class="result-line"><span class="lbl">Repas (moyenne par mois)</span><span class="val">'+fmtEUR(dv.repasMois)+'</span></div>';
  if(dv.km) h+='<div class="result-line"><span class="lbl">Frais kilométriques</span><span class="val">'+fmtEUR(dv.km)+'</span></div>';
  h+='<div class="result-line total"><span class="lbl">Total perçu par mois (net)</span><span class="val">'+fmtEUR(dv.totalNet)+'</span></div>';
  if(fe) h+='<div class="result-line"><span class="lbl">Fin de la période d\'essai (maximum)</span><span class="val">'+fe.toLocaleDateString('fr-FR')+'</span></div>';
  h+='<div class="legal">Montants calculés avec la réglementation en vigueur aujourd\'hui. Le salaire horaire ne peut jamais être inférieur au minimum légal : s\'il change, le carnet l\'applique automatiquement et vous prévient. La période d\'essai est de '+((R('essai')||[3,2])[0])+' mois au plus pour 1 à 3 jours d\'accueil par semaine, '+((R('essai')||[3,2])[1])+' mois pour 4 jours et plus.</div>';
  setHTML('ct-recap', h);
}
function ctStep(dir){
  ctRead();
  if(dir>0){
    if(CT_STEP===0 && !CT.enfant){ toast('Indiquez au moins le prénom de l\'enfant.'); $('ct-enfant').focus(); return; }
    if(CT_STEP===1 && !parseD(CT.debut)){ toast('Indiquez la date de début du contrat : elle sert à tous les calculs.'); $('ct-debut').focus(); return; }
    if(CT_STEP===1 && parseD(CT.fin) && parseD(CT.fin) < parseD(CT.debut)){ toast('La date de fin est avant la date de début.'); $('ct-fin').focus(); return; }
    if(CT_STEP===1 && CT.type===1 && !(parseFloat(CT.semaines)>0)){ toast('Indiquez le nombre de semaines d\'accueil par an.'); $('ct-semaines').focus(); return; }
    if(CT_STEP===3 && !(parseFloat(CT.taux)>0)){ ctTauxManquant(()=>{ CT_STEP = 4; ctRefresh(); window.scrollTo(0,0); }); return; }
    if(CT_STEP===2 && !derive(CT).moyH){ toast('Indiquez les heures d\'au moins un jour.'); return; }
    if(CT_STEP===4){ ctSave(); return; }
  }
  CT_STEP = Math.max(0, Math.min(4, CT_STEP+dir));
  ctRefresh(); window.scrollTo(0,0);
}
/* Salaire horaire vide : proposer le minimum légal plutôt qu'un contrat à 0 € */
function ctTauxManquant(suite){
  const mn = derive(CT, today()).tauxMin;
  showConfirmDialog('Salaire horaire', 'Aucun salaire horaire n\u2019est indiqué. Mettre le minimum légal ('+fmtEUR(mn)+' brut de l\u2019heure) ? Vous pourrez le changer plus tard.', ()=>{
    setVal('ct-taux', mn); ctRead(); if(suite) suite();
  }, 'Oui, mettre '+fmtEUR(mn), 'Je l\u2019indique moi-même');
  _confirmNoCb = ()=>{ setTimeout(()=>{ const t=$('ct-taux'); if(t) t.focus(); }, 50); };
}
function ctSave(){
  ctRead();
  if(!CT.enfant){ toast('Indiquez au moins le prénom de l\'enfant.'); CT_STEP=0; ctRefresh(); return; }
  if(!parseD(CT.debut)){ toast('Indiquez la date de début du contrat.'); CT_STEP=1; ctRefresh(); return; }
  if(!(parseFloat(CT.taux)>0)){ CT_STEP=3; ctRefresh(); ctTauxManquant(()=>ctSave()); return; }
  const exist = STATE.contrats.find(c=>c.id===CT.id);
  if(exist && CT._orig && JSON.stringify(paramsOf(CT)) !== JSON.stringify(CT._orig) && !CT._avenantDone){
    _confirmNoCb = ()=>{ CT._avenantDone = true; auditLog(CT.id, 'Correction du contrat (sans date d\'effet)'); ctSave(); };
    showConfirmDialog('Avenant ou correction ?', 'Vous avez changé le planning, le salaire ou les indemnités. Est-ce un AVENANT (changement à partir d\'une date : les mois d\'avant gardent les anciennes valeurs) ou la CORRECTION d\'une erreur de saisie (tout est recalculé avec les nouvelles valeurs) ?', ()=>{
      _confirmNoCb = null;
      const def = iso(new Date(today().getFullYear(), today().getMonth()+1, 1));
      askText('Date d\'effet de l\'avenant', 'À partir de quel jour les nouvelles valeurs s\'appliquent-elles ? Choisissez la date dans le calendrier.', def, v=>{
        const d = parseD((v||'').trim()); if(!d){ toast('Date non reconnue.'); return; }
        // un avenant ne peut pas prendre effet avant le début du contrat, ni avant (ou le jour d') un avenant déjà enregistré :
        // sinon l'avenant intermédiaire serait effacé et les mois concernés recalculés avec de mauvaises valeurs
        const dernier = (CT.hist||[]).map(x=>x.jusqua).sort().pop();
        if(parseD(CT.debut) && d <= parseD(CT.debut)){ toast('La date d\u2019effet doit être après le début du contrat ('+fmtDate(CT.debut)+'). Pour changer le contrat dès le début, choisissez « C\u2019est une correction ».'); return; }
        if(dernier && iso(d) <= dernier){ toast('Un avenant prend déjà effet le '+fmtDate(iso(addDays(parseD(dernier),1)))+'. La date d\u2019effet doit être postérieure.'); return; }
        const quitteIncomplete = CT._orig && CT._orig.type===1 && (CT.type!==1 || String(CT._orig.semaines)!==String(CT.semaines) || JSON.stringify(CT._orig.wA)!==JSON.stringify(CT.wA) || JSON.stringify(CT._orig.wB)!==JSON.stringify(CT.wB));
        CT.hist = (CT.hist||[]).filter(x=>x.jusqua < iso(d));
        CT.hist.push({jusqua: iso(addDays(d,-1)), p: CT._orig, avenantDu: iso(d), saisiLe: new Date().toISOString()});
        CT._avenantDone = true; auditLog(CT.id, 'Avenant à effet du '+d.toLocaleDateString('fr-FR')); ctSave();
        if(quitteIncomplete) setTimeout(()=>showConfirmDialog('Régularisation à faire',
          'Le contrat était en année incomplète et son rythme change au '+d.toLocaleDateString('fr-FR')+'. Comparez les heures réellement faites et les heures payées depuis le début du contrat (ou depuis la dernière régularisation) jusqu\u2019au '+addDays(d,-1).toLocaleDateString('fr-FR')+' : s\u2019il en manque, la différence est à payer avec le salaire de ce mois-là. Le calcul est celui de « Fin de contrat ▸ Régularisation », avec la date de l\u2019avenant comme date de fin.',
          ()=>showTheme('fin'), 'Ouvrir le calcul', 'Plus tard'), 400);
      }, {type:'date'});
    }, 'C\'est un avenant', 'C\'est une correction');
    return;
  }
  delete CT._orig; delete CT._avenantDone;
  const i = STATE.contrats.findIndex(c=>c.id===CT.id);
  if(i>=0){
    STATE.contrats[i] = CT;
    // les calculs déjà enregistrés pour cet enfant sont repris depuis le contrat modifié
    Object.keys(STATE.forms).forEach(t=>{ if(STATE.forms[t] && t!=='abattement' && t!=='cmg') delete STATE.forms[t][CT.id]; });
  } else STATE.contrats.push(CT);
  if(STATE.ui) delete STATE.ui.ctDraft;
  saveState(); toast('Enregistré : '+CT.enfant);
  CT = null; showHome(false, 'enfants');
}

/* =====================================================================================
   SÉLECTEUR D'ENFANT DANS CHAQUE CALCUL + MÉMOIRE DES SAISIES
   ===================================================================================== */
const PICKER_THEMES = ['mensu','mois','ccass','cp','ie','fin','parents'];
function selKey(theme){ const k = STATE.sel[theme]; return (k && (k==='libre' || getContrat(k))) ? k : (STATE.contrats[0] ? STATE.contrats[0].id : 'libre'); }
function renderPicker(theme){
  const el = document.querySelector('.kid-picker[data-for="'+theme+'"]'); if(!el) return;
  const k = selKey(theme);
  let h = '<span class="q">Pour quel enfant ?</span><div class="chips">';
  STATE.contrats.forEach(c=>{ h+='<button type="button" class="chip'+(k===c.id?' on':'')+'" onclick="pickKid(\''+theme+'\',\''+c.id+'\')">'+esc(c.enfant||'Enfant')+'</button>'; });
  h += '<button type="button" class="chip'+(k==='libre'?' on':'')+'" onclick="pickKid(\''+theme+'\',\'libre\')">Saisie libre</button></div>';
  h += '<div class="kp-hint">'+(k==='libre'
      ? 'Calcul ponctuel : remplissez les cases vous-même. Vos saisies restent mémorisées.'
      : 'Cases remplies d\'après le contrat de '+esc(getContrat(k).enfant)+'. Vous pouvez les modifier : vos changements sont mémorisés. <br><button type="button" class="btn small" style="margin-top:6px" onclick="refillFromContract(\''+theme+'\')">↺ Revenir aux valeurs du contrat</button>')+'</div>';
  el.innerHTML = h;
}
function pickKid(theme, key){
  persistTheme(theme);
  STATE.sel[theme] = key; saveState();
  loadThemeForm(theme);
}
function refillFromContract(theme){
  const k = selKey(theme);
  if(STATE.forms[theme]) delete STATE.forms[theme][k];
  loadThemeForm(theme);
  toast('Valeurs du contrat rechargées.');
}
function formCollect(theme){
  const root = $('theme-'+theme), f = {i:{}, s:{}};
  root.querySelectorAll('input[id], select[id]').forEach(el=>{ if(el.type!=='file' && el.value!=='') f.i[el.id]=el.value; });
  root.querySelectorAll('.seg[id]').forEach(g=>{ f.s[g.id]=parseInt(g.dataset.value||0); });
  return f;
}
function formApply(theme, f){
  const root = $('theme-'+theme);
  root.querySelectorAll('input[id], select[id]').forEach(el=>{ if(el.type!=='file') el.value=''; });
  root.querySelectorAll('.seg[id]').forEach(g=>{ const def=g.dataset.def!==undefined?+g.dataset.def:0; setSegVal(g.id, def); });
  if(!f) return;
  Object.keys(f.s||{}).forEach(id=>setSegVal(id, f.s[id]));
  Object.keys(f.i||{}).forEach(id=>setVal(id, f.i[id]));
  refreshVisibility(theme);
  // 2ᵉ passage : champs créés dynamiquement (calendrier…)
  Object.keys(f.i||{}).forEach(id=>{ if($(id)) setVal(id, f.i[id]); });
}
function formKey(theme){ return (theme==='abattement'||theme==='cmg') ? 'all' : selKey(theme); }
function persistTheme(theme){
  if(!$('theme-'+theme) || ['contrat','reglages','aide','docs','suivi'].includes(theme)) return;
  STATE.forms[theme] = STATE.forms[theme] || {};
  STATE.forms[theme][formKey(theme)] = formCollect(theme);
  saveState();
}
function loadThemeForm(theme){
  const key = formKey(theme);
  const saved = STATE.forms[theme] && STATE.forms[theme][key];
  if(saved){ formApply(theme, saved); }
  else {
    formApply(theme, null);
    const c = key!=='libre' && key!=='all' ? getContrat(key) : null;
    if(PREFILL[theme]) PREFILL[theme](c);
    refreshVisibility(theme);
  }
  if(PICKER_THEMES.includes(theme)) renderPicker(theme);
  recalc(theme);
}
/* Remet les segments à leur valeur par défaut HTML (mémorisée au démarrage) */
function rememberSegDefaults(){ document.querySelectorAll('.seg[id]').forEach(g=>{ g.dataset.def = g.dataset.value||0; }); }
