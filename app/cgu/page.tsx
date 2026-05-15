import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — BUUPP",
  description:
    "Conditions Générales d'Utilisation de la plateforme BUUPP (prospects et professionnels).",
};

export default function CguPage() {
  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 820,
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
        <div
          className="mono caps"
          style={{ color: "var(--ink-4)", marginBottom: 14 }}
        >
          Conditions générales d&apos;utilisation
        </div>
        <PageVersion version="1.0" />
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Vos engagements et les nôtres
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          BUUPP est une plateforme de mise en relation rémunérée entre
          particuliers (prospects) et professionnels, opérée par la société
          Majelink. Les présentes CGU encadrent l&apos;accès au service et
          précisent les droits et obligations de chacun.
        </p>
      </div>

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d&apos;Utilisation (ci-après
            «&nbsp;CGU&nbsp;») ont pour objet de définir les modalités et les
            conditions dans lesquelles la société{" "}
            <strong>Majelink</strong> (ci-après «&nbsp;BUUPP&nbsp;» ou
            l&apos;«&nbsp;Éditeur&nbsp;») met à la disposition des
            utilisateurs une plateforme de mise en relation rémunérée entre
            particuliers (ci-après «&nbsp;Prospects&nbsp;») et professionnels
            (ci-après «&nbsp;Pros&nbsp;») accessible à l&apos;adresse{" "}
            <a
              href="https://buupp.fr"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              buupp.fr
            </a>{" "}
            (ci-après le «&nbsp;Service&nbsp;»).
          </p>
          <p>
            L&apos;accès à BUUPP est <strong>gratuit</strong> pour les
            Prospects. Les Pros accèdent au Service via un abonnement
            (formule «&nbsp;Starter&nbsp;» ou «&nbsp;Pro&nbsp;») et financent
            les rémunérations versées aux Prospects. BUUPP agit comme un{" "}
            <strong>intermédiaire technique de mise en relation</strong> et
            n&apos;est pas partie aux échanges qui suivent la
            sollicitation.
          </p>
        </Section>

        <Section title="2. Acceptation des CGU">
          <p>
            L&apos;acceptation des présentes CGU est{" "}
            <strong>expresse et préalable</strong> à toute création de
            compte. Au moment de l&apos;inscription, l&apos;utilisateur
            confirme avoir lu et accepté l&apos;intégralité des CGU, de la{" "}
            <Link
              href="/cgv"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              CGV
            </Link>{" "}
            (Pros uniquement) et de la{" "}
            <Link
              href="/rgpd"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              politique RGPD
            </Link>
            . Cette acceptation forme un contrat opposable entre
            l&apos;utilisateur et Majelink.
          </p>
          <p>
            La version applicable est <strong>celle en vigueur au jour de
            l&apos;utilisation</strong> du Service. BUUPP peut faire évoluer
            les présentes CGU à tout moment ; les modifications substantielles
            sont notifiées à l&apos;utilisateur par message in-app et par
            courriel au moins <strong>30 jours</strong> avant leur entrée en
            vigueur. Le refus des nouvelles CGU emporte clôture du compte
            sans frais ni pénalité.
          </p>
        </Section>

        <Section title="3. Description du service">
          <p>
            BUUPP repose sur un principe de{" "}
            <strong>double consentement explicite</strong>&nbsp;: aucun
            contact entre un Pro et un Prospect ne peut avoir lieu sans
            que&nbsp;(i)&nbsp;le Pro ait sélectionné le Prospect via une
            campagne ciblée et&nbsp;(ii)&nbsp;le Prospect ait accepté
            explicitement la sollicitation depuis son tableau de bord.
          </p>
          <p>
            Les données du Prospect sont organisées en{" "}
            <strong>cinq paliers</strong> (Identification, Localisation,
            Style de vie, Données professionnelles, Patrimoine &amp;
            projets) selon le principe de{" "}
            <Link
              href="/minimisation"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              minimisation
            </Link>
            . Chaque palier est complété volontairement par le Prospect et
            associé à une rémunération propre. Le Pro ne peut cibler que les
            paliers strictement nécessaires à l&apos;objectif déclaré de sa
            campagne (cf.{" "}
            <Link
              href="/bareme"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              barème
            </Link>
            ).
          </p>
          <p>
            Le <strong>BUUPP Score</strong> (0-1000) reflète la qualité du
            profil Prospect&nbsp;: complétude des paliers, vérification du
            téléphone, taux de réponse aux sollicitations passées. Il sert
            au Pro à filtrer ses cibles et au Prospect à valoriser son
            profil. Les rémunérations sont versées en{" "}
            <strong>BUUPP Coins</strong> (1&nbsp;BUUPP Coin =
            1,00&nbsp;€), retirables sur compte bancaire selon les
            modalités décrites à l&apos;article&nbsp;8.
          </p>
        </Section>

        <Section title="4. Inscription et compte utilisateur">
          <p>
            La création d&apos;un compte se fait via{" "}
            <strong>Clerk</strong>, prestataire d&apos;authentification de
            BUUPP. L&apos;utilisateur fournit une adresse e-mail valide et
            choisit un mot de passe robuste (ou utilise un fournisseur
            d&apos;identité tiers&nbsp;: Google, Apple). Une vérification
            par courriel est requise pour activer le compte.
          </p>
          <p>
            <strong>Unicité du compte.</strong> Une même personne physique
            ne peut détenir qu&apos;<strong>un seul compte</strong> sur la
            plateforme. L&apos;unicité est garantie techniquement par
            plusieurs contrôles cumulés&nbsp;: unicité de
            l&apos;adresse&nbsp;e-mail (Clerk), unicité du numéro de
            téléphone après vérification SMS, unicité de l&apos;IBAN (pour
            les retraits), exclusivité de rôle (un même utilisateur ne peut
            pas être à la fois Prospect et Pro). Toute tentative de
            contournement entraîne la suspension immédiate.
          </p>
          <p>
            <strong>Vérification téléphone.</strong> Le Prospect peut
            valider son numéro via un code SMS à 6&nbsp;chiffres. Cette
            vérification débloque le palier{" "}
            <strong>«&nbsp;Vérifié&nbsp;»</strong> qui double la
            rémunération de toutes les acceptations à venir et est requise
            pour les retraits supérieurs à un seuil défini.
          </p>
          <p>
            <strong>Sécurité.</strong> L&apos;utilisateur est responsable de
            la confidentialité de ses identifiants. BUUPP met en œuvre les
            protections standard de Clerk (rate-limiting, détection de
            bots, MFA optionnelle). Toute activité suspecte doit être
            signalée immédiatement à <a
              href="mailto:contact@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              contact@buupp.com
            </a>
            .
          </p>
          <p>
            <strong>Suppression du compte.</strong> Le compte est
            supprimable à tout moment depuis le menu latéral («&nbsp;Supprimer
            mon compte&nbsp;»). La suppression est <strong>irréversible</strong> :
            elle entraîne l&apos;effacement définitif des données associées
            dans Supabase et la révocation du compte Clerk. Les BUUPP Coins
            non encore retirés sont perdus ; il est recommandé de procéder à
            un retrait avant suppression.
          </p>
        </Section>

        <Section title="5. Engagements du prospect">
          <p>Le Prospect s&apos;engage à&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              fournir des informations <strong>exactes, à jour et
              complètes</strong> dans tous les paliers qu&apos;il choisit de
              remplir ;
            </li>
            <li>
              ne <strong>pas créer plusieurs comptes</strong> (les contrôles
              de doublons IBAN, téléphone et e-mail sanctionnent toute
              tentative) ;
            </li>
            <li>
              <strong>répondre dans un délai raisonnable</strong> aux
              sollicitations qu&apos;il a acceptées (par e-mail, SMS,
              appel, ou via le canal indiqué par le Pro) ; un Prospect
              signalé «&nbsp;non atteint&nbsp;» à deux reprises reçoit un
              message de rappel et peut, en cas de récidive, voir son
              compte suspendu (cf. article&nbsp;12) ;
            </li>
            <li>
              respecter le <strong>droit à la prise de contact</strong>
              {" "}consenti, sans usage abusif des canaux du Pro
              (harcèlement, sollicitation détournée, etc.) ;
            </li>
            <li>
              signaler à BUUPP tout comportement déviant d&apos;un Pro
              (utilisation hors périmètre, démarchage tiers, exfiltration
              de coordonnées).
            </li>
          </ul>
        </Section>

        <Section title="6. Engagements du professionnel">
          <p>Le Pro s&apos;engage à&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              n&apos;utiliser les coordonnées révélées que{" "}
              <strong>dans le strict cadre de la campagne validée</strong>{" "}
              par le Prospect (objectif, sous-type et canal déclarés au
              wizard de création) ;
            </li>
            <li>
              respecter le principe de{" "}
              <Link
                href="/minimisation"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                minimisation
              </Link>
              {" "}: ne cibler que les paliers strictement nécessaires à la
              finalité déclarée ;
            </li>
            <li>
              ne <strong>pas exfiltrer, copier, exporter ou revendre</strong>{" "}
              les coordonnées révélées. Toutes les fiches contact sont
              affichées dans l&apos;interface BUUPP avec watermarking
              individuel — tout export, capture massif ou diffusion à des
              tiers expose le Pro à une résiliation immédiate et à une
              enquête (les watermarks sont uniques par fiche et permettent
              de tracer la source d&apos;une fuite) ;
            </li>
            <li>
              limiter ses contacts à <strong>une seule sollicitation</strong>
              {" "}par prospect dans le cadre d&apos;une même campagne ;
            </li>
            <li>
              respecter le <strong>RGPD</strong> dans son rôle de
              responsable de traitement vis-à-vis des données reçues
              (information, durée de conservation, droits d&apos;accès,
              opposition) ;
            </li>
            <li>
              honorer ses engagements financiers (provisionnement du
              wallet, paiement des bonus fondateurs, des bonus VIP et des
              commissions BUUPP).
            </li>
          </ul>
        </Section>

        <Section title="7. Double consentement et mise en relation">
          <p>
            Le double consentement est la règle fondatrice de BUUPP. Aucune
            mise en relation ne peut intervenir sans que les{" "}
            <strong>deux parties</strong> aient explicitement accepté&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>côté Pro</strong> : sélection du prospect via une
              campagne ciblée (objectif, palier, géographie, mots-clés) et
              validation du budget&nbsp;;
            </li>
            <li>
              <strong>côté Prospect</strong> : clic explicite sur
              «&nbsp;J&apos;accepte la sollicitation&nbsp;» depuis son
              tableau de bord, après prise de connaissance du motif, de
              l&apos;identité du Pro et de la rémunération proposée.
            </li>
          </ul>
          <p>
            Le Prospect dispose d&apos;une <strong>fenêtre de réponse</strong>
            {" "}calée sur la durée de la campagne (de 1&nbsp;heure pour les
            «&nbsp;flash deals&nbsp;» à plusieurs jours pour les campagnes
            standard). Passé ce délai sans réponse, la sollicitation
            expire automatiquement et le budget réservé est libéré côté
            Pro.
          </p>
          <p>
            <strong>Refus / retour arrière.</strong> Le Prospect peut
            refuser une sollicitation à tout moment avant son expiration —
            aucun préjudice n&apos;en résulte. Une sollicitation acceptée
            par erreur peut être annulée dans les premières minutes via le
            même écran («&nbsp;Reprendre ma décision&nbsp;»). Passé ce
            délai, la rémunération entre en{" "}
            <strong>séquestre</strong> (cf. article&nbsp;8) et le Pro est
            considéré comme ayant le droit d&apos;entrer en contact.
          </p>
        </Section>

        <Section title="8. Communication via BUUPP">
          <p>
            Pour préserver à la fois la <strong>confidentialité des
            coordonnées</strong> du Prospect et la <strong>traçabilité</strong>
            des échanges, BUUPP centralise l&apos;envoi de certaines
            communications.
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Emails Pro → Prospect</strong> : tout email envoyé
              au Prospect via les outils &laquo;&nbsp;Actions
              intégrées&nbsp;&raquo; de BUUPP est transmis par nos
              serveurs SMTP, avec l&apos;adresse <em>BUUPP</em> en
              expéditeur et l&apos;adresse personnelle du Pro en
              <em> Reply-To</em> (les réponses du Prospect arrivent
              donc directement chez le Pro). L&apos;adresse email du
              Prospect <strong>n&apos;est jamais affichée</strong> au Pro
              dans l&apos;interface de composition.
            </li>
            <li>
              <strong>Conservation</strong> : le sujet et le corps de
              chaque email sont conservés dans nos systèmes pendant{" "}
              <strong>12 mois</strong> à des fins d&apos;audit
              anti-spam, d&apos;enquête en cas de signalement et de
              respect du règlement BUUPP. Au-delà, ils sont
              anonymisés ou supprimés.
            </li>
            <li>
              <strong>Quota</strong> : le Pro peut envoyer{" "}
              <strong>1 email maximum</strong> par Prospect et par
              campagne via la plateforme. Au-delà, l&apos;envoi est
              refusé.
            </li>
            <li>
              <strong>Appels téléphoniques</strong> : lorsque le Pro
              clique sur le bouton &laquo;&nbsp;Appeler&nbsp;&raquo;
              dans l&apos;interface contact, l&apos;événement
              (horodatage, identifiant de la mise en relation) est
              enregistré dans nos journaux d&apos;audit. L&apos;appel
              lui-même se déroule via le réseau téléphonique standard
              et n&apos;est ni intercepté ni enregistré par BUUPP.
            </li>
            <li>
              <strong>Suivi d&apos;ouverture (pixel)</strong> : si le
              Prospect a explicitement consenti au suivi de la lecture
              des emails (case dédiée dans ses préférences,
              conformément aux recommandations CNIL sur les pixels de
              tracking), un pixel transparent invisible est intégré
              dans l&apos;email pour mesurer l&apos;ouverture. Le
              consentement est <strong>révocable à tout moment</strong>{" "}
              depuis l&apos;espace prospect. En l&apos;absence de
              consentement, aucun pixel n&apos;est inséré.
            </li>
          </ul>
        </Section>

        <Section title="9. BUUPP Coins, gains et retraits">
          <p>
            Les <strong>BUUPP Coins</strong> (BC) sont l&apos;unité de
            compte interne de la plateforme. <strong>1&nbsp;BC =
            1,00&nbsp;€</strong>. Ils ne constituent ni une monnaie
            électronique au sens de la directive DME2 ni un actif
            numérique au sens du Règlement MiCA — il s&apos;agit
            d&apos;une simple unité de représentation de créances en euros
            détenues par le Prospect sur Majelink, exclusivement
            utilisable au sein de BUUPP ou retirable en euros.
          </p>
          <p>
            <strong>Séquestre &amp; déblocage.</strong> Lors de
            l&apos;acceptation d&apos;une sollicitation, le montant de la
            rémunération (palier × multiplicateur durée × bonus
            éventuels) est <strong>débité du wallet du Pro</strong> et
            placé en séquestre. Il est{" "}
            <strong>automatiquement crédité au Prospect</strong> à la
            clôture de la campagne (date communiquée à l&apos;acceptation),
            sans action requise de sa part. Si la campagne est annulée par
            le Pro avant cette date, le séquestre est restitué au Pro et
            la relation est marquée comme remboursée.
          </p>
          <p>
            <strong>Retraits.</strong> Le retrait s&apos;effectue par
            virement SEPA sur l&apos;IBAN renseigné par le Prospect dans
            son profil. L&apos;IBAN est unique (anti-doublon) et nominatif.
            Le seuil minimum de retrait, les délais et la commission
            éventuelle sont précisés dans l&apos;onglet «&nbsp;Mon
            portefeuille&nbsp;» et peuvent évoluer (toute modification
            défavorable est notifiée 30&nbsp;jours à l&apos;avance).
          </p>
          <p>
            <strong>Fiscalité.</strong> Les gains perçus sur BUUPP
            constituent un revenu qu&apos;il appartient au Prospect de
            déclarer auprès de l&apos;administration fiscale selon sa
            situation personnelle. Conformément à l&apos;article
            242&nbsp;bis du Code général des impôts (transposition de la
            directive UE DAC7), BUUPP transmet annuellement à la DGFiP le
            récapitulatif des sommes versées dès lors que le Prospect
            dépasse, dans l&apos;année civile, le seuil de{" "}
            <strong>2&nbsp;000&nbsp;€</strong> ou de{" "}
            <strong>30&nbsp;transactions</strong>. Un{" "}
            <strong>récapitulatif annuel</strong> et une{" "}
            <strong>attestation DGFiP</strong> (le cas échéant) sont mis à
            la disposition du Prospect dans son onglet «&nbsp;Informations
            fiscales&nbsp;».
          </p>
        </Section>

        <Section title="10. Propriété intellectuelle">
          <p>
            La marque <strong>BUUPP</strong>, son logo, son identité
            graphique, la structure de la plateforme, ses fonctionnalités,
            ses textes, son interface et son code source sont la propriété
            exclusive de Majelink ou font l&apos;objet d&apos;une licence
            autorisant Majelink à les exploiter. Toute reproduction,
            représentation, modification ou exploitation non autorisée est
            interdite et susceptible de poursuites au titre de la
            contrefaçon (articles L.&nbsp;335-2 et suivants du Code de la
            propriété intellectuelle).
          </p>
          <p>
            BUUPP concède à chaque utilisateur une{" "}
            <strong>licence personnelle, non exclusive, non
            transférable</strong> d&apos;utilisation du Service pour la
            durée d&apos;activité de son compte, à l&apos;usage strict des
            fonctionnalités prévues. Cette licence ne confère aucun droit
            de propriété sur la plateforme ou ses composants.
          </p>
          <p>
            Les <strong>données personnelles du Prospect</strong> restent
            sa propriété pleine et entière. Les paliers complétés sont mis
            à disposition des Pros dans le cadre strict des sollicitations
            acceptées (cf. articles 6 et 7).
          </p>
        </Section>

        <Section title="11. Données personnelles">
          <p>
            Le traitement des données personnelles est détaillé dans la{" "}
            <Link
              href="/rgpd"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              politique RGPD
            </Link>
            .
          </p>
        </Section>

        <Section title="12. Disponibilité du service et évolutions">
          <p>
            BUUPP met tout en œuvre pour assurer une{" "}
            <strong>disponibilité continue</strong> du Service mais ne
            saurait garantir une disponibilité de 100&nbsp;%. Des fenêtres
            de maintenance peuvent intervenir, généralement annoncées en
            avance sur la page{" "}
            <Link
              href="/status"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              «&nbsp;Statut&nbsp;»
            </Link>
            . Les indisponibilités liées à un cas de force majeure, à un
            prestataire tiers (Clerk, Supabase, Stripe, Resend, opérateur
            SMS) ou à une attaque informatique ne peuvent engager la
            responsabilité de BUUPP.
          </p>
          <p>
            <strong>Évolutions fonctionnelles.</strong> BUUPP peut faire
            évoluer le Service, ajouter ou retirer des fonctionnalités,
            modifier la grille tarifaire des plans Pro, ou ajuster les
            seuils opérationnels (durées de campagne, BUUPP Score, etc.).
            Les évolutions sont notifiées par message in-app et/ou
            courriel. Les modifications substantiellement défavorables au
            Prospect prennent effet après un préavis de{" "}
            <strong>30&nbsp;jours</strong>, période pendant laquelle le
            Prospect peut clôturer son compte sans conséquence et retirer
            ses gains en attente.
          </p>
        </Section>

        <Section title="13. Suspension et résiliation">
          <p>
            BUUPP peut <strong>suspendre ou résilier</strong> un compte, de
            plein droit et sans préavis, en cas de manquement grave au
            présent contrat, notamment&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              tentative de création de comptes multiples (doublons IBAN,
              téléphone, e-mail) ;
            </li>
            <li>
              fourniture délibérée de données fausses ou trompeuses dans
              les paliers ;
            </li>
            <li>
              signalements répétés «&nbsp;non atteint&nbsp;» (Prospect qui
              accepte des sollicitations sans jamais répondre — cf.
              article&nbsp;5) ;
            </li>
            <li>
              côté Pro&nbsp;: exfiltration, revente, capture en masse ou
              diffusion à un tiers des coordonnées révélées (passibles
              aussi de poursuites pénales) ;
            </li>
            <li>
              usage du Service à des fins illicites, frauduleuses ou
              contraires à l&apos;ordre public ;
            </li>
            <li>
              non-paiement des sommes dues côté Pro (commissions, bonus,
              séquestre).
            </li>
          </ul>
          <p>
            <strong>Procédure côté BUUPP.</strong> Une suspension fait
            l&apos;objet d&apos;une notification motivée par courriel.
            L&apos;utilisateur dispose de <strong>15&nbsp;jours</strong>{" "}
            pour faire valoir ses observations à{" "}
            <a
              href="mailto:contact@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              contact@buupp.com
            </a>
            . En l&apos;absence de réponse ou en cas de manquement
            confirmé, la suspension peut être convertie en résiliation
            définitive ; les BUUPP Coins acquis avant la suspension
            restent retirables sauf cas de fraude caractérisée.
          </p>
          <p>
            <strong>Résiliation côté utilisateur.</strong> L&apos;utilisateur
            peut à tout moment résilier son contrat par la suppression de
            son compte (cf. article&nbsp;4) ou, pour les Pros, en
            résiliant son abonnement depuis l&apos;onglet «&nbsp;Mes
            informations&nbsp;».
          </p>
        </Section>

        <Section title="14. Responsabilité">
          <p>
            BUUPP agit comme un{" "}
            <strong>intermédiaire technique</strong>. Sa responsabilité
            est strictement limitée à la mise à disposition du Service
            conformément aux présentes CGU. BUUPP n&apos;est pas partie
            aux échanges qui surviennent après acceptation d&apos;une
            sollicitation et ne garantit ni la conclusion d&apos;une
            transaction commerciale, ni la satisfaction du Prospect ou du
            Pro vis-à-vis du contenu de l&apos;échange.
          </p>
          <p>
            <strong>Limites.</strong> En dehors des cas de faute lourde ou
            intentionnelle, la responsabilité de BUUPP est limitée aux
            préjudices directs, prévisibles et certains, à
            l&apos;exclusion de tout préjudice indirect (perte de
            chiffre d&apos;affaires, perte de clientèle, atteinte à
            l&apos;image, etc.). En tout état de cause, le montant total
            de la responsabilité de BUUPP au titre d&apos;un sinistre est
            plafonné aux <strong>sommes effectivement versées</strong> par
            l&apos;utilisateur sur les 12&nbsp;derniers mois (côté Pro)
            ou aux <strong>gains effectivement encaissés</strong> sur la
            même période (côté Prospect).
          </p>
          <p>
            <strong>Force majeure.</strong> Ni BUUPP ni l&apos;utilisateur
            ne peut être tenu responsable d&apos;un manquement résultant
            d&apos;un cas de force majeure au sens de
            l&apos;article&nbsp;1218 du Code civil (panne d&apos;un
            prestataire essentiel — Clerk, Supabase, Stripe, opérateurs
            SMS/e-mail, hébergeur Vercel ; attaque informatique majeure ;
            décision d&apos;une autorité administrative ; etc.).
          </p>
          <p>
            <strong>Contenus tiers.</strong> Le motif personnalisé saisi
            par le Pro («&nbsp;le mot du pro&nbsp;») et les éventuelles
            pièces jointes des broadcasts sont publiés sous la
            responsabilité exclusive de leur auteur. Tout contenu signalé
            comme illicite, mensonger ou diffamatoire est retiré par
            BUUPP dans les meilleurs délais.
          </p>
        </Section>

        <Section title="15. Loi applicable et juridiction">
          <p>
            Les présentes CGU sont régies par le{" "}
            <strong>droit français</strong>, à l&apos;exclusion des
            règles de conflit de lois.
          </p>
          <p>
            <strong>Médiation.</strong> Conformément à
            l&apos;article&nbsp;L.&nbsp;612-1 du Code de la consommation,
            tout différend avec un Prospect agissant en qualité de
            consommateur peut, après une tentative préalable de résolution
            amiable auprès du service client de BUUPP, être soumis
            gratuitement à un médiateur de la consommation. Les
            coordonnées du médiateur compétent sont précisées dans la
            page «&nbsp;Contact DPO&nbsp;» et sur la plateforme européenne
            de règlement en ligne des litiges (
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              ec.europa.eu/consumers/odr
            </a>
            ).
          </p>
          <p>
            <strong>Juridiction compétente.</strong> À défaut de règlement
            amiable, tout litige relatif à la formation, à
            l&apos;exécution ou à l&apos;interprétation des présentes CGU
            est de la compétence exclusive des tribunaux du ressort du
            siège social de Majelink, sous réserve des dispositions
            impératives applicables aux consommateurs.
          </p>
        </Section>

        <Section title="Programme Parrain — Fondateur·ice">
          <p>
            Les termes <strong>«&nbsp;parrain·e&nbsp;»</strong> et{" "}
            <strong>«&nbsp;fondateur·ice&nbsp;»</strong> désignent
            indifféremment la même qualité&nbsp;: toute personne s&apos;étant
            inscrite sur la liste d&apos;attente avant la date officielle de
            lancement de BUUPP. Ce statut, permanent, est confirmé à la
            création du compte et ouvre droit à&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              une <strong>priorité de 10 minutes</strong> sur les sollicitations
              «&nbsp;flash deal&nbsp;» (visibles aux parrain·es / fondateur·ices
              avant le grand public)&nbsp;;
            </li>
            <li>
              un <strong>doublement de la récompense</strong> versée pour chaque
              sollicitation acceptée pendant le{" "}
              <strong>1er mois suivant le lancement officiel</strong>, sauf
              indication contraire du professionnel à l&apos;origine de la
              sollicitation&nbsp;;
            </li>
            <li>
              un <strong>code de parrainage personnel</strong> permettant
              d&apos;inviter jusqu&apos;à <strong>10&nbsp;filleul·es</strong>{" "}
              maximum sur la liste d&apos;attente. Au-delà, le lien n&apos;est
              plus utilisable et tout nouvel inscrit utilisant ce code reçoit
              le message «&nbsp;Nombre maximal de filleul·es déjà
              atteint&nbsp;».
            </li>
          </ul>
          <p>
            <strong>Palier VIP au plafond de 10 filleul·es.</strong> Lorsqu&apos;un
            parrain·e atteint le plafond de 10&nbsp;filleul·es inscrit·es sur la
            liste d&apos;attente, il/elle accède à un palier VIP&nbsp;: chaque
            sollicitation acceptée pendant le 1er mois suivant le lancement
            donne droit à un bonus exceptionnel <strong>forfaitaire de
            +5,00&nbsp;€</strong>, en lieu et place du doublement standard. Ce
            bonus n&apos;est appliqué que sur les campagnes dont le budget
            total dépasse <strong>300,00&nbsp;€</strong>&nbsp;; en deçà, le
            doublement standard (×2) demeure applicable.
          </p>
          <p>
            Aucune action n&apos;est requise de la part du parrain·e /
            fondateur·ice&nbsp;: le bénéfice (×2 standard ou +5&nbsp;€ VIP) est
            calculé automatiquement à l&apos;acceptation et notifié par
            courriel.
          </p>
        </Section>

        <div
          style={{
            marginTop: 16,
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="serif"
        style={{
          fontSize: "clamp(22px, 3vw, 28px)",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink-3)",
          textAlign: "justify",
          hyphens: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}
