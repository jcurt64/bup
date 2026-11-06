import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — BUUPP",
  description:
    "Conditions Générales de Vente applicables aux professionnels souscrivant aux services BUUPP.",
};

export default function CgvPage() {
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
          Conditions générales de vente
        </div>
        <PageVersion page="cgv" />
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Achat des services BUUPP
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          Les présentes CGV régissent les commandes passées par les
          professionnels (lancement de campagnes, options payantes,
          recharges de portefeuille) auprès de BUUPP. Elles complètent les
          Conditions Générales d&apos;Utilisation et prévalent en cas de
          contradiction sur le volet commercial.
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
            Les présentes Conditions Générales de Vente (ci-après
            «&nbsp;CGV&nbsp;») régissent les <strong>commandes passées par
            des professionnels</strong> auprès de la société Majelink dans
            le cadre du Service BUUPP&nbsp;: recharge du portefeuille BUUPP, lancement de campagnes,
            révélation de coordonnées prospects.
          </p>
          <p>
            Elles s&apos;adressent <strong>exclusivement</strong> à des
            professionnels au sens de l&apos;article liminaire du Code de
            la consommation (personnes morales ou physiques agissant à des
            fins entrant dans le cadre de leur activité commerciale,
            industrielle, artisanale, libérale ou agricole). Toute
            commande passée vaut acceptation sans réserve des présentes,
            qui complètent les{" "}
            <Link
              href="/cgu"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              CGU
            </Link>{" "}
            et prévalent en cas de contradiction sur le volet commercial.
          </p>
        </Section>

        <Section title="2. Identification du vendeur">
          <p>
            <strong>Majelink</strong> — 12 Impasse des Étriers, 64140 Lons.
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>SIREN&nbsp;: <strong>892 514 167</strong></li>
            <li>RCS&nbsp;: <strong>Pau 892 514 167</strong></li>
            <li>
              Numéro de TVA intracommunautaire&nbsp;:{" "}
              <strong>FR06 892514167</strong>
            </li>
            <li>
              Contact commercial&nbsp;:{" "}
              <a
                href="mailto:contact@buupp.com"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                contact@buupp.com
              </a>
            </li>
          </ul>
        </Section>

        <Section title="3. Description des prestations">
          <p>
            BUUPP est une plateforme SaaS de mise en relation rémunérée
            entre particuliers (prospects) et professionnels. Le Service
            permet au Professionnel&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              de créer des <strong>campagnes ciblées</strong> par objectif,
              palier de données, zone géographique, tranche d&apos;âge,
              niveau de vérification, mots-clés&nbsp;;
            </li>
            <li>
              de bénéficier d&apos;un <strong>BUUPP Score</strong> par
              prospect, reflétant la qualité du profil (complétude des
              paliers, vérification téléphone, taux de réponse
              historique)&nbsp;;
            </li>
            <li>
              d&apos;accéder, après <strong>double consentement</strong>{" "}
              (acceptation du prospect via son tableau de bord), aux
              coordonnées révélées dans l&apos;interface BUUPP&nbsp;:
              l&apos;email est révélé sous forme d&apos;<strong>alias unique{" "}
              <code>prospect+rXXX@buupp.com</code></strong> propre à la relation
              (le vrai email du prospect n&apos;est jamais exposé) ; le téléphone
              et le nom complet sont révélés en clair, chaque accès étant tracé
              dans le journal d&apos;audit BUUPP&nbsp;;
            </li>
            <li>
              s&apos;agissant du <strong>canal téléphonique</strong>, de ne
              démarcher le prospect par téléphone qu&apos;après recueil de son{" "}
              <strong>consentement préalable et spécifique à ce canal</strong>
              &nbsp;: au moment où il accepte une sollicitation, le prospect est
              explicitement informé qu&apos;il est susceptible d&apos;être
              contacté par téléphone et doit le confirmer. Ce dispositif est
              conforme à la <strong>réforme française du démarchage téléphonique
              (bascule vers l&apos;opt-in)</strong> et le consentement reste
              révocable à tout moment&nbsp;;
            </li>
            <li>
              de gérer la facturation, l&apos;historique des campagnes,
              les statistiques d&apos;acceptation et le portefeuille
              depuis son tableau de bord pro.
            </li>
          </ul>
          <p>
            BUUPP propose une <strong>formule unique, sans abonnement ni
            frais d&apos;accès</strong>&nbsp;: campagnes illimitées, jusqu&apos;à
            500&nbsp;prospects par campagne et accès aux paliers de données
            1 à 5 (dans la limite de ce qu&apos;autorise la finalité de la
            campagne au titre du RGPD). Le Professionnel ne paie que les
            acceptations effectives, selon les modalités de l&apos;article&nbsp;4.
          </p>
        </Section>

        <Section title="4. Tarifs et modalités de calcul">
          <p>
            Tous les prix sont exprimés <strong>hors taxes (HT)</strong>.
            La TVA applicable (taux en vigueur) est ajoutée le cas échéant
            sur la facture finale.
          </p>
          <p>
            <strong>Tarif par contact accepté.</strong> Le coût d&apos;une
            mise en relation est calculé à partir du{" "}
            <strong>tarif de palier</strong> sélectionné lors de la
            création de la campagne (cf.{" "}
            <Link
              href="/bareme"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              barème des paliers
            </Link>
            ), multiplié par un{" "}
            <strong>coefficient de durée</strong>&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>Flash 1&nbsp;heure&nbsp;: ×3</li>
            <li>24&nbsp;heures&nbsp;: ×2</li>
            <li>48&nbsp;heures&nbsp;: ×1,5</li>
            <li>7&nbsp;jours et plus&nbsp;: ×1</li>
          </ul>
          <p>
            <strong>Bonus prospect.</strong> Le tarif est doublé (×2)
            lorsque le prospect est <strong>certifié confiance</strong>
            (niveau de vérification le plus élevé)&nbsp;; le Professionnel
            peut au choix activer ou désactiver l&apos;exclusion de ces
            profils dans le wizard de campagne. Pour les prospects
            «&nbsp;parrains/fondateur·ices&nbsp;», cf. la section
            «&nbsp;Bonus Parrain&nbsp;» plus bas.
          </p>
          <p>
            <strong>Commission BUUPP.</strong> Pour{" "}
            <strong>chaque acceptation</strong>, BUUPP facture au
            Professionnel une commission égale à{" "}
            <strong>10&nbsp;% de la rémunération versée au prospect</strong>{" "}
            (bonus «&nbsp;certifié confiance&nbsp;» et coefficient de durée
            inclus, bonus parrain exclu), avec un{" "}
            <strong>minimum de 0,30&nbsp;€ HT par acceptation</strong>&nbsp;: le
            montant retenu est le plus élevé des deux. Exemples&nbsp;: rémunération
            de 1&nbsp;€ → commission de 0,30&nbsp;€&nbsp;; 3&nbsp;€ → 0,30&nbsp;€&nbsp;;
            5&nbsp;€ → 0,50&nbsp;€&nbsp;; 10&nbsp;€ → 1,00&nbsp;€. La commission
            maximale (tous les contacts acceptent) est réservée au lancement
            de la campagne&nbsp;; la commission est débitée à chaque acceptation
            et <strong>remboursée</strong> si le prospect revient sur son
            acceptation. Sans acceptation, aucune commission n&apos;est due.
            Le tarif applicable est celui en vigueur au lancement de la
            campagne.
          </p>
        </Section>

        <Section title="5. Modalités de paiement">
          <p>
            Le paiement s&apos;effectue par <strong>carte bancaire</strong>{" "}
            via notre prestataire <strong>Stripe</strong>, agréé en tant
            qu&apos;établissement de paiement par les autorités
            européennes. Aucune donnée bancaire complète n&apos;est stockée
            sur les serveurs BUUPP&nbsp;; un identifiant client tokenisé
            est conservé pour faciliter les rechargements ultérieurs et
            l&apos;émission de factures.
          </p>
          <p>
            <strong>Recharge du portefeuille.</strong> Le Professionnel
            charge à l&apos;avance son portefeuille BUUPP (en euros). Les
            paiements sont <strong>débités immédiatement</strong> sur la
            carte et créditent le wallet en temps réel.
          </p>
          <p>
            <strong>Débit au lancement.</strong> Au lancement d&apos;une
            campagne, le montant total prévisionnel (budget cible +
            commission BUUPP maximale) est{" "}
            <strong>réservé</strong> sur le wallet (
            <em>wallet_reserved_cents</em>). Cette réserve n&apos;est pas
            encore débitée&nbsp;: elle apparaît comme «&nbsp;engagée&nbsp;» mais
            redevient disponible si la campagne expire sans acceptations.
          </p>
          <p>
            <strong>Débit définitif.</strong> Lors de chaque acceptation
            par un prospect, le tarif correspondant (palier × durée ×
            éventuels bonus) est{" "}
            <strong>débité réellement</strong> du wallet et placé en
            séquestre interne pour reversement au prospect à la clôture de
            campagne&nbsp;; la commission BUUPP de cette acceptation est
            débitée simultanément. La facture pro est éditée à la clôture
            de la campagne ou sur demande.
          </p>
          <p>
            <strong>Recharge automatique (option facultative).</strong> Le
            Professionnel peut activer, depuis la modale de recharge, une{" "}
            <strong>recharge automatique</strong> de son portefeuille. Cette
            option, <strong>désactivée par défaut</strong>, autorise BUUPP
            à débiter automatiquement, via Stripe et sans nouvelle action
            du Professionnel, un montant fixe (choisi entre 50&nbsp;€ et
            10&nbsp;000&nbsp;€) sur le moyen de paiement enregistré, dès
            lors que le solde du wallet passe sous un seuil défini par le
            Professionnel (entre 10&nbsp;€ et 10&nbsp;000&nbsp;€).
          </p>
          <p>
            <strong>Consentement exprès.</strong> L&apos;activation de cette
            option vaut <strong>consentement exprès au débit récurrent</strong>{" "}
            au sens de l&apos;article L.232-3 du Code monétaire et
            financier. Le Professionnel reconnaît être informé du montant,
            du seuil de déclenchement et de la possibilité de débit à tout
            moment, sans préavis individuel autre que les notifications
            automatiques émises par BUUPP (e-mail récapitulatif et
            facture immédiate).
          </p>
          <p>
            <strong>Révocation à tout moment.</strong> Le Professionnel
            peut <strong>désactiver la recharge automatique à tout
            moment</strong>, sans frais ni préavis, depuis la même modale
            de recharge ou via l&apos;endpoint{" "}
            <em>PATCH /api/pro/wallet/auto-recharge</em>. La désactivation
            est immédiate et n&apos;affecte pas les recharges déjà
            réalisées.
          </p>
          <p>
            <strong>Garde-fous.</strong> Pour limiter les débits
            indésirables&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 4 }}>
            <li>
              un <strong>cooldown d&apos;une heure</strong> entre deux
              déclenchements automatiques (évite la boucle en cas
              d&apos;échec de la première tentative)&nbsp;;
            </li>
            <li>
              en cas d&apos;échec (carte refusée, expirée, demande
              d&apos;authentification 3D Secure), le motif est consigné
              et affiché au Professionnel dans la modale recharge
              ; aucun nouvel essai n&apos;est lancé tant que le
              Professionnel n&apos;effectue pas une nouvelle recharge
              manuelle pour mettre à jour son moyen de paiement&nbsp;;
            </li>
            <li>
              chaque débit automatique fait l&apos;objet d&apos;une{" "}
              <strong>facture immédiate</strong> émise au format PDF
              et accessible depuis l&apos;onglet «&nbsp;Facturation&nbsp;».
            </li>
          </ul>
          <p>
            Conformément à l&apos;article L.221-23 du Code de la
            consommation, le présent service de paiement récurrent est
            réservé aux Professionnels et n&apos;ouvre pas droit au délai
            de rétractation (cf.&nbsp;art.&nbsp;9 ci-dessous).
          </p>
        </Section>

        <Section title="6. Absence d&apos;abonnement et de quotas">
          <p>
            Le Service ne comporte <strong>ni abonnement, ni frais
            d&apos;accès, ni quota de campagnes</strong>. Le Professionnel
            peut lancer autant de campagnes qu&apos;il le souhaite, sous
            réserve que son portefeuille couvre le budget et la commission
            maximale de chaque campagne. Seules les options facultatives
            (option «&nbsp;La Vitrine&nbsp;», prolongation de campagne) font
            l&apos;objet d&apos;un prix fixe, indiqué avant leur souscription.
          </p>
        </Section>

        <Section title="7. Crédit du portefeuille et remboursement">
          <p>
            Le crédit BUUPP Coins logé dans le portefeuille pro représente
            une <strong>créance en euros</strong> exclusivement utilisable
            au sein du Service. Il n&apos;est pas remboursable en numéraire
            hors des cas suivants&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              annulation d&apos;une campagne <strong>avant son
              lancement</strong>&nbsp;: la réserve provisoire est libérée
              automatiquement&nbsp;;
            </li>
            <li>
              refus ou non-réponse d&apos;un prospect après acceptation
              partielle&nbsp;: le montant correspondant est restitué au
              wallet par <em>refund</em> automatique&nbsp;;
            </li>
            <li>
              clôture définitive du compte pro à la demande du
              Professionnel et après apurement des campagnes en cours&nbsp;:
              le solde résiduel peut faire l&apos;objet d&apos;un
              remboursement sur demande motivée à{" "}
              <a
                href="mailto:contact@buupp.com"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                contact@buupp.com
              </a>
              {" "}sous 30&nbsp;jours, sous réserve des éventuelles
              commissions impayées ou litiges en cours.
            </li>
          </ul>
          <p>
            La commission BUUPP n&apos;est pas perçue sur les sommes
            remboursées au wallet (refund prospect, annulation pré-lancement).
          </p>
        </Section>

        <Section title="8. Pause et prolongation de campagne">
          <p>
            <strong>Pause.</strong> Chaque campagne peut être mise en
            pause <strong>une seule fois</strong> par le Professionnel
            depuis son tableau de bord, pour une durée indéterminée. Une
            campagne en pause cesse de générer des sollicitations
            visibles aux prospects&nbsp;; la réserve déjà engagée reste en
            place. La reprise se fait en un clic.
          </p>
          <p>
            <strong>Prolongation.</strong> La date de fin d&apos;une
            campagne peut être prolongée moyennant un{" "}
            <strong>complément de réserve</strong> calculé sur la base du
            tarif initial et de la nouvelle durée. Le complément est
            débité du wallet selon les mêmes règles qu&apos;un lancement
            initial.
          </p>
        </Section>

        <Section title="9. Droit de rétractation">
          <p>
            Conformément à l&apos;article L.&nbsp;221-3 du Code de la
            consommation, le <strong>droit de rétractation de 14&nbsp;jours</strong>
            {" "}n&apos;est pas applicable aux contrats conclus entre
            professionnels (B2B), sauf si le Professionnel emploie cinq
            salariés ou moins et que le contrat n&apos;entre pas dans le
            champ principal de son activité.
          </p>
          <p>
            Pour les Professionnels éligibles à cette exception légale,
            une demande de rétractation peut être adressée par courriel à{" "}
            <a
              href="mailto:contact@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              contact@buupp.com
            </a>{" "}
            dans les 14&nbsp;jours suivant la souscription, sous réserve
            qu&apos;aucune campagne n&apos;ait été lancée. Le remboursement
            intervient sous 14&nbsp;jours.
          </p>
        </Section>

        <Section title="10. Engagements du professionnel">
          <p>Le Professionnel s&apos;engage à&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              utiliser le Service à des fins{" "}
              <strong>strictement professionnelles</strong> (interdiction
              de l&apos;achat de palier à titre personnel ou pour le
              compte d&apos;un tiers non identifié)&nbsp;;
            </li>
            <li>
              respecter le <strong>consentement explicite</strong> du
              prospect et la finalité déclarée de la campagne (cf.{" "}
              <Link
                href="/minimisation"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                principe de minimisation
              </Link>
              )&nbsp;;
            </li>
            <li>
              ne <strong>jamais réutiliser, copier, exporter ou revendre</strong>
              {" "}les coordonnées révélées en dehors de la campagne
              concernée. Toutes les fiches contact sont individuellement
              watermarquées et permettent de remonter à la source de toute
              fuite&nbsp;;
            </li>
            <li>
              limiter chaque contact à une seule sollicitation par
              prospect dans le cadre d&apos;une même campagne&nbsp;;
            </li>
            <li>
              agir en tant que <strong>responsable de traitement
              distinct</strong> dès la révélation des coordonnées, et
              respecter à ce titre l&apos;ensemble des obligations
              RGPD (information du prospect, durée de conservation, base
              légale, droits)&nbsp;;
            </li>
            <li>
              régler en temps et en heure les sommes dues (commission,
              bonus parrain·e, recharges) sous peine de suspension du
              compte (cf. article&nbsp;13).
            </li>
          </ul>
        </Section>

        <Section title="11. Envoi via BUUPP et audit anti-fraude">
          <p>
            Pour garantir la qualité de service et le respect du
            règlement BUUPP, certains canaux de contact entre le Pro et
            les Prospects sont <strong>centralisés et tracés</strong>{" "}
            par la plateforme.
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Envoi des emails via BUUPP uniquement</strong> :
              le Pro accepte que les emails à destination des Prospects
              acquis soient envoyés via l&apos;infrastructure d&apos;envoi
              de BUUPP (prestataire e-mail Brevo, Union européenne),
              avec son adresse personnelle en{" "}
              <em>Reply-To</em>. L&apos;adresse email du Prospect
              n&apos;est jamais affichée au Pro dans l&apos;interface
              de composition — elle est résolue côté serveur au moment
              de l&apos;envoi.
            </li>
            <li>
              <strong>Quota</strong> : <strong>1 email maximum</strong>{" "}
              par Prospect et par campagne via la plateforme. Au-delà,
              l&apos;envoi est techniquement refusé. Ce plafond assure
              le respect de l&apos;engagement de non-sur-sollicitation.
            </li>
            <li>
              <strong>Conservation du contenu</strong> : le sujet et le
              corps de chaque email envoyé via BUUPP sont conservés
              pendant <strong>12 mois</strong> à des fins
              d&apos;audit (anti-spam, signalements, enquête
              réglementaire). L&apos;équipe BUUPP peut accéder à ces
              contenus dans le cadre strict d&apos;une investigation
              légitime — pas pour un usage commercial.
            </li>
            <li>
              <strong>Click-to-call audité</strong> : tout clic sur le
              bouton &laquo;&nbsp;Appeler&nbsp;&raquo; est enregistré
              (horodatage, identifiant de la mise en relation,
              identifiant du Pro). L&apos;appel téléphonique
              lui-même se déroule via le réseau standard et
              n&apos;est ni intercepté ni enregistré.
            </li>
            <li>
              <strong>Suivi d&apos;ouverture (pixel)</strong> : pour les
              emails envoyés via BUUPP, un pixel de tracking
              d&apos;ouverture peut être inséré, à condition exclusive
              que le Prospect destinataire ait donné son consentement
              explicite (recommandation CNIL 2025). Le Pro ne peut pas
              forcer l&apos;insertion du pixel ; le consentement est{" "}
              <strong>révocable à tout moment</strong> par le Prospect.
            </li>
            <li>
              <strong>Détection des comportements suspects</strong> :
              tout volume anormal d&apos;actions (plus de 10 clics
              d&apos;appel ou d&apos;envois en 24 heures par le même
              Pro, contenu d&apos;email dupliqué sur plusieurs
              Prospects, etc.) déclenche une alerte interne et peut
              conduire à une enquête, voire à la suspension du compte
              dans les conditions de la section 14.
            </li>
            <li>
              <strong>Hors plateforme</strong> : toute communication
              hors de ces canaux (mail personnel, SMS direct, etc.) est
              à la charge et sous la seule responsabilité du Pro, et
              reste soumise à l&apos;interdiction d&apos;exploiter les
              coordonnées révélées hors du périmètre strict de la
              campagne validée (section 10).
            </li>
          </ul>
        </Section>

        <Section title="12. Garantie et responsabilité">
          <p>
            BUUPP s&apos;engage à mettre en œuvre les{" "}
            <strong>moyens techniques nécessaires</strong> pour assurer
            la disponibilité et la sécurité du Service. Le Service est
            fourni «&nbsp;tel quel&nbsp;»&nbsp;; BUUPP ne garantit pas&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              un taux d&apos;acceptation minimum par campagne (le
              comportement des prospects est par nature aléatoire)&nbsp;;
            </li>
            <li>
              la conclusion d&apos;une transaction commerciale après
              révélation des coordonnées&nbsp;;
            </li>
            <li>
              l&apos;adéquation parfaite entre la finalité commerciale du
              Professionnel et les réponses obtenues.
            </li>
          </ul>
          <p>
            <strong>Limites.</strong> En dehors des cas de faute lourde
            ou intentionnelle, la responsabilité de BUUPP est limitée aux
            préjudices directs, prévisibles et certains&nbsp;; elle est
            plafonnée au <strong>montant total HT versé par le
            Professionnel sur les 12&nbsp;derniers mois</strong>. Sont
            exclus tous préjudices indirects (perte de chiffre
            d&apos;affaires, perte de clientèle, atteinte à
            l&apos;image, etc.).
          </p>
          <p>
            <strong>Force majeure.</strong> Aucune partie ne peut être
            tenue pour responsable en cas de force majeure au sens de
            l&apos;article&nbsp;1218 du Code civil (panne d&apos;un
            prestataire essentiel — Clerk, Supabase, Stripe, Brevo, hébergeur
            Vercel ; cyberattaque majeure ; décision d&apos;une autorité
            administrative ; etc.).
          </p>
        </Section>

        <Section title="13. Données personnelles">
          <p>
            Le traitement des données personnelles côté prospects est encadré
            par notre{" "}
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
            . Le professionnel agit en tant que responsable de traitement
            distinct dès la révélation des coordonnées.
          </p>
        </Section>

        <Section title="14. Suspension du compte professionnel">
          <p>
            BUUPP peut <strong>suspendre ou résilier</strong> de plein
            droit, sans préavis ni indemnité, le compte d&apos;un
            Professionnel en cas de manquement grave aux présentes CGV ou
            aux CGU, notamment&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>exfiltration, revente ou diffusion à un tiers</strong>{" "}
              des coordonnées prospects révélées (passible également de
              poursuites pénales et civiles)&nbsp;;
            </li>
            <li>
              tentative de contournement du double consentement
              (sollicitation hors plateforme avant acceptation, démarchage
              de contacts révélés en dehors de la campagne)&nbsp;;
            </li>
            <li>
              fraude au paiement (chargeback abusif, données carte
              falsifiées)&nbsp;;
            </li>
            <li>
              <strong>non-paiement</strong> d&apos;une somme due au-delà
              de 15&nbsp;jours après mise en demeure (par courriel)&nbsp;;
            </li>
            <li>
              usage du Service à des fins illicites, mensongères ou
              contraires à l&apos;ordre public (escroquerie, démarchage
              déguisé, services interdits, etc.).
            </li>
          </ul>
          <p>
            <strong>Conséquences.</strong> Les campagnes en cours sont
            interrompues. Les réserves provisoires correspondantes sont
            restituées au wallet, sous réserve des sommes effectivement
            engagées (acceptations validées, commissions encourues). Le
            solde résiduel peut être remboursé au Professionnel sauf en
            cas de fraude caractérisée, auquel cas BUUPP se réserve le
            droit de conserver les sommes à titre conservatoire dans
            l&apos;attente d&apos;une décision judiciaire.
          </p>
          <p>
            La résiliation pour faute n&apos;ouvre droit à aucun
            remboursement des commissions et options déjà
            consommées.
          </p>
        </Section>

        <Section title="15. Litiges, médiation et juridiction">
          <p>
            Tout différend entre Majelink et un Professionnel relatif à
            la formation, à l&apos;exécution ou à l&apos;interprétation
            des présentes CGV fait préalablement l&apos;objet d&apos;une{" "}
            <strong>tentative de résolution amiable</strong> par échange
            écrit auprès de{" "}
            <a
              href="mailto:contact@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              contact@buupp.com
            </a>
            . En l&apos;absence d&apos;accord dans un délai de
            30&nbsp;jours, les parties peuvent recourir à toute procédure
            de médiation ou d&apos;arbitrage conventionnel.
          </p>
          <p>
            Les présentes CGV sont régies par le{" "}
            <strong>droit français</strong>. À défaut de résolution
            amiable, tout litige est de la compétence exclusive des{" "}
            <strong>tribunaux du ressort du siège social de Majelink</strong>
            {" "}(Pau, Pyrénées-Atlantiques), y compris en cas de pluralité
            de défendeurs, d&apos;appel en garantie ou de procédure
            d&apos;urgence.
          </p>
        </Section>

        <Section title="Tests &amp; Études — Conditions applicables au Professionnel">
          <p>
            <strong>Principe.</strong> Le module « Tests &amp; Études » permet au
            Professionnel de proposer des campagnes rémunérées de sondage en
            ligne, de test d&apos;un site ou d&apos;une application, ou de visite en
            magasin / rendez-vous d&apos;échange. La tâche est réalisée chez le
            Professionnel ; BUUPP assure la publication, les inscriptions, la
            preuve de réalisation par code individuel, la validation et le
            paiement. Seuls le prénom et un alias e-mail du participant sont
            transmis au Professionnel.
          </p>
          <p>
            <strong>Tout ou rien et réservation.</strong> Le Professionnel fixe
            un nombre minimum et maximum de participants (5 à 500). À la
            publication, le budget maximum (nombre maximum × (rémunération +
            commission)) est <strong>réservé</strong> sur son portefeuille, sans
            être débité. Si le minimum n&apos;est pas atteint à la date limite
            d&apos;inscription, la campagne est annulée, aucune somme n&apos;est
            débitée et aucune donnée n&apos;est transmise. Le Professionnel peut
            annuler sans frais tant que la campagne n&apos;est pas validée.
          </p>
          <p>
            <strong>Paiement.</strong> Seules les participations validées sont
            débitées : rémunération du participant + commission BUUPP de 10 %
            de cette rémunération, avec un minimum de 0,30 € HT par participant.
            Le solde réservé non utilisé est libéré à la clôture.
          </p>
          <p>
            <strong>Validation.</strong> Le Professionnel valide ou refuse chaque
            participation déclarée réalisée dans un délai de{" "}
            <strong>sept (7) jours</strong> ; à défaut, elle est{" "}
            <strong>validée tacitement</strong> et débitée. Tout refus doit être
            motivé (motif choisi dans une liste). Le participant peut contester
            un refus sous sept jours ; BUUPP tranche au vu du code, du
            commentaire et du motif, et sa décision s&apos;impose aux parties.
          </p>
          <p>
            <strong>Engagements et interdictions.</strong> Le Professionnel
            s&apos;engage à ce que sa campagne ne soit ni frauduleuse ni
            trompeuse, à n&apos;exiger des participants aucun paiement ni aucune
            donnée personnelle au-delà de ce qu&apos;exige la tâche, et à ne pas
            proposer de test avec livraison de produit ni portant sur des
            produits de santé, cosmétiques ou compléments alimentaires. Ces
            engagements sont acceptés expressément avant chaque publication.
            Toute infraction entraîne la suspension de la campagne par BUUPP,
            la libération du budget non engagé et peut entraîner la fermeture
            du compte (article 14). Les participations déjà déclarées réalisées
            restent soumises à l&apos;arbitrage de BUUPP.
          </p>
          <p>
            <strong>Mention obligatoire.</strong> Chaque campagne porte la
            mention « Participation rémunérée via BUUPP ». Le Professionnel qui
            publie, cite ou exploite publiquement les avis ou retours obtenus
            s&apos;engage à reprendre cette mention de manière lisible.
          </p>
        </Section>

        <Section title="Bonus Parrain / Fondateur·ice — Conséquence pour le Professionnel">
          <p>
            Les termes <strong>«&nbsp;parrain·e&nbsp;»</strong> et{" "}
            <strong>«&nbsp;fondateur·ice&nbsp;»</strong> désignent, dans les
            présentes, une seule et même qualité (cf. Programme Parrain —
            Fondateur·ice des CGU).
          </p>
          <p>
            <strong>Bonus fondateur·ice de 5,00&nbsp;€ — hors charge du
            Professionnel.</strong> Le bonus de bienvenue de 5,00&nbsp;€ accordé
            aux prospects fondateur·ices est <strong>intégralement financé par
            BUUPP</strong>. Il n&apos;est refacturé à aucun Professionnel, n&apos;entre
            dans aucun budget de campagne et n&apos;affecte ni le tarif des
            paliers, ni la commission. Il n&apos;est débloqué au bénéfice du
            prospect qu&apos;après <strong>trois (3) mois</strong> d&apos;ancienneté
            de son compte <strong>et</strong> au moins{" "}
            <strong>une sollicitation acceptée</strong>, et sur{" "}
            <strong>action volontaire du prospect</strong> (cf. Programme
            Parrain — Fondateur·ice des CGU), sans qu&apos;aucune obligation
            n&apos;en découle pour le Professionnel.
          </p>
          <p>
            Lorsque le Professionnel active le <strong>bonus parrain</strong> sur
            une campagne, les <strong>filleul·es</strong> de tout prospect
            parrain·e / fondateur·ice ciblé reçoivent <strong>également</strong> la
            sollicitation, même s&apos;ils ne remplissent pas les critères de
            ciblage de la campagne. Le filleul·e perçoit la{" "}
            <strong>récompense normale</strong> de mise en relation.
          </p>
          <p>
            En contrepartie de cette portée élargie, <strong>à chaque fois
            qu&apos;un·e filleul·e accepte</strong> une sollicitation issue
            d&apos;une campagne dont le bonus parrain est activé, son parrain·e
            perçoit un <strong>bonus égal à 50&nbsp;% de la récompense du·de la
            filleul·e</strong>, à la charge du Professionnel. Ce bonus est dû à{" "}
            <strong>chaque acceptation</strong> d&apos;un·e filleul·e (et non à la
            seule première), <strong>sans limite de durée</strong>. Le·la
            filleul·e, lui·elle, perçoit la récompense normale (le bonus ne réduit
            pas sa rémunération).
          </p>
          <p>
            Le nombre total d&apos;acceptations (prospects ciblés et filleul·es
            confondus) ne peut <strong>jamais dépasser le quota</strong> de la
            campagne&nbsp;: une fois ce quota atteint, plus aucune acceptation
            n&apos;est possible. Le bonus parrain (50&nbsp;%) constitue un{" "}
            <strong>surcoût</strong> à la charge du Professionnel, débité de son
            solde au moment de l&apos;acceptation du parrain·e.
          </p>
          <p>
            Lors de la création d&apos;une campagne, le Professionnel peut activer
            ou désactiver le bonus parrain. Désactivé, les filleul·es ne sont pas
            sollicité·es et aucun bonus n&apos;est versé. Le Professionnel reconnaît
            être dûment informé de ces mécaniques et surcoûts avant validation de la
            campagne.
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
