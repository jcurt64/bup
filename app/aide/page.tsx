"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

type Article = {
  q: string;
  a: ReactNode;
  /* Mots-clés supplémentaires utilisés UNIQUEMENT pour la recherche
     (ne s'affichent pas). Permet d'attraper "rib", "iban" sur la même
     fiche, par exemple. */
  tags?: string[];
};

type Category = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  articles: Article[];
};

const CATEGORIES: Category[] = [
  {
    id: "prospect",
    icon: "🎯",
    label: "Prospect — utiliser BUUPP",
    desc: "Construire son profil, faire grimper son BUUPP Score, encaisser ses gains.",
    articles: [
      {
        q: "Qu'est-ce que BUUPP et pourquoi je suis rémunéré ?",
        a: (
          <p>
            BUUPP est une plateforme de mise en relation à <strong>double consentement</strong>.
            Vous renseignez les informations que vous acceptez de partager, par paliers, et
            les professionnels qui souhaitent vous contacter doivent <em>vous payer</em>{" "}
            pour obtenir votre accord. Aucune donnée n&apos;est jamais transmise sans votre
            validation explicite. Vos gains sont libellés en <strong>BUUPP Coins</strong>{" "}
            (1 BUUPP Coin = 1 €) et retirables sur votre IBAN.
          </p>
        ),
      },
      {
        q: "Comment fonctionnent les 5 paliers de données ?",
        a: (
          <>
            <p>Chaque palier regroupe une catégorie d&apos;informations :</p>
            <ul>
              <li><strong>Palier 1 — Identification</strong> (email, nom, téléphone) : minimum 1,00 €</li>
              <li><strong>Palier 2 — Localisation</strong> (adresse, logement) : 1,00 € – 2,00 €</li>
              <li><strong>Palier 3 — Style de vie</strong> (habitudes, famille, véhicule) : 2,00 € – 3,50 €</li>
              <li><strong>Palier 4 — Données professionnelles</strong> (poste, revenus) : 3,50 € – 5,00 €</li>
              <li><strong>Palier 5 — Patrimoine &amp; projets</strong> (immobilier, épargne) : 5,00 € – 10,00 €</li>
            </ul>
            <p>
              Plus vous remplissez de paliers, plus vous accédez à des sollicitations
              variées et mieux rémunérées. Le détail palier par palier est sur la
              page <Link href="/bareme" style={{ color: "var(--accent)", textDecoration: "underline" }}>Barème des paliers</Link>.
            </p>
          </>
        ),
        tags: ["palier", "rémunération", "tarif", "données"],
      },
      {
        q: "C'est quoi le BUUPP Score ?",
        a: (
          <p>
            Le BUUPP Score est un indice sur 1000 qui reflète la qualité de votre profil
            aux yeux des professionnels. Il évolue selon trois axes : <strong>complétude
            des paliers</strong>, <strong>fraîcheur des données</strong> et <strong>taux
            d&apos;acceptation</strong> de vos sollicitations. Quatre tranches : Découverte
            (0–399), Solide (400–699), Recherché (700–899), Prestige (900–1000). Un score
            élevé attire des demandes plus exigeantes, donc mieux rémunérées.
          </p>
        ),
      },
      {
        q: "Vérifié à 100 % : qu'est-ce que ça change ?",
        a: (
          <p>
            Quand votre profil est <strong>certifié confiance</strong> (téléphone vérifié
            par SMS, RIB validé, paliers à jour), un bonus <strong>×2</strong> est
            automatiquement appliqué à toutes vos récompenses. Concrètement : sur une
            sollicitation à 4,00 €, vous touchez 8,00 €. Aucune action n&apos;est
            nécessaire — le multiplicateur est appliqué côté serveur au moment où le
            professionnel lance sa campagne.
          </p>
        ),
        tags: ["certifié", "confiance", "bonus", "x2"],
      },
      {
        q: "Comment fonctionne une sollicitation ?",
        a: (
          <>
            <p>
              Quand un professionnel cible votre profil, vous recevez un email + une
              fiche dans l&apos;onglet <em>Mises en relation</em>. Vous avez une fenêtre
              limitée pour décider — selon le format de campagne :
            </p>
            <ul>
              <li><strong>Flash deal 1 h</strong> — gain ×3 sur le palier ciblé.</li>
              <li><strong>24 h</strong> — gain ×2.</li>
              <li><strong>48 h</strong> — gain ×1,5.</li>
              <li><strong>7 jours</strong> — gain ×1.</li>
            </ul>
            <p>
              <strong>Accepter</strong> place la récompense en séquestre. <strong>Refuser</strong>{" "}
              n&apos;a aucune conséquence sur votre score, et vous pouvez toujours revenir
              sur votre décision tant que la campagne est ouverte.
            </p>
          </>
        ),
      },
      {
        q: "Pourquoi mes gains sont en « séquestre » ?",
        a: (
          <p>
            Quand vous acceptez une sollicitation, la récompense entre dans un{" "}
            <strong>séquestre temporaire</strong>. Elle est libérée automatiquement à la{" "}
            <strong>clôture de la campagne</strong>. Ce délai protège tout le monde :
            vous pouvez encore refuser et déclencher un remboursement du
            professionnel ; le professionnel a le temps de prendre contact
            dans les conditions annoncées. Une fois libérés,
            les gains rejoignent votre solde <em>Disponible</em>.
          </p>
        ),
        tags: ["séquestre", "escrow", "déblocage"],
      },
      {
        q: "Comment retirer mes gains ?",
        a: (
          <>
            <p>
              Depuis l&apos;onglet <em>Portefeuille</em>, cliquez sur{" "}
              <strong>« Retirer mes gains »</strong>. Trois options :
            </p>
            <ul>
              <li><strong>Virement bancaire</strong> (actif) — vers votre IBAN sous 1 à 3 jours ouvrés via Stripe Connect Express.</li>
              <li><strong>Carte</strong> (à venir) — paiement instantané sur votre carte de débit.</li>
              <li><strong>Cartes cadeaux et dons</strong> (à venir) — convertissez vos gains en bons d&apos;achat ou en dons associatifs.</li>
            </ul>
            <p>
              Le minimum de retrait est de <strong>5,00 €</strong>. Si vous n&apos;avez
              pas encore créé votre compte Stripe Connect, le tunnel d&apos;onboarding
              s&apos;ouvre au premier retrait (environ 3 minutes : pièce d&apos;identité +
              IBAN). Vos données bancaires ne transitent jamais par BUUPP.
            </p>
          </>
        ),
        tags: ["retrait", "iban", "stripe", "virement"],
      },
      {
        q: "Pourquoi mon RIB est refusé ?",
        a: (
          <p>
            Pour lutter contre la fraude, un même IBAN ne peut être enregistré que sur{" "}
            <strong>un seul profil BUUPP</strong>. Si l&apos;application vous renvoie un
            message « ce compte bancaire est déjà enregistré par un autre utilisateur »,
            c&apos;est que ce RIB est associé à un autre compte. Contactez-nous via{" "}
            <Link href="/contact-dpo" style={{ color: "var(--accent)", textDecoration: "underline" }}>la page Contact DPO</Link>{" "}
            si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
        ),
        tags: ["rib", "iban", "fraude", "doublon"],
      },
      {
        q: "Et mon numéro de téléphone ?",
        a: (
          <p>
            Même règle anti-fraude : un numéro de téléphone ne peut être rattaché
            qu&apos;à un seul compte. Le téléphone se renseigne via une vérification
            SMS (code à 6 chiffres) — c&apos;est ce qui vous permet de passer au palier{" "}
            <em>Vérifié</em>.
          </p>
        ),
        tags: ["téléphone", "sms", "vérification", "otp"],
      },
      {
        q: "Le programme Parrain / Fondateur·ice",
        a: (
          <>
            <p>
              Sur BUUPP, <strong>parrain·e = fondateur·ice</strong> : c&apos;est
              le même statut, ouvert à toute personne inscrite sur la liste
              d&apos;attente avant la date officielle de lancement. Il est
              permanent.
            </p>
            <p>
              Vous disposez d&apos;un <strong>code de parrainage personnel</strong>{" "}
              (visible dans votre tableau de bord, onglet «&nbsp;Parrainage&nbsp;»).
              Chaque personne qui s&apos;inscrit sur la liste d&apos;attente
              avec votre code devient à son tour parrain·e / fondateur·ice. Vous
              pouvez parrainer au maximum <strong>10&nbsp;filleul·es</strong>{" "}
              ; au-delà, le lien affiche un message «&nbsp;quota atteint&nbsp;»
              au nouvel inscrit.
            </p>
            <p>
              <strong>Vos avantages.</strong> Pendant le 1er mois suivant le
              lancement&nbsp;:
            </p>
            <ul style={{ paddingLeft: 22, marginTop: 4 }}>
              <li>
                <strong>×2 sur vos gains</strong> à chaque sollicitation
                acceptée (financé par le pro sauf opt-out de sa part)&nbsp;;
              </li>
              <li>
                <strong>priorité de 10&nbsp;min</strong> sur les flash deals
                (vous les voyez avant le grand public)&nbsp;;
              </li>
              <li>
                au <strong>plafond de 10 filleul·es</strong>, vous passez{" "}
                <strong>VIP</strong>&nbsp;: à la place du ×2, vous touchez un{" "}
                <strong>bonus forfaitaire de +5&nbsp;€</strong> par acceptation,
                sur les campagnes dont le budget dépasse 300&nbsp;€ (sinon le
                ×2 standard s&apos;applique).
              </li>
            </ul>
            <p>
              Aucune action n&apos;est requise&nbsp;: tout est calculé
              automatiquement et notifié par e-mail à chaque acceptation.
            </p>
          </>
        ),
      },
      {
        q: "Supprimer mon compte",
        a: (
          <p>
            Depuis le menu latéral, cliquez sur <strong>« Supprimer mon compte »</strong>.
            La suppression est <em>irréversible</em> et entraîne la perte du solde de
            BUUPP Coins non encore retirés. Récupérez vos gains avant si possible. Le
            compte Clerk associé et toutes vos données dans Supabase (paliers, RIB,
            historique) sont effacés.
          </p>
        ),
      },
    ],
  },
  {
    id: "pro",
    icon: "💼",
    label: "Professionnel — lancer une campagne",
    desc: "Plans, ciblage, facturation, gestion des contacts révélés.",
    articles: [
      {
        q: "Starter ou Pro : lequel choisir ?",
        a: (
          <>
            <p>Deux plans, sans engagement, payés par cycle :</p>
            <ul>
              <li>
                <strong>Starter — 19 € / 2 campagnes par cycle</strong> — jusqu&apos;à
                50 prospects par campagne, ciblage paliers 1 à 3.
              </li>
              <li>
                <strong>Pro — 59 € / 10 campagnes par cycle</strong> (recommandé) —
                jusqu&apos;à 500 prospects par campagne, accès à tous les paliers (1 à
                5), accès anticipé aux nouveautés.
              </li>
            </ul>
            <p>
              Les frais d&apos;accès au cycle ne sont facturés qu&apos;<strong>une seule
              fois</strong> au démarrage du cycle. Les campagnes 2 à N réutilisent le
              quota déjà payé. Vous pouvez basculer Starter ↔ Pro à tout moment depuis
              la sélection de mode.
            </p>
          </>
        ),
        tags: ["plan", "starter", "pro", "tarif", "cycle"],
      },
      {
        q: "Comment lancer ma première campagne ?",
        a: (
          <p>
            Depuis le dashboard professionnel, cliquez sur{" "}
            <strong>« Créer une campagne »</strong>.
            Le wizard vous guide en 4 étapes : <strong>objectif</strong> (prise de
            contact, RDV, devis, sondage), <strong>ciblage</strong> (paliers requis,
            zone géo, âge, niveau de vérif), <strong>budget</strong> (durée, nombre de
            contacts, prix par contact) et <strong>récap</strong>. Une fois lancée, la
            campagne est immédiatement notifiée par email aux prospects matchés.
          </p>
        ),
      },
      {
        q: "Combien je paie pour un contact ?",
        a: (
          <>
            <p>
              Le prix par contact est calculé automatiquement à partir de :
            </p>
            <ul>
              <li>la fourchette du palier le plus élevé requis (1 € à 10 €) ;</li>
              <li>le coût lié au sous-objectif choisi (RDV physique, livre blanc, etc.) ;</li>
              <li>le multiplicateur de durée (×3 en flash deal 1 h jusqu&apos;à ×1 en 7 jours) ;</li>
              <li>le bonus ×2 « certifié confiance » quand le prospect matché a son profil 100 % vérifié.</li>
            </ul>
            <p>
              À cela s&apos;ajoute la <strong>commission BUUPP de 10 %</strong>{" "}
              calculée sur le budget de la campagne — elle n&apos;est facturée que sur
              les acceptations effectives.
            </p>
          </>
        ),
        tags: ["coût", "commission", "tarif", "budget"],
      },
      {
        q: "Pause et prolongation",
        a: (
          <p>
            Toutes les campagnes peuvent être <strong>mises en pause une seule fois</strong>{" "}
            (48 h max sur les 7 j, plus court pour les durées plus courtes). Pendant la
            pause, plus aucun prospect n&apos;est sollicité — les acceptations déjà
            obtenues restent acquises. Vous pouvez aussi <strong>prolonger</strong> une
            campagne une seule fois, moyennant un coût proportionnel à la durée
            ajoutée. Les deux actions se font depuis la fiche campagne.
          </p>
        ),
      },
      {
        q: "Que voit-on dans « Mes contacts » ?",
        a: (
          <p>
            La page <em>Mes contacts</em> liste tous les prospects ayant accepté vos
            sollicitations, regroupés par campagne. Les coordonnées (email, téléphone)
            sont <strong>masquées par défaut</strong> et révélables individuellement
            (un clic → un usage). Chaque révélation est tracée et watermarquée
            individuellement — toute fuite est imputable au professionnel émetteur.
          </p>
        ),
        tags: ["contact", "révélation", "email", "téléphone", "watermark"],
      },
      {
        q: "Recharger mon portefeuille",
        a: (
          <p>
            Depuis l&apos;onglet <em>Facturation</em>, cliquez sur <strong>« Recharger »</strong>
            et choisissez le montant. Paiement par carte via Stripe (3D Secure). Le crédit
            est immédiatement disponible. À noter : le crédit non utilisé n&apos;est pas
            remboursable hors cas légaux — calibrez vos campagnes en conséquence.
          </p>
        ),
      },
      {
        q: "Pourquoi un prospect peut « refuser après avoir accepté » ?",
        a: (
          <p>
            Tant qu&apos;une campagne est ouverte, un prospect a le droit de revenir sur
            son acceptation. Dans ce cas, sa récompense en séquestre est annulée et le{" "}
            <strong>budget vous est intégralement remboursé</strong> sur votre wallet,
            commission BUUPP comprise. Vous ne payez que pour des acceptations qui
            tiennent jusqu&apos;à la clôture.
          </p>
        ),
      },
      {
        q: "Règles d'usage et watermarking",
        a: (
          <p>
            Chaque coordonnée révélée porte une <strong>empreinte unique</strong> liée à
            votre compte. Toute diffusion hors du périmètre de la campagne (revente,
            partage à un tiers, sollicitation hors objet) est <em>traçable</em> et peut
            entraîner la résiliation immédiate du compte ainsi qu&apos;une enquête
            CNIL. La règle est simple : <strong>un prospect, une sollicitation, un
            usage</strong>.
          </p>
        ),
        tags: ["watermark", "règles", "fuite", "rgpd"],
      },
    ],
  },
  {
    id: "securite",
    icon: "🔒",
    label: "Sécurité, RGPD et anti-fraude",
    desc: "Comment vos données sont protégées et tracées.",
    articles: [
      {
        q: "Le double consentement, qu'est-ce que ça veut dire concrètement ?",
        a: (
          <>
            <p>
              Le double consentement repose sur <strong>deux accords distincts et
              explicites</strong> du prospect, séparés dans le temps :
            </p>
            <ul>
              <li>
                <strong>Premier consentement — à l&apos;inscription.</strong> Le
                prospect accepte les Conditions Générales d&apos;Utilisation de
                BUUPP et autorise l&apos;enregistrement de ses données sur la
                plateforme, palier par palier, en choisissant ce qu&apos;il accepte
                de partager.
              </li>
              <li>
                <strong>Second consentement — pour chaque sollicitation.</strong>{" "}
                Avant qu&apos;un professionnel n&apos;entre en contact, le prospect
                doit accepter <em>explicitement</em> sa sollicitation depuis son
                espace personnel. Sans cette validation au cas par cas, aucune
                coordonnée n&apos;est transmise et la mise en relation
                n&apos;a pas lieu.
              </li>
            </ul>
            <p>
              Cette mécanique garantit que le prospect garde la maîtrise de ses
              données à chaque étape : il décide d&apos;abord de rejoindre la
              plateforme, puis, à chaque demande reçue, il choisit individuellement
              s&apos;il souhaite y donner suite.
            </p>
          </>
        ),
      },
      {
        q: "Données pseudonymisées",
        a: (
          <p>
            Tant qu&apos;un prospect n&apos;a pas accepté une sollicitation, le
            professionnel voit
            uniquement des informations <strong>agrégées et anonymisées</strong>{" "}
            (palier, score, ville, etc.). Les coordonnées (email, téléphone, adresse)
            ne deviennent visibles qu&apos;<em>après</em> acceptation, et sont marquées
            individuellement.
          </p>
        ),
      },
      {
        q: "Anti-fraude : règles d'unicité",
        a: (
          <ul>
            <li><strong>Un IBAN = un compte</strong> — empêche un prospect de cumuler des récompenses sur plusieurs profils.</li>
            <li><strong>Un téléphone = un compte</strong> — la vérification SMS est obligatoire pour atteindre le palier <em>Vérifié</em>.</li>
            <li><strong>Détection des comptes dupliqués</strong> — empreinte appareil et scoring comportemental côté serveur.</li>
            <li><strong>Honeypots</strong> dans les formulaires d&apos;inscription pour bloquer les bots.</li>
          </ul>
        ),
        tags: ["fraude", "iban", "rib", "téléphone", "doublon", "duplicate"],
      },
      {
        q: "Mes droits RGPD",
        a: (
          <p>
            Vous avez les droits d&apos;accès, de rectification, d&apos;effacement,
            d&apos;opposition, de limitation, de portabilité et de directives
            post-mortem. Pour les exercer, voir notre{" "}
            <Link href="/rgpd" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              politique RGPD
            </Link>{" "}
            ou contactez directement notre{" "}
            <Link href="/contact-dpo" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              DPO
            </Link>
            . Délai de réponse : 30 jours, prolongeable de 60 jours pour les demandes
            complexes (avec notification).
          </p>
        ),
      },
      {
        q: "Cookies",
        a: (
          <p>
            Le site utilise des cookies essentiels (session Clerk), de préférences
            (panneau de cookies), de statistiques (anonymisées) et de marketing
            (uniquement après opt-in). Vous pouvez les gérer à tout moment via le
            bouton flottant <strong>« Gérer les cookies »</strong> en bas à gauche
            de l&apos;écran. Le détail complet (nom, émetteur, finalité, durée)
            est listé dans notre{" "}
            <Link
              href="/cookies"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              politique des cookies
            </Link>
            .
          </p>
        ),
      },
    ],
  },
  {
    id: "general",
    icon: "❓",
    label: "Questions fréquentes",
    desc: "Les réponses courtes aux questions qu'on nous pose le plus.",
    articles: [
      {
        q: "L'inscription est-elle gratuite côté prospect ?",
        a: (
          <p>
            Oui, totalement. Côté prospect, BUUPP est <strong>100 % gratuit</strong> :
            aucune carte demandée, aucun frais caché. Vous gagnez de l&apos;argent, vous
            n&apos;en dépensez pas.
          </p>
        ),
      },
      {
        q: "Combien je peux gagner par mois ?",
        a: (
          <p>
            Cela dépend de votre profil : un palier 1 seul rapporte quelques euros par
            mois ; un profil complet (5 paliers + certifié confiance) peut atteindre
            plusieurs dizaines d&apos;euros par mois selon le volume de campagnes
            ciblant votre zone et votre profession. La meilleure stratégie est de
            compléter au moins 3 paliers et de vérifier votre téléphone.
          </p>
        ),
      },
      {
        q: "Pourquoi je ne reçois pas de sollicitations ?",
        a: (
          <p>
            Trois causes fréquentes : (1) votre palier 1 (identification) n&apos;est
            pas complet — c&apos;est le minimum pour matcher ; (2) votre zone
            géographique est sous-représentée chez les pros pour le moment ; (3) vous
            avez décoché certains paliers de partage. Allez dans <em>Mes données</em>{" "}
            et activez tous les paliers que vous acceptez de partager.
          </p>
        ),
      },
      {
        q: "Et si un professionnel abuse ?",
        a: (
          <p>
            Signalez-le immédiatement via{" "}
            <Link href="/contact-dpo" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              la page Contact DPO
            </Link>{" "}
            ou en répondant à l&apos;email de sollicitation. Tout abus (sollicitation
            hors objet, harcèlement, fuite de coordonnées) est traçable grâce au
            watermarking et entraîne sanction.
          </p>
        ),
      },
      {
        q: "BUUPP est-il une banque ?",
        a: (
          <p>
            Non. BUUPP est une plateforme de mise en relation éditée par{" "}
            <strong>Majelink</strong> (RCS Pau 892 514 167). Les paiements sont
            opérés par Stripe pour les recharges des professionnels et les
            retraits des prospects. Aucun fonds n&apos;est conservé chez BUUPP en
            dehors du séquestre temporaire (campagne en cours).
          </p>
        ),
      },
    ],
  },
];

