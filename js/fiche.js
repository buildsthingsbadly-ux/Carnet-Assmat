/* =====================================================================================
   FICHES EXPLICATIVES : comprendre un résultat, en mots simples et avec les chiffres
   Chaque fiche dit ce qui a été pris en compte, les calculs faits étape par étape et ce qu'il faut retenir.
   Elle se lit à l'écran et s'imprime (ou s'enregistre en PDF). Elle marche avec ou sans suivi au jour le jour.
   ===================================================================================== */
'use strict';
(window.__V=window.__V||{})['fiche']='3.29.0';   /* version du fichier : écrite par tools/build.py */

const FE = x=>fmtEUR(x||0);
const FN = (x,d)=>fmtNum(x||0, d===undefined?2:d);
const FH = x=>{ const v = Math.round((x||0)*100)/100; return fmtNum(v, Number.isInteger(v)?0:2)+' h'; };
const FP = x=>fmtNum(x||0, 2)+' %';
let FICHE_HTML = '', FICHE_TITRE = '';

/* ---------- mise en page commune ---------- */
function ficheRender(f){
  const L = [];
  L.push('<div class="fiche">');
  L.push('<h1 id="fiche-titre">Comprendre : '+esc(f.titre)+'</h1>');
  L.push('<div class="meta">'+[f.sous, 'fiche établie le '+new Date().toLocaleDateString('fr-FR'), 'réglementation du '+fmtDate(REG.version)].filter(Boolean).map(esc).join(' · ')+'</div>');
  if(f.bref) L.push('<div class="fiche-bref"><b>En bref.</b> '+f.bref+'</div>');
  if(f.origine) L.push('<div class="fiche-origine">'+f.origine+'</div>');
  if(f.prise && f.prise.length){
    L.push('<h3>1. Ce qui a été pris en compte</h3><table>'+f.prise.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(String(r[1]))+'</td></tr>').join('')+'</table>');
  }
  if(f.etapes && f.etapes.length){
    L.push('<h3>2. Les calculs, étape par étape</h3>');
    f.etapes.forEach((e,i)=>{
      L.push('<div class="fiche-step"><div class="fiche-step-t"><span class="fiche-num">'+(i+1)+'</span> '+esc(e.t)+'</div>'
        + (e.txt ? '<p>'+e.txt+'</p>' : '')
        + (e.calc && e.calc.length ? '<table class="fiche-calc">'+e.calc.map(c=>'<tr><td>'+esc(c[0])+'</td><td>'+esc(String(c[1]))+'</td></tr>').join('')+'</table>' : '')
        + '</div>');
    });
  }
  if(f.resultat && f.resultat.length){
    L.push('<h3>3. Le résultat</h3><table>'+f.resultat.map(r=>'<tr class="'+(r[2]?'tot':'')+'"><td>'+esc(r[0])+'</td><td>'+esc(String(r[1]))+'</td></tr>').join('')+'</table>');
  }
  if(f.retenir && f.retenir.length) L.push('<h3>4. À retenir</h3><ul class="fiche-ul">'+f.retenir.map(x=>'<li>'+x+'</li>').join('')+'</ul>');
  if(f.mots && f.mots.length) L.push('<h3>Les mots utilisés</h3><ul class="fiche-ul">'+f.mots.map(x=>'<li><b>'+esc(x[0])+'</b> : '+x[1]+'</li>').join('')+'</ul>');
  L.push('<p class="legal-p">Cette fiche explique une <b>estimation</b> faite avec la réglementation connue à cette date. Les montants officiels sont ceux de Pajemploi, de la CAF ou de la MSA et de l\'administration fiscale. En cas de doute, le contrat de travail et la convention collective des particuliers employeurs (IDCC 3239) font foi.</p>');
  L.push('</div>');
  return L.join('');
}
function ficheOuvrir(f){
  if(!f){ toast('Rien à expliquer pour l’instant : remplissez d’abord le calcul.'); return; }
  FICHE_TITRE = f.titre; FICHE_HTML = ficheRender(f);
  setHTML('fiche-body', FICHE_HTML);
  openOverlay('fiche-overlay');
  const b = $('fiche-body'); if(b) b.scrollTop = 0;
}
function ficheImprimer(){ if(!FICHE_HTML) return; closeOverlay('fiche-overlay'); doPrint(FICHE_HTML); }
/* origine des chiffres d'un mois : validé, suivi au jour le jour, ou planning (sans suivi) */
function ficheOrigine(c, ym){
  if(!c) return 'Calcul fait avec les chiffres que vous avez saisis (calcul rapide, sans fiche enfant).';
  if(journalOf(c.id)[ym]) return '✔ Mois <b>validé</b> : les chiffres sont ceux enregistrés au moment de la validation.';
  const cg = ((STATE.settings||{}).conges||[]).length, ab = ((STATE.settings||{}).absEnf||[]).some(p=>p.cid===c.id);
  const inc = c.type===1 && c.semOffAVenir ? ' <b>Semaines sans accueil pas encore toutes connues</b> : tant qu’une semaine n’est pas notée, l’entretien et les repas la comptent comme une semaine d’accueil (le salaire, lui, ne change pas).' : '';
  return (hasSuiviMonth(c.id, ym)
    ? 'Chiffres tirés du <b>suivi au jour le jour</b> (journées notées), le planning du contrat servant pour les jours non notés.'
    : 'Chiffres <b>calculés sans suivi au jour le jour</b> : le carnet part du planning du contrat'+(cg||ab ? ' et des '+(cg?'congés':'')+(cg&&ab?' et ':'')+(ab?'absences prévues':'')+' notés dans Réglages' : '')+'. C\'est une estimation : si un jour a été différent (absence, heures en plus), corrigez-le dans « Salaire du mois ».') + inc;
}
function semainesTxt(c){ return c.type===1 ? (parseFloat(c.semaines)||0)+' semaines d\'accueil' : '52 semaines (toute l\'année, vos 5 semaines de congés comprises)'; }

