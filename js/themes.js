/* =====================================================================================
   CALCULS : mensualisation, mois, mois incomplet, congés payés, entretien, fin de contrat
   ===================================================================================== */
'use strict';

const CALC = {};      // CALC[theme]() relance le calcul
const PREFILL = {};   // PREFILL[theme](contrat|null) remplit les cases depuis un contrat
const VIS = {};       // VIS[theme]() met à jour ce qui est affiché/masqué

function recalc(theme){ if(CALC[theme]) CALC[theme](); }
function refreshVisibility(theme){ if(VIS[theme]) VIS[theme](); }
function onThemeOpen(id){
  if(id==='contrat'){ ctRefresh(); return; }
  if(id==='reglages'){ renderSettings(); return; }
  if(id==='aide'){ renderAide(); return; }
  if(id==='formation'){ renderFormation(); return; }
  if(id==='docs'){ renderDocs(); return; }
  if(id==='suivi'){ renderSuivi(); return; }
  loadThemeForm(id);
  if(id==='cmg') cmgRefreshHistorySelect();
  if(id==='abattement') abUpdateStatus();
}
function onSegChange(groupId, idx){
  const theme = ($(groupId).closest('.theme')||{}).id;
  if(!theme){ return; }
  const t = theme.replace('theme-','');
  if(t==='contrat'){ ctRefresh(); return; }
  if(t==='reglages'){ settingsChanged(); return; }
  refreshVisibility(t);
  recalc(t);
  persistTheme(t);
}
/* Toute saisie relance le calcul du thème et l'enregistre */
document.addEventListener('input', e=>{
  const th = e.target.closest && e.target.closest('.theme');
  if(!th) return;
  const t = th.id.replace('theme-','');
  if(t==='contrat'){ ctRefresh(); return; }
  if(t==='reglages'){ settingsChanged(); return; }
  if(e.target.id==='ccass-cal-mois'){ buildCcassCalendar(); }
  if(e.target.id==='ccass-motif-sel'){ VIS.ccass(); }
  if(e.target.id==='mois-mois' && moisContrat() && e.target.value){ moisFillFromContract(moisContrat(), e.target.value); VIS.mois(); }
  if(e.target.id==='ie-mois' && ieContratChoisi() && e.target.value){ ieFillFromContract(ieContratChoisi(), e.target.value); VIS.ie(); }
  if(e.target.id && e.target.id.indexOf('ccass-d')===0){ onCcassCalInput(); }
  recalc(t);
  clearTimeout(th._pt); th._pt = setTimeout(()=>persistTheme(t), 500);
});
function warnHTML(list){ return list.length ? '<div class="warn-box">'+list.join('<br>')+'</div>' : ''; }
function infoHTML(list){ return list.length ? '<div class="info-box">'+list.join('<br>')+'</div>' : ''; }
function curMonth(){ return isoMonth(today()); }

/* =====================================================================================
   01 · SALAIRE MENSUALISÉ
   ===================================================================================== */
VIS.mensu = ()=>{
  const alt = seg('mensu-rythme')===1;
  show('mensu-semaines-wrap', seg('mensu-type')===1);
  show('mensu-hB-wrap', alt); show('mensu-jB-wrap', alt);
  setTxt('mensu-hA-label', alt ? 'Heures de la semaine 1' : 'Heures par semaine');
  setTxt('mensu-jA-label', alt ? 'Jours d\'accueil de la semaine 1' : 'Jours d\'accueil par semaine');
};
PREFILL.mensu = c=>{
  if(!c) return;
  const dv = derive(c);
  setSegVal('mensu-type', c.type); setSegVal('mensu-rythme', c.alterne); setSegVal('mensu-titre', c.titre);
  setVal('mensu-semaines', c.semaines);
  setVal('mensu-hA', round2(dv.hA)); setVal('mensu-jA', dv.jA);
  if(c.alterne){ setVal('mensu-hB', round2(dv.hB)); setVal('mensu-jB', dv.jB); }
  setVal('mensu-taux', c.taux); setVal('mensu-maj', c.maj);
};
CALC.mensu = ()=>{
  const alt = seg('mensu-rythme')===1;
  const hA=num('mensu-hA'), hB=alt?num('mensu-hB'):hA, jA=num('mensu-jA'), jB=alt?num('mensu-jB'):jA;
  const sem = seg('mensu-type')===1 ? num('mensu-semaines') : 52;
  const seuil = R('seuilMaj');
  const majA=Math.max(0,hA-seuil), majB=Math.max(0,hB-seuil);
  const RM = rythmeMoyen(seg('mensu-type'), alt, hA, hB, jA, jB, majA, majB), moy = RM.moyH, moyMaj = RM.moyMaj, moyJ = RM.moyJ;
  const tauxMin = R(seg('mensu-titre')? 'salMinTitre':'salMin');
  const tSaisi = num('mensu-taux');
  const taux = tSaisi ? Math.max(tSaisi, tauxMin) : 0;
  const majPct = Math.max(num('mensu-maj')||R('majMin'), R('majMin'));
  const hNorm=(moy-moyMaj)*sem/12, hMaj=moyMaj*sem/12;
  const salaire = hNorm*taux + hMaj*taux*(1+majPct/100);
  show('row-mensu-cp12', seg('mensu-type')===1 && salaire>0, 'flex'); setTxt('out-mensu-cp12', fmtEUR(salaire*1.10));
  const w = [];
  if(tSaisi && tSaisi < tauxMin-1e-9) w.push('⛔ Le salaire horaire saisi ('+fmtEUR(tSaisi)+') est inférieur au minimum légal ('+fmtEUR(tauxMin)+' depuis le '+fmtDate(Rdu(seg('mensu-titre')?'salMinTitre':'salMin'))+'). Le calcul applique le minimum.');
  if(seg('mensu-type')===1 && sem>46) w.push('En année incomplète, le nombre de semaines d\'accueil ne dépasse pas 46 (52 semaines − 6 semaines au moins sans accueil, congés compris). Au-delà, il s\'agit d\'une année complète.');
  if(moy > R('hMaxSemaine')) w.push('Plus de '+R('hMaxSemaine')+' h par semaine : seulement avec votre accord écrit (2 250 h par an au maximum).');
  setHTML('mensu-warn', warnHTML(w));
  setTxt('out-mensu-moy', moy ? fmtNum(moy,2)+' h' : '—');
  setTxt('out-mensu-heures', (hNorm+hMaj) ? fmtNum(hNorm+hMaj,2)+' h' : '—');
  show('row-mensu-hmaj', hMaj>0, 'flex'); setTxt('out-mensu-hmaj', fmtNum(hMaj,2)+' h (+'+majPct+' %)');
  setTxt('out-mensu-jours', moyJ&&sem ? fmtNum(moyJ*sem/12,2)+' j' : '—');
  setTxt('out-mensu-salaire', salaire ? fmtEUR(salaire) : '—');
  setTxt('out-mensu-net', salaire ? fmtEUR(netMensualise(salaire, hMaj*taux*(1+majPct/100))) : '—');
  setTxt('mensu-net-hint', 'Estimation à '+fmtNum(netRatio()*100,2)+' % du brut'+(STATE.settings.am?' (Alsace-Moselle)':'')+' ; le net exact est calculé par Pajemploi.');
};

/* =====================================================================================
   02 · SALAIRE DU MOIS, DÉCLARATION PAJEMPLOI ET HISTORIQUE DES MOIS VALIDÉS
   ===================================================================================== */