function matchArticle(a: Article, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (a.q.toLowerCase().includes(q)) return true;
  if (a.tags?.some((t) => t.toLowerCase().includes(q))) return true;
  // Recherche dans le texte de la réponse — on extrait grossièrement la
  // string en parcourant les enfants React (suffisant pour notre contenu).
  const stringify = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(stringify).join(" ");
    if (node && typeof node === "object" && "props" in node) {
      const props = (node as { props?: { children?: ReactNode } }).props;
      return stringify(props?.children);
    }
    return "";
  };
  return stringify(a.a).toLowerCase().includes(q);
}

export default function AidePage() {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return CATEGORIES.map((c) => ({
      ...c,
      articles: c.articles.filter((a) => matchArticle(a, query)),
    })).filter((c) => c.articles.length > 0);
  }, [query]);

  const toggle = (key: string) =>
    setOpenItems((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 64px) 24px 24px",
        }}
      >
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="BUUPP"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>
        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          Centre d&apos;aide
        </div>
        <PageVersion version="1.0" />
        <h1
          className="serif"
          style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, marginBottom: 18 }}
        >
          Comment pouvons-nous vous aider ?
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink-3)", maxWidth: 720 }}>
          Tout ce qu&apos;il faut savoir pour utiliser BUUPP au mieux : compléter ses
          paliers, comprendre son BUUPP Score, encaisser ses BUUPP Coins, lancer une
          campagne professionnelle, ou simplement protéger ses données.
        </p>

        {/* Recherche */}
        <div
          style={{
            marginTop: 28,
            position: "relative",
            maxWidth: 520,
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : « retrait », « palier 3 », « certifié confiance »…"
            aria-label="Rechercher dans le centre d'aide"
            style={{
              width: "100%",
              padding: "14px 16px 14px 44px",
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "var(--paper)",
              fontSize: 15,
              color: "var(--ink)",
              outline: "none",
              boxShadow: "0 1px 0 rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.04)",
              fontFamily: "var(--sans)",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 16,
              color: "var(--ink-4)",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
        </div>
      </div>

      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              color: "var(--ink-4)",
            }}
          >
            Aucun article ne correspond à <strong style={{ color: "var(--ink)" }}>« {query} »</strong>.
            Essayez avec un autre mot-clé, ou écrivez-nous via{" "}
            <Link
              href="/contact-dpo"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              la page Contact
            </Link>
            .
          </div>
        )}

        {filtered.map((cat) => (
          <section key={cat.id}>
            <header style={{ marginBottom: 14 }}>
              <div
                className="row center"
                style={{ gap: 12, marginBottom: 4, alignItems: "center" }}
              >
                <span style={{ fontSize: 24 }} aria-hidden>
                  {cat.icon}
                </span>
                <h2
                  className="serif"
                  style={{ fontSize: "clamp(22px, 3vw, 28px)", lineHeight: 1.2 }}
                >
                  {cat.label}
                </h2>
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-4)" }}>{cat.desc}</div>
            </header>

            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {cat.articles.map((a, idx) => {
                const key = `${cat.id}:${a.q}`;
                const open = !!openItems[key] || query.length > 0;
                return (
                  <div
                    key={key}
                    style={{
                      borderBottom:
                        idx === cat.articles.length - 1 ? "none" : "1px solid var(--line)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={open}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "16px 20px",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        color: "var(--ink)",
                        fontSize: 15.5,
                        fontWeight: 500,
                        fontFamily: "var(--sans)",
                      }}
                    >
                      <span style={{ flex: 1 }}>{a.q}</span>
                      <span
                        aria-hidden
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: "var(--ivory-2)",
                          color: "var(--ink-3)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 600,
                          transition: "transform .15s",
                          transform: open ? "rotate(45deg)" : "none",
                        }}
                      >
                        +
                      </span>
                    </button>
                    {open && (
                      <div
                        style={{
                          padding: "0 20px 18px",
                          fontSize: 15,
                          lineHeight: 1.7,
                          color: "var(--ink-3)",
                          textAlign: "justify",
                          hyphens: "auto",
                        }}
                      >
                        {a.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* CTA aide humaine */}
        <div
          style={{
            padding: "22px 24px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="serif" style={{ fontSize: 18, color: "var(--ink)", marginBottom: 4 }}>
              Vous n&apos;avez pas trouvé votre réponse ?
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-4)" }}>
              Notre équipe vous répond sous 30 jours, ou plus rapidement pour les
              questions courantes.
            </div>
          </div>
          <Link
            href="/contact-dpo"
            className="back-home-btn"
            style={{ background: "var(--accent)" }}
          >
            <span>Nous contacter</span>
            <span aria-hidden style={{ fontSize: 14 }}>→</span>
          </Link>
        </div>

        <div
          style={{
            marginTop: 8,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
          }}
        >
          <BackHomeButton />
        </div>
      </div>
    </div>
  );
}