/* ---------- Salaire du mois & Pajemploi ---------- */
function ficheMois(){
  const r = moisCompute(); if(!r.brut && !r.base) return null;
  const c = moisContrat(), d = parseD(r.m), dv = c ? derive(c, d) : null;
  const hM = num('mois-heures'), jM = num('mois-jmensu'), hded = num('mois-hded'), total = r.net + r.ie + r.repas + r.km;
  const E = [];
  // 1. salaire de base
  const sem = c ? (c.type===1 ? (parseFloat(c.semaines)||0) : 52) : null;
  const calc1 = [];
  if(dv && dv.methode==='annuel') calc1.push([FN(dv.hAn)+' h prévues sur l’année (planning irrégulier) ÷ 12 mois', FH(hM)+' par mois']);
  else if(dv && sem && Math.abs(dv.moyH*sem/12 - hM) < 0.05) calc1.push([FN(dv.moyH)+' h par semaine en moyenne × '+sem+' semaines ÷ 12 mois', FH(hM)+' par mois']);
  else calc1.push(['Heures payées chaque mois (moyenne de l\'année)', FH(hM)]);
  if(r.taux && Math.abs(hM*r.taux - r.base) < 0.05) calc1.push([FH(hM)+' × '+FE(r.taux)+' brut de l\'heure', FE(r.base)]);
  else calc1.push(['Salaire de base (dont heures au-delà de 45 h par semaine, majorées de '+FN(r.majPct,0)+' %)', FE(r.base)]);
  E.push({t:'Le salaire de base, le même chaque mois', txt:'Le salaire est <b>mensualisé</b> : on compte les heures de toute l\'année, puis on les partage en 12. Ainsi la famille paie la même somme chaque mois, que le mois ait 4 ou 5 semaines, des jours fériés ou des vacances prévues au contrat.'+(c?' Ici : '+semainesTxt(c)+'.':''), calc:calc1});
  // 2. absences
  if(r.ded > 0.004){
    const M = c ? suiviMonth(c, r.m) : null, hPrev = M ? M.T.hPrev/60 : 0;
    const calc2 = (hPrev && Math.abs(r.base*hded/hPrev - r.ded) < 0.05) ? [[FE(r.base)+' × '+FH(hded)+' non travaillées ÷ '+FH(hPrev)+' prévues ce mois-ci', '− '+FE(r.ded)]] : [['Montant retiré pour l\'absence', '− '+FE(r.ded)]];
    E.push({t:'L\'absence non payée est retirée', txt:'Une absence qui ne se paie pas (arrivée ou départ en cours de mois, maladie de l\'assistante maternelle, enfant malade avec certificat…) se retire <b>au prorata des heures prévues ce mois-là</b>, et non au nombre de jours du mois : c\'est la règle fixée par la Cour de cassation.', calc:calc2});
  } else E.push({t:'Aucune absence à retirer', txt:'Le salaire de base est dû en entier. Ne se retirent jamais : l\'enfant absent parce que les parents l\'ont gardé, l\'enfant malade sans certificat, vos congés payés en année complète, les jours fériés chômés, les semaines sans accueil prévues au contrat.'});
  // 3. heures en plus, fériés, congés
  const c3 = [];
  if(r.hcompl) c3.push([FH(r.hcompl)+' complémentaires × '+FE(r.taux), '+ '+FE(r.brutCompl)]);
  if(r.hmaj) c3.push([FH(r.hmaj)+' majorées × '+FE(r.taux)+' × (1 + '+FN(r.majPct,0)+' %)', '+ '+FE(r.brutMaj)]);
  if(r.supFerie) c3.push(['Majoration des jours fériés travaillés (+10 %, +100 % le 1er mai)', '+ '+FE(r.supFerie)]);
  if(r.cp12) c3.push(['Congés payés du mois : 10 % du salaire', '+ '+FE(r.cp12)]);
  if(r.cpVerse) c3.push(['Congés payés versés ce mois-ci', '+ '+FE(r.cpVerse)]);
  if(num('mois-regul')) c3.push(['Correction d\'un mois précédent', (num('mois-regul')>0?'+ ':'− ')+FE(Math.abs(num('mois-regul')))]);
  if(c3.length) E.push({t:'Ce qui s\'ajoute au salaire de base', txt:'Les heures faites en plus du planning sont payées au tarif normal jusqu\'à 45 h dans la semaine (heures « complémentaires »), puis avec une majoration au-delà (heures « majorées »).'+(r.inc ? '' : ' En année complète, vos congés sont déjà payés dans le salaire de base : rien à ajouter pour eux.'), calc:c3});
  else E.push({t:'Rien à ajouter', txt:'Pas d\'heures en plus ni de jour férié travaillé ce mois-ci.'+(r.inc ? '' : ' En année complète, vos congés sont déjà compris dans le salaire de base.')});
  // 4. brut puis net
  const pct = (1 - netRatio(d))*100;
  E.push({t:'Du salaire brut au salaire net', txt:'Le <b>brut</b> est le salaire avant cotisations ; le <b>net</b> est ce que vous touchez. Les cotisations salariales (retraite, CSG, CRDS, prévoyance…) font environ '+FP(pct)+' du brut'+(r.netHs>0 ? ' ; elles sont plus faibles sur les heures en plus, qui ne sont pas imposables (dans la limite de l\'année)' : '')+'.',
    calc:[['Salaire brut du mois', FE(r.brut)], ['Cotisations salariales retirées', '− '+FE(r.brut - r.net)], ['Salaire net (estimation)', FE(r.net)]]});
  // 5. frais remboursés
  const c5 = [];
  if(r.ieAuto && r.ieAuto.jours){ const mn = r.ieAuto.min, mx = r.ieAuto.max; c5.push([r.ieAuto.jours+' jours de présence'+(mn && mx && Math.abs(mx-mn)>0.004 ? ' (de '+FE(mn)+' à '+FE(mx)+' selon la durée de la journée)' : ' × '+FE(r.ieAuto.total/r.ieAuto.jours)), FE(r.ie)]); }
  else if(r.jours) c5.push([r.jours+' jours de présence × '+FE(r.ieJour), FE(r.ie)]);
  if(r.repas) c5.push([r.jours+' jours × '+FE(num('mois-repas'))+' de repas et goûters', FE(r.repas)]);
  if(r.km) c5.push(['Frais kilométriques', FE(r.km)]);
  E.push({t:'Les frais remboursés (ce n\'est pas du salaire)', txt:'L\'<b>indemnité d\'entretien</b> rembourse vos frais (eau, chauffage, jouets, produits d\'hygiène). Elle est due <b>chaque jour où l\'enfant vient</b>, jamais en moyenne : chaque journée reçoit le montant prévu au contrat, sans jamais descendre sous le minimum légal pour sa durée ('+FE(ieLegalJour(9, d))+' pour 9 h). Repas et kilomètres s\'ajoutent si vous les fournissez. Ces sommes n\'ont pas de cotisations.', calc:c5.length ? c5 : [['Aucun jour de présence', FE(0)]]});
  // 6. total
  E.push({t:'Ce que la famille vous verse', calc:[[FE(r.net)+' net + '+FE(r.ie)+' entretien + '+FE(r.repas)+' repas + '+FE(r.km)+' km', FE(total)]].concat(r.acompte ? [['Moins l\'acompte déjà versé', '− '+FE(r.acompte)], ['Reste à verser', FE(total - r.acompte)]] : [])});
  // 7. Pajemploi
  E.push({t:'Les chiffres que les parents recopient sur Pajemploi', txt:'Ce sont les parents (vos employeurs) qui déclarent sur Pajemploi, une déclaration par enfant, entre le 25 et le 5. Les heures normales sont arrondies à l\'heure la plus proche et les jours d\'activité au jour supérieur, comme le demande Pajemploi ; aucun autre arrondi n\'est fait.',
    calc:[[FH(hM)+' payées par mois'+(r.ded>0.004 ? ', moins la part de l\'absence' : '')+(r.hMajMensuDu ? ', moins les heures majorées du contrat' : '')+' → arrondi', r.hNormDecl+' h normales'],
      [FN(jM)+' jours d\'activité par mois (jours par semaine × semaines ÷ 12)'+(r.ded>0.004 ? ', moins l\'absence' : '')+' → arrondi au jour supérieur', r.jDecl+' jours'],
      ['Salaire net total', FE(r.net)], ['Indemnités d\'entretien', FE(r.ie)], ['Repas', FE(r.repas)]]
      .concat(r.hcompl ? [['Heures complémentaires (nombre exact)', FH(r.hComplDecl)]] : []).concat(r.hMajDecl ? [['Heures majorées (nombre exact)', FH(r.hMajDecl)]] : [])});
  return {titre:'le salaire du mois', sous:(c ? (c.enfant||'')+' · ' : '')+fmtMonth(r.m),
    bref:'Pour '+fmtMonth(r.m)+', la famille vous verse <b>'+FE(total)+'</b> : '+FE(r.net)+' de salaire net estimé et '+FE(r.ie + r.repas + r.km)+' de frais remboursés.',
    origine: ficheOrigine(c, r.m),
    prise: [['Enfant', c ? (c.enfant||'')+(c.famille?' ('+c.famille+')':'') : 'calcul rapide'], ['Mois', fmtMonth(r.m)], ['Type de contrat', r.inc ? 'année incomplète (l\'enfant ne vient pas toute l\'année)' : 'année complète (l\'enfant vient toute l\'année)'],
      ['Salaire horaire brut', FE(r.taux)]].concat(dv ? [['Planning moyen', FN(dv.moyH)+' h par semaine sur '+FN(dv.moyJ,1)+' jours']] : []).concat([['Jours de présence ce mois-ci', r.jours+' j']]),
    etapes: E,
    resultat: [['Salaire brut', FE(r.brut)], ['Salaire net (estimation)', FE(r.net)], ['Indemnités d\'entretien', FE(r.ie)], ['Repas', FE(r.repas)], ['Kilomètres', FE(r.km)], ['Total à verser par la famille', FE(total), true], ['Net imposable (pour vos impôts)', FE(r.netImp)]],
    retenir: ['Le salaire de base est le même chaque mois ; seuls changent les absences non payées, les heures en plus et les frais.', 'L\'entretien et les repas suivent les jours de présence réels.', 'Validez le mois dans « Salaire du mois » une fois les chiffres vérifiés : il est gardé et sert aux congés, à la fin de contrat et aux impôts.', 'Le net exact est celui du bulletin Pajemploi.'],
    mots: [['Mensualisé', 'lissé sur 12 mois'], ['Brut / net', 'avant / après les cotisations salariales'], ['Heures complémentaires', 'heures en plus du planning, jusqu\'à 45 h dans la semaine'], ['Heures majorées', 'au-delà de 45 h dans la semaine, payées plus cher'], ['Jours d\'activité', 'nombre de jours d\'accueil par mois, en moyenne sur l\'année']]};
}
/* fiche d'un mois depuis l'onglet Mois, sans toucher aux cases de « Salaire du mois » */
function ficheMoisPour(cid, ym){
  const c = getContrat(cid); if(!c) return;
  const J = journalOf(c.id)[ym];
  if(J){
    const tot = (J.net||0)+(J.ie||0)+(J.repas||0)+(J.km||0);
    ficheOuvrir({titre:'le salaire du mois', sous:(c.enfant||'')+' · '+fmtMonth(ym), origine:ficheOrigine(c, ym),
      bref:'Pour '+fmtMonth(ym)+', la famille vous a versé <b>'+FE(tot)+'</b> : '+FE(J.net)+' de salaire net et '+FE((J.ie||0)+(J.repas||0)+(J.km||0))+' de frais.',
      etapes:[{t:'Chiffres enregistrés à la validation', txt:'Ce mois a été vérifié puis validé dans « Salaire du mois » le '+(J.validatedAt ? new Date(J.validatedAt).toLocaleDateString('fr-FR') : '—')+'. Pour revoir le détail de chaque calcul, ouvrez ce mois dans « Salaire du mois » et touchez « Comprendre ce résultat ».'}],
      resultat:[['Salaire brut', FE(J.brut)], ['Salaire net', FE(J.net)], ['Indemnités d\'entretien', FE(J.ie)], ['Repas et kilomètres', FE((J.repas||0)+(J.km||0))], ['Total versé par la famille', FE(tot), true], ['Heures normales déclarées', (J.hDecl||0)+' h'], ['Jours d\'activité déclarés', (J.jDecl||0)+' j']]});
    return;
  }
  const th = $('theme-mois'); if(!th) return;
  const champs = [...th.querySelectorAll('input,select,textarea')].map(el=>[el, el.value]);
  const segs = [...th.querySelectorAll('.seg[id]')].map(g=>[g.id, seg(g.id)]);
  const selAvant = STATE.sel.mois; let f = null;
  STATE.sel.mois = c.id;
  try{ setVal('mois-mois', ym); moisFillFromContract(c, ym); if(!hasSuiviMonth(c.id, ym) && typeof suiviFillMois==='function') suiviFillMois(c, ym); f = ficheMois(); }
  finally{ champs.forEach(([el,v])=>{ el.value = v; }); segs.forEach(([id,v])=>setSegVal(id, v)); STATE.sel.mois = selAvant; }
  ficheOuvrir(f);
}