VIS.mois = ()=>{
  const inc = seg('mois-type')===1;
  if(selKey('mois')==='libre'){ ['mois-fold-contrat','mois-fold-frais'].forEach(id=>{ const d=$(id); if(d) d.open = true; }); }
  show('mois-incomplet-wrap', seg('mois-incomplet')===1);
  show('mois-heuresup-wrap', seg('mois-heuresup')===1);
  show('mois-ferie-wrap', seg('mois-ferie')===1);
  show('mois-cp-complete', !inc); show('mois-cp-incomplete', inc);
};
function moisContrat(){ const k = selKey('mois'); return k!=='libre' ? getContrat(k) : null; }
PREFILL.mois = c=>{
  const m = curMonth(); setVal('mois-mois', m);
  if(!c) return;
  moisFillFromContract(c, m);
};
function moisFillFromContract(c, m){
  const d = parseD(m);
  setVal('mois-ded-maj', ''); setVal('mois-abs-dates', ''); setVal('mois-pas', '');
  const dv = derive(c, d);
  setSegVal('mois-type', c.type);
  setVal('mois-base', round2(dv.brutBase)); setVal('mois-heures', round2(dv.hMensu)); setVal('mois-taux', round2(dv.tauxEff));
  setVal('mois-jmensu', round2(dv.joursMensu));
  // jours de présence prévus : même calcul que l'onglet Mois (fériés chômés, semaines sans accueil, dates du contrat)
  const I = ieDuMois(c, m), ccM = paramsAt(c, new Date(d.getFullYear(), d.getMonth()+1, 0));
  setVal('mois-jours', I.jours || '');
  setVal('mois-hjour', I.jours ? round2(I.hAvg) : round2(dv.hDayAvg));
  setVal('mois-indemj', I.fixe || '');
  setVal('mois-repas', ccM.repasMode===1 ? ccM.repasPrix : '');
  setVal('mois-km', c.km);
  setSegVal('mois-cp12', (c.type===1 && c.cpMode===0) ? 1 : 0);
  if(c.paiementJour){
    const pj = Math.min(parseInt(c.paiementJour)||1, 28);
    const nx = new Date(d.getFullYear(), d.getMonth()+1, pj);   // salaire payé le mois suivant
    setVal('mois-datepaie', iso(nx));
  }
  // Le mois de début ou de fin du contrat est forcément incomplet : on le signale
  setVal('mois-j8',''); setVal('mois-hm8',''); setVal('mois-regul','');
  // Même calcul que l'onglet Mois : journées réelles si le mois est suivi, sinon planning du contrat jour par jour.
  // Le mois d'entrée ou de sortie en cours de mois est ainsi proratisé (méthode de la Cour de cassation),
  // les fériés chômés et les semaines sans accueil sont exclus, les avenants ventilés.
  if(typeof suiviFillMois==='function') suiviFillMois(c, m);
}
/* Tous les chiffres du mois : utilisés pour l'affichage, Pajemploi et l'historique */
function moisPssAlerte(r){
  const p = R('pss', r.d);
  return p && r.brut > p ? 'Salaire de '+fmtEUR(r.brut)+' chez cet employeur : au-delà du plafond de la Sécurité sociale ('+fmtEUR(p)+' par mois), d\u2019autres taux de cotisations s\u2019appliquent. Le net estimé est moins précis : fiez-vous au bulletin Pajemploi.' : '';
}
function moisCompute(){
  const m = val('mois-mois') || curMonth(), d = parseD(m);
  const inc = seg('mois-type')===1;
  const taux = num('mois-taux'), base = num('mois-base');
  const absent = seg('mois-incomplet')===1;
  const ded = absent ? Math.min(num('mois-deduction'), base) : 0;
  const hs = seg('mois-heuresup')===1;
  const hcompl = hs ? num('mois-hcompl') : 0, hmaj = hs ? num('mois-hmaj') : 0;
  const majPct = Math.max(num('mois-majoration')||R('majMin',d), R('majMin',d));
  const fer = seg('mois-ferie')===1;
  const supFerie = fer ? num('mois-hferie')*taux*R('majFerie',d)/100 + num('mois-h1mai')*taux*R('majPremierMai',d)/100 : 0;
  const brutCompl = hcompl*taux, brutMaj = hmaj*taux*(1+majPct/100);
  const brutNormal = Math.max(0, base-ded) + supFerie;
  const cp12 = inc && seg('mois-cp12')===1 ? (brutNormal+brutCompl+brutMaj)*(R('cpDixieme', d)||0.10) : 0;
  const cpVerse = num('mois-cpmontant');   // année incomplète : indemnité de congés ; année complète : complément de juin (règle des 10 %)
  const cpTot = cp12 + cpVerse;
  const regul = num('mois-regul');
  const brut = brutNormal + brutCompl + brutMaj + cpTot + regul;
  // Heures au-delà de 45 h prévues au planning (mensualisées) : ce sont des heures majorées. Elles se déclarent
  // comme telles sur Pajemploi et bénéficient, comme les heures majorées faites en plus, de la réduction de
  // cotisations salariales et de l'exonération d'impôt.
  // (même découpage que l'onglet Mois, ventilé par avenant)
  const cMaj = moisContrat(), Mmaj = cMaj ? suiviMonth(cMaj, m) : null;
  const partMaj = Mmaj ? Mmaj.partMaj : 0;
  const ratioDu0 = base ? Math.max(0, base-ded)/base : 1;
  // part de la déduction qui porte sur les heures majorées prévues : précisée par « Mois incomplet » (heures
  // majorées non travaillées), sinon répartie au prorata (même méthode que le suivi au jour le jour)
  const baseMaj = base*partMaj, dedMajSaisi = val('mois-ded-maj');
  const dedMaj = !absent ? 0 : (dedMajSaisi!=='' ? Math.min(num('mois-ded-maj'), baseMaj, ded) : ded*partMaj);
  const ratioMaj = baseMaj ? Math.max(0, baseMaj-dedMaj)/baseMaj : ratioDu0;
  const baseNorm = base - baseMaj, dedNorm = ded - dedMaj, ratioNorm = baseNorm>0 ? Math.max(0, baseNorm-dedNorm)/baseNorm : ratioDu0;
  const brutMajMensu = Math.max(0, baseMaj-dedMaj), hMajMensuDu = Mmaj ? Mmaj.hMajMensuV*ratioMaj : 0;
  // Net : cotisations réduites sur les heures complémentaires et majorées
  const ratio = netRatio(d), red = hsReduction(d);
  const netHs = (brutCompl+brutMaj+brutMajMensu)*Math.min(1, ratio+red);
  const net = (brutNormal-brutMajMensu+cpTot+regul)*ratio + netHs;
  // Net imposable : + CSG non déductible et CRDS ; les heures en plus sont exonérées d'impôt
  const Lc = cotisLignes(d), csgnd = Lc ? Lc.filter(x=>x.imp).reduce((s,x)=>s+x.t,0) : (R('csgNonDed', d)||0), assiette = R('assietteCsg', d)||0.9825;
  // heures en plus exonérées d'impôt, mais leur CSG et leur CRDS ne sont pas déductibles : elles restent imposables
  const csgHs = (R('cotCsgDed', d)||0) + (R('cotCsgNonDed', d)||0) + (R('cotCrds', d)||0);
  const netImp = (brutNormal-brutMajMensu+cpTot+regul)*(ratio + csgnd*assiette) + (brutCompl+brutMaj+brutMajMensu)*csgHs*assiette;
  // Entretien, repas, km
  // Entretien : jour par jour (même total que l'onglet Mois) tant que les cases reprises du contrat ne sont pas modifiées ;
  // sinon, saisie libre sur une durée moyenne. Montants au centime (minimum légal arrondi au centime supérieur).
  const joursSaisis = num('mois-jours'), hj = num('mois-hjour'), ieSaisie = num('mois-indemj');   // montant du contrat tel qu'écrit
  const ieLeg = ieLegalJour(hj || R('ieHeuresRef', d), d);
  let ieAuto = null, jours = joursSaisis;
  const cIE = moisContrat();
  const absSet = new Set(String(val('mois-abs-dates')||'').split(',').filter(Boolean));
  if(cIE && joursSaisis){
    const I = ieDuMoisSauf(cIE, m, absSet);
    // absence retirée du salaire sans préciser les jours : l'entretien et les repas de ces jours ne sont pas dus non plus
    // les jours hors contrat (début ou fin en cours de mois) sont déjà exclus des jours de présence : seuls les vrais jours d'absence se retirent
    const jHors = Mmaj ? Mmaj.T.jOut : 0;
    const jdedSansDates = absent && !I.suivi && !absSet.size && I.jours===joursSaisis ? Math.min(I.jours, Math.max(0, (Math.round(num('mois-jded'))||0) - jHors)) : 0;
    jours = joursSaisis - jdedSansDates;
    const memeMontant = Math.abs(I.fixe-ieSaisie)<0.005, memeDuree = Math.abs(round2(I.hAvg)-hj)<0.005;
    if(memeMontant && memeDuree && I.jours===jours) ieAuto = I;
    else if(memeMontant && memeDuree && jours < I.jours){
      // jours d'absence non précisés : on retire les journées les moins chères (hypothèse la plus favorable à la salariée)
      const keep = I.days.slice().sort((a,b)=>b.ie-a.ie).slice(0, jours), vk = keep.map(x=>x.ie);
      ieAuto = Object.assign({}, I, {days: keep, jours, total: round2(vk.reduce((s,v)=>s+v,0)), min: vk.length ? Math.min(...vk) : 0, max: vk.length ? Math.max(...vk) : 0, modifie: true, favorable: true});
    }
  }
  // durée non indiquée : le montant convenu est retenu tel quel (le minimum ne peut pas être vérifié), sinon minimum pour 9 h
  // contrat « montant pour 9 h » : au prorata de la durée moyenne si elle est plus courte
  const modeIE = cIE ? (paramsAt(cIE, new Date(d.getFullYear(), d.getMonth()+1, 0)).ieMode||0) : 1;
  const iePrevu = ieSaisie && hj ? ieContratJour({ieMode: modeIE===2 ? 2 : 1, ieMontant: ieSaisie}, hj, d) : ieSaisie;
  const ieJour = ieAuto ? (ieAuto.jours ? ieAuto.total/ieAuto.jours : 0) : (ieSaisie && !hj ? ieSaisie : Math.max(iePrevu, ieLeg));
  const ie = ieAuto ? ieAuto.total : (jours ? round2(ieJour*jours) : 0);
  // repas : total exact du mois (jours de présence × prix), exprimé au centime seulement à la fin
  const repas = ieAuto && !ieAuto.modifie && Math.abs(num('mois-repas') - (ieAuto.M.T.jAcc ? ieAuto.M.T.repas/ieAuto.M.T.jAcc : 0)) < 1e-6
    ? round2(ieAuto.M.T.repas) : round2(jours*num('mois-repas'));
  const km = round2(num('mois-km'));
  // Pajemploi : heures et jours mensualisés, diminués de l'absence ; + heures de congés payés (année incomplète)
  const hMensu = num('mois-heures'), jMensu = num('mois-jmensu');
  const ratioDu = base ? Math.max(0, base-ded)/base : 1;
  // Heures normales : arrondies à l'heure la plus proche (consigne Pajemploi pour les heures mensualisées).
  // Heures complémentaires et majorées : aucun texte ne prévoit d'arrondi, le nombre exact est conservé.
  const hNormDecl = Math.round(Math.max(0, (hMensu - (Mmaj ? Mmaj.hMajMensuV : 0))*ratioNorm) + (inc && taux ? cpTot/taux : 0));
  const hComplDecl = hcompl, hMajDecl = hmaj + hMajMensuDu;
  const jprev = num('mois-jprev'), jded = absent ? num('mois-jded') : 0;
  const jDecl0 = jMensu ? Math.ceil((jprev ? jMensu - jMensu/jprev*jded : jMensu*ratioDu) - 1e-9) : 0;
  // mois d'entrée ou de sortie en cours de mois : au moins les jours où l'enfant est réellement accueilli
  const jHorsC = Mmaj ? Mmaj.T.jOut : 0, jDecl = jHorsC && jours ? Math.max(jDecl0, jours) : jDecl0;
  // Heures réellement effectuées (pour la régularisation)
  let hReel = num('mois-hreel'), hReelAuto = false;
  if(!val('mois-hreel')){
    const c = moisContrat();
    // heures dues du planning : les jours fériés chômés sont payés, ils comptent donc comme effectués
    if(c){ const days = plannedDays(c, d.getFullYear(), d.getMonth()); hReel = days.reduce((s,x)=>s+x.h,0); }
    else hReel = hMensu;
    // les heures travaillées un jour férié sont déjà dans le planning : seules les heures en plus s'ajoutent
    hReel = Math.max(0, hReel - (absent ? num('mois-hded') : 0)) + hcompl + hmaj;
    hReelAuto = true;
  }
  // pour la régularisation : heures du contrat seulement (les heures en plus sont déjà payées à part)
  const hContrat = Math.max(0, hReel - hcompl - hmaj);
  // Abattement fiscal : jours de 8 h et plus / heures des jours plus courts
  const H8 = R('abatHeuresJour', d)||8;
  // jours exacts quand le mois vient du suivi au jour le jour, sinon estimation par la durée moyenne
  // sans suivi : chaque journée du planning est classée selon SA durée (pas la durée moyenne)
  const jH = ieAuto ? ieAuto.days.map(x=>x.R/60) : null;
  const j8 = val('mois-j8')!=='' ? num('mois-j8') : (jH ? jH.filter(h=>h>=H8).length : (hj >= H8 ? jours : 0));
  const hm8 = val('mois-hm8')!=='' ? num('mois-hm8') : (jH ? jH.filter(h=>h<H8).reduce((s,h)=>s+h,0) : (hj < H8 ? jours*hj : 0));
  // impôt sur le revenu retenu par Pajemploi : montant du bulletin s'il est saisi, sinon estimation avec le taux du profil (0 % par défaut)
  const pasM = val('mois-pas')!=='' ? Math.max(0, num('mois-pas')) : pasEstime(netImp, ie, repas);
  return {m, d, inc, taux, base, ded, hContrat, brutMensu: Math.max(0, base-ded), hcompl, hmaj, majPct, supFerie, brutCompl, brutMaj, brutNormal, cp12, cpVerse, cpTot, brut,
    net, netHs, netImp, brutMajMensu, hMajMensuDu, hComplDecl, hMajDecl, jours, hj, ieLeg, ieSaisie, ieJour, ie, ieAuto, repas, km, hNormDecl, jDecl, jHors: jHorsC, hReel, hReelAuto, j8, hm8,
    pas: pasM, jcp: num('mois-jcp'), acompte: num('mois-acompte'), datepaie: val('mois-datepaie')};
}
/* Jours fériés : précisions selon le contrat (fériés travaillés) et le lundi de Pentecôte (journée de solidarité) */
function feriesPlus(fl){
  const c = moisContrat(); let t = '';
  if(c && c.feriesTr===1) t += ' Votre contrat prévoit des jours fériés travaillés : un férié prévu au planning est compté comme travaillé, majoré de 10 % (le 1er mai reste chômé et payé ; s’il est travaillé, notez-le : +100 %).';
  if(fl.some(x=>/Pentecôte/.test(x))) t += ' Lundi de Pentecôte : s’il a été fixé par écrit comme journée de solidarité, il est travaillé sans supplément (7 h au plus pour un temps plein, au prorata sinon ; les avis divergent pour les assistantes maternelles, d’où l’accord écrit) ; sinon, c’est un jour férié comme les autres.';
  return t;
}
CALC.mois = ()=>{
  const r = moisCompute(), d = r.d;
  const fl = Object.entries(feries(d.getFullYear())).filter(([k])=>k.slice(0,7)===r.m.slice(0,7)).map(([k,n])=>n+' ('+fmtDate(k)+')');
  setTxt('mois-feries-liste', fl.length ? 'Jours fériés ce mois-ci : '+fl.join(', ')+'. Un jour férié chômé prévu au planning est payé normalement (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée).'+feriesPlus(fl) : 'Aucun jour férié ce mois-ci.');
  moisAbsRender();
  setTxt('mois-ie-hint', r.ieAuto && r.ieAuto.favorable
    ? 'Jours d\u2019absence non précisés : le carnet retire les journées les moins chères (hypothèse la plus favorable à l\u2019assistante maternelle). Touchez les jours d\u2019absence ci-dessous pour le montant exact.'
    : r.ieAuto
    ? 'Calcul jour par jour d\'après '+(r.ieAuto.suivi ? 'le suivi des journées' : 'le planning du contrat')+' : chaque journée reçoit le montant du contrat, jamais moins que le minimum légal de sa durée (même total que l\'onglet Mois).'
    : 'Minimum légal pour une journée de '+fmtNum(r.hj||R('ieHeuresRef', r.d)||9,2)+' h : '+fmtEUR(r.ieLeg)+'. Laissez vide pour l\'appliquer.'+(moisContrat() ? ' Cases modifiées à la main : calcul sur la durée moyenne.' : ''));
  setTxt('mois-hreel-hint', r.hReelAuto ? 'Calculé d\'après le planning : '+fmtNum(r.hReel,2)+' h. Corrigez si besoin (sert à la régularisation de fin de contrat).' : 'Gardées dans l\'historique pour la régularisation de fin de contrat.');
  const w = [];
  const cT = moisContrat(), tauxMin = R(cT && cT.titre ? 'salMinTitre' : 'salMin', d);
  if(r.taux && r.taux < tauxMin-1e-9) w.push('⛔ Salaire horaire inférieur au minimum légal de ce mois ('+fmtEUR(tauxMin)+(cT && cT.titre ? ', avec le titre AM-AP' : '')+').');
  const pssW = moisPssAlerte(r); if(pssW) w.push('⚠️ '+pssW);
  if(r.ieAuto && r.ieAuto.releves && r.ieAuto.mode===2) w.push('⚠️ Le montant prévu au contrat pour 9 h ('+fmtEUR(r.ieAuto.fixe)+') est inférieur au minimum légal ('+fmtEUR(ieLegalJour(R('ieHeuresRef', d)||9, d))+' pour 9 h) : le minimum est appliqué '+r.ieAuto.releves+' j sur '+r.ieAuto.jours+'. Pensez à un avenant.');
  else if(r.ieAuto && r.ieAuto.releves) w.push('⚠️ Le montant du contrat ('+fmtEUR(r.ieAuto.fixe)+' par jour) est inférieur au minimum légal pour les journées de plus de '+fmtH(Math.floor(ieSeuilHeures(r.ieAuto.fixe, d)*60))+' : le minimum est appliqué ces jours-là ('+r.ieAuto.releves+' j sur '+r.ieAuto.jours+'). Pensez à un avenant.');
  else if(!r.ieAuto && r.ieSaisie && !r.hj) w.push('Durée des journées non indiquée : '+fmtEUR(r.ieSaisie)+' par jour est retenu sans contrôle. Il est sous le minimum légal pour les journées de plus de '+fmtH(Math.floor(ieSeuilHeures(r.ieSaisie, d)*60))+' : indiquez la durée moyenne pour le vérifier.');
  else if(!r.ieAuto && r.ieSaisie && r.ieSaisie < r.ieLeg-1e-9) w.push('⚠️ L\'indemnité d\'entretien saisie ('+fmtEUR(r.ieSaisie)+') est sous le minimum légal pour une journée de '+fmtNum(r.hj||9,2)+' h ('+fmtEUR(r.ieLeg)+') : le minimum est appliqué.');
  if(!r.ieAuto && r.jours && !r.hj && !r.ieSaisie) w.push('Durée des journées non indiquée : le minimum d\'entretien est calculé pour '+(R('ieHeuresRef', d)||9)+' h.');
  if(seg('mois-incomplet')===1 && !num('mois-deduction')) w.push('Indiquez le montant déduit (calcul « Mois incomplet », bouton « Reporter »).');
  if(!r.inc && r.cpTot) w.push('ℹ️ Année complète : complément de congés payés de '+fmtEUR(r.cpTot)+' brut (sur la période terminée le 31 mai, la règle des 10 % est plus favorable que le maintien de salaire). Il s’ajoute au salaire de ce mois, sans heures en plus ; sur Pajemploi, il est compris dans le salaire net.');
  const c = moisContrat();
  if(c && adaptationAFaire(c, r.m)) w.push(adaptationTxt(c, r.m));
  if(c && r.km){ const kw = kmTauxAlerte(paramsAt(c, d).kmTaux); if(kw) w.push('⚠️ '+kw.charAt(0).toUpperCase()+kw.slice(1)); }
  if(c && journalOf(c.id)[r.m]) w.push('ℹ️ Ce mois est déjà validé : valider à nouveau remplacera l\'enregistrement.');
  setHTML('mois-warn', warnHTML(w));
  setTxt('out-mois-brut', r.brut ? fmtEUR(r.brut)+(r.cpTot?' (dont congés '+fmtEUR(r.cpTot)+')':'') : '—');
  setTxt('out-mois-net-sal', r.brut ? fmtEUR(r.net) : '—');
  setTxt('out-mois-entretien', !r.ie ? '—' : fmtEUR(r.ie)+' ('+(r.ieAuto && r.ieAuto.min!==r.ieAuto.max
    ? r.jours+' j, de '+fmtEUR(r.ieAuto.min)+' à '+fmtEUR(r.ieAuto.max)+' selon la durée de la journée'
    : r.jours+' j × '+fmtEUR(r.ieAuto ? r.ieAuto.min : r.ieJour))+')');
  setTxt('out-mois-repas-r', r.repas ? fmtEUR(r.repas) : '—');
  setTxt('out-mois-km-r', r.km ? fmtEUR(r.km) : '—');
  const total = r.net+r.ie+r.repas+r.km;
  setTxt('out-mois-net', (r.brut||r.ie) ? fmtEUR(total) : '—');
  const aPas = r.pas > 0.004;
  show('row-mois-pas', aPas, 'flex'); show('row-mois-apres', aPas, 'flex');
  setTxt('lbl-mois-pas', 'Impôt sur le revenu retenu par Pajemploi ('+(val('mois-pas')!=='' ? 'montant du bulletin' : 'taux de '+fmtNum(pasTaux(),2)+' %, estimation')+')');
  setTxt('out-mois-pas', '−'+fmtEUR(r.pas)); setTxt('out-mois-apres', fmtEUR(total - r.pas));
  setTxt('mois-pas-hint', aPas ? 'Pajemploi prélève cet impôt sur le compte des parents : ils versent à l’assistante maternelle le salaire après impôt, plus les indemnités.' : 'Impôt sur le revenu : 0 € (non imposable, réglage par défaut). Si vous êtes imposée, indiquez votre taux dans Réglages ▸ Mon profil.');
  show('row-mois-reste', r.acompte>0, 'flex'); setTxt('out-mois-reste', fmtEUR(total - r.pas - r.acompte));
  setTxt('out-mois-netsocial', r.brut ? fmtEUR(r.net) : '—');
  setTxt('out-mois-netimp', r.brut ? fmtEUR(r.netImp) : '—');
  const D = r.brut ? cotisDetail(r.brutNormal - r.brutMajMensu + r.cpTot + num('mois-regul'), r.brutCompl + r.brutMaj + r.brutMajMensu, d) : null;
  setHTML('mois-cotis-detail', !D ? '' : '<table class="ab-table" style="min-width:0"><tr><th>Cotisation salariale</th><th>Taux</th><th>Montant</th></tr>'
    + D.map(x=>'<tr><td>'+esc(x.l)+'</td><td>'+fmtNum(x.taux*100,2)+' %'+(x.base<1?' × '+fmtNum(x.base*100,2)+' %':'')+'</td><td class="ab-out">'+fmtEUR(x.montant)+'</td></tr>').join('')
    + '<tr><td><b>Total</b></td><td>'+fmtNum((1-netRatio(d))*100,2)+' %</td><td class="ab-out"><b>'+fmtEUR(D.reduce((s,x)=>s+x.montant,0))+'</b></td></tr></table>'
    + '<p class="hint">Brut '+fmtEUR(r.brut)+' − cotisations = net '+fmtEUR(r.net)+'. Heures complémentaires et majorées : pas de cotisations retraite (réduction de '+fmtNum(hsReduction(d)*100,2)+' %), CSG, CRDS et prévoyance restent dues. Pajemploi calcule le montant définitif à partir du net déclaré.</p>');
  // Lignes Pajemploi, dans l'ordre du formulaire en ligne
  const L = [
    ['Période (mois déclaré)', fmtMonth(r.m)],
    ['Nombre d\'heures normales', r.hNormDecl ? r.hNormDecl+' h' : '—'],
    ['Nombre de jours d\'activité', r.jDecl ? r.jDecl+' j' : '—'],
    ['Heures complémentaires : nombre / montant net', r.hcompl ? fmtNum(r.hComplDecl,2)+' h / '+fmtEUR(r.brutCompl*Math.min(1,netRatio(d)+hsReduction(d))) : '0'],
    ['Heures majorées : nombre / montant net', (r.hmaj||r.hMajMensuDu) ? fmtNum(r.hMajDecl,2)+' h'+(r.hMajMensuDu?' (dont '+fmtNum(r.hMajMensuDu,2)+' h prévues au contrat)':'')+' / '+fmtEUR((r.brutMaj+r.brutMajMensu)*Math.min(1,netRatio(d)+hsReduction(d))) : '0'],
    ['Congés payés', r.inc ? (r.cpTot||r.jcp ? (r.jcp ? fmtNum(r.jcp,1)+' j · ' : '')+'dont '+fmtEUR(r.cpTot*netRatio(d))+' net, déjà compris dans le salaire net total et les heures' : 'rien ce mois-ci') : (r.cpTot ? 'rien dans cette case (année complète) : le complément de juin ('+fmtEUR(r.cpTot*netRatio(d))+' net) est compris dans le salaire net total' : 'ne rien remplir (année complète)')],
    ['Salaire net total', r.brut ? fmtEUR(r.net) : '—'],
    ['Indemnités d\'entretien', fmtEUR(r.ie)],
    ['Indemnités de repas', fmtEUR(r.repas)],
    ['Indemnités kilométriques', fmtEUR(r.km)],
    ['Acompte déjà versé', r.acompte ? fmtEUR(r.acompte) : '0'],
    ['Date de paiement', r.datepaie ? fmtDate(r.datepaie) : 'à indiquer'],
  ];
  if(r.pas > 0.004) L.push(['Impôt (prélèvement à la source)', 'calculé et prélevé par Pajemploi, rien à saisir (environ '+fmtEUR(r.pas)+')']);
  if(c && c.fin && c.fin.slice(0,7)===r.m) L.push(['Fin de contrat ce mois-ci', 'Oui, le '+fmtDate(c.fin)+' (indemnités : voir « Fin de contrat »)']);
  setHTML('pj-lines', L.map(x=>'<div class="result-line"><span class="lbl">'+x[0]+'</span><span class="val">'+esc(x[1])+'</span></div>').join(''));
  renderJournal();
};
function validerMois(){
  const c = moisContrat();
  if(!c){ toast('Choisissez un enfant enregistré pour garder ce mois dans son historique.'); return; }
  const r = moisCompute();
  if(!r.brut){ toast('Le salaire du mois est vide.'); return; }
  STATE.journal = STATE.journal || {};
  STATE.journal[c.id] = STATE.journal[c.id] || {};
  STATE.journal[c.id][r.m] = { brut:round2(r.brut), net:round2(r.net), netImp:round2(r.netImp), netHs:round2(r.netHs), ie:round2(r.ie), repas:round2(r.repas), km:round2(r.km),
    hDecl:r.hNormDecl, jDecl:r.jDecl, hCompl:r.hcompl, hMaj:r.hmaj + r.hMajMensuDu, hReel:round2(r.hReel), hContrat:round2(r.hContrat), brutMensu:round2(r.brutMensu), jours:r.jours, jCP:r.jcp, cpMontant:round2(r.cpTot), cp12:round2(r.cp12),
    ded:round2(r.ded), pas:round2(r.pas||0), j8:r.j8, hm8:round2(r.hm8), taux:r.taux, datepaie:r.datepaie, validatedAt:new Date().toISOString() };
  // le mois correspondant du suivi passe au statut « déclaré »
  const S = (STATE.suivi||{})[c.id];
  if(S && S.months){ const mr = S.months[r.m] = S.months[r.m] || {st:'ouvert'}; if(MONTH_ST.indexOf(mr.st) < MONTH_ST.indexOf('declare')){ mr.st='declare'; auditLog(c.id, fmtMonth(r.m)+' déclaré (mois validé)'); } }
  persistTheme('mois'); saveNow();
  CALC.mois();
  const nomMois = fmtMonth(r.m), deMois = (/^[aeiouéè]/i.test(nomMois) ? 'd’' : 'de ')+nomMois;
  toast('Mois '+deMois+' enregistré pour '+(c.enfant||'l\'enfant')+'.');
  // rappel : proposer la copie de sécurité (sauf si une copie a déjà été faite aujourd'hui, ou en démonstration)
  const deja = STATE.lastExport && iso(new Date(STATE.lastExport))===iso(today());
  if(!deja && !isDemo()) setTimeout(()=>showConfirmDialog('Faire une copie de sécurité ?',
    'Le mois '+deMois+' est enregistré sur ce téléphone uniquement. Une copie (Drive, mail…) vous permet de tout retrouver si le téléphone est perdu, cassé ou changé.'
    + (STATE.lastExport ? ' Dernière copie : '+new Date(STATE.lastExport).toLocaleDateString('fr-FR')+'.' : ' Aucune copie faite pour l’instant.'),
    ()=>syncExport(), 'Oui, faire la copie', 'Plus tard'), 600);
}
function supprimerMois(id, m){
  showConfirmDialog('Retirer ce mois ?', 'Le mois de '+fmtMonth(m)+' sera retiré de l\'historique (vous pourrez le valider à nouveau).', ()=>{
    delete STATE.journal[id][m]; saveNow(); CALC.mois();
  }, 'Oui, retirer', 'Annuler');
}
function renderJournal(){
  const c = moisContrat();
  if(!c){ setHTML('mois-journal', '<p class="hint">L\'historique est tenu pour chaque enfant enregistré (pas en saisie libre).</p>'); return; }
  const J = journalOf(c.id), ms = Object.keys(J).sort().reverse();
  if(!ms.length){ setHTML('mois-journal', '<p class="hint">Aucun mois validé pour '+esc(c.enfant)+'. Après chaque déclaration Pajemploi, touchez « Valider ce mois » : les cumuls ci-dessous se rempliront tout seuls.</p>'); return; }
  const t = journalTotals(c.id);
  const ref = cpRefStart(today());
  const tN = journalTotals(c.id, isoMonth(ref)), tN1 = journalTotals(c.id, isoMonth(new Date(ref.getFullYear()-1,5,1)), isoMonth(new Date(ref.getFullYear(),4,1)));
  let h = '<div class="ab-table-wrap"><table class="ab-table" style="min-width:560px"><thead><tr><th>Mois</th><th>Brut</th><th>Net</th><th>Entretien + repas + km</th><th>Heures déclarées</th><th>Heures réelles</th><th></th></tr></thead><tbody>';
  ms.forEach(m=>{ const r=J[m];
    h += '<tr><td>'+fmtMonth(m)+'</td><td class="ab-out">'+fmtEUR(r.brut)+'</td><td class="ab-out">'+fmtEUR(r.net)+'</td><td class="ab-out">'+fmtEUR((r.ie||0)+(r.repas||0)+(r.km||0))+'</td><td>'+(r.hDecl||0)+' h</td><td>'+fmtNum(r.hReel||0,2)+' h</td>'
      + '<td><button class="btn small" onclick="supprimerMois(\''+c.id+'\',\''+m+'\')" aria-label="Retirer">✕</button></td></tr>'; });
  h += '</tbody></table></div>';
  h += '<div class="box"><div class="section-label">Cumuls repris automatiquement ailleurs</div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts depuis le début ('+t.n+' mois validés) → indemnité de rupture</span><span class="val">'+fmtEUR(t.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts de la période terminée le 31 mai → congés payés (10 %)</span><span class="val">'+fmtEUR(tN1.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Salaires bruts de la période en cours (depuis le '+ref.toLocaleDateString('fr-FR')+')</span><span class="val">'+fmtEUR(tN.brut)+'</span></div>'
    + '<div class="result-line"><span class="lbl">Heures réellement effectuées depuis le début → régularisation</span><span class="val">'+fmtNum(t.hReel,2)+' h</span></div>'
    + '<div class="result-line"><span class="lbl">Net imposable + indemnités de l\'année '+today().getFullYear()+' → impôts</span><span class="val">'+fmtEUR((()=>{const y=journalTotals(c.id, today().getFullYear()+'-01', today().getFullYear()+'-12'); return y.netImp+y.ie+y.repas+y.km;})())+'</span></div>'
    + '<div class="net-hint">Les mois non validés ne sont pas comptés : validez chaque mois après la déclaration Pajemploi (ou corrigez avec les montants exacts du bulletin).</div></div>';
  setHTML('mois-journal', h);
}
function cpRefStart(d){ return new Date(d.getMonth()>=5 ? d.getFullYear() : d.getFullYear()-1, 5, 1); }

/* =====================================================================================
   03 · MOIS INCOMPLET (méthode Cour de cassation) & ABSENCES
   ===================================================================================== */
/* Motifs d'un mois incomplet.  ded : 'oui' = déduction (méthode Cour de cassation),
   'cond' = déduction sous conditions (aide au calcul), 'non' = aucune déduction (salaire dû). */
const MOTIFS = [
  {id:'debut', ded:'oui', t:'Arrivée ou départ de l\'enfant en cours de mois',
   info:'✅ Déduction. Premier ou dernier mois du contrat : on déduit les jours situés avant la date de début ou après la date de fin. Les jours fériés chômés compris dans le contrat restent payés. Dans le calendrier, gardez les heures de tout le mois et indiquez à déduire celles d\'avant le début / d\'après la fin.'},
  {id:'adapt', ded:'cond', t:'Premier mois avec période d\'adaptation',
   info:'✅ Déduction obligatoire avec cette méthode depuis la convention collective de 2022 (le paiement « au réel » n\'est plus admis). Le salaire mensualisé est dû dès le 1er jour ; on déduit les heures du planning normal qui n\'ont pas été faites pendant l\'adaptation (30 jours calendaires au plus, horaires prévus au contrat). Si le contrat prévoit le maintien du salaire pendant l\'adaptation, ne déduisez rien.'},
  {id:'maladie', ded:'oui', t:'Arrêt maladie, accident du travail, maternité ou paternité de l\'assmat',
   info:'✅ Déduction de toutes les heures prévues pendant l\'arrêt : le particulier employeur ne maintient pas le salaire (pas de subrogation). Vous êtes indemnisée par la CPAM (indemnités journalières ; 3 jours de carence en maladie) et par l\'IRCEM Prévoyance (complément). Envoyez l\'arrêt à la CPAM sous 48 h ; les parents déclarent l\'absence sur Pajemploi. Entretien et repas non dus.'},
  {id:'enfmal', ded:'cond', t:'Enfant accueilli malade, avec certificat médical',
   info:'✅ Déduction sous conditions : certificat médical (daté du 1er jour d\'absence, remis dans les 48 h), 5 jours au maximum (de suite ou non) par période de 12 mois comptée à partir de la date du contrat. Au-delà, le salaire est dû. Hospitalisation ou maladie d\'au moins 14 jours d\'affilée : pas de salaire pendant cette période (les parents peuvent aussi rompre le contrat).'},
  {id:'sanssolde', ded:'oui', t:'Congé sans solde, ou congés payés pas encore acquis',
   info:'✅ Déduction quand c\'est vous qui demandez l\'absence et que les parents l\'acceptent (de préférence par écrit), ou que vous partez en congés sans avoir assez de jours acquis (souvent la 1re année). ⚠️ Si ce sont les parents qui imposent une fermeture ou leurs propres vacances au-delà de vos congés acquis, le salaire reste en principe dû : choisissez alors « Absence de l\'enfant voulue par les parents ».'},
  {id:'enfassmat', ded:'cond', t:'Votre propre enfant malade',
   info:'✅ Déduction : congé non rémunéré pour enfant malade de moins de 16 ans, sur certificat médical, 3 jours par an (5 jours si l\'enfant a moins d\'un an ou si vous avez au moins 3 enfants de moins de 16 ans).'},
  {id:'evt', ded:'cond', t:'Événement familial (mariage, naissance, décès…)',
   info:'Ces jours sont payés normalement dans la limite prévue par la loi : on ne déduit que les jours pris en plus. Le congé de deuil d\'un enfant (8 jours supplémentaires) est indemnisé par la CPAM : ces jours-là se déduisent.'},
  {id:'autre', ded:'oui', t:'Autre absence non rémunérée de l\'assmat',
   info:'✅ Déduction : absence injustifiée, congé parental, congé de proche aidant ou de présence parentale, formation suivie sur le temps d\'accueil et indemnisée par un organisme, mise à pied… Gardez un écrit qui explique l\'absence.'},
  {id:'parents', ded:'non', t:'Absence de l\'enfant voulue par les parents, ou fermeture imposée par eux',
   info:'⛔ Pas de déduction : vacances des parents non prévues au contrat, convenance personnelle, garde par la famille, fermeture imposée au-delà de vos congés acquis… Le salaire mensualisé reste dû en entier. Seules les indemnités d\'entretien et de repas ne sont pas dues ces jours-là.'},
  {id:'enfmalsans', ded:'non', t:'Enfant malade sans certificat, ou au-delà des 5 jours',
   info:'⛔ Pas de déduction : sans certificat médical remis à temps, ou une fois les 5 jours de la période de 12 mois utilisés, le salaire est dû (sauf hospitalisation ou maladie d\'au moins 14 jours d\'affilée). Entretien et repas non dus les jours d\'absence.'},
  {id:'cp', ded:'non', t:'Vos congés payés (année complète)',
   info:'⛔ Pas de déduction : en année complète, vos congés payés sont déjà compris dans le salaire mensualisé. (Si vous n\'avez pas assez de jours acquis, choisissez « Congé sans solde ».)'},
  {id:'nonprog', ded:'non', t:'Semaine sans accueil prévue au contrat (année incomplète)',
   info:'⛔ Rien à déduire : les semaines non programmées sont déjà exclues du salaire mensualisé, et vos congés payés sont payés à part. Dans le calendrier d\'un mois incomplet pour une autre raison, laissez simplement ces jours vides.'},
  {id:'ferie', ded:'non', t:'Jour férié chômé',
   info:'⛔ Pas de déduction : un jour férié chômé qui tombe un jour d\'accueil prévu est payé (dès le début du contrat, si les jours d\'accueil prévus juste avant et juste après sont travaillés ou l\'absence autorisée ; le 1er mai est toujours chômé et payé).'},
  {id:'evtquota', ded:'non', t:'Événement familial dans la limite légale',
   info:'⛔ Pas de déduction : ces jours sont payés normalement (voir la liste dans « Événement familial »).'}
];
const EVT_LABELS = {mariage:'votre mariage ou PACS', mariageEnfant:'le mariage de votre enfant', naissance:'une naissance ou adoption', decesEnfant:'le décès de votre enfant',
  decesEnfantMoins25:'le décès de votre enfant de moins de 25 ans', decesConjoint:'le décès du conjoint', decesParentFratrie:'le décès d\'un proche (parent, beau-parent, frère, sœur)', handicapEnfant:'l\'annonce du handicap ou de la maladie de votre enfant'};
function ccassMotif(){ return MOTIFS.find(m=>m.id===val('ccass-motif-sel')) || MOTIFS[0]; }
function fillMotifSelect(){
  const s = $('ccass-motif-sel'); if(s.options.length) return;
  const grp = (lbl, ded)=>'<optgroup label="'+lbl+'">'+MOTIFS.filter(m=>ded.includes(m.ded)).map(m=>'<option value="'+m.id+'">'+esc(m.t)+'</option>').join('')+'</optgroup>';
  s.innerHTML = grp('✅ Absences qui se déduisent', ['oui','cond']) + grp('⛔ Absences qui ne se déduisent pas', ['non']);
}
VIS.ccass = ()=>{
  fillMotifSelect();
  if(!val('ccass-motif-sel')) setVal('ccass-motif-sel', 'debut');
  const sup = seg('ccass-hassup')===1, cal = seg('ccass-usecal')===0, mo = ccassMotif();
  ['ccass-base-sup-wrap','ccass-hsup-habituel-wrap','ccass-hpot-sup-wrap','ccass-hded-sup-wrap'].forEach(id=>show(id, sup));
  show('row-ccass-deduct-sup', sup, 'flex'); show('row-ccass-cal-hsup', sup, 'flex'); show('row-ccass-hsup-declar', sup, 'flex');
  show('ccass-cal-wrap', cal); show('ccass-manuel-wrap', !cal);
  show('ccass-ie-wrap', seg('ccass-entretien')===1); show('row-ccass-entretien', seg('ccass-entretien')===1, 'flex');
  show('ccass-maladie-wrap', mo.id==='enfmal'); show('ccass-evt-wrap', mo.id==='evt');
  show('ccass-ea-wrap', mo.id==='enfassmat'); show('ccass-adapt-wrap', mo.id==='adapt');
  show('ccass-report-row', mo.ded==='cond', 'flex');
  const box = $('ccass-motif-info');
  box.textContent = mo.info;
  box.className = mo.ded==='non' ? 'warn-box' : 'info-box';
  if(cal) buildCcassCalendar();
};
/* Aides au calcul des motifs « sous conditions » : renvoie {jours, heures, txt} déductibles */
function ccassHelper(){
  const mo = ccassMotif();
  const jp = num('ccass-jours-potentiels'), hp = num('ccass-hpot-normal');
  const hJour = jp ? hp/jp : 0;   // durée moyenne d'une journée prévue ce mois-ci
  const est = j => hJour ? ' Soit environ <b>'+fmtNum(j*hJour,2)+' h</b> (durée moyenne d\'une journée prévue ce mois-ci) : corrigez si les jours concernés ont une autre durée.' : '';
  if(mo.id==='enfmal'){
    const lim = R('absMaladieEnfant'), deja = num('ccass-mal-deja'), mois = num('ccass-mal-mois');
    if(seg('ccass-mal-longue')===1) return {jours:mois, heures:mois*hJour, txt:'Hospitalisation ou maladie d\'au moins '+R('absMaladieLongue')+' jours d\'affilée : les <b>'+mois+'</b> jour(s) de ce mois se déduisent.'+est(mois)};
    const ded = Math.max(0, Math.min(mois, lim-deja));
    return {jours:ded, heures:ded*hJour, txt:'Jours déductibles ce mois-ci : <b>'+ded+'</b> sur '+mois+'. Il restera '+Math.max(0,lim-deja-ded)+' jour(s) déductible(s) jusqu\'à la prochaine date anniversaire du contrat.'+(mois>ded?' Les '+(mois-ded)+' autre(s) jour(s) restent payés.':'')+est(ded)};
  }
  if(mo.id==='evt'){
    const q = R('evtFamiliaux')||{}, type = val('ccass-evt-type')||'mariage', quota = q[type]||0, pris = num('ccass-evt-jours');
    const ded = Math.max(0, pris-quota);
    return {jours:ded, heures:ded*hJour, txt:'Pour '+EVT_LABELS[type]+', <b>'+quota+' jour(s)</b> sont payés normalement. Jours à déduire : <b>'+ded+'</b> sur '+pris+'.'
      +(type==='decesEnfantMoins25'?' En plus, le congé de deuil ('+R('congeDeuil')+' jours, indemnisé par la CPAM) se déduit : ajoutez ces jours s\'ils sont pris ce mois-ci.':'')+est(ded)};
  }
  if(mo.id==='enfassmat'){
    const quota = (R('enfantMaladeAssmat')||[3,5])[seg('ccass-ea-plus')], deja = num('ccass-ea-deja'), mois = num('ccass-ea-mois');
    const reste = Math.max(0, quota-deja);
    return {jours:mois, heures:mois*hJour, txt:'Ces <b>'+mois+'</b> jour(s) ne sont pas rémunérés : ils se déduisent.'+(mois>reste?' ⚠️ Vous dépassez votre droit annuel ('+quota+' jours, il en restait '+reste+') : les jours en plus doivent être acceptés par les parents (congé sans solde).':' Il vous restera '+(reste-mois)+' jour(s) cette année.')+est(mois)};
  }
  if(mo.id==='adapt'){
    const faites = num('ccass-adapt-faites');
    if(!hp) return {jours:0, heures:0, txt:'Remplissez d\'abord le calendrier avec le planning normal du mois (bouton « Remplir avec le planning du contrat »).'};
    const h = Math.max(0, hp-faites);
    return {jours:null, heures:h, txt:'Heures prévues au planning ce mois-ci : '+fmtNum(hp,2)+' h ; faites : '+fmtNum(faites,2)+' h. Heures à déduire : <b>'+fmtNum(h,2)+' h</b>. Indiquez aussi les jours où l\'enfant n\'est pas venu du tout.'};
  }
  return null;
}
function ccassReport(){
  const r = ccassHelper(); if(!r) return;
  if(r.jours!==null) setVal('ccass-jours-non-travailles', r.jours);
  setVal('ccass-hded-normal', round2(r.heures));
  CALC.ccass(); persistTheme('ccass');
  toast('Reporté : vérifiez les heures, puis le résultat.');
}
PREFILL.ccass = c=>{
  setVal('ccass-cal-mois', curMonth());
  if(!c){ buildCcassCalendar(); return; }
  const dv = derive(c);
  setVal('ccass-base-normal', round2(dv.hNormMensu*dv.tauxEff));
  setSegVal('ccass-hassup', dv.hMajMensu>0 ? 1 : 0);
  if(dv.hMajMensu>0){ setVal('ccass-base-sup', round2(dv.hMajMensu*dv.tauxEff*(1+dv.majPct/100))); setVal('ccass-hsup-habituel', round2(dv.hMajMensu)); }
  setVal('ccass-jours-habituel', round2(dv.joursMensu));
  setVal('ccass-hnorm-habituel', round2(dv.hNormMensu));
  setSegVal('ccass-entretien', 1);
  setVal('ccass-ie-montant', ieContrat(paramsAt(c, today())) || '');   // montant du contrat ; le minimum légal est appliqué jour par jour
  const dm = malCountBefore(c, parseD(curMonth())); if(dm) setVal('ccass-mal-deja', dm);
  refreshVisibility('ccass');
  ccassPrefillCalendar(true);
};
function buildCcassCalendar(){
  const m = val('ccass-cal-mois') || curMonth();
  if($('ccass-send-mois')) setTxt('ccass-send-mois', fmtMonth(m));
  const base = parseD(m), y = base.getFullYear(), mo = base.getMonth(), nb = daysInMonth(y, mo);
  const hasSup = seg('ccass-hassup')===1;
  const prevN = {}, prevS = {};
  document.querySelectorAll('[id^="ccass-d-"]').forEach(i=>{ if(i.value!=='') prevN[i.id]=i.value; });
  document.querySelectorAll('[id^="ccass-ds-"]').forEach(i=>{ if(i.value!=='') prevS[i.id]=i.value; });
  const cont = $('ccass-calendar');
  if(cont.dataset.month !== m){ Object.keys(prevN).forEach(k=>delete prevN[k]); Object.keys(prevS).forEach(k=>delete prevS[k]); }
  let h = '<div class="cal-grid">';
  // cases vides pour aligner le 1er du mois sur son jour de semaine (affichage 7 colonnes)
  const lead = dowIdx(new Date(y,mo,1));
  for(let i=0;i<lead;i++) h += '<div class="cal-day off lead" style="visibility:hidden"></div>';
  for(let d=1; d<=nb; d++){
    const dt = new Date(y,mo,d), fn = ferieName(dt), dw = dowIdx(dt);
    h += '<div class="cal-day'+(dw===6?' off':'')+(fn?' ferie':'')+'"><div class="dname">'+DOW_SHORT[dw]+'</div><div class="dnum">'+d+'</div>'
      + (fn?'<div class="fname">'+esc(fn)+'</div>':'')
      + '<input type="number" inputmode="decimal" step="0.25" min="0" placeholder="h" id="ccass-d-'+d+'" value="'+esc(prevN['ccass-d-'+d]||'')+'">'
      + (hasSup?'<input type="number" inputmode="decimal" step="0.25" min="0" placeholder="maj" class="sup" id="ccass-ds-'+d+'" value="'+esc(prevS['ccass-ds-'+d]||'')+'">':'')
      + '</div>';
  }
  h += '</div>';
  cont.innerHTML = h; cont.dataset.month = m;
  // sur petit écran (4 colonnes) l'alignement n'a pas de sens : on masque les cases d'alignement
  if(window.matchMedia('(max-width:480px)').matches) cont.querySelectorAll('.lead').forEach(e=>e.remove());
  onCcassCalInput(true);
}
function ccassPrefillCalendar(silent){
  const k = selKey('ccass'), c = k!=='libre' ? getContrat(k) : null;
  if(!c){ if(!silent) toast('Choisissez d\'abord un enfant enregistré.'); return; }
  const m = val('ccass-cal-mois') || curMonth(); setVal('ccass-cal-mois', m);
  $('ccass-calendar').dataset.month = '';
  buildCcassCalendar();
  const d = parseD(m), seuil = R('seuilMaj', d);
  const days = plannedDays(c, d.getFullYear(), d.getMonth());
  const hasSup = seg('ccass-hassup')===1;
  // répartition des heures au-delà de 45 h sur les derniers jours de chaque semaine
  const byWeek = {};
  days.forEach(x=>{ const k=iso(mondayOf(x.d)); (byWeek[k]=byWeek[k]||[]).push(x); });
  Object.values(byWeek).forEach(list=>{
    const A=wNums(c.wA), B=c.alterne?wNums(c.wB):A;
    const tot = (weekIsB(c,list[0].d)?B:A).reduce((s,x)=>s+x,0);
    let exc = hasSup ? Math.max(0, tot-seuil) : 0;
    for(let i=list.length-1;i>=0;i--){ const take=Math.min(exc, list[i].h); list[i].sup=take; list[i].norm=list[i].h-take; exc-=take; }
  });
  days.forEach(x=>{ setVal('ccass-d-'+x.d.getDate(), round2(x.norm)); if(hasSup && x.sup) setVal('ccass-ds-'+x.d.getDate(), round2(x.sup)); });
  onCcassCalInput();
  if(!silent) toast(c.type===1
    ? 'Calendrier rempli d\'après le planning et les semaines sans accueil du contrat. Les jours fériés sont comptés comme prévus (ils sont payés).'
    : 'Calendrier rempli d\'après le planning. Les jours fériés sont comptés comme prévus (ils sont payés).');
}
function ccassClearCalendar(){ document.querySelectorAll('[id^="ccass-d-"],[id^="ccass-ds-"]').forEach(i=>i.value=''); onCcassCalInput(); }
function onCcassCalInput(noCalc){
  let hn=0, hs=0, j=0;
  document.querySelectorAll('#ccass-calendar .cal-day').forEach(cell=>{
    const a = cell.querySelector('[id^="ccass-d-"]'), b = cell.querySelector('[id^="ccass-ds-"]');
    const av = a ? parseFloat(a.value) : NaN, bv = b ? parseFloat(b.value) : NaN;
    if(av>0) hn+=av; if(bv>0) hs+=bv;
    if(av>0 || bv>0) j++;
  });
  setTxt('out-ccass-cal-jours', j ? j+' j' : '—');
  setTxt('out-ccass-cal-hnorm', hn ? fmtNum(hn,2)+' h' : '—');
  setTxt('out-ccass-cal-hsup', hs ? fmtNum(hs,2)+' h' : '—');
  if(seg('ccass-usecal')===0){
    setVal('ccass-jours-potentiels', j||''); setVal('ccass-hpot-normal', hn||''); setVal('ccass-hpot-sup', hs||'');
  }
  if(noCalc!==true) CALC.ccass();
}
CALC.ccass = ()=>{
  const sup = seg('ccass-hassup')===1;
  const bN = num('ccass-base-normal'), bS = sup ? num('ccass-base-sup') : 0;
  const hpN = num('ccass-hpot-normal'), hpS = sup ? num('ccass-hpot-sup') : 0;
  const mo = ccassMotif(), nonDed = mo.ded==='non';
  // motif non déductible : le salaire mensualisé reste dû en entier, quelles que soient les heures saisies
  const hdN = nonDed ? 0 : num('ccass-hded-normal'), hdS = (sup && !nonDed) ? num('ccass-hded-sup') : 0;
  const dN = hpN ? bN/hpN*hdN : 0, dS = hpS ? bS/hpS*hdS : 0;
  setHTML('ccass-verdict', nonDed
    ? '<div class="warn-box">⛔ <b>Aucune déduction</b> pour ce motif : le salaire mensualisé est dû en entier'+(num('ccass-jours-non-travailles')?' ; seuls l\'entretien et les repas ne sont pas dus les '+num('ccass-jours-non-travailles')+' jour(s) d\'absence':'')+'.</div>'
    : (num('ccass-hded-normal')||num('ccass-hded-sup')) ? '' : '<div class="info-box">Indiquez les heures non travaillées à déduire pour obtenir le salaire du mois.</div>');
  const sal = (bN-dN)+(bS-dS);
  setTxt('out-ccass-deduct-normal', fmtEUR(dN)); setTxt('out-ccass-deduct-sup', fmtEUR(dS));
  setTxt('out-ccass-salaire', (bN||bS) ? fmtEUR(sal) : '—');
  const jh=num('ccass-jours-habituel'), jp=num('ccass-jours-potentiels'), jnt=num('ccass-jours-non-travailles');
  const hnh=num('ccass-hnorm-habituel'), hsh=sup?num('ccass-hsup-habituel'):0;
  const up = x=>Math.ceil(x-1e-9);
  const jD = jp ? up(jh - jh/jp*(nonDed?0:jnt)) : NaN;
  const hnD = hpN ? Math.round(hnh - hnh/hpN*hdN) : NaN;
  const hsD = (sup && hpS) ? round2(hsh - hsh/hpS*hdS) : 0;
  setTxt('out-ccass-jours-declar', !isNaN(jD) ? Math.max(jD,0)+' j' : '—');
  setTxt('out-ccass-hnorm-declar', !isNaN(hnD) ? Math.max(hnD,0)+' h' : '—');
  setTxt('out-ccass-hsup-declar', fmtNum(Math.max(hsD,0),2)+' h');
  setTxt('out-ccass-h-total-declar', !isNaN(hnD) ? fmtNum(Math.max((hnD||0)+(hsD||0),0),2)+' h' : '—');
  const jAcc = Math.max(0, jp-jnt);
  const ie = seg('ccass-entretien')===1 ? ccassEntretien(jnt) : 0;
  setTxt('out-ccass-entretien', fmtEUR(ie));
  const m = val('ccass-cal-mois') || curMonth();
  setTxt('out-ccass-total', (bN||bS||ie) ? fmtEUR(sal+ie) : '—');
  setTxt('out-ccass-net', (bN||bS||ie) ? fmtEUR(toNet(sal, m)+ie) : '—');
  // Aides au calcul selon le motif
  const r = ccassHelper();
  if(r){ const id = {enfmal:'ccass-mal-result', evt:'ccass-evt-result', enfassmat:'ccass-ea-result', adapt:'ccass-adapt-result'}[mo.id]; setHTML(id, r.txt); }
};
/* « Salaire du mois » sans suivi : jours d'absence à cocher (entretien et repas exacts) */
function moisAbsSel(){ return new Set(String(val('mois-abs-dates')||'').split(',').filter(Boolean)); }
function moisAbsRender(){
  const c = moisContrat(), m = val('mois-mois'); if(!$('mois-abs-wrap')) return;
  if(!c || !m){ show('mois-abs-wrap', false); return; }
  const I = ieDuMois(c, m), sel = moisAbsSel();
  show('mois-abs-wrap', I.days.length > 0);
  setHTML('mois-abs-jours', I.days.map(x=>'<button type="button" class="chip'+(sel.has(x.k) ? ' on' : '')+'" aria-pressed="'+sel.has(x.k)+'" onclick="moisAbsToggle(\''+x.k+'\')">'+x.d.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric'})+'</button>').join(''));
}
function moisAbsToggle(k){
  const c = moisContrat(), m = val('mois-mois'); if(!c || !m) return;
  const sel = moisAbsSel(); if(sel.has(k)) sel.delete(k); else sel.add(k);
  setVal('mois-abs-dates', [...sel].sort().join(','));
  const I = ieDuMoisSauf(c, m, sel); setVal('mois-jours', I.jours); setVal('mois-hjour', round2(I.hAvg));
  CALC.mois(); persistTheme('mois');
}
function moisDedDepuisJours(){
  const c = moisContrat(), m = val('mois-mois'), sel = moisAbsSel();
  if(!c || !sel.size){ toast('Cochez d\u2019abord les jours d\u2019absence (« Entretien, repas, kilomètres et paiement »).'); const f = $('mois-fold-frais'); if(f){ f.open = true; f.scrollIntoView({block:'start'}); } return; }
  const I = ieDuMois(c, m), abs = I.days.filter(x=>sel.has(x.k)), hSel = abs.reduce((s,x)=>s+x.P,0)/60, hPrev = I.M.T.hPrev/60;
  setSegVal('mois-incomplet', 1); refreshVisibility('mois');
  setVal('mois-jded', abs.length); setVal('mois-hded', round2(hSel)); setVal('mois-deduction', hPrev ? round2(num('mois-base')*hSel/hPrev) : '');
  CALC.mois(); persistTheme('mois');
  toast(abs.length+' jour(s), '+fmtNum(hSel, 2)+' h retirés du salaire (méthode de la Cour de cassation).');
}
/* « Mois incomplet » : entretien jour par jour d'après le calendrier, sans les jours fériés chômés */
function ccassEntretien(jnt){
  const m = val('ccass-cal-mois') || curMonth(), d0 = parseD(m), y = d0.getFullYear(), mo = d0.getMonth(), nb = daysInMonth(y, mo);
  const k = selKey('ccass'), c = k!=='libre' ? getContrat(k) : null, mt = num('ccass-ie-montant'), sup = seg('ccass-hassup')===1;
  if(seg('ccass-usecal')===1){   // totaux saisis sans calendrier : durée moyenne
    const jp = num('ccass-jours-potentiels'), hMoy = num('ccass-jours-habituel') ? num('ccass-hnorm-habituel')/num('ccass-jours-habituel')/(52/12)*(52/12) : 0;
    return round2(Math.max(0, jp - jnt)*Math.max(mt, ieLegalJour(hMoy || R('ieHeuresRef', d0), d0)));
  }
  const deb = c ? parseD(c.debut) : null, fin = c ? parseD(c.fin) : null, L = []; let dehors = 0;
  for(let i=1; i<=nb; i++){
    const dt = new Date(y, mo, i), h = num('ccass-d-'+i) + (sup ? num('ccass-ds-'+i) : 0);
    // jour férié : pas d'entretien (chômé), sauf si le contrat prévoit des fériés travaillés (hors 1er mai)
    if(!(h > 0) || (ferieName(dt) && !(c && paramsAt(c, dt).feriesTr===1 && ferieName(dt)!=='1er mai'))) continue;
    if((deb && dt < deb) || (fin && dt > fin)){ dehors++; continue; }
    const p = c ? paramsAt(c, dt) : {};
    L.push(ieJourMontant({ieMode: mt ? (p.ieMode===2 ? 2 : 1) : 0, ieMontant: mt}, h, dt));
  }
  const retirer = Math.max(0, Math.round(jnt) - dehors);
  L.sort((a,b)=>b-a);
  return round2(L.slice(0, Math.max(0, L.length - retirer)).reduce((s,v)=>s+v,0));
}
/* Depuis « Salaire du mois » : ouvrir « Mois incomplet » sur le même enfant et le MÊME mois */
function moisOpenCcass(){
  const m = val('mois-mois') || curMonth(), key = selKey('mois');
  if(key) STATE.sel.ccass = key;
  showTheme('ccass');
  if(val('ccass-cal-mois') !== m){
    setVal('ccass-cal-mois', m);
    if(key && key!=='libre' && getContrat(key)) ccassPrefillCalendar(true); else buildCcassCalendar();
    CALC.ccass(); persistTheme('ccass');
  }
  toast('Calcul ouvert sur '+fmtMonth(m)+'.');
}
/* Chemin court : noter les absences sur les jours du mois (calendrier du suivi), sans report */
function moisNoterAbsences(){
  const m = val('mois-mois') || curMonth(), key = selKey('mois');
  if(!key || key==='libre' || !getContrat(key)){ toast('Choisissez d\'abord un enfant enregistré.'); return; }
  openSuivi('cal', key, m);
  toast('Touchez chaque jour d\'absence et choisissez ce qui s\'est passé.');
}
function ccassSendToMois(){
  const m = val('ccass-cal-mois'), key = selKey('ccass'), f = ((STATE.forms||{}).mois||{})[key], avant = f && (f.i||{})['mois-mois'];
  if(m && avant && avant !== m){
    showConfirmDialog('Sur quel mois reporter ?', 'Ce calcul porte sur '+fmtMonth(m)+', mais « Salaire du mois » était ouvert sur '+fmtMonth(avant)+'. Reporter la déduction sur '+fmtMonth(m)+' ? (Pour '+fmtMonth(avant)+', changez d\'abord le mois en haut de ce calcul.)', ccassSendToMoisGo, 'Oui, sur '+fmtMonth(m), 'Annuler');
    return;
  }
  ccassSendToMoisGo();
}
function ccassSendToMoisGo(){
  const sup = seg('ccass-hassup')===1;
  const sal = num('ccass-base-normal')+(sup?num('ccass-base-sup'):0);
  if(!sal){ toast('Faites d\'abord le calcul.'); return; }
  const nonDed = ccassMotif().ded==='non';
  const hpN=num('ccass-hpot-normal'), hpS=sup?num('ccass-hpot-sup'):0;
  const ded = nonDed ? 0 : (hpN ? num('ccass-base-normal')/hpN*num('ccass-hded-normal') : 0) + (hpS ? num('ccass-base-sup')/hpS*num('ccass-hded-sup') : 0);
  const v = { m: val('ccass-cal-mois'), jprev: num('ccass-jours-potentiels'), jnt: num('ccass-jours-non-travailles'),
    hded: num('ccass-hded-normal') + (sup ? num('ccass-hded-sup') : 0) };
  persistTheme('ccass');
  const key = selKey('ccass');
  STATE.sel.mois = key;
  STATE.forms.mois = STATE.forms.mois || {};
  let f = STATE.forms.mois[key];
  const cR = key!=='libre' ? getContrat(key) : null;
  // les cases enregistrées concernent un autre mois : on repart du contrat (et du suivi) du mois choisi
  if(cR && v.m && (!f || (f.i||{})['mois-mois'] !== v.m)){
    delete STATE.forms.mois[key];
    if(CURRENT!=='mois') showTheme('mois'); else loadThemeForm('mois');
    setVal('mois-mois', v.m); moisFillFromContract(cR, v.m);
    if(typeof hasSuiviMonth==='function' && !hasSuiviMonth(cR.id, v.m) && typeof suiviFillMois==='function') suiviFillMois(cR, v.m);
    f = formCollect('mois');
  } else if(!f){ showTheme('mois'); f = formCollect('mois'); }
  f.s['mois-incomplet'] = nonDed ? 0 : 1; f.i['mois-deduction'] = round2(ded);
  f.i['mois-ded-maj'] = (sup && !nonDed && hpS) ? round2(num('ccass-base-sup')/hpS*num('ccass-hded-sup')) : (nonDed ? '' : (hpS ? 0 : ''));
  if(v.m) f.i['mois-mois'] = v.m;
  f.i['mois-jprev'] = v.jprev || '';
  f.i['mois-jded'] = nonDed ? 0 : v.jnt;
  f.i['mois-hded'] = nonDed ? 0 : v.hded;
  // présence réelle (entretien, repas) : on retire les jours d'absence, même quand ils ne se déduisent pas du salaire
  const jp = v.jprev - v.jnt; if(jp>0) f.i['mois-jours'] = jp;
  STATE.forms.mois[key] = f; saveState();
  if(CURRENT==='mois') loadThemeForm('mois'); else showTheme('mois');
  toast('Déduction de '+fmtEUR(ded)+' reportée.');
}

/* =====================================================================================
   04 · CONGÉS PAYÉS (périodes N-2, N-1, N)
   ===================================================================================== */
const CP_P = [ {k:'n2', t:'Période d\u2019il y a deux ans (1er juin – 31 mai)'}, {k:'n1', t:'Période terminée le 31 mai dernier'}, {k:'n', t:'Période en cours (depuis le 1er juin)'} ];
function buildCpPeriods(){
  let h='';
  CP_P.forEach((p,i)=>{
    h += '<div class="cp-period"><div class="cp-period-title">'+p.t+'</div>'
      + '<div class="grid2"><div class="field"><label>Date de début</label><input type="date" id="cp-'+p.k+'-debut"></div>'
      + '<div class="field"><label>Date de fin'+(p.k==='n'?' (ou aujourd\'hui)':'')+'</label><input type="date" id="cp-'+p.k+'-fin"></div></div>'
      + '<div class="field"><label>Mois d\'arrêt maladie (non professionnelle) sur la période</label><input type="number" step="0.5" min="0" id="cp-'+p.k+'-mal" placeholder="0"><div class="hint">Ces mois donnent 2 jours au lieu de 2,5 (accident du travail : laissez 0).</div></div>'
      + (i>0 ? '<div class="result-line" id="row-cp-'+p.k+'-report" style="display:none"><span class="lbl">↳ jours restants reportés de la période d\u2019avant</span><span class="val" id="out-cp-'+p.k+'-report">—</span></div>' : '')
      + '<div class="result-line cp-sub"><span class="lbl">Jours acquis sur cette période</span><span class="val" id="out-cp-'+p.k+'-acquis">—</span></div>'
      + '<div class="field"><label>Jours de congés pris sur cette période</label><input type="number" step="0.5" min="0" id="cp-'+p.k+'-solde" placeholder="0"></div>'
      + '<div class="result-line cp-rel"><span class="lbl">Jours restants à la fin de la période</span><span class="val" id="out-cp-'+p.k+'-reliquat">—</span></div></div>';
  });
  $('cp-periods').innerHTML = h;
}
/* Semaines d'accueil d'un contrat entre deux dates (année incomplète) : semaines du planning avec des heures,
   hors semaines sans accueil, dans les dates du contrat, selon l'avenant en vigueur chaque semaine.
   Sans calendrier des semaines sans accueil : nombre de semaines du contrat au prorata de la durée. */
function semainesAccueil(c, s, e){
  const avecCalendrier = (c.hist||[]).some(h=>h.p && (h.p.semOff||[]).length) || (c.semOff||[]).length;
  if(!avecCalendrier){
    const mois = (e - s)/86400000/ (365.25/12);
    return (parseFloat(paramsAt(c, e).semaines)||0) * Math.min(12, mois) / 12;
  }
  let n = 0, W = 0;
  for(let w = mondayOf(s); w <= e; w = addDays(w, 7)){
    let h = 0, nbJ = 0;
    for(let i=0;i<7;i++){ const d = addDays(w, i); if(d < s || d > e || !inContract(c, d)) continue; nbJ++; h += plannedDay(c, d).min; }
    W += nbJ/7;   // semaine coupée par le début ou la fin de la période : comptée au prorata
    if(h > 0) n++;
  }
  // semaines sans accueil pas encore toutes connues : on ne compte jamais plus que la part prévue au contrat
  const cc = paramsAt(c, e);
  if(cc.semOffAVenir){ const prevues = (parseFloat(cc.semaines)||0) * W / 52; return Math.min(n, prevues); }
  return n;
}
function joursAcquisCP(d1, d2, moisMal, enCours, c){
  const s=parseD(d1), e=parseD(d2);
  if(!s||!e||e<=s) return 0;
  let total;
  if(c && paramsAt(c, e).type===1){
    // année incomplète : 2,5 jours ouvrables par période de 4 semaines d'accueil (art. L3141-4 du Code du travail)
    total = semainesAccueil(c, s, e)/4;
  } else {
    const months = monthsBetween(s,e);
    const anchor = addMonths(s, months);
    const lenInc = Math.round((addMonths(anchor,1)-anchor)/86400000) || 30;
    const daysInc = Math.max(0, Math.round((e-anchor)/86400000)+1);
    const frac = Math.min(1, daysInc/lenInc);
    total = months + frac;
  }
  const mal = Math.min(total, Math.max(0, moisMal||0));
  const parMois = R('cpParMois', e), parMal = R('cpMaladie', e)||0;
  const jMal = Math.min(mal*parMal, R('cpMaladieMax', e)||24);
  const brut = (total-mal)*parMois + jMal;
  // l'arrondi au jour supérieur se fait sur la période close ; en cours de période on montre la valeur exacte
  return Math.min(enCours ? Math.floor(brut*100)/100 : Math.ceil(brut - 1e-9), R('cpMax', e));
}
VIS.cp = ()=>{
  show('cp-valeur-wrap', seg('cp-valeur')===1);
  show('cp-valeur-results', seg('cp-valeur')===1);
};
/* Périodes de référence des congés (1er juin – 31 mai) vues au jour « ref » (aujourd'hui par défaut ;
   pour une fin de contrat, la date de fin, même si elle est à venir) */
function cpRefPeriods(c, ref){
  const t = ref || today();
  const startN = new Date(t.getMonth()>=5 ? t.getFullYear() : t.getFullYear()-1, 5, 1);
  const deb = c ? parseD(c.debut) : null, fin = c ? parseD(c.fin) : null;
  const P = [
    {k:'n2', s:new Date(startN.getFullYear()-2,5,1), e:new Date(startN.getFullYear()-1,4,31)},
    {k:'n1', s:new Date(startN.getFullYear()-1,5,1), e:new Date(startN.getFullYear(),4,31)},
    {k:'n',  s:startN, e:t}
  ];
  return P.map(p=>{
    let s=p.s, e=p.e;
    if(deb && deb>s) s=deb;
    if(fin && fin<e) e=fin;
    return {k:p.k, s: e>=s ? s : null, e: e>=s ? e : null};
  });
}
function cpAutoDates(){
  const k = selKey('cp'), c = k!=='libre' ? getContrat(k) : null;
  cpRefPeriods(c).forEach(p=>{ setVal('cp-'+p.k+'-debut', p.s?iso(p.s):''); setVal('cp-'+p.k+'-fin', p.e?iso(p.e):''); });
  CALC.cp(); persistTheme('cp');
  toast(c ? 'Dates calculées d\'après le contrat (périodes du 1er juin au 31 mai).' : 'Dates des périodes de référence remplies (1er juin – 31 mai).');
}
PREFILL.cp = c=>{
  cpRefPeriods(c).forEach(p=>{ setVal('cp-'+p.k+'-debut', p.s?iso(p.s):''); setVal('cp-'+p.k+'-fin', p.e?iso(p.e):''); });
  if(!c) return;
  const dv = derive(c);
  setSegVal('cp-type', c.type); setVal('cp-taux', round2(dv.tauxEff)); setVal('cp-heures', round2(dv.moyH));
  // jours de congés déjà notés : suivi au jour le jour, sinon mois validés (+ reprise d'un contrat en cours)
  const S = (STATE.suivi||{})[c.id], rp = c.rep||{};
  cpRefPeriods(c).forEach(p=>{
    if(!p.s) return;
    const a = iso(p.s), b = iso(p.e);
    const sCP = cpPrisSuivi(c, p.s, p.e);
    let pris = Math.max(sCP, journalTotals(c.id, a.slice(0,7), b.slice(0,7)).jCP);
    if(p.k==='n') pris += parseFloat(rp.cpPrisN)||0;
    if(pris) setVal('cp-'+p.k+'-solde', pris);
  });
};
CALC.cp = ()=>{
  const A = {}, S = {};
  CP_P.forEach(p=>{
    const kF = selKey('cp'), cF = kF!=='libre' ? getContrat(kF) : null;
    const fin = parseD(val('cp-'+p.k+'-fin')), enCours = p.k==='n' && fin && !(fin.getMonth()===4 && fin.getDate()===31) && !(cF && cF.fin && iso(fin)===cF.fin);
    const kC = selKey('cp'), cC = kC!=='libre' && seg('cp-type')===1 ? getContrat(kC) : null;
    A[p.k]=joursAcquisCP(val('cp-'+p.k+'-debut'), val('cp-'+p.k+'-fin'), num('cp-'+p.k+'-mal'), enCours, cC); S[p.k]=num('cp-'+p.k+'-solde');
  });
  const take=(pools, n)=>{ for(const k of Object.keys(pools)){ const u=Math.min(pools[k], n); pools[k]-=u; n-=u; } return pools; };
  let pools = take({n2:A.n2}, S.n2);
  setTxt('out-cp-n2-acquis', fmtNum(A.n2,2)+' j'); setTxt('out-cp-n2-reliquat', fmtNum(pools.n2,2)+' j');
  show('row-cp-n1-report', pools.n2>0, 'flex'); setTxt('out-cp-n1-report', fmtNum(pools.n2,2)+' j');
  pools = take({n2:pools.n2, n1:A.n1}, S.n1);
  setTxt('out-cp-n1-acquis', fmtNum(A.n1,2)+' j'); setTxt('out-cp-n1-reliquat', fmtNum(pools.n2+pools.n1,2)+' j');
  show('row-cp-n-report', pools.n2+pools.n1>0, 'flex'); setTxt('out-cp-n-report', fmtNum(pools.n2+pools.n1,2)+' j');
  pools = take({n2:pools.n2, n1:pools.n1, n:A.n}, S.n);
  const dispo = pools.n2+pools.n1+pools.n;
  setTxt('out-cp-n-acquis', fmtNum(A.n,2)+' j'); setTxt('out-cp-n-reliquat', fmtNum(dispo,2)+' j');
  setTxt('out-cp-acquis', fmtNum(A.n2+A.n1,2)+' j'); setTxt('out-cp-encours', fmtNum(A.n,2)+' j');
  setTxt('out-cp-pris', fmtNum(S.n2+S.n1+S.n,2)+' j'); setTxt('out-cp-total', fmtNum(dispo,2)+' j');
  let rep='';
  if(pools.n2>0||pools.n1>0){
    if(pools.n2>0) rep+='<div class="result-line"><span class="lbl">↳ dont jours restants d\u2019il y a deux ans (à prendre en premier)</span><span class="val">'+fmtNum(pools.n2,2)+' j</span></div>';
    if(pools.n1>0) rep+='<div class="result-line"><span class="lbl">↳ dont jours restants de la période terminée le 31 mai</span><span class="val">'+fmtNum(pools.n1,2)+' j</span></div>';
    rep+='<div class="result-line"><span class="lbl">↳ dont période en cours</span><span class="val">'+fmtNum(pools.n,2)+' j</span></div>';
  }
  setHTML('cp-repart', rep);
  // Suggestion du total des salaires d'après le contrat
  const k = selKey('cp'), c = k!=='libre' ? getContrat(k) : null;
  if(c && val('cp-n1-debut') && val('cp-n1-fin')){
    const s=parseD(val('cp-n1-debut')), e=parseD(val('cp-n1-fin'));
    const mo = monthsBetween(s, addDays(e,1)) || 0;
    // assiette du 10ᵉ : tout le brut de la période, y compris les congés payés versés (art. L3141-24),
    // sauf les 12ᵉ versés d'avance chaque mois (ils paient déjà ces congés). Mois validés tels qu'enregistrés,
    // autres mois calculés comme dans l'onglet Mois (suivi ou planning).
    const jt = contratCumuls(c, isoMonth(s), isoMonth(e));
    const est = jt.n ? jt.brut - jt.cp12 : derive(c, e).brutBase*mo;
    const src = 'Salaires de la période terminée le 31 mai'+(jt.n ? ' ('+(jt.n-jt.estimes)+' mois validés'+(jt.estimes ? ', '+jt.estimes+' calculés d\u2019après le planning ou le suivi' : '')+')' : ' (estimation d\u2019après le contrat)');
    setHTML('cp-total-suggest', est ? src+' : <a href="#" onclick="setVal(\'cp-total-salaires\','+round2(est)+');CALC.cp();persistTheme(\'cp\');return false;">'+fmtEUR(est)+'</a> (touchez pour l\'utiliser).' : '');
  } else setHTML('cp-total-suggest','');
  if(seg('cp-valeur')!==1) return;
  const taux=num('cp-taux'), h=num('cp-heures'), tot=num('cp-total-salaires');
  const vj = (h/6)*taux;                          // valeur d'un jour ouvrable (6 jours ouvrables par semaine)
  // les deux méthodes portent sur les MÊMES jours : ceux acquis pendant la période de référence (N-1) dont le salaire est saisi
  const maintien = A.n1*vj, dixieme = tot*(R('cpDixieme')||0.10);
  const verser = Math.max(maintien, dixieme);
  setTxt('out-cp-maintien', fmtEUR(maintien)); setTxt('out-cp-dixieme', fmtEUR(dixieme));
  setTxt('out-cp-verser', fmtEUR(verser)); setTxt('out-cp-net', fmtEUR(toNet(verser)));
  setTxt('cp-badge', maintien>=dixieme ? 'Maintien' : 'Dixième');
  // Paiement selon le type de contrat (sur la période N-1, celle des congés acquis)
  const mN1 = A.n1*vj, iN1 = Math.max(mN1, dixieme);
  let p = '<div class="section-label">Comment payer les congés acquis sur la période N-1 ?</div>';
  if(seg('cp-type')===0){
    const comp = Math.max(0, dixieme - mN1);
    p += '<div class="result-line"><span class="lbl">Année complète : les congés pris sont déjà payés par le salaire mensualisé. Complément à verser en juin si les 10 % sont plus favorables (ajouté tout seul au salaire de juin)</span><span class="val">'+fmtEUR(comp)+'</span></div>';
  } else {
    p += '<div class="result-line"><span class="lbl">Indemnité de congés payés de la période (la plus favorable)</span><span class="val">'+fmtEUR(iN1)+'</span></div>'
      +  '<div class="result-line"><span class="lbl">• Paiement en une fois en juin</span><span class="val">'+fmtEUR(iN1)+'</span></div>'
      +  '<div class="result-line"><span class="lbl">• Un peu chaque mois : '+fmtNum((R('cpDixieme')||0.10)*100, 0)+' % du salaire brut de chaque mois, versés avec lui (déjà compris dans l\u2019onglet Mois). Sur la période, cela fait</span><span class="val">'+fmtEUR(dixieme)+'</span></div>'
      +  '<div class="result-line'+(mN1 > dixieme ? ' warn' : '')+'"><span class="lbl">&nbsp;&nbsp;↳ Vérification de juin : complément à verser si le maintien de salaire est plus favorable</span><span class="val">'+fmtEUR(Math.max(0, mN1 - dixieme))+'</span></div>'
      +  '<div class="result-line"><span class="lbl">• Paiement à la prise des congés, par jour pris</span><span class="val">'+(A.n1?fmtEUR(iN1/A.n1)+' / jour':'—')+'</span></div>'
      +  '<div class="net-hint">Année incomplète : l\'indemnité de congés s\'ajoute au salaire mensualisé, selon le mode prévu au contrat. Payés un peu chaque mois : les 10 % sont ajoutés au salaire de chaque mois ; en juin, si le maintien de salaire donne plus, la différence est versée en plus.</div>';
  }
  setHTML('cp-paiement', p);
};

/* =====================================================================================
   05 · INDEMNITÉS D'ENTRETIEN
   ===================================================================================== */
VIS.ie = ()=>{ show('ie-contrat-wrap', seg('ie-mode')===1); show('ie-compare-results', seg('ie-mode')===1); };
function ieContratChoisi(){ const k = selKey('ie'); return k!=='libre' ? getContrat(k) : null; }
function ieFillFromContract(c, m){
  const I = ieDuMois(c, m);
  setVal('ie-jours-accueil', I.jours || '');
  setVal('ie-heures', I.jours ? round2(I.hAvg) : round2(derive(c, parseD(m)).hDayAvg));
  setSegVal('ie-employeur', 0);
  if(I.fixe){ setSegVal('ie-mode',1); setVal('ie-montant-contrat', I.fixe); } else setVal('ie-montant-contrat', '');
}
PREFILL.ie = c=>{
  setVal('ie-mois', curMonth());
  if(!c) return;
  ieFillFromContract(c, curMonth());
};
CALC.ie = ()=>{
  const m = val('ie-mois') || curMonth();
  const pm = seg('ie-employeur')===1;
  const mg = R('mg', m), h = num('ie-heures'), j = num('ie-jours-accueil');
  const mc = seg('ie-mode')===1 ? num('ie-montant-contrat') : 0;   // montant du contrat tel qu'écrit
  const leg = ieLegalJour(h||R('ieHeuresRef',m), m, pm);
  // jour par jour (planning ou suivi) tant que les cases reprises du contrat ne sont pas modifiées
  const c = ieContratChoisi();
  let I = null;
  if(c && j && !pm){ const x = ieDuMois(c, m); if(x.jours===j && Math.abs(round2(x.hAvg)-h)<0.005 && (seg('ie-mode')===0 || Math.abs(x.fixe-mc)<0.005)) I = x; }
  setTxt('out-ie-mg', fmtEUR(mg)+' (depuis le '+fmtDate(Rdu('mg',m))+')');
  setTxt('out-ie-9h', fmtEUR(ieLegalJour(R('ieHeuresRef',m), m, pm)));
  setTxt('out-ie-taux', fmtEUR(leg)+' / jour'+(h?' ('+fmtNum(h,2)+' h'+(I?' en moyenne':'')+')':' (9 h)'));
  setTxt('out-ie-jours', j ? j+' j'+(I ? (I.suivi ? ' (suivi des journées)' : ' (planning du contrat)') : '') : '—');
  const minMois = I ? I.totalLegal : (j ? round2(leg*j) : 0);
  setTxt('out-ie-mois-min', j ? fmtEUR(minMois)+(I ? ' (calculé jour par jour)' : '') : '—');
  setTxt('ie-methode', I ? 'Calcul jour par jour d\'après '+(I.suivi ? 'les journées notées dans le suivi' : 'le planning du contrat (fériés chômés et semaines sans accueil exclus)')+' : même résultat que l\'onglet Mois et que « Salaire du mois ».'
    : (c ? 'Cases modifiées à la main : calcul sur la durée moyenne indiquée.' : 'Indiquez les jours de présence et leur durée moyenne. Pour un calcul exact jour par jour, choisissez l\'enfant ci-dessus.'));
  if(seg('ie-mode')===1){
    // montant prévu chaque jour : fixe, ou « pour 9 h » au prorata en dessous (mode du contrat choisi)
    const modeC = c ? (paramsAt(c, parseD(m)).ieMode===2 ? 2 : 1) : 1, prevu = h2=>ieContratJour({ieMode:modeC, ieMontant:mc}, h2, m);
    const verser = I ? (I.fixe===mc ? I.total : round2(I.days.reduce((s,x)=>s+Math.max(prevu(x.R/60), ieLegalJour(x.R/60, x.d)),0))) : (j ? round2(Math.max(h ? prevu(h) : mc, leg)*j) : 0);
    const releves = I ? I.days.filter(x=>ieLegalJour(x.R/60, x.d) > prevu(x.R/60)+1e-9).length : (leg > (h ? prevu(h) : mc)+1e-9 ? j : 0);
    const totPrevu = I ? round2(I.days.reduce((s,x)=>s+prevu(x.R/60),0)) : round2((h ? prevu(h) : mc)*j);
    setTxt('out-ie-contrat', !(mc&&j) ? '—' : modeC===2 ? fmtEUR(totPrevu)+' ('+fmtEUR(mc)+' pour 9 h, au prorata en dessous)' : fmtEUR(mc)+' × '+j+' j = '+fmtEUR(totPrevu));
    setTxt('out-ie-verser', mc&&j ? fmtEUR(verser)+(releves ? ' (minimum légal appliqué '+releves+' j)' : '') : '—');
    const b=$('ie-badge'), row=$('row-ie-conformite');
    row.classList.remove('warn');
    if(!I && !h && mc){ setTxt('out-ie-verser', j ? fmtEUR(round2(mc*j))+' (durée non indiquée)' : '—'); b.textContent='À vérifier'; b.className='badge warn';
      setTxt('out-ie-ecart', 'Conforme seulement pour des journées de '+fmtH(Math.floor(ieSeuilHeures(mc, m)*60))+' au plus : indiquez la durée moyenne'); }
    else if(mc && !releves){ b.textContent='Conforme'; b.className='badge ok'; setTxt('out-ie-ecart', I && I.max>0 ? 'Au-dessus du minimum chaque jour' : 'Marge : '+fmtEUR(mc-leg)+'/jour'); }
    else { b.textContent='Insuffisant'; b.className='badge warn'; row.classList.add('warn');
      setTxt('out-ie-ecart', mc ? (modeC===2 ? 'Montant pour 9 h sous le minimum légal ('+fmtEUR(ieLegalJour(R('ieHeuresRef',m)||9, m))+')' : 'Sous le minimum pour les journées de plus de '+fmtH(Math.floor(ieSeuilHeures(mc, m)*60)))+' : '+fmtEUR(round2(verser-totPrevu))+' à ajouter ce mois-ci' : '—'); }
  }
};

/* =====================================================================================
   06 · FIN DE CONTRAT
   ===================================================================================== */
function buildFinAvenants(){
  let h='';
  for(let i=1;i<=4;i++){
    h += '<div id="fin-regul-av'+i+'-block" class="box" style="display:none;background:var(--bg)"><div class="section-label">Avenant n°'+i+'</div>'
      + '<div class="field"><label>Date d\'effet de l\'avenant n°'+i+'</label><input type="date" id="fin-regul-av'+i+'-date"></div>'
      + '<div class="field"><label>Total des salaires mensualisés versés depuis cet avenant (€)</label><input type="number" step="0.01" id="fin-regul-av'+i+'-verse" placeholder="ex. 3200"></div>'
      + '<div class="grid2"><div class="field"><label>Heures réellement effectuées depuis cet avenant</label><input type="number" step="0.25" id="fin-regul-av'+i+'-heures" placeholder="ex. 520"></div>'
      + '<div class="field"><label>Nouveau salaire horaire (€)</label><input type="number" step="0.01" id="fin-regul-av'+i+'-taux" placeholder="ex. 4.60"></div></div></div>';
  }
  $('fin-regul-avs').innerHTML = h;
}
function finRegulApplicable(){ return seg('fin-type')===1 || seg('fin-regul-q1')===1 || seg('fin-regul-q2')===1; }
function finPreavis(){
  const qui = seg('fin-qui'), faute = qui===0 && seg('fin-faute')===1;
  const deb = parseD(val('fin-debut')), notif = parseD(val('fin-notif'));
  const res = {qui, faute, deb, notif, mois:null, jours:0, moisP:0, fin:null, motifSans:''};
  if(qui===2){ res.motifSans='Suspension, modification ou retrait d\'agrément : le contrat est rompu sans préavis ni indemnité de rupture (les congés non pris restent dus).'; return res; }
  if(qui===4){ res.motifSans='Renonciation avant le début de l\'accueil (engagement réciproque signé) : la partie qui renonce verse à l\'autre une indemnité forfaitaire égale à un demi-mois du salaire brut prévu. Elle n\'est pas due en cas de décès de l\'enfant, ou de retrait, suspension ou non-renouvellement de l\'agrément (sur justificatif).'; return res; }
  if(qui===3){ res.motifSans='Rupture pendant la période d\'essai : pas de préavis ni d\'indemnité de rupture (prévenir l\'autre partie le plus tôt possible).'; return res; }
  // décès du parent employeur ou de l'enfant : fin au jour du décès, préavis payé (il ne peut pas être fait)
  if(qui===5 || qui===6){ res.deces = true; }
  if(faute){ res.motifSans='Faute grave ou lourde : pas de préavis ni d\'indemnité de rupture. Les parents doivent pouvoir la prouver et la motiver par écrit ; en cas de contestation, c\'est le conseil de prud\'hommes qui tranche. Les congés non pris restent dus.'; return res; }
  if(!deb||!notif) return res;
  res.mois = monthsBetween(deb, notif);
  const p = R('preavis', notif) || [{jours:8},{jours:15},{mois:1}];
  const t = res.mois < 3 ? p[0] : res.mois < 12 ? p[1] : p[2];
  if(t.mois){ res.moisP=t.mois; res.fin = addDays(addMonths(notif, t.mois), -1); }
  else { res.jours=t.jours; res.fin = addDays(notif, t.jours-1); }
  return res;
}
VIS.fin = ()=>{
  const inc = seg('fin-type')===1;
  show('fin-type-row', selKey('fin')==='libre', 'flex');   // enfant enregistré : le type vient de la fiche
  show('fin-faute-row', seg('fin-qui')===0, 'flex');
  const quiV = seg('fin-qui'), deces = quiV===5 || quiV===6, avant = quiV===4;
  // avant le début de l'accueil : seul le salaire mensuel prévu sert (demi-mois) ; le reste est sans objet
  ['fin-entretien-row','fin-cp-row','fin-regul-row','fin-rupture-row'].forEach(id=>show(id, !avant, 'flex'));
  if(avant){ show('fin-entretien-wrap', false); show('fin-cp-wrap', false); show('fin-regul-wrap', false); show('fin-rupture-wrap', false); }
  setTxt('fin-salaire-label', avant ? 'Salaire mensuel brut prévu au contrat (€)' : 'Salaire du dernier mois, hors indemnités d\'entretien (€)');
  if(avant) setTxt('fin-salaire-hint', 'Sert à calculer l\'indemnité forfaitaire : la moitié de ce montant.');
  show('fin-retraite-wrap', quiV===7);
  setTxt('fin-notif-label', deces ? 'Date du décès' : quiV===7 ? 'Date de remise de votre lettre de départ (ou de sa première présentation par La Poste)' : 'Date de remise de la lettre en main propre (ou de sa première présentation par La Poste)');
  setTxt('fin-notif-hint', deces ? 'Le contrat s\'arrête ce jour-là. Un proche (ayant droit) doit vous prévenir par écrit ; les documents de fin de contrat sont à remettre sous 30 jours.' : 'Pas la date d\'envoi : le préavis commence le jour où la lettre est remise ou présentée pour la première fois (voir l\'avis de réception). L\'ancienneté se compte à cette date.');
  const pr = finPreavis();
  show('fin-preavis-row', seg('fin-qui')===0 && !pr.motifSans && (pr.jours||pr.moisP), 'flex');
  show('fin-entretien-wrap', seg('fin-entretien')===1); show('row-fin-entretien', seg('fin-entretien')===1, 'flex');
  show('fin-cp-wrap', seg('fin-cp')===1); show('fin-cp-results', seg('fin-cp')===1);
  show('fin-rupture-wrap', seg('fin-rupture')===1); show('fin-rupture-results', seg('fin-rupture')===1);
  // Régularisation : textes selon le type de contrat
  setTxt('fin-regul-question', inc ? 'Calculer la régularisation de fin de contrat (obligatoire en année incomplète) ?' : 'Une régularisation est-elle nécessaire à titre exceptionnel ?');
  setTxt('fin-regul-hint', inc ? 'Compare le salaire mensualisé versé aux heures réellement effectuées ; indispensable s\'il y a eu un avenant.' : 'En année complète, pas de régularisation de principe : la mensualisation couvre exactement les heures dues. Seulement en cas de rythmes variables ou d\'avenant appliqué en retard.');
  const regul = seg('fin-regul')===1;
  show('fin-regul-wrap', regul);
  const warn = $('fin-regul-warn');
  if(!inc){ warn.style.display='block'; warn.innerHTML='<strong>Rappel —</strong> en année complète, aucune régularisation n\'est due de plein droit. Répondez aux deux questions pour vérifier si votre situation est un cas particulier.'; }
  else { warn.style.display='none'; }
  show('fin-regul-qualify', regul && !inc);
  const ok = regul && finRegulApplicable();
  show('fin-regul-notapplicable', regul && !ok);
  setHTML('fin-regul-notapplicable', '<strong>Régularisation non nécessaire —</strong> d\'après vos réponses, la mensualisation couvre déjà exactement les heures dues.');
  show('fin-regul-details', ok); show('fin-regul-results', ok);
  const av = seg('fin-regul-avenants')===1, nb = av ? seg('fin-regul-nbav')+1 : 0;
  show('fin-regul-nbav-wrap', av, 'flex');
  for(let i=1;i<=4;i++) show('fin-regul-av'+i+'-block', i<=nb);
  setTxt('fin-regul-base-label', av ? 'Avant le 1er avenant' : 'Sur toute la période');
  setTxt('fin-regul-verse-label', av ? 'Total des salaires mensualisés versés avant le 1er avenant (€)' : 'Total des salaires mensualisés versés sur la période (€)');
  setTxt('fin-regul-heures-label', av ? 'Heures réellement effectuées avant le 1er avenant' : 'Total des heures réellement effectuées sur la période');
  if(seg('fin-qui')===4){ ['fin-entretien-wrap','fin-cp-wrap','fin-cp-results','fin-regul-wrap','fin-regul-results','fin-rupture-wrap','fin-rupture-results','row-fin-entretien'].forEach(id=>show(id, false)); }
};
/* Fin de contrat : date de fin = celle de la fiche, sinon la fin du préavis (ou la date de la lettre si pas de préavis) */
let FIN_AUTO = null;
function finDateFin(c){ if(c && parseD(c.fin)) return parseD(c.fin); const pr = finPreavis(); return pr.fin || pr.notif || today(); }
function finAutoKey(){ return [val('fin-debut'), val('fin-notif'), seg('fin-qui'), seg('fin-faute'), seg('fin-preavis-fait')].join('|'); }
/* Préavis non effectué (dispense des parents ou décès) : jours notés comme absence prévue (salaire dû, ni entretien ni repas) */
function finNoterPreavis(){
  const k = selKey('fin'), c = k!=='libre' ? getContrat(k) : null, pr = finPreavis(); if(!c || !pr.notif || !pr.fin) return;
  const du = iso(pr.deces ? addDays(pr.notif, 1) : pr.notif), au = iso(pr.fin);
  STATE.settings.absEnf = (STATE.settings.absEnf||[]).filter(p=>!(p.cid===c.id && p.du===du && p.au===au)).concat([{cid:c.id, du, au}]).sort((a,b)=>a.du<b.du?-1:1);
  auditLog(c.id, 'Préavis non effectué : absence prévue du '+fmtDate(du)+' au '+fmtDate(au)); saveState();
  toast('Noté : salaire dû jusqu’au '+fmtDate(au)+', sans entretien ni repas à partir du '+fmtDate(du)+'.');
}
/* Dernier mois : salaire au prorata des heures prévues jusqu'à la date de fin (Cour de cassation), entretien jour par jour */
function finDernierMois(c){
  const fin = finDateFin(c), cv = Object.assign({}, c, {fin: iso(fin)}), m = isoMonth(fin);
  const Mfin = suiviMonth(cv, m, {sansCP:true}), ieFin0 = ieDuMois(cv, m);
  // préavis non effectué : le salaire reste dû jusqu'à la fin du préavis (indemnité compensatrice), pas l'entretien
  const prD = finPreavis(), nonFait = ((prD.qui===0 && seg('fin-preavis-fait')===1) || prD.deces) && !prD.motifSans && prD.notif && prD.fin;
  const arret = nonFait ? (prD.deces ? prD.notif : addDays(prD.notif, -1)) : null;
  const ieFin = !arret ? ieFin0 : (arret < parseD(m) ? {total:0} : ieDuMois(Object.assign({}, c, {fin: iso(arret)}), m));
  setVal('fin-salaire', round2(Mfin.brut || 0));
  setSegVal('fin-entretien', ieFin.total ? 1 : 0); setVal('fin-entretien-montant', ieFin.total || '');
  FIN_AUTO = {cid: c.id, key: finAutoKey(), sal: val('fin-salaire'), ie: val('fin-entretien-montant'), fin: iso(fin)};
  setHTML('fin-salaire-hint', 'Calculé jusqu\u2019au <b>'+fin.toLocaleDateString('fr-FR')+'</b> '+(parseD(c.fin) ? '(date de fin de la fiche)' : '(fin du préavis)')+' : salaire au prorata des heures prévues (Cour de cassation), entretien jour par jour.'
    + (parseD(c.fin) ? '' : ' <a href="#" onclick="finEnregistrerDate();return false;">Enregistrer cette date de fin dans la fiche</a>')
    + (nonFait ? ' Préavis non effectué : le salaire reste dû jusqu’au '+prD.fin.toLocaleDateString('fr-FR')+' (indemnité compensatrice, déjà comprise ici et dans les mois précédents), mais pas l’entretien ni les repas après le '+arret.toLocaleDateString('fr-FR')+'. <a href="#" onclick="finNoterPreavis();return false;">Noter ces jours comme absence prévue</a> (pour que l’onglet Mois soit juste).' : ''));
}
function finEnregistrerDate(){
  const k = selKey('fin'), c = k!=='libre' ? getContrat(k) : null; if(!c || !FIN_AUTO) return;
  showConfirmDialog('Date de fin du contrat', 'Enregistrer le '+fmtDate(FIN_AUTO.fin)+' comme dernier jour du contrat de '+(c.enfant||'cet enfant')+' ? Les mois suivants ne seront plus comptés.', ()=>{ c.fin = FIN_AUTO.fin; saveState(); finPrefillDates(c); CALC.fin(); toast('Date de fin enregistrée.'); }, 'Enregistrer', 'Annuler');
}
/* Lettre ou motif modifiés : le dernier mois suit la nouvelle date de fin, tant qu'il n'a pas été corrigé à la main */
const FIN_AUTO_CHAMPS = ['fin-salaire','fin-entretien-montant','fin-jours','fin-total-salaires','fin-regul-debut','fin-regul-fin','fin-regul-verse','fin-regul-heures','fin-rupture-total'];
function finAutoSnap(c){ if(FIN_AUTO && FIN_AUTO.cid===c.id) FIN_AUTO.snap = FIN_AUTO_CHAMPS.map(val).join('|'); }
function finAutoRefresh(){
  const k = selKey('fin'), c = k!=='libre' ? getContrat(k) : null;
  if(!c || !FIN_AUTO || FIN_AUTO.cid!==c.id || finAutoKey()===FIN_AUTO.key) return;
  const snap = FIN_AUTO.snap!==undefined ? FIN_AUTO.snap : [FIN_AUTO.sal, FIN_AUTO.ie].join('|');
  const now = FIN_AUTO.snap!==undefined ? FIN_AUTO_CHAMPS.map(val).join('|') : [val('fin-salaire'), val('fin-entretien-montant')].join('|');
  if(now!==snap){ FIN_AUTO.key = finAutoKey(); toast('Date ou motif changé : les montants corrigés à la main ne sont pas recalculés (« ↺ Revenir aux valeurs du contrat » pour tout recalculer).'); return; }
  finPrefillDates(c);
}
PREFILL.fin = c=>{
  setVal('fin-notif', iso(today()));
  if(!c) return;
  const dv = derive(c);
  setSegVal('fin-type', c.type);
  setVal('fin-debut', c.debut);
  // contrat pas encore commencé : renonciation avant le début de l'accueil
  if(parseD(c.debut) && parseD(c.debut) > today()) setSegVal('fin-qui', 4);
  setVal('fin-taux', round2(dv.tauxEff)); setVal('fin-heures', round2(dv.moyH));
  finPrefillDates(c);
};
/* Tout ce qui dépend de la date de fin : dernier mois, congés restants, régularisation, indemnité de rupture.
   Recalculé à chaque changement de la lettre ou du motif, tant que ces montants n'ont pas été corrigés à la main. */
function finPrefillDates(c0){
  const fin = finDateFin(c0), c = parseD(c0.fin) ? c0 : Object.assign({}, c0, {fin: iso(fin)});
  const dv = derive(c0);
  setVal('fin-regul-fin', iso(fin));
  finDernierMois(c0);
  setVal('fin-regul-taux', round2(dv.tauxEff));
  const d12 = addMonths(fin, -12), deb = parseD(c.debut);
  setVal('fin-regul-debut', c.debut);   // toute la durée du contrat (chaque avenant est calculé à part)
  if(!c.fin) setVal('fin-regul-fin', iso(fin));
  setSegVal('fin-regul', c.type===1 ? 1 : 0);
  // entretien du dernier mois : calculé dans finDernierMois (jour par jour, jusqu'à la date de fin)
  // Cumuls : mois validés tels qu'enregistrés ; mois non validés calculés comme dans l'onglet Mois (suivi ou planning)
  const rp = c.rep || {};
  const J = contratCumuls(c);
  if(J.n || rp.cumulBrut){
    // 1/80ᵉ de TOUTES les rémunérations brutes du contrat, congés payés compris (hors entretien, repas, km)
    setVal('fin-rupture-total', round2(J.brut + (parseFloat(rp.cumulBrut)||0)));
    if(rp.regulVerse && parseD(rp.date)) setVal('fin-regul-debut', c.debut);
    const Rg = contratCumuls(c, val('fin-regul-debut').slice(0,7), val('fin-regul-fin').slice(0,7));
    if(Rg.n || rp.regulVerse){ setVal('fin-regul-verse', round2(Rg.brutMensu + (parseFloat(rp.regulVerse)||0))); setVal('fin-regul-heures', round2(Rg.hContrat + (parseFloat(rp.regulHeures)||0))); }
    setVal('fin-total-salaires', round2(finBaseDixieme(c)));
    if(J.estimes) setTimeout(()=>toast(J.estimes+' mois non validés : montants calculés d\u2019après le suivi ou le planning. Vérifiez-les avec vos relevés Pajemploi.'), 300);
  }
  // Année incomplète : avant la régularisation, vérifier que les semaines sans accueil sont toutes notées
  setHTML('fin-regul-semaines', '');
  if(c.type===1 && val('fin-regul-debut') && val('fin-regul-fin')){
    const s0 = parseD(val('fin-regul-debut')), e0 = parseD(val('fin-regul-fin'));
    let n = 0, W = 0;
    for(let w = mondayOf(s0); w <= e0; w = addDays(w, 7)){ let h = 0, nbJ = 0; for(let i=0;i<7;i++){ const d = addDays(w,i); if(d < s0 || d > e0 || !inContract(c, d)) continue; nbJ++; h += plannedDay(c, d).min; } W += nbJ/7; if(h>0) n++; }
    const prevues = (parseFloat(c.semaines)||0) * W / 52, hR = num('fin-regul-heures');
    const suiviPeriode = (()=>{ const S=(STATE.suivi||{})[c.id]; return !!(S && Object.keys(S.days||{}).some(k=>k>=iso(s0) && k<=iso(e0))); })();
    if(n > prevues + 0.5 && hR){
      const est = round2(hR * prevues / n);
      setHTML('fin-regul-semaines', '<div class="warn-box">Le planning compte <b>'+n+' semaines d\u2019accueil</b> sur la période, pour environ <b>'+fmtNum(prevues,1)+'</b> prévues au contrat ('+c.semaines+' par an). '
        + (suiviPeriode ? 'Vérifiez les journées du suivi.' : 'Si des semaines sans accueil n\u2019ont pas été notées, la régularisation serait trop élevée : notez-les (<a href="#" onclick="noterSemaineOff(\''+c.id+'\');return false;">📅 semaine sans accueil</a>) puis rouvrez ce calcul, ou <a href="#" onclick="setVal(\'fin-regul-heures\','+est+');CALC.fin();persistTheme(\'fin\');return false;">utilisez l\u2019estimation : '+fmtNum(est,2)+' h</a>.')
        + ' Si l\u2019enfant est vraiment venu '+n+' semaines, la régularisation est due.</div>');
    }
  }
  // Avenants enregistrés pendant la période de régularisation : une sous-période par avenant
  const rd = val('fin-regul-debut'), rf = val('fin-regul-fin');
  const avs = (c.hist||[]).map(h=>h.avenantDu).filter(x=>x && x>rd && x<=rf).sort().slice(0,4);
  if(avs.length){
    setSegVal('fin-regul-avenants', 1); setSegVal('fin-regul-nbav', avs.length-1);
    const bornes = [rd].concat(avs), mois = x=>x.slice(0,7);
    // un mois coupé par un avenant est compté entièrement dans la période où il commence
    const debM = x=>{ const d=parseD(x); return d.getDate()===1 ? isoMonth(d) : isoMonth(new Date(d.getFullYear(), d.getMonth()+1, 1)); };
    bornes.forEach((deb, i)=>{
      const fin = i<avs.length ? isoMonth(new Date(parseD(debM(avs[i])).getFullYear(), parseD(debM(avs[i])).getMonth()-1, 1)) : mois(rf);
      const T = journalTotals(c.id, i===0 ? mois(deb) : debM(deb), fin), taux = round2(derive(c, parseD(deb)).tauxEff);
      if(i===0){ setVal('fin-regul-verse', round2(T.brutMensu)); setVal('fin-regul-heures', round2(T.hContrat)); setVal('fin-regul-taux', taux); }
      else { setVal('fin-regul-av'+i+'-date', deb); setVal('fin-regul-av'+i+'-verse', round2(T.brutMensu)); setVal('fin-regul-av'+i+'-heures', round2(T.hContrat)); setVal('fin-regul-av'+i+'-taux', taux); }
    });
  }
  const cpd = cpDispoFor(c);
  if(cpd !== null){ setSegVal('fin-cp', cpd>0 ? 1 : 0); setVal('fin-jours', round2(cpd)); }
  const cpDet = cpDispoFor(c, true), sansForm = !(STATE.forms.cp && STATE.forms.cp[c.id]);
  setHTML('fin-jours-hint', sansForm && cpDet && !cpDet.prisConnu && c.type!==1
    ? '⚠️ Aucun congé pris n\u2019est noté depuis le 1er juin : les jours acquis jusqu\u2019au 31 mai sont comptés comme restants. Si vous avez pris des congés, notez-les dans <a href="#" onclick="showTheme(\'reglages\');setTimeout(()=>{const e=$(\'conges-wrap\');if(e)e.scrollIntoView();},80);return false;">Réglages ▸ Mes congés payés</a> ou corrigez ce nombre.'
    : 'Calculé d\u2019après vos congés notés (suivi, « Mes congés » ou mois validés). Détail dans le thème « Congés payés ».');
  // Année incomplète payée par 12ᵉ : les congés sont déjà payés chaque mois
  if(c.type===1 && c.cpMode===0){ setSegVal('fin-cp', 0); }
  finAutoRupture();
  finAutoSnap(c0);
}
/* Jours de congés restants d'un contrat : calcul « Congés payés » enregistré s'il existe,
   sinon périodes du contrat et jours de congés notés dans les mois validés */
function cpDispoFor(c, detail){
  const f = STATE.forms.cp && STATE.forms.cp[c.id];
  if(!f){
    // Sans calcul « Congés payés » enregistré : seule la période en cours est reprise (les périodes
    // précédentes sont normalement prises ou payées) ; les reliquats éventuels sont à vérifier.
    const ref = parseD(c.fin) || today();
    const PP = cpRefPeriods(Object.assign({}, c, {fin: iso(ref)}), ref);
    const Pn = PP.find(x=>x.k==='n'), P1 = PP.find(x=>x.k==='n1');
    if(!Pn || !Pn.s) return detail ? {rest:0, parts:[]} : 0;
    const rp = c.rep || {}, avecReliquat = rp.cpReliquat!==undefined && rp.cpReliquat!=='';
    const acquis = joursAcquisCP(iso(Pn.s), iso(Pn.e), 0, false, c);
    // les jours acquis jusqu'au 31 mai se prennent pendant la période en cours : ils restent dus s'ils ne sont pas pris
    // (année complète, ou année incomplète payée à la prise des congés ; payés en juin ou par 12ᵉ sinon).
    // La période d'il y a deux ans est réputée prise. Contrat repris avec un reliquat saisi : ce reliquat les remplace.
    // les congés pris depuis le 1er juin consomment d'abord les jours acquis jusqu'au 31 mai, même déjà payés en juin
    const aN1 = !avecReliquat && P1 && P1.s, avecN1 = aN1 && (c.type!==1 || c.cpMode===2);
    const acquis1 = aN1 ? joursAcquisCP(iso(P1.s), iso(P1.e), 0, false, c) : 0;
    // congés pris depuis le 1er juin : suivi au jour le jour ou « Mes congés », sinon mois validés (+ reprise)
    const sCP = cpPrisSuivi(c, Pn.s, Pn.e);
    const pris = Math.max(sCP, journalTotals(c.id, isoMonth(Pn.s), isoMonth(Pn.e)).jCP) + (parseFloat(rp.cpPrisN)||0);
    const rest1 = avecN1 ? Math.max(0, acquis1 - pris) : 0, restN = Math.max(0, acquis - Math.max(0, pris - acquis1));
    const tot = rest1 + restN + (avecReliquat ? parseFloat(rp.cpReliquat)||0 : 0);
    const parts = [{k:'n', s:Pn.s, e:Pn.e, acq:acquis, rest:restN}];
    if(avecN1) parts.unshift({k:'n1', s:P1.s, e:P1.e, acq:acquis1, rest:rest1});
    return detail ? {rest: tot, parts, prisConnu: pris>0} : tot;
  }
  const refF = parseD(c.fin) || today();
  const P = cpRefPeriods(Object.assign({}, c, {fin: iso(refF)}), refF);
  const order = ['n2','n1','n'], pools = {}, acqs = {}, bornes = {};
  order.forEach(k=>{
    const p = P.find(x=>x.k===k);
    const deb = f ? (f.i['cp-'+k+'-debut']||'') : (p.s ? iso(p.s) : ''), end = f ? (f.i['cp-'+k+'-fin']||'') : (p.e ? iso(p.e) : '');
    pools[k] = joursAcquisCP(deb, end, f ? parseFloat(f.i['cp-'+k+'-mal'])||0 : 0, false, c);
    acqs[k] = pools[k]; bornes[k] = {s: parseD(deb), e: parseD(end)};
    let pris = f ? parseFloat(f.i['cp-'+k+'-solde'])||0 : (deb && end ? journalTotals(c.id, deb.slice(0,7), end.slice(0,7)).jCP : 0);
    for(const kk of order){ if(pools[kk]===undefined) continue; const u = Math.min(pools[kk], pris); pools[kk] -= u; pris -= u; }
  });
  const rest = Object.values(pools).reduce((a,b)=>a+b, 0);
  if(isNaN(rest)) return null;
  return detail ? {rest, parts: order.filter(k=>bornes[k].s && bornes[k].e).map(k=>({k, s:bornes[k].s, e:bornes[k].e, acq:acqs[k], rest:pools[k]}))} : rest;
}
/* Méthode du dixième en fin de contrat : 10 % des salaires qui ont donné droit aux jours restants.
   Pour chaque période (1er juin – 31 mai), salaires de la période × jours restants ÷ jours acquis. */
function finBaseDixieme(c){
  const D = cpDispoFor(c, true); if(!D || !D.parts) return 0;
  let base = 0;
  D.parts.forEach(p=>{
    if(!(p.rest>0) || !(p.acq>0)) return;
    const T = contratCumuls(c, isoMonth(p.s), isoMonth(p.e));
    base += Math.max(0, T.brut - T.cp12) * Math.min(1, p.rest/p.acq);
  });
  return base;
}
/* Jours de congés pris d'après le suivi au jour le jour ou « Mes congés » (jours ouvrables : une semaine = 6 jours) */
function cpPrisSuivi(c, s, e){
  if(!s || !e) return 0;
  const S = (STATE.suivi||{})[c.id], aSuivi = S && Object.keys(S.days||{}).length, aConges = ((STATE.settings||{}).conges||[]).length;
  if(!aSuivi && !aConges) return 0;
  const deb = parseD(c.debut), fin = parseD(c.fin);
  let d = new Date(s.getFullYear(), s.getMonth(), 1), n = 0;
  const lim = e < today() ? e : today();
  while(d <= lim){
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
    if(!(deb && deb > last) && !(fin && fin < d)) n += suiviMonth(c, isoMonth(d), {sansCP:true}).T.cpOuv || 0;
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }
  return n;
}
function finAutoRupture(){
  const pr = finPreavis();
  const min = R('ruptureAnciennete');
  // retrait de l'enfant ou décès du parent employeur : à partir de 9 mois ; décès de l'enfant : sans condition d'ancienneté
  const due = (pr.qui===0 && !pr.faute && pr.mois!==null && pr.mois >= min) || (pr.qui===5 && pr.mois!==null && pr.mois >= min) || pr.qui===6;
  if(pr.mois!==null || pr.qui!==0) setSegVal('fin-rupture', due ? 1 : 0);
  if(pr.qui===5 || pr.qui===6){
    setTxt('fin-rupture-hint', pr.qui===6 ? '✔ Due en cas de décès de l\'enfant, quelle que soit l\'ancienneté (calculée comme pour un retrait).' : (due ? '✔ Due (décès du parent employeur, ancienneté d\'au moins '+min+' mois) : payée par la succession.' : '✘ Pas due : ancienneté inférieure à '+min+' mois.'));
    return;
  }
  setTxt('fin-rupture-hint', pr.qui!==0 || pr.faute
    ? 'Pas d\'indemnité de rupture dans cette situation (seulement quand les parents retirent l\'enfant, hors faute grave).'
    : pr.mois===null ? 'Due par les parents qui retirent l\'enfant après au moins '+min+' mois de contrat, sauf faute grave ou lourde.'
    : (due ? '✔ Due : '+ancienneteTxt(val('fin-debut'), val('fin-notif'))+' d\'ancienneté (minimum '+min+' mois).' : '✘ Pas due : ancienneté de '+ancienneteTxt(val('fin-debut'), val('fin-notif'))+' (il faut au moins '+min+' mois).'));
}
function finEstimeTotal(){
  const k = selKey('fin'), c = k!=='libre' ? getContrat(k) : null;
  if(!c || !c.debut){ toast('Choisissez un enfant enregistré avec une date de début.'); return; }
  // même calcul que l'onglet Mois (mois validés, sinon suivi ou planning, entrée et sortie en cours de mois au prorata
  // des heures prévues) jusqu'à la fin du contrat, préavis compris
  const end = parseD(c.fin) || parseD(val('fin-regul-fin')) || today();
  const tot = contratCumuls(Object.assign({}, c, {fin: iso(end)})).brut + (parseFloat((c.rep||{}).cumulBrut)||0);
  setVal('fin-rupture-total', round2(tot)); CALC.fin(); persistTheme('fin');
  toast('Estimation : '+fmtEUR(tot)+'. Vérifiez avec le cumul Pajemploi (absences, heures en plus, augmentations…).');
}
function toBrutFin(x){ return seg('fin-unite')===1 ? x/netRatio() : x; }
CALC.fin = ()=>{
  if(document.activeElement && ['fin-debut','fin-notif'].includes(document.activeElement.id)) finAutoRupture();
  finAutoRefresh();
  const pr = finPreavis();
  // Préavis
  let piTxt;
  if(pr.motifSans) piTxt = pr.motifSans;
  else if(!pr.deb || !pr.notif) piTxt = 'Indiquez la date de début du contrat et la date de la lettre pour connaître le préavis.';
  else {
    const dur = pr.moisP ? pr.moisP+' mois' : pr.jours+' jours calendaires';
    piTxt = 'Ancienneté : <b>'+ancienneteTxt(val('fin-debut'), val('fin-notif'))+'</b>. Préavis : <b>'+dur+'</b>'+(pr.fin?', jusqu\'au <b>'+pr.fin.toLocaleDateString('fr-FR')+'</b> inclus':'')+'.'
      + (pr.qui===1 || pr.qui===7 ? ' C\'est vous qui devez ce préavis à la famille.' : '')
      + (pr.deces ? ' Il ne peut pas être effectué : il est payé (indemnité compensatrice). Les sommes sont dues par '+(pr.qui===5?'la succession (le notaire rembourse la personne qui les avance)':'les parents')+'.' : '');
  }
  // date de la lettre avant le début de l'accueil, ou pendant la période d'essai : motif à revoir
  const kF = selKey('fin'), cF = kF!=='libre' ? getContrat(kF) : null, feF = cF ? finEssai(cF) : null, debF = cF ? parseD(cF.debut) : null;
  const choisir = (q, l)=>' <a href="#" onclick="setSegVal(\'fin-qui\','+q+');refreshVisibility(\'fin\');CALC.fin();return false;">Choisir « '+l+' »</a>';
  let alerteF = '';
  if(cF && pr.notif && (pr.qui===0 || pr.qui===1)){
    if(debF && pr.notif < debF) alerteF = '⚠️ La lettre est datée d’avant le premier jour d’accueil ('+fmtDate(cF.debut)+') : c’est une renonciation à l’engagement, pas une fin de contrat avec préavis.'+choisir(4, 'Avant le début de l’accueil');
    else if(feF && pr.notif <= feF) alerteF = '⚠️ Le '+pr.notif.toLocaleDateString('fr-FR')+', la période d’essai n’est pas terminée (jusqu’au '+feF.toLocaleDateString('fr-FR')+' au plus tard) : pas de préavis ni d’indemnité de rupture.'+choisir(3, 'Fin pendant l’essai');
  }
  if(cF && pr.notif && pr.qui===3 && feF && pr.notif > feF) alerteF = '⚠️ La période d’essai s’est terminée le '+feF.toLocaleDateString('fr-FR')+' (au plus tard) : à cette date, le préavis s’applique. Choisissez qui met fin au contrat.';
  if(alerteF) piTxt = '<div class="warn-box" style="margin:0 0 6px">'+alerteF+'</div>'+piTxt;
  setHTML('fin-preavis-info', piTxt);
  const salaire = toBrutFin(num('fin-salaire'));
  setTxt('out-fin-salaire', salaire ? fmtEUR(salaire) : '—');
  let ipr = 0;
  const dispense = ((pr.qui===0 && seg('fin-preavis-fait')===1) || pr.deces) && !pr.motifSans && (pr.jours||pr.moisP);
  // préavis non effectué : le salaire reste dû jusqu'à la fin du préavis ; il est déjà compté (mois après mois, puis le dernier mois), rien à ajouter
  show('row-fin-preavis', !!dispense, 'flex'); setTxt('out-fin-preavis', dispense && pr.fin ? 'compris dans les salaires jusqu’au '+pr.fin.toLocaleDateString('fr-FR') : fmtEUR(ipr));
  // départ à la retraite : estimation de l'indemnité IRCEM (non payée par les parents, donc hors total)
  if(pr.qui===7){
    const tot = num('fin-ret-mois'), rec = num('fin-ret-recents'), sal = num('fin-ret-salaire'), b = R('retraiteBareme') || [1,1.5,2,2.5];
    const k = tot>=360 ? b[3] : tot>=240 ? b[2] : tot>=180 ? b[1] : tot>=120 ? b[0] : 0;
    const ok = k && rec>=60;
    show('row-fin-retraite', true, 'flex');
    setTxt('out-fin-retraite', !tot ? '—' : ok ? fmtEUR(k*sal)+' ('+k+' mois)' : tot<120 ? 'pas de droit (moins de 120 mois)' : 'pas de droit (moins de 60 mois sur 7 ans)');
  } else show('row-fin-retraite', false);
  // engagement réciproque rompu avant le premier jour : ½ mois du salaire brut prévu (non soumis à cotisations)
  const engag = pr.qui===4 ? salaire/2 : 0;
  show('row-fin-engag', pr.qui===4, 'flex'); setTxt('out-fin-engag', fmtEUR(engag));
  const ent = seg('fin-entretien')===1 ? num('fin-entretien-montant') : 0;
  setTxt('out-fin-entretien-r', fmtEUR(ent));
  let cpV = 0;
  if(seg('fin-cp')===1){
    const vj = (num('fin-heures')/6)*toBrutFin(num('fin-taux'));
    const mt = num('fin-jours')*vj, dx = toBrutFin(num('fin-total-salaires'))*(R('cpDixieme', val('fin-notif')||undefined)||0.10);
    cpV = Math.max(mt, dx);
    setTxt('out-fin-maintien', fmtEUR(mt)); setTxt('out-fin-dixieme', fmtEUR(dx)); setTxt('out-fin-cp', fmtEUR(cpV));
    setTxt('fin-badge', mt>=dx ? 'Maintien' : 'Dixième');
  }
  let ecart = 0;
  if(seg('fin-regul')===1 && finRegulApplicable()){
    const pd=val('fin-regul-debut'), pf=val('fin-regul-fin');
    setTxt('out-fin-periode', pd&&pf ? fmtDate(pd)+' → '+fmtDate(pf) : '—');
    const av = seg('fin-regul-avenants')===1, nb = av ? seg('fin-regul-nbav')+1 : 0;
    const vB=toBrutFin(num('fin-regul-verse')), hB=num('fin-regul-heures'), tB=toBrutFin(num('fin-regul-taux'));
    let du=hB*tB, verse=vB; const rows=[{l:'Avant le 1er avenant', du:hB*tB, v:vB}];
    for(let i=1;i<=nb;i++){
      const v=toBrutFin(num('fin-regul-av'+i+'-verse')), h=num('fin-regul-av'+i+'-heures'), t=toBrutFin(num('fin-regul-av'+i+'-taux')), d=val('fin-regul-av'+i+'-date');
      du+=h*t; verse+=v; rows.push({l:'Avenant n°'+i+(d?' (depuis le '+fmtDate(d)+')':''), du:h*t, v});
    }
    ecart = du - verse;
    setHTML('fin-regul-detail', av ? rows.map(r=>{ const e=r.du-r.v; return '<div class="result-line'+(e<0?' warn':'')+'"><span class="lbl">'+r.l+' : dû '+fmtEUR(r.du)+' / versé '+fmtEUR(r.v)+'<span class="badge '+(e>=0?'ok':'warn')+'">'+(e>=0?'Rappel dû':'Trop-perçu')+'</span></span><span class="val">'+fmtEUR(Math.abs(e))+'</span></div>'; }).join('') : '');
    setTxt('out-fin-regul-du', fmtEUR(du)); setTxt('out-fin-regul-verse-r', fmtEUR(verse)); setTxt('out-fin-regul-ecart', fmtEUR(Math.abs(ecart)));
    const b=$('fin-regul-badge'), row=$('row-fin-regul-ecart'); row.classList.remove('warn');
    if(ecart>=0){ b.textContent='Rappel dû'; b.className='badge ok'; }
    else { b.textContent='Trop-perçu'; b.className='badge warn'; row.classList.add('warn'); }
  }
  // un trop-perçu n'est pas déduit d'office du solde de tout compte
  const ecartRetenu = Math.max(0, ecart);
  let rup = 0;
  if(seg('fin-rupture')===1){ rup = toBrutFin(num('fin-rupture-total'))/R('ruptureDiviseur'); setTxt('out-fin-rupture', fmtEUR(rup)); }
  // avant le début de l'accueil : ni salaire, ni congés, ni entretien — seule l'indemnité forfaitaire est due
  const avant = pr.qui===4;
  const cot = avant ? 0 : salaire + ipr + cpV + ecartRetenu, nonCot = (avant ? 0 : ent + rup) + engag;
  const any = cot || nonCot;
  setTxt('out-fin-total', any ? fmtEUR(cot+nonCot) : '—');
  if(typeof finNavUpdate==='function') finNavUpdate();
  setTxt('out-fin-net', any ? fmtEUR(toNet(cot)+nonCot) : '—');
  // impôt retenu par Pajemploi sur les sommes imposables (pas sur l'indemnité de rupture, exonérée)
  const pasF = avant ? 0 : pasEstime(cot*(netRatio() + ((R('cotCsgNonDed')||0)+(R('cotCrds')||0))*(R('assietteCsg')||0.9825)), ent, 0);
  show('row-fin-pas', !!any && pasF > 0.004, 'flex'); show('row-fin-apres', !!any && pasF > 0.004, 'flex');
  setTxt('out-fin-pas', '−'+fmtEUR(pasF)); setTxt('out-fin-apres', fmtEUR(toNet(cot)+nonCot-pasF));
};


/* =====================================================================================
   POUR LES PARENTS : récapitulatif du mois et de l'année (avec ou sans suivi au jour le jour)
   ===================================================================================== */
/* Chiffres d'un mois pour un contrat : mois validé tel qu'enregistré, sinon le calcul de « Salaire du mois »
   (suivi s'il existe, sinon planning). Les cases de « Salaire du mois » ne sont pas modifiées. */
function moisPourContrat(c, ym){
  const J = journalOf(c.id)[ym];
  const kHs = netRatio(parseD(ym)) + hsReduction(parseD(ym)), kN = netRatio(parseD(ym));
  if(J) return {valide:true, brut:J.brut, net:J.net, netImp:J.netImp||0, ie:J.ie||0, repas:J.repas||0, km:J.km||0, hDecl:J.hDecl, jDecl:J.jDecl, hCompl:J.hCompl||0, hMaj:J.hMaj||0, jCP:J.jCP||0, cp:J.cpMontant||0, acompte:0, jours:J.jours||0, j8:J.j8||0, hm8:J.hm8||0, ded:J.ded||0, pas:J.pas||0,
    netHs: J.netHs||0, cpNet: (J.cpMontant||0)*kN, datepaie: J.datepaie||'', type: paramsAt(c, parseD(ym)).type};
  const th = $('theme-mois'); if(!th) return null;
  const champs = [...th.querySelectorAll('input,select,textarea')].map(el=>[el, el.value]);
  const segs = [...th.querySelectorAll('.seg[id]')].map(g=>[g.id, seg(g.id)]);
  const selAvant = STATE.sel.mois;
  STATE.sel.mois = c.id;
  let r = null;
  try{ setVal('mois-mois', ym); moisFillFromContract(c, ym); r = moisCompute(); }
  finally{ champs.forEach(([el,v])=>{ el.value = v; }); segs.forEach(([id,v])=>setSegVal(id, v)); STATE.sel.mois = selAvant; }
  return r && {valide:false, brut:r.brut, net:r.net, netImp:r.netImp, ie:r.ie, repas:r.repas, km:r.km, hDecl:r.hNormDecl, jDecl:r.jDecl, hCompl:r.hComplDecl, hMaj:r.hMajDecl, jCP:r.jcp, cp:r.cpTot, acompte:r.acompte||0, jours:r.jours||0, j8:r.j8||0, hm8:r.hm8||0, ded:r.ded||0, pas:r.pas||0,
    netCompl: (r.brutCompl||0)*Math.min(1,kHs), netMaj: ((r.brutMaj||0)+(r.brutMajMensu||0))*Math.min(1,kHs), cpNet: (r.cpTot||0)*kN, datepaie: r.datepaie||'', type: r.inc ? 1 : paramsAt(c, parseD(ym)).type};
}
/* Mois d'un contrat entre deux mois (inclus), jusqu'au mois en cours : chiffres validés, sinon calculés
   comme dans « Salaire du mois » (suivi s'il existe, sinon planning) */
function moisDuContrat(c, fromYm, toYm){
  const out = [], deb = parseD(c.debut), fin = parseD(c.fin), lim = curMonth();
  if(!deb) return out;
  let d = parseD(fromYm); const end = parseD(toYm);
  while(d <= end){
    const ym = isoMonth(d), last = new Date(d.getFullYear(), d.getMonth()+1, 0);
    if(ym <= lim && !(deb > last) && !(fin && fin < d)){ const x = moisPourContrat(c, ym); if(x) out.push({ym, x}); }
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }
  return out;
}
function parentsContrat(){ const k = selKey('parents'); return k!=='libre' ? getContrat(k) : null; }
let PARENTS_CTX = null;
function parentsOuvrir(cid, ym){
  STATE.sel.parents = cid; showTheme('parents');
  setVal('par-mois', ym); setVal('par-annee', String(ym).slice(0,4));
  if($('par-annee-msg')) $('par-annee-msg').checked = today().getMonth()===0;
  CALC.parents(); persistTheme('parents');
}
function moisVersParents(){
  const c = moisContrat(); if(!c){ toast('Choisissez un enfant enregistré.'); return; }
  parentsOuvrir(c.id, val('mois-mois') || curMonth());
}
PREFILL.parents = ()=>{ setVal('par-mois', curMonth()); setVal('par-annee', today().getFullYear()); };
let PARENTS_TXT = '';
/* Bloc d'un enfant pour un mois : ce que les parents déclarent, ce qu'ils versent (HTML + texte du message) */
function parentsMoisBloc(c, ym, titre){
  const line = (l, v)=>'<div class="result-line"><span class="lbl">'+l+'</span><span class="val">'+v+'</span></div>';
  const m = moisPourContrat(c, ym); if(!m) return null;
  const total = m.net + m.ie + m.repas + m.km;
  const Ms = hasSuiviMonth(c.id, ym) ? suiviMonth(c, ym) : null, fraisAv = Ms ? round2(Ms.T.frais) : 0;
  const pj = c.pjPlus||0, dv0 = derive(c, ym);
  let absTxt = '', hsTxt = '';
  if(Ms){
    const jr = x=>parseD(x.k).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
    const g = {}; Ms.days.filter(x=>x.ded>0).forEach(x=>{ const l = ((ST[x.st]||{}).l||x.st).toLowerCase(); (g[l] = g[l] || []).push(jr(x)); });
    absTxt = Object.keys(g).map(l=>g[l].join(', ')+' ('+l+')').join(' ; ');
    hsTxt = Ms.days.filter(x=>x.extra>0).map(x=>jr(x)+' (+'+fmtH(x.extra)+')').join(', ');
  }
  // mois d'entrée ou de sortie en cours de mois : le prorata n'est pas une absence
  const d0p = parseD(ym), lastP = new Date(d0p.getFullYear(), d0p.getMonth()+1, 0), debP = parseD(c.debut), finP = parseD(c.fin);
  const entree = !!(debP && debP > d0p && debP <= lastP), sortie = !!(finP && finP >= d0p && finP < lastP);
  let horsTxt = '', dedHors = 0;
  if(entree || sortie){
    const M0 = suiviMonth(c, ym), T0 = M0.T;
    if(T0.hOut && T0.hPrev){
      dedHors = round2(M0.base*T0.hOut/T0.hPrev); if(m.ded!==undefined) dedHors = Math.min(m.ded||0, dedHors);
      horsTxt = (entree ? 'Contrat commencé le '+fmtDate(c.debut) : '')+(sortie ? (entree ? ' et terminé le ' : 'Contrat terminé le ')+fmtDate(c.fin) : '')
        +' : salaire calculé sur '+fmtH(T0.hPrev - T0.hOut)+' prévues pendant le contrat, sur '+fmtH(T0.hPrev)+' prévues dans tout le mois (−'+fmtEUR(dedHors)+' brut ; ce n’est pas une absence)';
    }
  }
  const dedAbs = Math.max(0, (m.ded||0) - dedHors);
  const dedTxt = dedAbs > 0.004 ? (absTxt ? absTxt+' : ' : '')+'−'+fmtEUR(dedAbs)+' brut' : '';
  // année incomplète, congés payés en juin : prévenir les parents dès le mois de mai
  const cpJuin = (c.type===1 && c.cpMode===1 && ym.slice(5,7)==='05' && typeof cpIndemniteMois==='function') ? cpIndemniteMois(c, ym.slice(0,4)+'-06', 0) : 0;
  const cpJuinTxt = cpJuin > 0.004 ? 'À prévoir : en juin, les congés payés de l’année s’ajoutent au salaire, environ '+fmtEUR(cpJuin)+' brut (montant exact au mois de juin).' : '';
  const hNormTxt = 'Heures normales déclarées = heures du contrat ('+fmtNum(dv0.hNormMensu, Math.abs(dv0.hNormMensu - Math.round(dv0.hNormMensu)) < 0.005 ? 0 : 2)+' h par mois)'+(horsTxt ? ' au prorata des heures prévues pendant le contrat' : '')+(dedAbs > 0.004 ? ' moins les heures d’absence retirées' : '')+(horsTxt ? ' = '+(m.hDecl||0)+' h' : '')+' ; les heures en plus se déclarent à part.';
  const cmgE = (c.cmgFoyer && typeof cmgEstime==='function') ? cmgEstime(c.cmgFoyer, ym, (m.hDecl||0)+(m.hCompl||0)+(m.hMaj||0), m.net, m.ie, m.repas, c.naissance) : null;
  const pjTxt = pj===2 ? 'Pajemploi+ : ne me versez rien vous-mêmes. Pajemploi me verse le salaire et les indemnités, et vous prélève le reste (aide CMG déduite).'
    : pj===0 ? 'Si vous utilisez Pajemploi+, ne me versez rien vous-mêmes : Pajemploi s\u2019en charge (aide CMG déduite).' : '';
  const h = (titre ? '<div class="h-sec">'+esc(titre)+'</div>' : '')
    + '<p class="hint">'+(m.valide ? '✔ Mois validé : chiffres enregistrés.' : 'Estimation d’après '+(Ms ? 'le suivi des journées' : 'le planning du contrat')+'. Validez le mois dans « Salaire du mois » pour figer les chiffres.')+'</p>'
    + '<div class="pajemploi-block"><div class="pajemploi-title">À déclarer sur Pajemploi — '+esc(c.enfant||'')+' — '+esc(fmtMonth(ym))+'</div>'
    + line('Heures normales', (m.hDecl||0)+' h') + line('Jours d’activité', (m.jDecl||0)+' j')
    + (m.hCompl ? line('Heures complémentaires', fmtNum(m.hCompl,2)+' h'+(m.netCompl ? ' · '+fmtEUR(m.netCompl)+' net' : '')) : '') + (m.hMaj ? line('Heures majorées', fmtNum(m.hMaj,2)+' h'+(m.netMaj ? ' · '+fmtEUR(m.netMaj)+' net' : '')) : '')
    + (m.netHs && !m.netCompl && !m.netMaj ? line('Montant net des heures en plus', fmtEUR(m.netHs)) : '')
    + (m.cp ? line('Congés payés', (m.jCP ? fmtNum(m.jCP,2)+' j · ' : '')+'dont '+fmtEUR(m.cpNet)+' net, '+(m.type===1 ? 'déjà compris dans le salaire net total et les heures normales' : 'complément de congés de juin (règle des 10 %), déjà compris dans le salaire net total ; année complète : rien dans la case congés payés')) : (m.type===1 ? '' : line('Congés payés', 'ne rien remplir (année complète)')))
    + line('Salaire net', fmtEUR(m.net)) + line('Indemnités d’entretien', fmtEUR(m.ie)) + line('Repas', fmtEUR(m.repas)) + line('Kilomètres', fmtEUR(m.km))
    + (m.datepaie ? line('Date de paiement', fmtDate(m.datepaie)) : '') + '</div>'
    + (horsTxt ? line('Début ou fin de contrat dans le mois', esc(horsTxt)) : '') + (cpJuinTxt ? '<p class="hint">'+esc(cpJuinTxt)+'</p>' : '')
    + (dedTxt ? line('Absences retirées du salaire', esc(dedTxt)) : '') + (hsTxt ? line('Heures en plus', esc(hsTxt)) : '')
    + (Ms ? line('Heures faites (prévu au planning)', fmtH(Ms.T.R)+' ('+fmtH(Ms.T.hPrev)+')') + line('Jours où l’enfant est venu', Ms.T.jAcc+' j') : '')
    + '<p class="hint">'+esc(hNormTxt)+'</p>'
    + '<div class="result-line total"><span class="lbl">'+(pj===2 ? 'Total payé par Pajemploi+ pour '+esc(c.enfant||'cet enfant')+' (les parents ne versent rien eux-mêmes)' : 'Total à verser pour '+esc(c.enfant||'cet enfant'))+'</span><span class="val">'+fmtEUR(total)+'</span></div>'
    + ((m.pas||0) > 0.004 ? line('Impôt de l’assistante maternelle retenu par Pajemploi (estimation)', '−'+fmtEUR(m.pas)) + line(pj===2 ? 'Versé par Pajemploi+ à l’assistante maternelle (après impôt)' : 'À verser à l’assistante maternelle (salaire après impôt + indemnités)', fmtEUR(total - m.pas)) : '')
    + (cmgE!==null ? line('Aide CMG estimée (versée par la CAF)', fmtEUR(cmgE)) + line('Reste à la charge des parents (estimation)', fmtEUR(total - cmgE))
      : '<p class="hint">Pour indiquer aux parents l\u2019aide CMG et ce qui reste à leur charge : <a href="#" onclick="cmgOuvrir(\''+c.id+'\',\''+ym+'\');return false;">estimer l\u2019aide CMG de ce mois</a> (une fois suffit : leurs ressources sont gardées pour les mois suivants).</p>')
    + (fraisAv ? line('Frais avancés à rembourser (hors Pajemploi)', fmtEUR(fraisAv)) : '')
    + (m.acompte ? line('Acompte déjà versé', fmtEUR(m.acompte)) + line('Reste à verser', fmtEUR(total - m.acompte)) : '');
  const t = [(c.enfant||'Enfant')+' — '+fmtMonth(ym),
    'À déclarer sur Pajemploi : '+(m.hDecl||0)+' h normales, '+(m.jDecl||0)+' jours d’activité'+(m.hCompl?', '+fmtNum(m.hCompl,2)+' h complémentaires'+(m.netCompl?' ('+fmtEUR(m.netCompl)+' net)':''):'')+(m.hMaj?', '+fmtNum(m.hMaj,2)+' h majorées'+(m.netMaj?' ('+fmtEUR(m.netMaj)+' net)':''):'')
      + (m.cp ? (m.jCP ? ', '+fmtNum(m.jCP,2)+' jours de congés payés' : '')+' (dont congés payés '+fmtEUR(m.cpNet)+' net, '+(m.type===1 ? 'déjà compris dans le salaire net total et les heures' : 'complément de juin, déjà compris dans le salaire net total')+' : ne pas les ajouter)' : '') + (m.datepaie ? ', date de paiement '+fmtDate(m.datepaie) : ''),
    'Salaire net total : '+fmtEUR(m.net), 'Entretien : '+fmtEUR(m.ie)+' · Repas : '+fmtEUR(m.repas)+' · Km : '+fmtEUR(m.km), (pj===2 ? 'Total payé par Pajemploi+ : ' : 'Total à verser : ')+fmtEUR(total)+(m.valide?'':' (provisoire)')];
  if(horsTxt) t.push(horsTxt);
  if(dedTxt) t.push('Absences retirées du salaire : '+dedTxt);
  if(hsTxt) t.push('Heures en plus : '+hsTxt);
  t.push(hNormTxt);
  if(cmgE!==null) t.push('Aide CMG estimée : '+fmtEUR(cmgE)+' → reste à votre charge : '+fmtEUR(total - cmgE)+' (estimation, la CAF fixe le montant exact)');
  if(pjTxt) t.push(pjTxt);
  if((m.pas||0) > 0.004) t.push(pj===2 ? 'Impôt sur le revenu : Pajemploi+ me verse le salaire après impôt (environ '+fmtEUR(m.pas)+' retenus).' : 'Impôt sur le revenu : Pajemploi prélève mon impôt sur votre compte (environ '+fmtEUR(m.pas)+'). Versez-moi donc '+fmtEUR(total - m.pas)+' (salaire après impôt + indemnités), pas plus.');
  if(Ms) t.push('Heures faites : '+fmtH(Ms.T.R)+' (prévu '+fmtH(Ms.T.hPrev)+') · jours de présence : '+Ms.T.jAcc);
  if(fraisAv) t.push('Frais avancés à rembourser : '+fmtEUR(fraisAv));
  if(cpJuinTxt) t.push(cpJuinTxt);
  return {h, t, total: round2(total), valide: m.valide, cmg: cmgE};
}
function contratActifMois(c, ym){ const d0 = parseD(ym), last = new Date(d0.getFullYear(), d0.getMonth()+1, 0), deb = parseD(c.debut), fin = parseD(c.fin); return !(deb && deb > last) && !(fin && fin < d0); }
/* Frères et sœurs : autres enfants de la même famille (même nom d'employeur) accueillis ce mois-là */
function parentsFratrie(c, ym){
  const f = String(c.famille||'').trim().toLowerCase(); if(!f) return [];
  return STATE.contrats.filter(x=>x.id!==c.id && String(x.famille||'').trim().toLowerCase()===f && contratActifMois(x, ym));
}
/* Année de paiement d'un mois de salaire (crédit d'impôt : sommes versées pendant l'année) */
function anneePaiement(c, ym){
  const J = journalOf(c.id)[ym]; const dp = J && parseD(J.datepaie);
  if(dp) return dp.getFullYear();
  const d = parseD(ym);
  return c.paiementJour ? new Date(d.getFullYear(), d.getMonth()+1, 1).getFullYear() : d.getFullYear();
}
CALC.parents = ()=>{
  const c = parentsContrat(), ym = val('par-mois') || curMonth(), an = parseInt(val('par-annee')) || today().getFullYear();
  if(!c){ setHTML('par-mois-out', '<p class="hint">Choisissez un enfant enregistré : le récapitulatif part de son contrat.</p>'); setHTML('par-annee-out',''); PARENTS_TXT=''; PARENTS_CTX=null; return; }
  const line = (l, v)=>'<div class="result-line"><span class="lbl">'+l+'</span><span class="val">'+v+'</span></div>';
  let h = '', t = [];
  PARENTS_CTX = null;
  if(!contratActifMois(c, ym)){ h = '<p class="hint">Pas de contrat en cours ce mois-là.</p>'; }
  else {
    const fr = $('par-fratrie') && $('par-fratrie').checked ? parentsFratrie(c, ym) : [];
    const blocs = [c].concat(fr).map(x=>({c:x, b:parentsMoisBloc(x, ym, fr.length ? x.enfant : '')})).filter(x=>x.b);
    PARENTS_CTX = {ym, items: blocs.map(x=>({cid:x.c.id, total:x.b.total, valide:x.b.valide}))};
    t.push('Récapitulatif '+fmtMonth(ym)+(c.famille ? ' — '+c.famille : ''));
    if(blocs.some(x=>!x.b.valide)) t.push('⚠️ Chiffres provisoires : le mois n\u2019est pas encore validé. Attendez la version définitive avant de déclarer sur Pajemploi.');
    blocs.forEach(x=>{ h += x.b.h; t.push(''); t.push(...x.b.t); });
    if(blocs.length > 1){
      const tot = blocs.reduce((s,x)=>s+x.b.total, 0);
      h += '<div class="result-line total"><span class="lbl">Total à verser pour la famille</span><span class="val">'+fmtEUR(tot)+'</span></div>'
        + '<p class="hint">Une déclaration Pajemploi par enfant : chaque bloc orange se recopie séparément.</p>';
      t.push('', 'Total pour la famille : '+fmtEUR(tot)+' (une déclaration Pajemploi par enfant)');
    }
    t.push('', 'Merci de me confirmer votre accord, ou de me signaler une erreur.');
    h += '<p class="hint">Aide de la CAF (CMG) : versée directement aux parents ; estimation dans « Aide CMG des parents ». Avec <b>Pajemploi+</b>, c’est Pajemploi qui verse le salaire à l’assistante maternelle et prélève les parents (aide déduite) : les parents ne lui versent alors rien eux-mêmes.</p>';
  }
  const nbFr = contratActifMois(c, ym) ? parentsFratrie(c, ym).length : 0;
  show('par-fratrie-row', nbFr > 0, 'flex');
  setHTML('par-mois-out', h);
  // Année : sommes VERSÉES pendant l'année (date de paiement), pour le crédit d'impôt « frais de garde » des parents
  let net = 0, ie = 0, repas = 0, n = 0, est = 0, fut = 0, cmgEst = 0;
  const deb = parseD(c.debut), fin = parseD(c.fin);
  for(let k=-1; k<12; k++){
    const dm = new Date(an, k, 1), lm = new Date(an, k+1, 0);
    if((deb && deb > lm) || (fin && fin < dm)) continue;
    const ymm = isoMonth(dm); if(anneePaiement(c, ymm)!==an) continue;
    const x = moisPourContrat(c, ymm); if(!x) continue;
    net += x.net; ie += x.ie; repas += x.repas; n++; if(!x.valide) est++; if(ymm >= curMonth()) fut++;
    if(c.cmgFoyer && typeof cmgEstime==='function') cmgEst += cmgEstime(c.cmgFoyer, ymm, (x.hDecl||0)+(x.hCompl||0)+(x.hMaj||0), x.net, x.ie, x.repas, c.naissance) || 0;
  }
  const ageMax = R('creditGardeAgeMax', an+'-01-01') || 6, nais = parseD(c.naissance), moins6 = nais ? new Date(an, 0, 1) < new Date(nais.getFullYear()+ageMax, nais.getMonth(), nais.getDate()) : null;
  const garde = net + ie, plafond = R('creditGardePlafond', an+'-12-31') || 3500, tauxCI = R('creditGardeTaux', an+'-12-31') || 0.5;
  const cmgSaisi = val('par-cmg-an') !== '', cmgAn = cmgSaisi ? num('par-cmg-an') : (c.cmgFoyer ? round2(cmgEst) : null), aDeclarer = cmgAn!==null ? Math.max(0, garde - cmgAn) : null;
  setHTML('par-annee-out', !n ? '<p class="hint">Pas de salaire versé cette année pour ce contrat.</p>' :
      line('Mois de salaire versés dans l’année', n+(est ? ' (dont '+est+' estimés'+(fut ? ', dont '+fut+' pas encore payés' : '')+')' : ''))
    + line('Salaires nets versés', fmtEUR(net)) + line('Indemnités d’entretien', fmtEUR(ie)) + line('Repas (non retenus pour le crédit d’impôt)', fmtEUR(repas))
    + '<div class="result-line total"><span class="lbl">Frais de garde de l’année (salaire net + entretien)</span><span class="val">'+fmtEUR(garde)+'</span></div>'
    + (aDeclarer!==null ? line('Aide CMG reçue dans l’année'+(cmgSaisi ? '' : ' (estimation du carnet)'), '− '+fmtEUR(cmgAn)) + '<div class="result-line total"><span class="lbl">Montant à déclarer (frais de garde − aide CMG)</span><span class="val">'+fmtEUR(aDeclarer)+'</span></div>'
        + (moins6===false ? '' : line('Crédit d’impôt estimé ('+fmtNum(tauxCI*100,0)+' %, dans la limite de '+fmtEUR(plafond)+' de frais)', fmtEUR(tauxCI*Math.min(aDeclarer, plafond))))
      : '<p class="hint"><b>Avant de déclarer, retirez l’aide CMG reçue dans l’année</b> (attestation de la CAF) : indiquez-la ci-dessus, ou estimez l’aide CMG d’un mois pour que le carnet la calcule.</p>')
    + '<p class="hint">Compté à la date de paiement : un salaire de décembre payé en janvier compte pour l’année suivante. '+(moins6===false ? 'L’enfant avait '+ageMax+' ans ou plus au 1er janvier '+an+' : pas de crédit d’impôt pour frais de garde.' :
        'À déclarer par les parents (cases 7GA à 7GC ; 7GE à 7GG en résidence alternée, plafond divisé par deux), après avoir retiré l’aide CMG reçue dans l’année : crédit d’impôt de '+fmtNum(tauxCI*100,0)+' %, dans la limite de '+fmtEUR(plafond)+' de frais par enfant.'+(moins6===null ? ' (Date de naissance non renseignée : vérifiez que l’enfant avait moins de '+ageMax+' ans au 1er janvier.)' : ''))+'</p>');
  if(n && $('par-annee-msg') && $('par-annee-msg').checked) t.push('', 'Année '+an+' (salaires payés dans l’année'+(fut ? ', dont '+fut+' à venir, estimés' : '')+') pour '+(c.enfant||'')+' : salaires nets '+fmtEUR(net)+', entretien '+fmtEUR(ie)+' → frais de garde '+fmtEUR(garde)+' (avant déduction de l’aide CMG).');
  t.push('', 'Calculé avec Carnet Assmat. Les montants exacts sont ceux de Pajemploi et de la CAF.');
  if(n && $('par-annee-msg') && $('par-annee-msg').checked && aDeclarer!==null) t.push('Aide CMG reçue'+(cmgSaisi ? '' : ' (estimation)')+' : '+fmtEUR(cmgAn)+' → montant à déclarer : '+fmtEUR(aDeclarer)+'.');
  PARENTS_TXT = t.join('\n');
};
function parentsPartager(force){
  if(!PARENTS_TXT){ toast('Choisissez d’abord un enfant enregistré.'); return; }
  if(!force && PARENTS_CTX && PARENTS_CTX.items.some(it=>!it.valide)){
    _confirmNoCb = ()=>{ const it = PARENTS_CTX.items.find(x=>!x.valide); STATE.sel.mois = it.cid; showTheme('mois'); setVal('mois-mois', PARENTS_CTX.ym); $('mois-mois').dispatchEvent(new Event('change', {bubbles:true})); toast('Vérifiez puis touchez « Valider ce mois », et revenez envoyer le récapitulatif.'); };
    showConfirmDialog('Mois pas encore validé', 'Les parents risquent de déclarer des chiffres provisoires sur Pajemploi. Le mieux est de valider le mois d\u2019abord. Le message, s\u2019il part maintenant, est marqué « provisoire ».', ()=>parentsPartager(true), 'Envoyer quand même', 'Valider d\u2019abord');
    return;
  }
  const note = ()=>{ if(!PARENTS_CTX) return;
    PARENTS_CTX.items.forEach(it=>{ const mr = monthRec(it.cid, PARENTS_CTX.ym);
      mr.envoyeLe = iso(today()); mr.envoyeTotal = it.total; if(mr.st==='ouvert') mr.st = 'avalider';
      auditLog(it.cid, fmtMonth(PARENTS_CTX.ym)+' : récapitulatif envoyé aux parents ('+fmtEUR(it.total)+')'); });
    saveState(); };
  if(navigator.share){ navigator.share({title:'Récapitulatif assistante maternelle', text:PARENTS_TXT}).then(note).catch(()=>{}); return; }
  if(navigator.clipboard){ navigator.clipboard.writeText(PARENTS_TXT).then(()=>{ note(); toast('Récapitulatif copié : collez-le dans un SMS ou un mail aux parents.'); }, ()=>toast('Copie impossible.')); return; }
  toast('Partage non disponible sur cet appareil.');
}
/* Écrans longs : bouton « Voir le résultat » en haut, qui descend directement au résultat */
function ajouterBoutonsResultat(){
  document.querySelectorAll('.theme').forEach(th=>{
    if(th.id==='theme-contrat' || th.id==='theme-mois') return;
    const stub = th.querySelector('.stub'); if(!stub || th.querySelector('.go-result')) return;
    if(th.querySelectorAll('input, select, textarea').length < 10) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small go-result'; b.textContent = '⬇ Voir le résultat';
    b.onclick = ()=>{ stub.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); };
    const ref = th.querySelector('.kid-picker') || th.querySelector('.sub'); if(ref) ref.after(b); else th.prepend(b);
  });
}
document.addEventListener('DOMContentLoaded', ajouterBoutonsResultat);
if(document.readyState !== 'loading') setTimeout(ajouterBoutonsResultat, 0);
