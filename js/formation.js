(window.__V=window.__V||{})['formation']='3.29.0';   /* version du fichier : écrite par tools/build.py */
/* =====================================================================
   SE FORMER : les calculs de l'assistante maternelle, du contrat à la fin
   Les chiffres des exemples sont calculés avec la réglementation du jour
   (reg.js) : ils suivent tout seuls chaque mise à jour, sans reprogrammer.
   ===================================================================== */

/* Valeurs du jour et petits outils d'affichage */
function fmVals(){
  const d = today(), r = k=>R(k, d);
  const v = {d, smic:r('smic'), salMin:r('salMin'), salMinTitre:r('salMinTitre'), mg:r('mg'), iePct:r('iePct'), ieRef:r('ieHeuresRef')||9,
    iePlancher:r('iePlancher'), seuil:r('seuilMaj')||45, majMin:r('majMin'), majFerie:r('majFerie'), maj1mai:r('majPremierMai'),
    ratio:netRatio(d), cpMois:r('cpParMois'), cpMax:r('cpMax'), cpDix:r('cpDixieme')||0.10, malEnf:r('absMaladieEnfant'),
    malLongue:r('absMaladieLongue'), adapt:r('adaptationMax'), essai:r('essai')||[3,2], preavis:r('preavis')||[{jours:8},{jours:15},{mois:1}],
    rupDiv:r('ruptureDiviseur'), rupAnc:r('ruptureAnciennete'), abat:r('abatMult'), abatMaj:r('abatMultMaj'), abat24:r('abatMult24'),
    abatH:r('abatHeuresJour')||8, smicJanv:R('smic', new Date(d.getFullYear(), 0, 1)), hMax:r('hMaxSemaine'), cpMal:r('cpMaladie'), cpMalMax:r('cpMaladieMax'), agr:r('agrementMax') };
  v.T = Math.max(4.60, Math.ceil(v.salMin*100)/100);               // tarif horaire de l'exemple
  v.ie9 = ieLegalJour(9, d);                                         // entretien minimum d'une journée de 9 h
  v.ie4 = ieLegalJour(4, d);
  return v;
}
const fmE = n=>fmtEUR(n), fmN = (n, k)=>fmtNum(n, k!==undefined ? k : (Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2));
const fmR2 = n=>Math.round(n*100)/100;
const fmPct = x=>fmtNum(x*100, (x*100)%1 ? 2 : 0)+' %';
function fmCalc(lignes){ return '<div class="fm-calc">'+lignes.map(l=>'<div>'+l+'</div>').join('')+'</div>'; }
function fmPiege(items){ return '<div class="fm-piege"><b>⚠️ Les pièges à éviter</b><ul>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul></div>'; }
function fmRetenir(items){ return '<div class="fm-retenir"><b>📌 À retenir</b><ul>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul></div>'; }
function fmOutil(theme, label){ return '<button class="btn small fm-outil" onclick="'+theme+'">'+label+'</button>'; }