/* ---------- Salaire mensualisé ---------- */
function ficheMensu(){
  const inc = seg('mensu-type')===1, sem = inc ? num('mensu-semaines') : 52, alt = seg('mensu-rythme')===1;
  const hA = num('mensu-hA'), hB = num('mensu-hB'), taux = num('mensu-taux');
  if(!hA && !hB) return null;
  const txt = id=>($(id)||{}).textContent||'—';
  return {titre:'le salaire mensualisé', sous: inc ? 'année incomplète' : 'année complète',
    bref:'Salaire de base : <b>'+txt('out-mensu-salaire')+'</b> brut chaque mois (environ '+txt('out-mensu-net')+' net).',
    prise:[['Type de contrat', inc ? 'année incomplète : '+sem+' semaines d\'accueil par an' : 'année complète : 52 semaines payées (vos congés compris)'], ['Heures par semaine', alt ? FH(hA)+' (semaine 1) et '+FH(hB)+' (semaine 2)' : FH(hA)], ['Salaire horaire brut', FE(taux)]],
    etapes:[
      {t:'Les heures d\'une semaine moyenne', txt: alt ? 'L\'accueil change une semaine sur deux : on prend la moyenne des deux semaines'+(inc?' où l\'enfant vient':'')+'.' : 'Le planning est le même chaque semaine.', calc:[['Moyenne par semaine', txt('out-mensu-moy')]]},
      {t:'Les heures de l\'année partagées en 12', txt:'On multiplie par le nombre de semaines payées dans l\'année puis on divise par 12 : chaque mois reçoit la même part.', calc:[['Heures par semaine × '+sem+' semaines ÷ 12', txt('out-mensu-heures')]].concat(txt('out-mensu-hmaj').indexOf('0,00')!==0 ? [['dont heures au-delà de 45 h par semaine (payées plus cher)', txt('out-mensu-hmaj')]] : [])},
      {t:'Le salaire de base', calc:[['Heures payées par mois × '+FE(taux), txt('out-mensu-salaire')], ['Net estimé (cotisations retirées, environ '+FP((1-netRatio())*100)+')', txt('out-mensu-net')]]},
      {t:'Les jours par mois', txt:'Les jours d\'accueil par mois (jours par semaine × semaines ÷ 12) servent de repère pour l\'entretien et les repas, et à la déclaration Pajemploi (arrondis au jour supérieur).', calc:[['Jours par mois en moyenne', txt('out-mensu-jours')]]}
    ].concat(inc ? [{t:'Les congés payés en année incomplète', txt:'En année incomplète, les congés s\'ajoutent au salaire, selon ce que prévoit le contrat : en juin, quand vous les prenez, ou un peu chaque mois (10 %).', calc:[['Si payés chaque mois : salaire + 10 %', txt('out-mensu-cp12')]]}] : []),
    retenir:['Ce salaire est le même chaque mois tant que le contrat ne change pas.', 'Il ne peut jamais être en dessous du minimum légal ('+FE(R('salMin'))+' brut de l\'heure aujourd\'hui).', 'Le mois réel (absences, heures en plus, frais) se calcule dans « Salaire du mois ».']};
}

