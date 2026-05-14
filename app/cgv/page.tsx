import type { Metadata } from "next";
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
          Conditions générales de vente
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
          professionnels (plans Starter / Pro, lancement de campagnes,
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
            le cadre du Service BUUPP&nbsp;: souscription à un abonnement
            (plan «&nbsp;Starter&nbsp;» ou «&nbsp;Pro&nbsp;»),
            recharge du portefeuille BUUPP, lancement de campagnes,
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
              coordonnées révélées dans l&apos;interface BUUPP
              (one-shot par prospect, watermarking individuel)&nbsp;;
            </li>
            <li>
              de gérer la facturation, l&apos;historique des campagnes,
              les statistiques d&apos;acceptation et le portefeuille
              depuis son tableau de bord pro.
            </li>
          </ul>
          <p>
            Deux formules d&apos;abonnement&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Starter</strong>&nbsp;: accès aux paliers 1 à 3, quota
              de <strong>2&nbsp;campagnes</strong> par cycle d&apos;abonnement.
            </li>
            <li>
              <strong>Pro</strong>&nbsp;: accès aux paliers 1 à 5, quota de{" "}
              <strong>10&nbsp;campagnes</strong> par cycle.
            </li>
          </ul>
          <p>
            Les tarifs HT de chaque formule sont indiqués sur la page{" "}
            «&nbsp;Tarifs&nbsp;» de la plateforme et peuvent évoluer dans
            les conditions prévues à l&apos;article&nbsp;4.
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
            (palier vérification le plus élevé)&nbsp;; le Professionnel
            peut au choix activer ou désactiver l&apos;exclusion de ces
            profils dans le wizard de campagne. Pour les prospects
            «&nbsp;parrains/fondateur·ices&nbsp;», cf. la section
            «&nbsp;Bonus Parrain&nbsp;» plus bas.
          </p>
          <p>
            <strong>Commission BUUPP.</strong> Une commission de{" "}
            <strong>10&nbsp;% du budget engagé</strong> est facturée par
            BUUPP au Professionnel sur chaque campagne. Elle est calculée
            au lancement (réserve provisoire) et débitée définitivement au
            prorata des acceptations effectives à la clôture de la
            campagne. Les acceptations nulles ne génèrent aucune
            commission.
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
            commission BUUPP + frais cycle éventuels) est{" "}
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
            campagne. La facture pro est éditée à la fin du cycle ou sur
            demande.
          </p>
        </Section>

        <Section title="6. Cycle de campagne et quotas">
          <p>
            Le quota de campagnes prévu par la formule (2 pour Starter,
            10 pour Pro) s&apos;applique à un <strong>cycle</strong>{" "}
            d&apos;abonnement. Un cycle s&apos;ouvre dès la première
            campagne lancée après une recharge du portefeuille et dure le
            temps de consommer l&apos;intégralité du quota.
          </p>
          <p>
            <strong>Frais d&apos;accès cycle.</strong> Un frais de cycle
            (<strong>19&nbsp;€ HT</strong> pour Starter,{" "}
            <strong>59&nbsp;€ HT</strong> pour Pro) est facturé{" "}
            <strong>une seule fois</strong>, en début de cycle, lors du
            lancement de la 1<sup>re</sup> campagne. Ce frais est prélevé
            sur le wallet&nbsp;; il n&apos;est pas remboursable une fois
            le cycle entamé.
          </p>
          <p>
            <strong>Renouvellement.</strong> À la consommation totale du
            quota, le Professionnel peut ouvrir un nouveau cycle en
            relançant une campagne (re-paiement du frais d&apos;accès) ou
            changer de formule depuis l&apos;onglet «&nbsp;Mes
            informations&nbsp;».
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
              bonus fondateurs, surcoût palier VIP, recharges) sous peine
              de suspension du compte (cf. article&nbsp;13).
            </li>
          </ul>
        </Section>

        <Section title="11. Garantie et responsabilité">
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

        <Section title="12. Données personnelles">
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

        <Section title="13. Suspension du compte professionnel">
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
            remboursement des frais d&apos;abonnement ou de cycle déjà
            consommés.
          </p>
        </Section>

        <Section title="14. Litiges, médiation et juridiction">
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

        <Section title="Bonus Parrain / Fondateur·ice — Conséquence pour le Professionnel">
          <p>
            Les termes <strong>«&nbsp;parrain·e&nbsp;»</strong> et{" "}
            <strong>«&nbsp;fondateur·ice&nbsp;»</strong> désignent, dans les
            présentes, une seule et même qualité (cf. Programme Parrain —
            Fondateur·ice des CGU).
          </p>
          <p>
            Pendant le 1er mois suivant le lancement officiel de BUUPP, chaque
            acceptation d&apos;une sollicitation par un prospect parrain·e /
            fondateur·ice donne lieu à un débit de{" "}
            <strong>2× le tarif palier choisi</strong> sur le solde du
            Professionnel. Lors de la création d&apos;une campagne, le
            Professionnel peut désactiver cette mécanique pour la campagne
            concernée — ses sollicitations resteront alors visibles aux
            parrain·es / fondateur·ices, mais ces dernier·ères gagneront le
            tarif standard.
          </p>
          <p>
            <strong>Palier VIP (10 filleul·es) — surcoût forfaitaire.</strong>{" "}
            Lorsqu&apos;un parrain·e ayant atteint le plafond de 10&nbsp;filleul·es
            accepte une sollicitation, le bonus standard ×2 est remplacé par un{" "}
            <strong>débit forfaitaire de +5,00&nbsp;€</strong> par acceptation
            (en sus du tarif palier). Ce surcoût n&apos;est appliqué que sur
            les campagnes dont le <strong>budget total dépasse
            300,00&nbsp;€</strong>&nbsp;; en deçà, c&apos;est le doublement
            standard qui s&apos;applique. Cette mécanique n&apos;est active que
            pendant le 1er mois suivant le lancement officiel.
          </p>
          <p>
            Le Professionnel reconnaît être dûment informé de ces surcoûts
            avant validation de la campagne. Le récapitulatif présenté à
            l&apos;étape de validation indique explicitement le coût maximal
            projeté avec et sans bonus, ainsi qu&apos;un avertissement dédié
            lorsque le budget dépasse 300&nbsp;€ (déclencheur du palier VIP).
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