/* Les chapitres : du contrat à la fin du contrat */
function fmChapitres(){
  const v = fmVals(), T = v.T;
  const hC = 36*52/12, sC = hC*T, jC = 4*52/12;
  const hI = 36*36/12, sI = hI*T, jI = 4*36/12;
  const hN50 = 45*52/12, hM50 = 5*52/12, s50 = hN50*T + hM50*T*(1+v.majMin/100);
  const dueAbs = sC*(162-18)/162;
  const ieMois = 17*v.ie9;
  const net = sC*v.ratio;
  const cp10 = 8000*v.cpDix;
  const rup = 16000/v.rupDiv;
  const abatJ = v.abat*v.smicJanv;
  const pv = v.preavis, pTxt = p=>p.mois ? p.mois+' mois' : p.jours+' jours';
  return [
  { id:'bases', titre:'1. Les bases : qui fait quoi', duree:'5 min',
    html: `
      <p>Vous êtes <b>salariée</b> des parents. Chaque famille est un <b>employeur</b> différent, avec son propre contrat, sa propre paie et sa propre fin de contrat. Si vous accueillez 3 enfants de 3 familles, vous avez 3 employeurs.</p>
      <ul>
        <li><b>La convention collective</b> (particulier employeur et emploi à domicile, IDCC 3239) fixe les règles : salaire minimum, congés, absences, fin de contrat. Le Code du travail s'applique pour le reste.</li>
        <li><b>Pajemploi</b> (Urssaf) : chaque mois, les parents y déclarent ce que vous avez fait. Pajemploi calcule les cotisations et, si les parents l'ont choisi, vous verse le salaire (« Pajemploi+ »).</li>
        <li><b>La CAF</b> verse aux parents une aide, le <b>CMG</b>, qui paie une partie de votre salaire.</li>
        <li><b>La PMI</b> (département) délivre votre agrément : nombre d'enfants, âges, horaires.</li>
      </ul>
      <h4>Brut, net, indemnités : trois choses différentes</h4>
      <ul>
        <li><b>Le salaire brut</b> : ce que vous gagnez avant cotisations. Tous les calculs légaux partent du brut.</li>
        <li><b>Le salaire net</b> : ce que vous touchez. Aujourd'hui, le net vaut environ <b>${fmPct(v.ratio)}</b> du brut. Le net exact est toujours celui que calcule Pajemploi.</li>
        <li><b>Les indemnités</b> (entretien, repas, kilomètres) : des remboursements de frais. Elles ne sont pas du salaire : pas de cotisations, pas de congés payés dessus.</li>
      </ul>
      <h4>Les 3 chiffres qui font tout le contrat</h4>
      ${fmCalc(['① les heures d’accueil par semaine (ex. 4 jours × 9 h = <b>36 h</b>)', '② le nombre de semaines d’accueil par an (52 en année complète)', '③ le salaire horaire brut (ex. <b>'+fmE(T)+'</b>, jamais moins que '+fmE(v.salMin)+' par enfant aujourd’hui)'])}
      ${fmRetenir(['Une famille = un employeur = un contrat écrit.', 'On calcule toujours en brut, on paie en net.', 'Les indemnités ne sont pas du salaire.'])}`,
    outil: fmOutil("showTheme('aide')", 'Ouvrir le lexique'),
    quiz:[ {q:'Vous accueillez Léa et son frère Tom (même famille). Combien de contrats ?', c:['Un seul, puisque c’est la même famille','Deux : un par enfant'], ok:1, e:'Un contrat par enfant, même si l’employeur est le même. Le salaire minimum s’apprécie aussi par enfant.'},
           {q:'Les indemnités d’entretien ouvrent-elles droit à des congés payés ?', c:['Oui','Non'], ok:1, e:'Ce sont des remboursements de frais, pas du salaire.'} ] },

  { id:'contrat', titre:'2. Le contrat : année complète ou incomplète ?', duree:'8 min',
    html: `
      <p>C'est le choix le plus important : il change le salaire mensuel, le paiement des congés et la fin du contrat.</p>
      <ul>
        <li><b>Année complète</b> : l'enfant vient <b>toutes les semaines</b>, sauf pendant vos 5 semaines de congés payés. On compte 52 semaines. Vos congés sont déjà <b>compris</b> dans le salaire mensuel.</li>
        <li><b>Année incomplète</b> : l'enfant ne vient pas pendant certaines semaines en plus de vos congés (vacances scolaires des parents, par exemple). On compte <b>seulement les semaines où il vient</b>. Vos congés payés sont payés <b>en plus</b>.</li>
      </ul>
      <p>Astuce : si les parents prennent des vacances qui ne tombent pas pendant vos congés, c'est presque toujours une année incomplète.</p>
      <h4>Ce que le contrat doit contenir</h4>
      <ul>
        <li>Les dates, le planning (jours et heures), le nombre de semaines, le salaire horaire, la majoration au-delà de ${v.seuil} h.</li>
        <li>Les indemnités : entretien, repas (qui fournit ?), kilomètres si vous transportez l'enfant.</li>
        <li>La période d'essai : <b>${v.essai[0]} mois</b> au plus si l'enfant vient 1 à 3 jours par semaine, <b>${v.essai[1]} mois</b> à partir de 4 jours. La période d'adaptation (${v.adapt} jours au plus) en fait partie.</li>
        <li>En année incomplète, comment les congés seront payés (voir chapitre 6).</li>
      </ul>
      <h4>Le salaire horaire</h4>
      <p>Il se négocie librement, mais jamais sous le minimum : <b>${fmE(v.salMin)} brut de l'heure par enfant</b> (${fmE(v.salMinTitre)} avec le titre professionnel AM-AP). Quand le minimum augmente, votre tarif doit être relevé s'il passe en dessous : le carnet le fait tout seul et vous prévient.</p>
      ${fmPiege(['Mettre « année complète » alors que les parents prendront d’autres vacances que les vôtres : les absences ne pourront pas être retirées et le contrat sera faux dès le départ.', 'Compter vos semaines de congés dans les semaines d’accueil d’une année incomplète : elles ne se comptent jamais.', 'Oublier d’écrire qui fournit les repas : c’est ce qui crée le plus de désaccords.', 'Changer d’horaires ou de tarif sans avenant écrit et signé.'])}`,
    outil: fmOutil("goTab('enfants')", 'Ajouter ou modifier un enfant'),
    quiz:[ {q:'L’enfant vient toute l’année sauf 3 semaines de vacances des parents, en dehors de vos congés. C’est :', c:['Une année complète','Une année incomplète'], ok:1, e:'Des semaines sans accueil en plus de vos congés : année incomplète.'},
           {q:'Période d’essai maximale pour un enfant accueilli 4 jours par semaine ?', c:[v.essai[0]+' mois', v.essai[1]+' mois'], ok:1, e:'À partir de 4 jours par semaine, l’essai est plus court.'} ] },

  { id:'mensu', titre:'3. Le salaire mensualisé : le même chaque mois', duree:'10 min',
    html: `
      <p>Le salaire est <b>lissé</b> : on calcule les heures de l'année, puis on les divise par 12. Ainsi, le salaire est le même chaque mois, qu'il y ait 4 ou 5 semaines dans le mois.</p>
      <h4>Exemple 1 : année complète</h4>
      <p>Léa vient 4 jours de 9 h, soit 36 h par semaine, à ${fmE(T)} de l'heure.</p>
      ${fmCalc(['Heures par mois = 36 h × 52 semaines ÷ 12 = <b>'+fmN(hC)+' h</b>', 'Salaire mensuel brut = '+fmN(hC)+' h × '+fmE(T)+' = <b>'+fmE(sC)+'</b>', 'Jours d’activité par mois = 4 jours × 52 ÷ 12 = <b>'+fmN(jC)+'</b> (déclarés '+Math.ceil(jC-1e-9)+' sur Pajemploi, arrondi au-dessus)'])}
      <h4>Exemple 2 : année incomplète</h4>
      <p>Même planning, mais l'enfant vient seulement les 36 semaines de l'année scolaire.</p>
      ${fmCalc(['Heures par mois = 36 h × 36 semaines ÷ 12 = <b>'+fmN(hI)+' h</b>', 'Salaire mensuel brut = '+fmN(hI)+' h × '+fmE(T)+' = <b>'+fmE(sI)+'</b>', 'Jours d’activité = 4 × 36 ÷ 12 = <b>'+fmN(jI)+'</b>', 'Les congés payés s’ajouteront à ce salaire (chapitre 6).'])}
      <h4>Exemple 3 : plus de ${v.seuil} h par semaine</h4>
      <p>Les heures au-delà de ${v.seuil} h par semaine sont <b>majorées</b> d'au moins ${v.majMin} %. Pour 50 h par semaine en année complète :</p>
      ${fmCalc(['Heures normales = '+v.seuil+' h × 52 ÷ 12 = '+fmN(hN50)+' h → '+fmE(hN50*T), 'Heures majorées = 5 h × 52 ÷ 12 = '+fmN(hM50)+' h × '+fmE(T)+' × '+fmN(1+v.majMin/100)+' → '+fmE(hM50*T*(1+v.majMin/100)), 'Salaire mensuel brut = <b>'+fmE(s50)+'</b>'])}
      <h4>Plannings particuliers</h4>
      <ul>
        <li><b>Une semaine sur deux</b> (garde alternée) : on fait la moyenne des deux semaines. Ex. 50 h et 32 h → (50 + 32) ÷ 2 = 41 h en moyenne, puis × semaines ÷ 12.</li>
        <li><b>Planning qui change tout le temps</b> (parents en horaires décalés) : on prévoit le total d'heures de l'année, puis on divise par 12.</li>
        <li><b>Semaines sans accueil pas encore connues</b> : seul le nombre de semaines compte pour le salaire. Les dates serviront plus tard (entretien, régularisation).</li>
      </ul>
      ${fmPiege(['Arrondir les heures mensuelles dans le calcul du salaire : on garde '+fmN(hC)+' h pour payer. Seule la déclaration Pajemploi arrondit (à l’heure la plus proche).', 'Payer « au réel » les mois de 5 semaines : le salaire mensualisé ne bouge pas.', 'Dépasser '+v.hMax+' h par semaine en moyenne : c’est la limite légale.'])}`,
    outil: fmOutil("showTheme('mensu')", 'Calculer un salaire mensualisé'),
    quiz:[ {q:'30 h par semaine, année complète : combien d’heures par mois ?', c:['120 h','130 h','150 h'], ok:1, e:'30 × 52 ÷ 12 = 130 h. Multiplier par 4 oublie les mois de 5 semaines.'},
           {q:'Un mois compte 5 mercredis au lieu de 4. Le salaire mensualisé :', c:['Augmente','Ne change pas'], ok:1, e:'C’est tout l’intérêt de la mensualisation : il est lissé sur l’année.'} ] },

  { id:'mois', titre:'4. La paie du mois : ce qui s’ajoute et ce qui se retire', duree:'15 min',
    html: `
      <p>Chaque mois, on part du salaire mensualisé, puis on ajoute ou on retire seulement ce qui a changé.</p>
      ${fmCalc(['Salaire mensualisé', '− absences qui se retirent (voir chapitre 5)', '+ heures complémentaires et majorées', '+ majoration des jours fériés travaillés', '+ congés payés (si payés ce mois-ci, année incomplète)', '= <b>salaire brut</b> → environ '+fmPct(v.ratio)+' = <b>salaire net</b>', '+ indemnités d’entretien, repas, kilomètres', '= <b>total à verser</b>'])}
      <h4>Les heures en plus</h4>
      <ul>
        <li><b>Heures complémentaires</b> : faites en plus du planning, jusqu'à ${v.seuil} h dans la semaine. Payées au tarif normal.</li>
        <li><b>Heures majorées</b> : toutes les heures faites au-delà de ${v.seuil} h dans la semaine. Payées au moins ${v.majMin} % de plus.</li>
        <li>Une absence un autre jour ne « compense » pas des heures en plus : on ne fait pas la différence.</li>
      </ul>
      <p>Exemple : contrat de 36 h, semaine réelle de 54 h → 18 h en plus, dont <b>9 h complémentaires</b> (de 36 à 45 h) et <b>9 h majorées</b> (de 45 à 54 h).</p>
      <h4>Les indemnités d'entretien</h4>
      <p>Elles couvrent les jouets, le chauffage, l'eau… Elles sont dues <b>seulement les jours où l'enfant est là</b>, jamais pendant les absences ni les congés.</p>
      ${fmCalc(['Minimum pour une journée de '+v.ieRef+' h = '+fmPct(v.iePct)+' du minimum garanti ('+fmE(v.mg)+') = <b>'+fmE(v.ie9)+'</b> (arrondi au centime supérieur)', 'Journée plus courte : au prorata, mais jamais moins de '+fmE(v.iePlancher)+' (ex. 4 h → '+fmE(v.ie4)+')', 'Total du mois = somme des journées de présence (ex. 17 jours de 9 h → '+fmE(ieMois)+')'])}
      <h4>Les repas</h4>
      <p>Si vous fournissez les repas, le prix prévu au contrat est dû pour chaque repas donné. Pas de repas les jours d'absence.</p>
      <h4>Les jours fériés</h4>
      <ul>
        <li><b>Chômé</b> (le cas habituel) : payé normalement, rien à retirer, pas d'entretien. Il faut que l'enfant soit venu (ou ait eu une absence autorisée) le jour d'accueil prévu juste avant et juste après.</li>
        <li><b>Travaillé</b> (seulement si c'est prévu ou accepté) : majoré de ${v.majFerie} % (${v.maj1mai} % le 1er mai, qui est toujours chômé sauf accord).</li>
      </ul>
      <h4>Le net, et ce que les parents déclarent sur Pajemploi</h4>
      <ul>
        <li>Le nombre d'<b>heures normales</b> (arrondi à l'heure la plus proche), les <b>jours d'activité</b> (arrondis au-dessus), le salaire net, les heures complémentaires et majorées (sans arrondi), les indemnités d'entretien.</li>
        <li>Les parents déclarent avant le <b>5 du mois suivant</b>. C'est à eux de le faire, pas à vous : envoyez-leur le récapitulatif.</li>
        <li>Exemple : ${fmE(sC)} brut → environ <b>${fmE(net)} net</b>.</li>
      </ul>
      ${fmPiege(['Payer l’entretien les jours d’absence ou de congés.', 'Compter des heures en plus « en moins » d’une absence.', 'Arrondir les heures complémentaires : elles se déclarent à la minute près (ex. 1,5 h).', 'Oublier qu’un jour férié chômé est payé : on ne le retire jamais du salaire.'])}`,
    outil: fmOutil("showTheme('mois')", 'Calculer le salaire du mois'),
    quiz:[ {q:'Contrat de 40 h. Cette semaine : 48 h. Combien d’heures majorées ?', c:['8 h','3 h','0 h'], ok:1, e:'5 h complémentaires (40 → 45 h) et 3 h majorées (45 → 48 h).'},
           {q:'L’enfant est absent 2 jours (vacances des parents, année complète). L’entretien de ces 2 jours :', c:['Est dû','N’est pas dû'], ok:1, e:'L’entretien n’est dû que les jours de présence. Le salaire, lui, reste dû en année complète.'} ] },

  { id:'absences', titre:'5. Les absences : retirer ou payer ?', duree:'12 min',
    html: `
      <p>C'est la question qui pose le plus de soucis. La règle générale : <b>une absence voulue par les parents est payée</b>. Seules quelques absences se retirent.</p>
      <table class="fm-table">
        <tr><th>Situation</th><th>Salaire</th><th>Entre&shy;tien</th></tr>
        <tr><td>Vacances ou absence voulue par les parents (en dehors des semaines sans accueil prévues)</td><td>Payé</td><td>Non</td></tr>
        <tr><td>Enfant malade avec certificat médical</td><td>Retiré, ${v.malEnf} jours au plus par période de 12 mois ; au-delà, payé</td><td>Non</td></tr>
        <tr><td>Enfant hospitalisé, ou malade ${v.malLongue} jours d'affilée ou plus (certificat)</td><td>Retiré</td><td>Non</td></tr>
        <tr><td>Enfant malade sans certificat</td><td>Payé</td><td>Non</td></tr>
        <tr><td>Votre arrêt maladie</td><td>Retiré (la Sécurité sociale vous indemnise)</td><td>Non</td></tr>
        <tr><td>Vos congés payés</td><td>Selon le chapitre 6</td><td>Non</td></tr>
        <tr><td>Vous fermez (convenance personnelle, hors congés)</td><td>Retiré, avec l'accord des parents</td><td>Non</td></tr>
        <tr><td>Événement familial (mariage, naissance, décès…)</td><td>Payé (jours prévus par la loi)</td><td>Non</td></tr>
        <tr><td>Jour férié chômé</td><td>Payé</td><td>Non</td></tr>
      </table>
      <h4>Comment on retire une absence : la méthode de la Cour de cassation</h4>
      <p>On ne retire pas « un jour de salaire ». On retire la <b>part des heures prévues ce mois-là</b> qui n'ont pas été faites :</p>
      ${fmCalc(['Salaire du mois × (heures prévues ce mois − heures d’absence) ÷ heures prévues ce mois', 'Exemple : 18 jours de 9 h prévus = 162 h ; 2 jours d’absence = 18 h', fmE(sC)+' × (162 − 18) ÷ 162 = <b>'+fmE(dueAbs)+'</b>'])}
      <p>Les heures prévues sont celles du <b>calendrier réel du mois</b> (pas les ${fmN(hC)} h mensualisées). C'est la même méthode pour un contrat qui commence ou qui finit en cours de mois, y compris le premier mois d'adaptation.</p>
      ${fmPiege(['Retirer une absence pour enfant malade sans certificat, ou au-delà de '+v.malEnf+' jours dans la période de 12 mois.', 'Retirer « 1/30e » ou « 1/20e » du salaire par jour : ce n’est pas la bonne méthode.', 'Retirer les vacances des parents en année complète : elles sont payées.', 'Oublier qu’un enfant renvoyé chez lui malade en cours de journée reste payé pour la journée.'])}`,
    outil: fmOutil("showTheme('ccass')", 'Calculer un mois incomplet'),
    quiz:[ {q:'L’enfant a de la fièvre, pas de certificat, il reste 1 jour chez lui. Le salaire :', c:['Se retire','Est payé'], ok:1, e:'Sans certificat médical, l’absence est payée.'},
           {q:'Pour retirer 9 h d’absence, on utilise :', c:['Les heures mensualisées','Les heures prévues dans le calendrier du mois'], ok:1, e:'Méthode de la Cour de cassation : heures réellement prévues ce mois-là.'} ] },

  { id:'cp', titre:'6. Les congés payés : acquérir, prendre, payer', duree:'15 min',
    html: `
      <h4>Acquérir</h4>
      <ul>
        <li>La période de référence va du <b>1er juin au 31 mai</b>.</li>
        <li>Vous gagnez <b>${fmN(v.cpMois, 1)} jours ouvrables</b> par mois (ou par 4 semaines) d'accueil, <b>${v.cpMax} jours</b> au plus (5 semaines). Les jours ouvrables vont du lundi au samedi : une semaine de congés = 6 jours.</li>
        <li>Votre arrêt maladie ordinaire ouvre aussi droit à ${v.cpMal} jours par mois (${v.cpMalMax} au plus par an).</li>
        <li>On arrondit le total au jour supérieur.</li>
      </ul>
      <h4>Prendre</h4>
      <p>Vous fixez vos dates de congés, en essayant de vous accorder avec toutes vos familles. Prévenez tôt (avant le 1er mars pour l'été est une bonne habitude).</p>
      <h4>Payer : on compare deux méthodes et on garde la plus favorable</h4>
      ${fmCalc(['<b>Maintien de salaire</b> : ce que vous auriez gagné si vous aviez travaillé pendant ces jours.', '<b>Dixième</b> : '+fmPct(v.cpDix)+' des salaires bruts de la période de référence (ex. 8 000 € de salaires → '+fmE(cp10)+' pour l’ensemble des congés).', 'Le carnet calcule les deux et retient la plus haute.'])}
      <ul>
        <li><b>Année complète</b> : vos congés sont déjà payés dans le salaire mensualisé (c'est le maintien). En juin, on compare avec le dixième : si le dixième est plus élevé, la différence est versée en plus.</li>
        <li><b>Année incomplète</b> : les congés sont payés <b>en plus</b>, selon ce qui est écrit au contrat : un peu chaque mois (${fmPct(v.cpDix)} du salaire brut du mois, versés avec lui ; en juin, si le maintien de salaire donne plus, la différence est versée), en une fois en juin, ou au moment où vous les prenez.</li>
      </ul>
      <p>Un jour férié chômé qui tombe pendant vos congés, un jour où l'enfant serait venu, ne compte pas comme jour de congé : une semaine de congés avec un jour férié compte 5 jours au lieu de 6.</p>
      ${fmPiege(['Prendre plus de congés que ceux déjà acquis (souvent la première année) : les jours en plus sont un congé sans solde, retiré du salaire, sauf accord écrit des parents. Le carnet vous prévient.', 'En année incomplète, ne jamais payer les congés : ils sont dus en plus du salaire mensualisé.', 'Compter les congés en jours ouvrés (lundi-vendredi) au lieu de jours ouvrables (lundi-samedi).', 'Payer l’entretien pendant les congés.', 'Oublier la comparaison du mois de juin en année complète.'])}`,
    outil: fmOutil("showTheme('cp')", 'Calculer les congés payés'),
    quiz:[ {q:'Du 1er juin au 31 mai, accueil toute l’année : combien de jours acquis ?', c:['25 jours','30 jours'], ok:1, e:'12 mois × '+fmN(v.cpMois,1)+' = 30 jours ouvrables (5 semaines).'},
           {q:'Année incomplète, paiement « à la prise ». Vous prenez 6 jours en août :', c:['Rien à payer, c’est inclus','On paie ces 6 jours en plus du salaire'], ok:1, e:'En année incomplète, les congés s’ajoutent au salaire mensualisé.'} ] },

  { id:'vie', titre:'7. Pendant le contrat : avenants, aides, impôts', duree:'10 min',
    html: `
      <h4>L'avenant</h4>
      <p>Tout changement durable (horaires, jours, tarif, nombre de semaines) se fait par un <b>avenant écrit, daté et signé</b>. Le nouveau salaire s'applique à partir de sa date. Un mois coupé en deux se calcule au prorata des jours de chaque partie.</p>
      <h4>L'aide CMG des parents</h4>
      <p>La CAF paie une partie du coût de la garde. Depuis 2025, elle dépend des revenus des parents et des heures d'accueil. Elle est versée aux parents, pas à vous : le carnet leur montre une estimation du reste à payer.</p>
      <h4>Vos impôts : l'abattement</h4>
      <p>Les assistantes maternelles ont un calcul spécial, souvent plus avantageux :</p>
      ${fmCalc(['Revenu imposable = salaires nets imposables + indemnités (entretien, repas) − <b>abattement</b>', 'Abattement = '+v.abat+' × SMIC horaire du 1er janvier ('+fmE(v.smicJanv)+') = '+fmE(abatJ)+' par jour et par enfant ('+v.abatMaj+' × SMIC pour un enfant handicapé, malade ou inadapté ; '+v.abat24+' × pour un accueil continu de 24 h ; 5 × si les deux)', 'Une journée de moins de '+v.abatH+' h compte au prorata des heures', 'Si l’abattement dépasse ce que vous avez touché, le résultat est 0 € (jamais négatif)'])}
      <p>On compare avec le montant pré-rempli par les impôts : le carnet vous dit lequel choisir, enfant par enfant.</p>
      ${fmPiege(['Changer les horaires « à l’oral » : sans avenant, c’est l’ancien contrat qui compte.', 'Oublier d’ajouter les indemnités avant de retirer l’abattement.', 'Utiliser le SMIC du jour pour l’abattement : c’est celui du 1er janvier de l’année des revenus.'])}`,
    outil: fmOutil("showTheme('abattement')", 'Calculer mon abattement'),
    quiz:[ {q:'Les parents veulent passer de 4 à 3 jours par semaine. Il faut :', c:['Le noter dans le suivi','Signer un avenant'], ok:1, e:'Un changement durable du contrat se fait toujours par avenant.'},
           {q:'Le CMG est versé :', c:['À l’assistante maternelle','Aux parents'], ok:1, e:'C’est une aide de la CAF aux parents.'} ] },

  { id:'fin', titre:'8. La fin du contrat', duree:'15 min',
    html: `
      <h4>Qui y met fin ?</h4>
      <ul>
        <li><b>Les parents</b> retirent l'enfant (lettre recommandée ou remise en main propre). Ils n'ont pas à donner de raison.</li>
        <li><b>Vous</b> démissionnez (même forme). Pas d'indemnité de rupture.</li>
        <li><b>Pendant l'essai</b> : chacun peut arrêter, sans préavis ni indemnité.</li>
        <li><b>Suspension ou retrait de votre agrément</b> : fin sans préavis ni indemnité de rupture.</li>
        <li><b>Faute grave</b> : pas de préavis ni d'indemnité de rupture, mais les parents doivent pouvoir la prouver.</li>
      </ul>
      <h4>Le préavis</h4>
      ${fmCalc(['Moins de 3 mois d’ancienneté : <b>'+pTxt(pv[0])+'</b>', 'De 3 mois à moins d’1 an : <b>'+pTxt(pv[1])+'</b>', '1 an et plus : <b>'+pTxt(pv[2])+'</b>', 'Il commence le jour où la lettre est présentée ou remise. S’il n’est pas fait à la demande des parents, il est quand même payé.'])}
      <h4>Le solde de tout compte : ce qui est dû à la fin</h4>
      <ol>
        <li><b>Le dernier salaire</b>, au prorata si le dernier mois est incomplet (méthode du chapitre 5).</li>
        <li><b>Les congés payés non pris</b> : payés en indemnité (la plus favorable entre maintien et dixième).</li>
        <li><b>La régularisation</b> (année incomplète, ou contrat qui a changé en cours de route) : on compare ce qui a été payé avec ce qui aurait dû l'être pour les heures vraiment prévues et faites. Si vous avez été payée moins, les parents vous doivent la différence. S'ils ont payé plus, ce trop-perçu n'est pas retiré d'office du solde de tout compte.</li>
        <li><b>L'indemnité de rupture</b> (retrait de l'enfant par les parents, à partir de <b>${v.rupAnc} mois</b> d'ancienneté) : <b>1/${v.rupDiv}</b> du total des salaires bruts de tout le contrat. Ex. 16 000 € de salaires → ${fmE(rup)}. Elle n'est pas imposable dans la limite légale.</li>
        <li><b>L'entretien</b> des derniers jours de présence.</li>
      </ol>
      <h4>Les documents à remettre le dernier jour</h4>
      <ul>
        <li>Le <b>certificat de travail</b>.</li>
        <li>L'<b>attestation France Travail</b> (Pôle emploi), faite par les parents sur Pajemploi.</li>
        <li>Le <b>reçu pour solde de tout compte</b>.</li>
      </ul>
      ${fmPiege(['Calculer le préavis à partir de la date d’envoi de la lettre au lieu de sa présentation.', 'Oublier les congés payés non pris : ils sont toujours dus, même en cas de faute grave.', 'Oublier la régularisation en année incomplète.', 'Calculer l’indemnité de rupture sur le net ou avec les indemnités d’entretien : c’est le total des salaires bruts.', 'Partir sans le certificat de travail ni l’attestation France Travail : sans eux, l’inscription au chômage est bloquée.'])}`,
    outil: fmOutil("showTheme('fin')", 'Calculer une fin de contrat'),
    quiz:[ {q:'Le contrat a 10 mois, les parents retirent l’enfant. Préavis ?', c:[pTxt(pv[0]), pTxt(pv[1]), pTxt(pv[2])], ok:1, e:'De 3 mois à moins d’1 an : '+pTxt(pv[1])+'.'},
           {q:'Vous démissionnez après 2 ans. L’indemnité de rupture :', c:['Est due','N’est pas due'], ok:1, e:'Elle n’est due que si ce sont les parents qui retirent l’enfant.'} ] },

  { id:'routine', titre:'9. Ma routine du mois avec le carnet', duree:'5 min',
    html: `
      <ol>
        <li><b>Au jour le jour</b> (facultatif) : dans l'onglet Aujourd'hui, touchez « Conforme » ou notez ce qui change (absence, heures en plus). Sans suivi, notez au moins vos congés et les semaines sans accueil dans Réglages.</li>
        <li><b>En fin de mois</b> : onglet Mois → vérifiez les chiffres, corrigez seulement ce qui a changé, puis « Valider ce mois ».</li>
        <li><b>Envoyez le récapitulatif</b> aux parents (SMS ou mail) : ils y trouvent ce qu'ils doivent recopier sur Pajemploi.</li>
        <li><b>Le salaire reçu</b>, notez-le : cela sert aux congés, aux impôts et à la fin du contrat.</li>
        <li><b>Une fois par an</b> : en juin les congés, au printemps les impôts, et une copie de sécurité de vos données.</li>
      </ol>
      ${fmRetenir(['Chaque calcul du carnet a un bouton « Comprendre ce résultat » qui explique les chiffres.', 'Le bouton « Mettre à jour la réglementation » garde les taux à jour, sans rien recalculer vous-même.', 'En cas de doute sur un cas particulier : Pajemploi, le relais petite enfance (RPE) ou la convention collective.'])}`,
    outil: fmOutil("goTab('mois')", 'Ouvrir l’onglet Mois'),
    quiz:[ {q:'Qui déclare le salaire sur Pajemploi ?', c:['L’assistante maternelle','Les parents'], ok:1, e:'Ce sont les parents employeurs qui déclarent, avant le 5 du mois suivant.'} ] },
  ];
}