/* ---------- Mois incomplet & absences ---------- */
function ficheCcass(){
  const bN = num('ccass-base-normal'), hp = num('ccass-hpot-normal'), hd = num('ccass-hded-normal'), jp = num('ccass-jours-potentiels'), jnt = num('ccass-jours-non-travailles');
  if(!bN) return null;
  const txt = id=>($(id)||{}).textContent||'—', mo = ccassMotif(), m = val('ccass-cal-mois') || curMonth();
  const non = mo.ded==='non';
  return {titre:'le mois incomplet', sous: fmtMonth(m)+' · '+(mo.t||''),
    bref: non ? 'Pour ce motif, <b>rien ne se retire</b> : le salaire de base reste dû en entier.' : 'Salaire du mois après l\'absence : <b>'+txt('out-ccass-salaire')+'</b> brut ('+txt('out-ccass-deduct-normal')+' retirés).',
    prise:[['Motif', mo.t||'—'], ['Salaire de base du mois (heures normales)', FE(bN)], ['Heures prévues ce mois-ci', FH(hp)], ['Jours prévus ce mois-ci', jp+' j'], ['Heures non travaillées', FH(hd)], ['Jours non travaillés', jnt+' j']],
    etapes:[
      {t:'Est-ce que cette absence se retire ?', txt: non ? 'Non : '+esc(mo.t||'ce motif')+' fait partie des absences payées (ou déjà comprises dans le salaire). Seuls l\'entretien et les repas ne sont pas dus les jours où l\'enfant ne vient pas.' : 'Oui : c\'est une absence non payée. On retire seulement la part des heures qui n\'ont pas été faites.'},
      {t:'La part retirée, calculée sur les heures du mois', txt:'La règle de la Cour de cassation : on ne compte pas en jours du calendrier, mais en heures prévues au planning <b>de ce mois-là</b>. Ainsi un jour d\'absence ne coûte pas la même chose en février et en mars.', calc: non ? [['Montant retiré', FE(0)]] : [[FE(bN)+' × '+FH(hd)+' ÷ '+FH(hp), '− '+txt('out-ccass-deduct-normal')], ['Salaire du mois recalculé', txt('out-ccass-salaire')]]},
      {t:'Les chiffres pour Pajemploi', txt:'On applique la même proportion aux heures et aux jours habituels : heures normales arrondies à l\'heure la plus proche, jours au jour supérieur.', calc:[['Jours d\'activité à déclarer', txt('out-ccass-jours-declar')], ['Heures normales à déclarer', txt('out-ccass-hnorm-declar')]]},
      {t:'L\'entretien du mois', txt:'Il n\'est dû que pour les jours où l\'enfant est venu ('+(jp-jnt)+' jours ici).', calc:[['Indemnités d\'entretien', txt('out-ccass-entretien')]]}
    ],
    resultat:[['Montant retiré', txt('out-ccass-deduct-normal')], ['Salaire brut du mois', txt('out-ccass-salaire')], ['À verser au total (net estimé + entretien)', txt('out-ccass-net'), true]],
    retenir:['Seules les absences non payées se retirent, et toujours au prorata des heures prévues dans le mois.', 'Le bouton « Reporter » envoie ce calcul dans « Salaire du mois », où le mois complet est calculé.']};
}

