# Brief — Présentation publique BUUPP (PowerPoint interactif)

> **Pour Claude :** ce document est un brief de production. À partir de son contenu, tu dois générer un fichier `.pptx` complet, prêt à être ouvert dans PowerPoint / Keynote / Google Slides. Utilise `python-pptx` (ou équivalent). Le résultat doit ressembler à un vrai pitch deck professionnel — pas un Word habillé.

---

## 1. Le projet, en deux phrases

BUUPP est la **première plateforme qui rémunère les particuliers (« prospects ») pour qu'ils acceptent de partager leurs données personnelles** avec des entreprises, en respectant strictement le RGPD. C'est un **échange équitable** : les entreprises obtiennent enfin des données fiables, fraîches et consenties pour leurs opérations marketing — les prospects sont **payés en cash** pour la valeur qu'ils créent en partageant leurs informations.

Baseline officielle : **« Be Used · Paid & Proud »**

---

## 2. Audience et ton de la présentation

- **À qui** : entourage de l'auteur (famille, amis, premier cercle) — **personnes de 25 à 55 ans**, non techniques.
- **But** : faire comprendre l'idée innovante et donner envie d'y croire. Pas vendre, **convaincre**.
- **Ton** : clair, chaleureux, légèrement audacieux, **zéro jargon technique**. On parle de gens réels, d'argent réel, de leur vie quotidienne.
- **Format** : **12 slides max** (cible : 12 ; minimum acceptable : 10 ; plafond : 15). Une idée par slide.
- **Durée à l'oral** : ~8-10 min de pitch.

---

## 3. Identité visuelle à reproduire fidèlement

### Palette de couleurs (BUUPP brand)

| Token | Hex | Usage |
|---|---|---|
| `--ivory` | **#F7F4EC** | Fond principal des slides (papier crème, pas blanc pur) |
| `--paper` | **#FBF9F3** | Fond des cartes / blocs surélevés |
| `--ivory-2` | **#F1EDE2** | Fond de sections alternées |
| `--ink` | **#0F172A` | Texte principal (noir bleuté très foncé, jamais `#000000`) |
| `--ink-3` | **#334155** | Texte secondaire |
| `--ink-4` | **#64748B** | Texte tertiaire / labels mono caps |
| `--accent` | **#4F46E5** | Accent principal indigo (CTA, chiffres clés, em) |
| `--accent-ink` | **#3730A3** | Hover / variante foncée de l'accent |
| `--accent-soft` | **#EEF2FF** | Fond pâle accent (badges, callouts) |
| `--good` | **#15803D** | Vert : succès, ✓ |
| `--danger` | **#B91C1C** | Rouge : alerte, suppression |

### Typographies (à utiliser à 100 %)

- **Titres et accents : Fraunces** (Google Font, serif) — `font-weight: 400`, `letter-spacing: -0.02em`. Si Fraunces n'est pas installé, fallback : *Cormorant Garamond* puis *Georgia*.
- **Texte courant : DM Sans** (Google Font) — `font-weight: 400`. Fallback : *Inter*, puis sans-serif système.
- **Chiffres, codes, labels en MAJUSCULES : JetBrains Mono** — `letter-spacing: 0.14em`, `text-transform: uppercase`, `font-size` ~10-11px. Fallback : `ui-monospace`.

### Codes visuels signatures

