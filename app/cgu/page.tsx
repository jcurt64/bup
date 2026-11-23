import type { Metadata } from "next";
import Image from "next/image";
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
          <Image
            src="/logo.png"
            alt="BUUPP"
            width={800}
            height={295}
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>
        <div
          className="mono caps"
          style={{ color: "var(--ink-4)", marginBottom: 14 }}
        >
          Conditions générales d&apos;utilisation
        </div>
        <PageVersion page="cgu" />
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
              href="https://buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              buupp.com
            </a>{" "}
            (ci-après le «&nbsp;Service&nbsp;»).
          </p>
          <p>
            L&apos;accès à BUUPP est <strong>gratuit</strong> pour les
            Prospects. Les Pros accèdent au Service sans abonnement&nbsp;: ils
            financent les rémunérations versées aux Prospects et une
            commission BUUPP par acceptation (10&nbsp;%, minimum
            0,30&nbsp;€). BUUPP agit comme un{" "}
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
            Les seules données personnelles du Prospect traitées pour la
            mise en relation sont son <strong>prénom</strong>, l&apos;
            <strong>initiale de son nom</strong>, sa{" "}
            <strong>ville</strong>, son <strong>sexe</strong>, sa{" "}
            <strong>tranche d&apos;âge</strong>, son{" "}
            <strong>numéro de téléphone</strong> et son{" "}
            <strong>adresse e-mail</strong>, conformément au principe de
            minimisation (RGPD art.&nbsp;5.1.c). À la création de sa
            campagne, le Pro choisit le ou les modes de contact souhaités
            (téléphone et/ou e-mail) et peut, s&apos;il le souhaite,
            réserver sa campagne à certaines villes, à un sexe ou à une
            tranche d&apos;âge&nbsp;: ces critères servent uniquement à
            déterminer quels Prospects reçoivent la sollicitation, sans que
            la ville, le sexe ou la tranche d&apos;âge d&apos;un Prospect ne
            soient jamais communiqués au Pro. Le prénom et l&apos;initiale
            du nom lui sont communiqués afin de personnaliser l&apos;échange.
          </p>
          <p>
            <strong>Le Pro a-t-il accès aux informations du
            Prospect&nbsp;?</strong> Avant l&apos;acceptation d&apos;une
            sollicitation par le Prospect, le Pro n&apos;a accès à aucune
            de ses données. Après l&apos;acceptation, le Pro voit le prénom
            du Prospect et l&apos;initiale de son nom et, si la campagne
            prévoit un contact par téléphone, obtient son numéro de
            téléphone, à la seule fin de le contacter au sujet de cette
            campagne. L&apos;adresse e-mail du Prospect ne lui est jamais
            communiquée (les e-mails sont relayés par la plateforme BUUPP),
            pas plus que sa ville, son sexe ou sa tranche d&apos;âge.
          </p>
          <p>
            Chaque acceptation donne lieu à une rémunération unique du
            Prospect&nbsp;: une base de 1,00&nbsp;€ multipliée selon la
            durée de la campagne (7&nbsp;jours&nbsp;×1, 48&nbsp;h&nbsp;×1,5,
            24&nbsp;h&nbsp;×2, Flash 1&nbsp;h&nbsp;×3).
          </p>
          <p>
            Le <strong>BUUPP Score</strong> (0-1000) reflète le sérieux du
            profil Prospect&nbsp;: complétude de ses coordonnées, fraîcheur de
            ses informations et taux de fiabilité (notes attribuées par les
            Pros après une mise en relation). Il permet au Prospect de
            valoriser son profil auprès des Pros. Les rémunérations sont versées en{" "}
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
            vérification débloque le niveau{" "}
            <strong>«&nbsp;Vérifié&nbsp;»</strong>, requis pour les retraits
            supérieurs à un seuil défini. Le <strong>doublement de la
            rémunération</strong> n&apos;est en revanche acquis qu&apos;au
            niveau le plus élevé,{" "}
            <strong>«&nbsp;certifié confiance&nbsp;»</strong>.
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
              fournir des informations <strong>exactes et à jour</strong>{" "}
              (prénom, initiale du nom, ville, sexe, tranche d&apos;âge,
              téléphone, adresse e-mail) ;
            </li>
            <li>
              ne <strong>pas créer plusieurs comptes</strong> (les contrôles
              de doublons IBAN, téléphone et e-mail sanctionnent toute
              tentative) ;
            </li>
            <li>
              <strong>répondre dans un délai raisonnable</strong> aux
              sollicitations qu&apos;il a acceptées (par e-mail, SMS,
              appel, ou via le canal indiqué par le Pro). À défaut, un
              Prospect signalé «&nbsp;non atteint&nbsp;» par des
              professionnels fait l&apos;objet d&apos;une <strong>escalade
              graduée</strong>&nbsp;: rappel amical dès le 2<sup>e</sup>{" "}
              signalement, ajustement de son BUUPP Score
              (<strong>−100&nbsp;points</strong>) au 3<sup>e</sup>, puis{" "}
              <strong>mise en pause de l&apos;acceptation de nouvelles
              sollicitations pendant 2&nbsp;mois</strong> au 4<sup>e</sup>.
              Ces mesures sont automatiquement <strong>remises à zéro</strong>{" "}
              à l&apos;issue de la période de pause (cf. article&nbsp;13). Le
              fait de <em>refuser</em> une sollicitation n&apos;entraîne, lui,
              aucune conséquence ;
            </li>
            <li>
              respecter le <strong>droit à la prise de contact</strong>
              {" "}consenti, sans usage abusif des canaux du Pro
              (harcèlement, sollicitation détournée, etc.) ;
            </li>
            <li>
              signaler à BUUPP tout comportement déviant d&apos;un Pro
              (utilisation hors périmètre, démarchage tiers, tentative
              d&apos;obtenir ses coordonnées en dehors de la plateforme).
            </li>
          </ul>
        </Section>

        <Section title="6. Engagements du professionnel">
          <p>Le Pro s&apos;engage à&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              ne contacter le Prospect{" "}
              <strong>que dans le strict cadre de la campagne acceptée</strong>{" "}
              par celui-ci (objectif, sous-type et mode de contact déclarés
              lors de la création de la campagne) ;
            </li>
            <li>
              passer <strong>exclusivement par les outils de la plateforme
              BUUPP</strong> pour obtenir le numéro du Prospect (bouton
              &laquo;&nbsp;Appeler&nbsp;&raquo;) ou lui écrire (e-mails
              relayés)&nbsp;: le Pro ne reçoit jamais l&apos;adresse e-mail
              du Prospect, n&apos;utilise son numéro de téléphone que pour
              l&apos;appeler au sujet de la campagne acceptée et s&apos;interdit
              de chercher à obtenir ses coordonnées par un autre moyen.
              Chaque prise de contact est consignée dans un journal
              d&apos;audit serveur (horodatage, identification du Pro et de
              la relation)&nbsp;;
            </li>
            <li>
              ne <strong>pas copier, exporter, revendre ou diffuser</strong>{" "}
              les informations du Prospect auxquelles il a accès (prénom,
              initiale du nom et, le cas échéant, numéro de téléphone). Tout manquement expose le Pro à une
              résiliation immédiate et à une enquête ;
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
              wallet, paiement des bonus parrain·e et des commissions
              BUUPP).
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
              campagne (objectif, mode de contact, durée) et validation du
              budget&nbsp;;
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
            des échanges, <strong>tous les e-mails</strong> entre le Pro et
            le Prospect passent par la plateforme BUUPP et chaque accès au
            numéro de téléphone du Prospect est journalisé. Le Pro ne reçoit
            jamais l&apos;adresse e-mail du Prospect&nbsp;; il n&apos;obtient
            son numéro de téléphone qu&apos;après l&apos;acceptation de la
            sollicitation, pour une campagne prévoyant un contact par
            téléphone, et à la seule fin de l&apos;appeler au sujet de cette
            campagne.
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Emails Pro → Prospect</strong> : tout email destiné
              au Prospect est rédigé depuis l&apos;espace du Pro et
              transmis par l&apos;infrastructure d&apos;envoi de BUUPP
              (prestataire Brevo), avec l&apos;adresse <em>BUUPP</em> en
              expéditeur. L&apos;adresse e-mail du Prospect{" "}
              <strong>n&apos;est jamais communiquée</strong> au Pro.
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
              <strong>Appels téléphoniques</strong> : après
              l&apos;acceptation du Prospect, le Pro obtient son numéro
              depuis le bouton &laquo;&nbsp;Appeler&nbsp;&raquo; de son
              espace et l&apos;appelle depuis son propre téléphone&nbsp;;
              l&apos;appel ne transite pas par la plateforme BUUPP.
              L&apos;accès au numéro (horodatage, identifiant de la mise en
              relation) est enregistré dans nos journaux d&apos;audit. Le
              contenu de l&apos;appel n&apos;est ni connu ni enregistré par
              BUUPP.
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
            rémunération (base de 1,00&nbsp;€ × multiplicateur de durée ×
            bonus éventuels) est <strong>débité du wallet du Pro</strong> et
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
            sa propriété pleine et entière. Seuls son prénom,
            l&apos;initiale de son nom et, pour les campagnes prévoyant un
            contact par téléphone, son numéro de téléphone sont portés à la
            connaissance du Pro, dans le cadre strict des sollicitations
            acceptées et à la seule fin de le contacter&nbsp;; son adresse
            e-mail, sa ville, son sexe et sa tranche d&apos;âge ne lui sont
            jamais transmis (cf. articles 3, 6 et 8).
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
            prestataire tiers (Clerk, Supabase, Stripe, Brevo — e-mail
            et SMS) ou à une attaque informatique ne peuvent engager la
            responsabilité de BUUPP.
          </p>
          <p>
            <strong>Évolutions fonctionnelles.</strong> BUUPP peut faire
            évoluer le Service, ajouter ou retirer des fonctionnalités,
            modifier la tarification applicable aux Pros, ou ajuster les
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
              fourniture délibérée de données fausses ou trompeuses (identité,
              ville, sexe, tranche d&apos;âge, téléphone, adresse e-mail) ;
            </li>
            <li>
              signalements répétés «&nbsp;non atteint&nbsp;» (Prospect qui
              accepte des sollicitations sans jamais répondre). Ces
              signalements déclenchent d&apos;abord une escalade graduée et
              réversible (rappel, ajustement du BUUPP Score, puis mise en
              pause temporaire de l&apos;acceptation pendant 2&nbsp;mois —
              cf. article&nbsp;5)&nbsp;; la suspension ou la résiliation du
              compte n&apos;est envisagée qu&apos;en cas de persistance
              avérée au-delà de ce dispositif ;
            </li>
            <li>
              côté Pro&nbsp;: contournement de la plateforme pour contacter
              un Prospect, revente, capture en masse ou diffusion à un tiers
              des informations d&apos;un Prospect (passibles aussi de
              poursuites pénales) ;
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
            son compte (cf. article&nbsp;4). Les Pros n&apos;étant soumis à
            aucun abonnement, aucune résiliation distincte n&apos;est
            nécessaire.
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
            page «&nbsp;Contact chargé de la protection des données&nbsp;» et sur la plateforme européenne
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

        <Section title="Tests &amp; Études — Participation des prospects">
          <p>
            Le prospect peut consulter les campagnes « Tests &amp; Études »
            (sondage en ligne, test d&apos;un site ou d&apos;une application, visite
            en magasin ou rendez-vous) et s&apos;y inscrire par un{" "}
            <strong>consentement explicite</strong>. Il doit avoir renseigné
            son prénom et son e-mail.
          </p>
          <p>
            Le prospect peut se retirer tant que la campagne n&apos;est pas
            validée. Si le nombre minimum de participants est atteint, il
            reçoit un <strong>code personnel</strong> à transmettre au
            Professionnel en réalisant la tâche, puis déclare la tâche
            terminée dans BUUPP avant la date limite. Seuls son prénom et
            l&apos;initiale de son nom sont alors communiqués au
            Professionnel&nbsp;; les échanges éventuels passent par la
            plateforme BUUPP.
          </p>
          <p>
            La rémunération est créditée sur le portefeuille BUUPP après
            validation par le Professionnel, ou automatiquement sept (7) jours
            après la déclaration de réalisation. En cas de refus motivé, le
            prospect peut le contester sous sept jours ; BUUPP tranche. Toute
            fausse déclaration de réalisation peut entraîner l&apos;exclusion du
            module, voire la suspension du compte (article 13).
          </p>
          <p>
            Chaque fiche de campagne permet de la <strong>signaler</strong>{" "}
            (arnaque, demande de paiement ou de données personnelles, produit
            interdit, description trompeuse). BUUPP examine les signalements
            et peut suspendre la campagne.
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
              un <strong>bonus fondateur·ice de 5,00&nbsp;€</strong>, crédité au
              portefeuille sous conditions de déblocage (cf. ci-dessous)&nbsp;;
            </li>
            <li>
              à partir de <strong>3&nbsp;filleul·es</strong> inscrit·es, le
              statut de <strong>profil prioritaire</strong>&nbsp;: une{" "}
              <strong>priorité de 20 minutes</strong> sur les sollicitations
              «&nbsp;flash deal&nbsp;», visibles dès leur lancement alors que
              le grand public ne les voit qu&apos;après ce délai&nbsp;;
            </li>
            <li>
              un <strong>bonus parrain·e</strong> égal à{" "}
              <strong>50&nbsp;% de la récompense</strong> perçue par un·e
              filleul·e, versé au parrain·e à <strong>chaque</strong>{" "}
              acceptation de ce·tte filleul·e et <strong>sans limitation de
              durée</strong>. Ce bonus est à la charge du professionnel et
              suppose qu&apos;il ait activé l&apos;option sur sa campagne. Le·la
              filleul·e perçoit, lui·elle, sa récompense normale, que le bonus
              ne réduit pas&nbsp;;
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
            <strong>Bonus fondateur·ice de 5,00&nbsp;€ — conditions de
            déblocage.</strong> Le bonus est inscrit au portefeuille dès la
            création du compte et apparaît dans le solde affiché, mais il y
            figure à l&apos;état{" "}
            <strong>«&nbsp;en attente de déblocage&nbsp;»</strong>&nbsp;: il
            n&apos;est <strong>pas retirable</strong>, et il n&apos;est pas
            davantage pris en compte pour atteindre le seuil minimal de retrait
            de 5,00&nbsp;€ prévu à l&apos;article&nbsp;9 — celui-ci s&apos;apprécie
            sur les seuls gains, bonus exclu. Il le devient lorsque les{" "}
            <strong>deux conditions cumulatives</strong> suivantes sont
            réunies&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>trois (3) mois révolus</strong> depuis la création du
              compte prospect&nbsp;;
            </li>
            <li>
              <strong>au moins une sollicitation acceptée</strong> par le·la
              prospect.
            </li>
          </ul>
          <p>
            <strong>Le déblocage n&apos;est pas automatique.</strong> Dès que
            ces deux conditions sont remplies, le bonus devient{" "}
            <strong>débloquable</strong> et le·la prospect en est informé·e par
            notification et par courriel. Il·elle doit alors le débloquer
            lui·elle-même depuis l&apos;onglet
            «&nbsp;Portefeuille&nbsp;»&nbsp;; les 5,00&nbsp;€ rejoignent à ce
            moment-là le solde disponible et deviennent retirables dans les
            conditions de l&apos;article&nbsp;9. Tant que le déblocage
            n&apos;est pas demandé, la somme reste en attente. Le décompte des
            jours restants est consultable à tout moment au même endroit.
          </p>
          <p>
            Le bonus n&apos;est assorti d&apos;<strong>aucune date
            d&apos;expiration</strong>&nbsp;: qu&apos;il devienne débloquable
            sans être réclamé, ou que les conditions ne soient jamais réunies,
            il demeure acquis et en attente sans limitation de durée. Il est
            versé par BUUPP et n&apos;est à la charge d&apos;aucun
            professionnel. Il ne peut être débloqué qu&apos;une seule fois par
            compte.
          </p>
          <p>
            <strong>Sollicitation élargie des filleul·es.</strong> Lorsqu&apos;un
            professionnel active l&apos;option de bonus parrain·e sur une
            campagne et qu&apos;un·e parrain·e est sollicité·e, ses{" "}
            <strong>filleul·es sont également sollicité·es</strong>. Le
            nombre total d&apos;acceptations reste plafonné au volume de
            contacts financé par le professionnel pour cette campagne.
          </p>
          <p>
            Aucune action n&apos;est requise de la part du parrain·e /
            fondateur·ice&nbsp;: le bonus de 50&nbsp;% est calculé
            automatiquement à l&apos;acceptation du·de la filleul·e et notifié
            par courriel.
          </p>
          <p>
            <strong>Dispositifs supprimés.</strong> Le doublement automatique
            (×2) de la récompense des fondateur·ices pendant le 1er mois suivant
            le lancement, ainsi que le palier VIP et son bonus forfaitaire de
            +5,00&nbsp;€ au plafond de 10&nbsp;filleul·es, <strong>ne sont plus
            en vigueur</strong> et sont remplacés par le bonus parrain·e décrit
            ci-dessus. Demeure applicable, indépendamment du statut de
            fondateur·ice, le <strong>doublement lié au niveau de vérification
            «&nbsp;certifié confiance&nbsp;»</strong> prévu à
            l&apos;article&nbsp;9.
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