/* ---------- Indemnités d'entretien ---------- */
function ficheIe(){
  const txt = id=>($(id)||{}).textContent||'—', m = val('ie-mois') || curMonth();
  if(txt('out-ie-mois-min')==='—') return null;
  const contrat = seg('ie-mode')===1 && num('ie-montant-contrat');
  return {titre:'les indemnités d\'entretien', sous: fmtMonth(m),
    bref:'Minimum du mois : <b>'+txt('out-ie-mois-min')+'</b>'+(contrat ? ' ; à verser : <b>'+txt('out-ie-verser')+'</b>' : '')+'.',
    prise:[['Mois', fmtMonth(m)], ['Jours d\'accueil retenus', txt('out-ie-jours')], ['Minimum garanti (valeur légale)', txt('out-ie-mg')]].concat(contrat ? [['Montant prévu au contrat', FE(num('ie-montant-contrat'))+' par jour']] : []),
    etapes:[
      {t:'Le minimum pour une journée de 9 heures', txt:'La convention collective fixe le minimum à 90 % du « minimum garanti » (une valeur légale revue en général chaque année) pour 9 heures d\'accueil.', calc:[['90 % × '+txt('out-ie-mg').split(' (')[0], txt('out-ie-9h')]]},
      {t:'Le minimum selon la durée de la journée', txt:'Pour une journée plus courte ou plus longue, le minimum suit la durée (au prorata), sans jamais descendre sous 2,65 € par jour.', calc:[['Minimum pour la durée moyenne retenue', txt('out-ie-taux')]]},
      {t:'Le total du mois', txt:'On additionne <b>chaque jour où l\'enfant vient</b> : pas de moyenne mensuelle, et rien les jours d\'absence.', calc:[['Somme des jours d\'accueil', txt('out-ie-mois-min')]].concat(contrat ? [['Avec le montant du contrat (jamais sous le minimum du jour)', txt('out-ie-verser')]] : [])}
    ],
    retenir:['L\'entretien n\'est pas du salaire : ni cotisations, ni impôt (il entre dans les sommes perçues de l\'abattement).', 'Il change chaque mois avec le nombre de jours de présence.']};
}