- Les mots en *italique* dans les titres sont **toujours en accent indigo** (Fraunces italic, color `--accent`). Exemple : *« Cinq paliers. Un prix par donnée. »* → « Un prix par donnée » en italique indigo.
- **Eyebrow** au-dessus des titres : petit label monospace en MAJUSCULES, lettré (tracking 0.14em), couleur `--ink-4`, ~11 px. Exemple : `— LA PROMESSE BUUPP`.
- **Confetti header** (signature mail/landing) : 4 formes décoratives sur 1 ligne — un cercle bleu (#4596EC), un losange violet (#7C3AED) à 45°, un triangle ambre (#F59E0B), un cercle vert (#10B981). Petits (~10-14 px). À reprendre sur la slide de titre et la slide de fin.
- **Cartes** : `background: #FBF9F3`, `border: 1px solid #EAE3D0`, `border-radius: 16-18px`, `box-shadow: 0 4px 24px -8px rgba(15,22,41,.08)`. Padding intérieur 24-32 px.
- **Boutons / chips d'accent** : pilule arrondie 999px, fond linear-gradient `135deg, #4F46E5 → #6D5BFF`, texte blanc, font-weight 600.
- **Filets pointillés et tirets** comme séparateurs (`• ● ●`), couleur `--ink-5`.

---

## 4. Architecture de la présentation — 12 slides

> Pour chaque slide : titre, eyebrow, contenu, élément visuel, suggestion d'interaction. Les screenshots à intégrer sont décrits en section 5.

### Slide 1 — Couverture
- **Eyebrow** : `— BUUPP · BE USED · PAID & PROUD`
- **Titre** (Fraunces géant, ~64 pt) : Vos données ont *une valeur*. Et si elles vous **rappor­taient** ?
- **Sous-titre** (DM Sans, ~18 pt, --ink-3) : La première plateforme française où les particuliers sont payés pour partager leurs données — et où les entreprises obtiennent enfin des données vraies, consenties, et qualifiées.
- **Visuel** : logo BUUPP centré + ligne confetti 4 formes sous le titre.
- **Footer slide** : nom de l'auteur, date du jour, mention « Pitch interne ».
- **Interaction** : transition fade vers slide 2 ; clic « Démarrer » optionnel.

### Slide 2 — Le constat
- **Eyebrow** : `— LE PROBLÈME QU'ON CONNAÎT TOUS`
- **Titre** : Aujourd'hui, vos données *travaillent pour les autres.*
- **Trois cartes en row** (chacune : pictogramme + chiffre + phrase) :
  1. **150 milliards €** — marché mondial de la donnée personnelle en 2024.
  2. **0 €** — ce que les particuliers en touchent.
  3. **74 %** — des Français se sentent « surveillés » sans contrepartie (étude CNIL 2024).
- **Punchline en bas** (Fraunces, italic accent) : *« On échange tous nos données contre des services gratuits. Et si la gratuité n'était plus suffisante ? »*

### Slide 3 — L'idée BUUPP
- **Eyebrow** : `— L'IDÉE`
- **Titre** : Un *échange équitable*, enfin.
- **Schéma central** (à dessiner) :
  - À gauche : un visage stylisé « Prospect » + flèche « partage volontairement ses données ».
  - Au milieu : logo BUUPP encadré (le tiers de confiance).
  - À droite : icône immeuble « Pro / Entreprise » + flèche « rémunère ».
  - **Flèche verte du milieu vers la gauche** : « rémunération directe ».
- **Sous le schéma** : trois phrases courtes en colonnes :
  - « Le prospect choisit ce qu'il partage. »
  - « L'entreprise paie pour ce dont elle a besoin. »
  - « BUUPP garantit le consentement et la conformité. »

### Slide 4 — Côté prospect : ce qu'on gagne
- **Eyebrow** : `— POUR VOUS, PARTICULIER`
- **Titre** : Vous êtes payé, *vraiment*.
- **3 cartes** (style carte BUUPP) :
  1. **💶 De 5 à 80 € par mise en relation acceptée** — selon le palier de données partagées (ex. seulement votre code postal = quelques €, profil complet vérifié = jusqu'à 80 €).
  2. **🔕 Aucun spam, aucune relance** — vous n'êtes contacté qu'**après votre acceptation explicite**. Vous gardez la main à 100 %.
  3. **🔐 Données chiffrées et cloisonnées** — BUUPP ne revend rien, ne stocke que le strict nécessaire, et vous pouvez tout effacer en un clic.
- **Screenshot** : capture de l'onglet « Mises en relation » côté prospect (une carte avec récompense visible). Voir section 5.

### Slide 5 — Côté pro : pourquoi c'est différent
- **Eyebrow** : `— POUR LES ENTREPRISES`
- **Titre** : Des données *vraies*, *fraîches*, et *qualifiées*.
- **Tableau 3 colonnes (comparatif)** :

  | | Achat de fichiers classiques | Pubs Google / Meta | **BUUPP** |
  |---|---|---|---|
  | Consentement | Approximatif | Implicite cookies | **Double, horodaté** |
  | Fraîcheur des données | 6-24 mois | Pas accessible | **Mis à jour en temps réel** |
  | Qualité | Variable | Anonyme | **Profils vérifiés par paliers** |
  | Coût | Forfait à l'aveugle | Au clic, pas au prospect | **Au prospect réellement intéressé** |
  | RGPD | Risque élevé | Risque modéré | **Conforme par design** |

- En bas, callout : *« Vous ne payez que pour les prospects qui ont dit oui. »*

### Slide 6 — Deux cas d'usage emblématiques (côté pro)
- **Eyebrow** : `— CONCRÈTEMENT, ÇA SERT À QUI ?`
- **Titre** : *Du petit commerce à la grande marque.*
- **Deux blocs côte à côte** :
  - **🏪 Le commerçant local** (boulanger, garage, coach sportif…)
    *« Je viens d'ouvrir. J'ai besoin de 30 clients dans un rayon de 5 km. Avec BUUPP, j'envoie une offre ciblée, je paie 8 € par accord, et j'ai 30 vrais contacts qui m'attendent en moins d'une semaine. »*
  - **🏢 La grande marque**
    *« Je lance une campagne nationale. Je cible 500 profils ultra-qualifiés (palier 4-5, âge, revenu, intérêt produit). BUUPP me les délivre avec consentement signé, prêts à recevoir mon offre. »*
- Screenshot illustratif : interface de création de campagne pro (encart à côté des deux blocs). Voir section 5.

### Slide 7 — Le principe des 5 paliers
- **Eyebrow** : `— LE CŒUR TECHNIQUE, EXPLIQUÉ SIMPLEMENT`
- **Titre** : Cinq paliers. *Un prix par donnée.*
- **Visuel central** : 5 disques empilés horizontalement, chacun avec son label + montant indicatif (de 5 € à 80 €).
  - Palier 1 — *Identification de base* (prénom, code postal)
  - Palier 2 — *Localisation détaillée + tranche d'âge*
  - Palier 3 — *Style de vie* (mobilité, animaux, habitat)
  - Palier 4 — *Profession et revenus*
  - Palier 5 — *Patrimoine et projets*
- **Phrase pied de slide** : « Chaque palier est **cloisonné** : un pro qui achète un palier 2 ne voit jamais le palier 5. C'est la **minimisation des données** exigée par le RGPD. »
- **Screenshot** : page `/bareme` ou `/minimisation` montrant la matrice. Voir section 5.

### Slide 8 — RGPD-by-design (le sérieux)
- **Eyebrow** : `— LE SÉRIEUX QU'ON EXIGE DE NOUS`
- **Titre** : *Aucune zone grise.*
- **4 piliers en carrés alignés** (icône + phrase courte) :
  1. **🤝 Double consentement** — prospect ET pro doivent dire « oui » avant tout échange. Horodaté, archivé, vérifiable.
  2. **📐 Minimisation des données** — chaque finalité (prise de RDV, étude, opération promo…) débloque **uniquement** les paliers de données strictement nécessaires. Aucun « pack tout inclus ».
  3. **👁 CNIL & pixels** — BUUPP applique les dernières recommandations CNIL (notamment sur les pixels de tracking email) : **consentement explicite obligatoire** avant toute mesure.
  4. **🗑 Droit à l'effacement en 1 clic** — le prospect peut tout effacer instantanément. Aucune copie cachée, aucune rétention indue.
- **Phrase pied** : « BUUPP n'est pas un projet "RGPD-compatible". C'est un projet **né du RGPD**. »

### Slide 9 — La promesse de sécurité
- **Eyebrow** : `— LA TRANQUILLITÉ`
- **Titre** : Vos données sont *à vous*. Et bien gardées.
- **3 colonnes** :
  - **🔒 Chiffrement** — toutes les données sensibles sont chiffrées au repos et en transit. Personne chez BUUPP ne peut lire votre IBAN ou votre n° de téléphone en clair.
  - **🚧 Cloisonnement strict** — accès par palier uniquement, aucun pro ne voit ce qui n'a pas été acheté.
  - **🛡 Hébergement européen** — serveurs en France (Vercel + Supabase EU), zéro export hors UE.
- En bas, mention discrète : *« BUUPP SAS · RCS Paris 908 214 009 · Agréé intermédiaire en opérations de banque »*.

### Slide 10 — L'expérience prospect en 3 étapes
- **Eyebrow** : `— COMMENT ON UTILISE BUUPP, CÔTÉ PROSPECT`
- **Titre** : *Trois étapes. C'est tout.*
- **Timeline horizontale 3 points** :
  1. **Je crée mon profil par paliers** — je remplis seulement ce que je suis prêt à partager.
  2. **Je reçois des propositions** — je vois le pro, l'offre, la rémunération. Je dis oui ou non.
  3. **Je suis payé** — virement IBAN, carte cadeau, ou don à une association.
- **Screenshot** : aperçu d'une notification de mise en relation reçue (carte pending). Voir section 5.

### Slide 11 — Et pour vous, demain ?
- **Eyebrow** : `— L'IMPACT SI ON RÉUSSIT`
- **Titre** : Un nouveau *contrat numérique*.
- **Phrase narrative centrée** (Fraunces 28 pt, max 4 lignes) :
  > Si BUUPP devient le standard, un Français moyen pourrait gagner **600 à 1 200 € par an** rien qu'en partageant volontairement ses données. Les entreprises, elles, dépenseraient **moitié moins** pour des résultats **deux fois meilleurs**. Et nos données arrêteraient enfin d'être pillées dans notre dos.
- **Sub-line** (DM Sans 14 pt, --ink-3, centré) : *« Be Used. Paid. And Proud. »*

### Slide 12 — Appel à l'action
- **Eyebrow** : `— LA PROCHAINE ÉTAPE`
- **Titre** : Vous voulez en être ?
- **3 boutons-CTA pilule** (cliquables si export interactif) :
  - **Découvrir la plateforme** → lien `https://bup-rouge.vercel.app`
  - **S'inscrire à la liste d'attente** → lien `https://bup-rouge.vercel.app/liste-attente`
  - **Me contacter pour en parler** → lien `mailto:jjlex64@gmail.com`
- En bas, **QR code** menant à la home BUUPP (généré dans la slide).
- Pied de page : ligne confetti + « Merci. »

---

## 5. Screenshots à capturer et à intégrer

Capture les URLs ci-dessous (mode connecté en prospect, viewport desktop 1440×900). Sauvegarde-les en PNG dans le sous-dossier `/assets/screenshots/` du `.pptx` (ou embed direct dans les slides).

| # | URL / écran | À intégrer dans | Cadrage |
|---|---|---|---|
| **A** | `https://bup-rouge.vercel.app/` (home, hero) | Slide 1 (en fond très estompé, opacité 8 %) | Pleine page, haut |
| **B** | `/prospect?tab=relations` — une carte de mise en relation pending visible | Slide 4 | Zoom sur une seule carte |
| **C** | `/pro` (création de campagne, écran de ciblage par paliers) | Slide 6 (encart droit) | Section ciblage uniquement |
| **D** | `/bareme` ou `/minimisation` (matrice paliers) | Slide 7 | La grille des 5 paliers |
| **E** | `/prospect?tab=relations` modale d'une mise en relation | Slide 10 (étape 2) | Modale détaillée |

> Si tu ne peux pas générer de screenshots dynamiques, **mock-up des écrans** dans le style BUUPP (cartes ivoire, fonts Fraunces/DM Sans, accent indigo). Le rendu doit rester crédible.

---

## 6. Interactivité PowerPoint à intégrer

- **Liens hypertextes** sur les CTAs slide 12 (URLs réelles).
- **Transitions** : « morph » entre slides 4 → 5 → 6 (séquence d'arguments), « fade » partout ailleurs.
- **Animations** :
  - Slide 2 : les 3 cartes apparaissent en cascade (fly-in left, décalage 0,2 s).
  - Slide 3 : flèches du schéma central animées séquentiellement (flèche prospect → BUUPP, puis BUUPP → pro, puis flèche verte de retour).
  - Slide 7 : les 5 paliers apparaissent un à un.
  - Slide 11 : la phrase narrative se révèle ligne par ligne.
- **Navigation cliquable** : sommaire optionnel sur slide 1, et icône « home » en footer de chaque slide pour revenir au début (lien interne).
- **Mode présentateur** : notes orateur pour chaque slide (1-2 phrases clés à dire à voix haute, en français naturel).

---

## 7. Notes orateur (à insérer dans les "speaker notes" du pptx)

Pour chaque slide, ajoute en speaker note un script de 2-3 phrases que je pourrais lire mot pour mot si nécessaire. Le ton doit être **conversationnel**, comme si je parlais à un ami autour d'un café.

Exemple slide 1 : *« Tout le monde ici utilise Google, Facebook, Amazon. Et tout le monde sait que nos données valent une fortune — sans qu'on touche un centime. J'ai créé BUUPP pour changer ça. Laissez-moi 8 minutes pour vous montrer. »*

---

## 8. Inspirations bonus (à toi de juger)

- **Slide bonus possible** entre 8 et 9 : un témoignage fictif (réaliste) d'un boulanger ayant utilisé BUUPP (« J'ai gagné 18 nouveaux clients en 2 semaines »). À placer si la durée le permet, mais coupable si on dépasse 12 slides.
- **Easter egg** : une mini-note en bas de la slide 12, en mono caps `--ink-5`, taille 9 pt : `BUUPP · Be Used · Paid & Proud · v1.0` — clin d'œil pour les attentifs.
- **Couleur d'accent alternative** : si le public est plus senior (50+), envisager de passer la palette en `data-palette="slate"` (gris ardoise plus sobre, moins « start-up ») — laisser à l'auteur le choix au moment de la prod.

---

## 9. Contraintes finales

- **Pas de stock photo Shutterstock** — uniquement icônes vectorielles (Heroicons, Tabler, Lucide) ou pictogrammes émojis Apple Color.
- **Pas de slide « Merci des questions ? »** générique — la slide 12 fait office de clôture.
- **Tout en français.** Pas d'anglicisme autre que la baseline officielle « Be Used · Paid & Proud ».
- **Format** : 16:9, dimensions 1920×1080 pour un rendu net en projection.
- **Livrable** : un fichier `buupp-pitch-v1.pptx` + un dossier `/assets` si screenshots externes.

---

> Fin du brief. Tout ce qui n'est pas spécifié ici est laissé à l'appréciation du designer/de l'agent générateur, **dans le strict respect de l'identité visuelle BUUPP décrite en section 3**.