/* Ouvrir la formation sur un chapitre (lien depuis un autre écran) */
function fmOuvrir(id){
  showTheme('formation');
  setTimeout(()=>{ const d = $('fm-'+id); if(!d) return; document.querySelectorAll('.fm-chap').forEach(x=>{ if(x!==d) x.open = false; }); d.open = true; d.scrollIntoView({block:'start'}); }, 60);
}
/* Affichage */
function fmProgress(){ STATE.formation = STATE.formation || {lu:{}}; return STATE.formation; }
function renderFormation(){
  const ch = fmChapitres(), P = fmProgress(), nLu = ch.filter(c=>P.lu[c.id]).length;
  const h = '<div class="fm-head"><div class="fm-bar"><span style="width:'+Math.round(nLu*100/ch.length)+'%"></span></div><div class="hint">'+nLu+' chapitre(s) sur '+ch.length+' terminé(s). Les chiffres des exemples utilisent la réglementation en vigueur aujourd’hui ('+fmtDate(iso(today()))+').</div>'
    + '<div class="btn-row" style="margin-top:6px"><button class="btn small" onclick="fmImprimer()">🖨️ Imprimer toute la formation</button></div></div>'
    + ch.map((c, i)=>'<details class="help fm-chap" id="fm-'+c.id+'"'+(i===0 && !nLu ? ' open' : '')+'><summary>'+(P.lu[c.id] ? '✅ ' : '')+esc(c.titre)+' <span class="hint">· '+c.duree+'</span></summary><div>'
      + c.html
      + '<div class="btn-row">'+c.outil+'</div>'
      + '<div class="fm-quiz"><b>🧠 Vérifiez que vous avez compris</b>'+c.quiz.map((q, j)=>'<div class="fm-q" id="fmq-'+c.id+'-'+j+'"><p>'+esc(q.q)+'</p><div class="fm-choix">'
          + fmOrdre(q.c.length, i+j).map(k=>'<button class="btn small" data-k="'+k+'" onclick="fmRepondre(\''+c.id+'\','+j+','+k+')">'+esc(q.c[k])+'</button>').join('')+'</div><div class="fm-rep hint" aria-live="polite"></div></div>').join('')+'</div>'
      + '<div class="btn-row"><button class="btn primary small" onclick="fmLu(\''+c.id+'\')">'+(P.lu[c.id] ? '✓ Chapitre terminé' : 'J’ai terminé ce chapitre')+'</button></div>'
      + '</div></details>').join('');
  setHTML('formation-content', h);
}
/* ordre d'affichage des réponses : il varie d'une question à l'autre (la bonne réponse n'est pas toujours au même endroit) */
function fmOrdre(n, graine){ const o = [...Array(n).keys()], r = graine % n; return o.slice(r).concat(o.slice(0, r)); }
function fmRepondre(cid, j, k){
  const c = fmChapitres().find(x=>x.id===cid), q = c && c.quiz[j], box = $('fmq-'+cid+'-'+j); if(!q || !box) return;
  box.querySelectorAll('.fm-choix button').forEach(b=>{ const i = +b.dataset.k; b.classList.toggle('fm-ok', i===q.ok); b.classList.toggle('fm-ko', i===k && k!==q.ok); });
  box.querySelector('.fm-rep').innerHTML = (k===q.ok ? '✔ Bonne réponse. ' : '✘ Pas tout à fait. ')+esc(q.e);
}
function fmLu(cid){
  const P = fmProgress(); P.lu[cid] = !P.lu[cid]; saveState();
  const open = [...document.querySelectorAll('.fm-chap[open]')].map(d=>d.id);
  renderFormation(); open.forEach(id=>{ const e = $(id); if(e) e.open = true; });
}
function fmImprimer(){
  const ch = fmChapitres();
  doPrint('<h1>Se former : les calculs de l’assistante maternelle</h1><p>Chiffres calculés avec la réglementation en vigueur le '+fmtDate(iso(today()))+'.</p>'
    + ch.map(c=>'<section class="fm-print"><h2>'+esc(c.titre)+'</h2>'+c.html
      + '<h3>Vérifiez que vous avez compris</h3><ol>'+c.quiz.map(q=>'<li>'+esc(q.q)+'<br><i>Réponse : '+esc(q.c[q.ok])+'. '+esc(q.e)+'</i></li>').join('')+'</ol></section>').join(''));
}