/* ---------- Congés payés ---------- */
function ficheCp(){
  const txt = id=>($(id)||{}).textContent||'—';
  if(txt('out-cp-total')==='—') return null;
  const val10 = seg('cp-valeur')===1;
  return {titre:'les congés payés', sous: (()=>{ const k=selKey('cp'); const c=k!=='libre'?getContrat(k):null; return c ? c.enfant||'' : 'calcul rapide'; })(),
    bref:'Il vous reste <b>'+txt('out-cp-total')+'</b> de congés à prendre.',
    prise:[['Périodes de référence', 'du 1er juin au 31 mai'], ['Congés acquis sur les périodes terminées', txt('out-cp-acquis')], ['Congés de la période en cours', txt('out-cp-encours')], ['Congés déjà pris', txt('out-cp-pris')]],
    etapes:[
      {t:'Combien de jours sont gagnés', txt:'Chaque mois d\'accueil (ou chaque bloc de 4 semaines d\'accueil en année incomplète) donne <b>2,5 jours ouvrables</b>, dans la limite de 30 jours par an. Un arrêt maladie donne aussi 2 jours par mois. Le total d\'une période terminée s\'arrondit au jour supérieur.', calc:[['Période terminée', txt('out-cp-acquis')], ['Période en cours (pas encore arrondie)', txt('out-cp-encours')]]},
      {t:'Les jours pris', txt:'Ils viennent du suivi au jour le jour, ou sans suivi de « Mes congés payés » (Réglages), ou des mois validés. Une semaine de congés compte 6 jours ouvrables. On prend toujours d\'abord les jours les plus anciens.', calc:[['Jours pris', txt('out-cp-pris')], ['Jours restants', txt('out-cp-total')]]}
    ].concat(val10 && txt('out-cp-maintien')!=='—' ? [{t:'La valeur en euros', txt:'Deux méthodes sont comparées et la plus favorable pour vous est retenue : le <b>maintien de salaire</b> (ce que vous auriez gagné en travaillant) et le <b>dixième</b> (10 % des salaires de la période).', calc:[['Maintien de salaire', txt('out-cp-maintien')], ['10 % des salaires', txt('out-cp-dixieme')], ['Montant retenu', txt('out-cp-verser')]]}] : []),
    retenir:['Année complète : les congés sont déjà payés dans le salaire de chaque mois ; en juin on vérifie seulement si le dixième est plus favorable.', 'Année incomplète : les congés se paient en plus, comme prévu au contrat (en juin, à la prise ou chaque mois).', 'Sans suivi, notez vos congés dans Réglages : sinon le carnet ne peut pas les décompter.'],
    mots:[['Jours ouvrables', 'du lundi au samedi : une semaine de congés = 6 jours'], ['Période de référence', 'du 1er juin au 31 mai']]};
}

/* ---------- Fin de contrat ---------- */
function ficheFin(){
  const txt = id=>($(id)||{}).textContent||'—';
  if(txt('out-fin-total')==='—') return null;
  const pr = finPreavis(), E = [];
  E.push({t:'Le préavis', txt: ($('fin-preavis-info')||{}).textContent || 'Durée selon l\'ancienneté : 8 jours (moins de 3 mois), 15 jours (3 mois à moins d\'un an), 1 mois au-delà.', calc: txt('out-fin-preavis')!==FE(0) && txt('out-fin-preavis')!=='—' ? [['Préavis non travaillé payé par les parents', txt('out-fin-preavis')]] : []});
  E.push({t:'Le salaire du dernier mois', txt:'Si le contrat s\'arrête en cours de mois, seul ce qui est dû jusqu\'à la date de fin est payé, au prorata des heures prévues (même calcul qu\'un mois incomplet).', calc:[['Salaire du dernier mois (brut)', txt('out-fin-salaire')], ['Entretien du dernier mois (jours de présence)', txt('out-fin-entretien-r')]]});
  if(seg('fin-cp')===1){
    const j = num('fin-jours'), hs = num('fin-heures'), tx = num('fin-taux'), b = num('fin-total-salaires');
    E.push({t:'Les congés payés pas encore pris', txt:'Les jours restants sont payés. Deux méthodes, la plus favorable est retenue.', calc:[[FN(j)+' jours × ('+FH(hs)+' par semaine ÷ 6 jours × '+FE(tx)+')  — maintien', txt('out-fin-maintien')], ['10 % × '+FE(b)+' de salaires de ces jours  — dixième', txt('out-fin-dixieme')], ['Montant retenu', txt('out-fin-cp')]]});
  }
  if(seg('fin-rupture')===1) E.push({t:'L\'indemnité de rupture', txt:'Quand les parents retirent l\'enfant après au moins 9 mois, ils doivent 1/80ᵉ de tous les salaires bruts du contrat. Elle n\'a ni cotisations ni impôt (dans les limites légales).', calc:[['1/80ᵉ × '+FE(num('fin-rupture-total')), txt('out-fin-rupture')]]});
  if(txt('out-fin-regul-ecart')!=='—' && txt('out-fin-regul-ecart')!=='') E.push({t:'La régularisation (année incomplète)', txt:'On compare le salaire versé chaque mois et ce que valaient les heures vraiment faites (absences payées et fériés compris). S\'il en manque, la différence est due.', calc:[['Salaire réellement dû', txt('out-fin-regul-du')], ['Déjà versé', txt('out-fin-regul-verse-r')], ['Écart', txt('out-fin-regul-ecart')]]});
  return {titre:'la fin de contrat', sous: (()=>{ const k=selKey('fin'); const c=k!=='libre'?getContrat(k):null; return c ? c.enfant||'' : ''; })(),
    bref:'Au total, environ <b>'+txt('out-fin-net')+'</b> à verser (estimation en net).',
    prise:[['Qui met fin au contrat', (document.querySelector('#fin-qui .on')||{}).textContent||'—'], ['Début du contrat', fmtDate(val('fin-debut'))||'—'], ['Lettre envoyée ou remise le', fmtDate(val('fin-notif'))||'—']],
    etapes:E,
    resultat:[['Total des sommes dues', txt('out-fin-total')], ['À verser au total (estimation en net)', txt('out-fin-net'), true]],
    retenir:['Documents à remettre : certificat de travail, attestation France Travail (via Pajemploi), dernier bulletin ; le reçu pour solde de tout compte est conseillé.', 'Une somme versée en trop se récupère par petites retenues, dans la limite de la part saisissable, après information écrite.']};
}

/* ---------- Aide CMG ---------- */
function ficheCmg(){
  const txt = id=>($(id)||{}).textContent||'—', m = val('cmg-mois') || curMonth();
  if(txt('out-cmg-total')==='—') return null;
  const chr = R('cmgCHR', m), plafH = R('cmgPlafondH', m), plancher = R('cmgPlancher', m), plafond = R('cmgPlafond', m);
  const rs = num('cmg-revenu'), rev = Math.min(Math.max(rs, plancher), plafond), te = txt('out-cmg-taux-effort');
  const E = [{t:'Les ressources retenues', txt:'Ce sont les revenus du foyer pris en compte par la CAF, divisés par 12. Ils sont ramenés entre un minimum ('+FE(plancher)+') et un maximum ('+FE(plafond)+') par mois.', calc:[['Ressources saisies', FE(rs)], ['Ressources retenues', FE(rev)]]},
    {t:'La part payée par la famille pour chaque heure', txt:'Le « taux d\'effort » dépend du nombre d\'enfants à charge : '+te+' ici. Rapporté au coût horaire de référence ('+FE(chr)+'), il donne la part du coût que la famille garde à sa charge.', calc:[[FE(rev)+' × '+te+' ÷ '+FE(chr), FP(rev*parseFloat(te.replace(',','.'))/100/chr*100)+' du coût reste aux parents']]}];
  const n = seg('cmg-nbenfants-gardes')+1;
  for(let i=1;i<=n;i++){
    if(txt('out-cmg-c'+i+'-cmg')==='—') continue;
    const h = num('cmg-c'+i+'-heures'), netS = val('cmg-c'+i+'-net'), net = netS!=='' ? num('cmg-c'+i+'-net') : toNet(h*num('cmg-c'+i+'-taux'), m), ie = num('cmg-c'+i+'-entretien'), rp = num('cmg-c'+i+'-repas'), cout = net+ie+rp;
    E.push({t:'Enfant '+i+' : le coût de la garde et l\'aide', txt:'Le coût compte le salaire net, l\'entretien et les repas. Il est pris en compte jusqu\'à '+FE(plafH)+' de l\'heure ; au-delà, la différence reste aux parents.',
      calc:[[FE(net)+' net + '+FE(ie)+' entretien + '+FE(rp)+' repas', FE(cout)], ['Coût par heure ('+FH(h)+')', txt('out-cmg-c'+i+'-cout')], ['Aide CMG = coût (plafonné) × (1 − part des parents)', txt('out-cmg-c'+i+'-cmg')], ['Reste à payer', txt('out-cmg-c'+i+'-reste')]]});
  }
  return {titre:'l\'aide CMG des parents', sous: fmtMonth(m),
    bref:'Aide estimée : <b>'+txt('out-cmg-total')+'</b> pour le mois ; reste à payer par les parents : <b>'+txt('out-cmg-reste-total')+'</b>.',
    prise:[['Mois', fmtMonth(m)], ['Ressources mensuelles du foyer', FE(rs)], ['Coût horaire de référence', FE(chr)], ['Plafond horaire', FE(plafH)]],
    etapes:E,
    resultat:[['Coût mensuel de la garde', txt('out-cmg-cout-total')], ['Aide CMG estimée', txt('out-cmg-total')], ['Reste à payer par les parents', txt('out-cmg-reste-total'), true]],
    retenir:['La CAF ou la MSA verse l\'aide aux parents ; elle prend aussi en charge 100 % des cotisations sociales de l\'assistante maternelle.', 'En résidence alternée, chaque parent a sa propre aide, calculée avec ses ressources et ses heures.', 'Seule la CAF ou la MSA fixe le montant exact ; le simulateur de l\'Urssaf permet de vérifier.']};
}

/* ---------- Impôts : abattement ---------- */
function ficheAbattement(){
  const txt = id=>($(id)||{}).textContent||'—', a = abYear(), T = abTauxBase();
  if(txt('out-ab-total-decl')==='—') return null;
  const nb = seg('ab-nbenfants')+1, E = [];
  E.push({t:'Le montant déduit par jour', txt:'Les assistantes maternelles ont un régime spécial : pour chaque jour d\'accueil d\'un enfant, on déduit une somme fixe égale à 3 fois le SMIC horaire du 1er janvier (4 fois pour un enfant handicapé ou en accueil de 24 h). Une journée de moins de 8 h compte au prorata des heures.', calc:[['Abattement pour une journée de 8 h ou plus', FE(T.eff)], ['Par heure pour une journée plus courte (÷ 8)', FE(Math.round(T.eff/8*100)/100)]]});
  for(let i=1;i<=nb;i++){
    if(txt('out-ab-c'+i+'-decl')==='—') continue;
    E.push({t:(val('ab-c'+i+'-nom')||'Enfant '+i)+' : sommes perçues moins l\'abattement', txt:'On additionne ce que vous avez reçu pour cet enfant (salaire net imposable, entretien, repas), puis on retire l\'abattement de tous ses jours d\'accueil. Le résultat ne peut pas être négatif.',
      calc:[['Sommes perçues', txt('out-ab-c'+i+'-sal')], ['Abattement', '− '+txt('out-ab-c'+i+'-abatt')], ['Imposable pour cet enfant', txt('out-ab-c'+i+'-decl')]]});
  }
  E.push({t:'Le régime le plus avantageux', txt:'Le carnet compare avec le régime ordinaire (salaires seuls, sans abattement) et vous indique le plus favorable.', calc:[['Régime spécial', txt('out-ab-total-decl')], ['Régime ordinaire', txt('out-ab-commun')]]});
  return {titre:'l\'abattement fiscal', sous:'revenus '+(a||'—'),
    bref:'Montant imposable à déclarer : <b>'+txt('out-ab-total-decl')+'</b> (case 1AJ), avec <b>'+txt('out-ab-total-abatt')+'</b> d\'abattement (case 1GA).',
    prise:[['Année des revenus', a||'—'], ['Nombre d\'enfants (employeurs)', nb], ['Abattement par jour', FE(T.eff)]],
    etapes:E,
    resultat:[['Total des sommes perçues', txt('out-ab-total-sal')], ['Total de l\'abattement', txt('out-ab-total-abatt')], ['Montant imposable (régime spécial)', txt('out-ab-total-decl'), true], ['Case 1AJ (ou 1BJ)', txt('out-ab-1aj')], ['Case 1GA (ou 1HA)', txt('out-ab-1ga')]],
    retenir:['Le montant pré-rempli par les impôts (salaires Pajemploi) est à <b>corriger</b> en 1AJ, et l\'abattement se reporte obligatoirement en 1GA.', 'Un mois compte pour l\'année où il est payé : décembre payé en janvier va dans l\'année suivante.', 'Les kilomètres remboursés ne s\'ajoutent pas aux sommes perçues.']};
}

/* ---------- Pour les parents ---------- */
function ficheParents(){
  const c = parentsContrat(), ym = val('par-mois') || curMonth(); if(!c) return null;
  const m = moisPourContrat(c, ym); if(!m) return null;
  const an = parseInt(val('par-annee')) || today().getFullYear(), total = m.net+m.ie+m.repas+m.km;
  return {titre:'le récapitulatif pour les parents', sous:(c.enfant||'')+' · '+fmtMonth(ym), origine:ficheOrigine(c, ym),
    bref:'Pour '+fmtMonth(ym)+', vous versez <b>'+FE(total)+'</b> à l\'assistante maternelle et vous déclarez <b>'+(m.hDecl||0)+' h</b> et <b>'+(m.jDecl||0)+' jours</b> sur Pajemploi.',
    etapes:[
      {t:'Ce que vous déclarez sur Pajemploi', txt:'Chaque mois, entre le 25 et le 5, vous déclarez une fois pour chaque enfant : les heures normales (arrondies à l\'heure la plus proche), les jours d\'activité (arrondis au jour supérieur), le salaire net et les indemnités.', calc:[['Heures normales', (m.hDecl||0)+' h'], ['Jours d\'activité', (m.jDecl||0)+' j'], ['Salaire net', FE(m.net)], ['Indemnités d\'entretien', FE(m.ie)], ['Repas', FE(m.repas)]]},
      {t:'Ce que vous versez', txt:'Le salaire net plus les frais (entretien, repas, kilomètres). Avec Pajemploi+, c\'est Pajemploi qui verse le salaire et vous prélève, aide CMG déduite.', calc:[[FE(m.net)+' + '+FE(m.ie)+' + '+FE(m.repas)+' + '+FE(m.km), FE(total)]]},
      {t:'Pour vos impôts (année '+an+')', txt:'Crédit d\'impôt de 50 % des frais de garde d\'un enfant de moins de 6 ans au 1er janvier : salaires nets et entretien versés dans l\'année (sans les repas), moins l\'aide CMG reçue, dans la limite de 3 500 € par enfant (cases 7GA à 7GC ; plafond divisé par deux en résidence alternée).', calc:[['Frais de garde de l\'année (avant aide CMG)', (($('par-annee-out')||{}).textContent.match(/Frais de garde de l’année \(salaire net \+ entretien\)\s*([^\n€]*€)/)||[])[1] || 'voir l\'écran']]}
    ],
    retenir:['L\'aide de la CAF (CMG) vous est versée directement ; les cotisations sociales de l\'assistante maternelle sont prises en charge.', 'Les montants exacts sont ceux de Pajemploi et de votre attestation fiscale.']};
}

/* ---------- boutons « Comprendre ce résultat » ---------- */
const FICHES = {mois:ficheMois, mensu:ficheMensu, ccass:ficheCcass, ie:ficheIe, cp:ficheCp, fin:ficheFin, cmg:ficheCmg, abattement:ficheAbattement, parents:ficheParents};
function ouvrirFiche(theme){
  let f = null;
  try{ f = FICHES[theme] ? FICHES[theme]() : null; }catch(e){ console.error(e); toast('Fiche indisponible pour ce calcul.'); return; }
  ficheOuvrir(f);
}
function ajouterBoutonsFiche(){
  Object.keys(FICHES).forEach(t=>{
    const th = $('theme-'+t); if(!th || th.querySelector('.fiche-btn')) return;
    const stub = th.querySelector('.stub'); if(!stub) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn block fiche-btn';
    b.innerHTML = '🧾 Comprendre ce résultat : fiche explicative (imprimable)';
    b.onclick = ()=>ouvrirFiche(t);
    const head = stub.querySelector('.stub-head'); const body = stub.querySelector('.stub-body');
    // corps recalculé à chaque fois (id) : le bouton va au-dessus du bloc pour ne pas être effacé
    if(body && !body.id) body.insertBefore(b, body.firstChild); else stub.before(b);
  });
}
document.addEventListener('DOMContentLoaded', ajouterBoutonsFiche);
if(document.readyState !== 'loading') setTimeout(ajouterBoutonsFiche, 0);
