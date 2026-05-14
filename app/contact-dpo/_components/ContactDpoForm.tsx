"use client";

import { useEffect, useState } from "react";

/**
 * Formulaire de contact DPO inline dans /contact-dpo. POST vers
 * /api/contact-dpo (pas d'auth requise — un ex-utilisateur doit pouvoir
 * écrire au DPO). Le honeypot `website` reste invisible aux humains et
 * absorbe l'essentiel des bots qui remplissent tout. Le rendu reste
 * cohérent avec le style éditorial des pages footer (ivoire, accent
 * BUUPP, typographie serif sur les titres).
 */

type Feedback = { kind: "ok" | "err"; text: string } | null;

const REQUEST_TYPES: { id: string; label: string }[] = [
  { id: "access", label: "Accès à mes données" },
  { id: "rectification", label: "Rectification d'une donnée" },
  { id: "erasure", label: "Effacement de mon compte" },
  { id: "objection", label: "Opposition au traitement" },
  { id: "restriction", label: "Limitation du traitement" },
  { id: "portability", label: "Portabilité de mes données" },
  { id: "leak", label: "Signalement d'une fuite supposée" },
  { id: "other", label: "Autre demande RGPD" },
];

const MAX_MESSAGE = 4000;

/**
 * Modèles de courrier RGPD préformatés. Le pro/prospect choisit un type
 * et clique « Choisir ce modèle » : le contenu remplit le textarea, à
 * personnaliser ensuite (champs entre crochets). Les références aux
 * articles RGPD sont précisées pour rendre la demande recevable
 * immédiatement par le DPO.
 */
const TEMPLATES: Record<string, { subject: string; body: string }> = {
  access: {
    subject: "Demande d'accès à mes données personnelles (RGPD art. 15)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 15 du Règlement européen sur la protection " +
      "des données (RGPD), je souhaite exercer mon droit d'accès aux données " +
      "personnelles que la société Majelink (BUUPP) détient à mon sujet.\n\n" +
      "Pourriez-vous me communiquer, dans un format structuré et lisible :\n" +
      "  • la liste complète des données me concernant que vous traitez ;\n" +
      "  • les finalités de chaque traitement ;\n" +
      "  • les destinataires ou catégories de destinataires ;\n" +
      "  • la durée de conservation prévue pour chaque catégorie ;\n" +
      "  • l'origine des données (lorsqu'elles n'ont pas été collectées " +
      "directement auprès de moi).\n\n" +
      "Vous trouverez ci-joint un justificatif d'identité afin de me permettre " +
      "d'exercer ce droit en toute sécurité.\n\n" +
      "Je vous remercie par avance et reste à votre disposition pour toute " +
      "précision complémentaire.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]\n" +
      "[E-mail associé à votre compte BUUPP]",
  },
  rectification: {
    subject: "Demande de rectification de données (RGPD art. 16)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 16 du RGPD, je vous prie de bien vouloir " +
      "rectifier les données suivantes me concernant :\n\n" +
      "  • Donnée concernée : [exemple : adresse postale, prénom, téléphone…]\n" +
      "  • Valeur actuellement enregistrée : [valeur erronée]\n" +
      "  • Valeur correcte à enregistrer : [valeur exacte]\n\n" +
      "Ces données sont rattachées au compte BUUPP associé à l'adresse " +
      "e-mail [votre e-mail BUUPP].\n\n" +
      "Je vous remercie de bien vouloir effectuer cette mise à jour dans les " +
      "meilleurs délais, et de me confirmer la rectification par retour de " +
      "courriel.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
  erasure: {
    subject: "Demande d'effacement de mon compte (RGPD art. 17)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 17 du RGPD (droit à l'effacement, dit " +
      "« droit à l'oubli »), je vous prie de bien vouloir procéder à la " +
      "suppression définitive de l'ensemble des données personnelles " +
      "associées à mon compte BUUPP, identifié par l'adresse e-mail " +
      "[votre e-mail BUUPP].\n\n" +
      "Je vous remercie de me confirmer, dans le délai légal d'un mois :\n" +
      "  • la suppression effective de mon profil et de toutes les données " +
      "liées (paliers, historique de campagnes, portefeuille, etc.) ;\n" +
      "  • la liste des éventuelles données conservées au titre d'une " +
      "obligation légale (archives comptables, déclarations DGFiP) et la " +
      "durée pendant laquelle elles seront conservées.\n\n" +
      "J'ai bien compris que cette suppression est irréversible et entraîne " +
      "la perte des éventuels BUUPP Coins non encore retirés.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]\n" +
      "[E-mail associé à votre compte BUUPP]",
  },
  objection: {
    subject: "Opposition au traitement de mes données (RGPD art. 21)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 21 du RGPD, je m'oppose au(x) " +
      "traitement(s) suivant(s) de mes données personnelles par la société " +
      "Majelink (BUUPP) :\n\n" +
      "  • [exemple : pixel de mesure d'ouverture des e-mails BUUPP] ;\n" +
      "  • [exemple : prospection commerciale par e-mail / SMS] ;\n" +
      "  • [autre traitement à préciser].\n\n" +
      "Mon opposition prend effet à compter de la réception de la présente " +
      "demande. Je vous remercie de me confirmer la prise en compte de ce " +
      "choix dans les délais légaux et de cesser, dès lors, le(s) " +
      "traitement(s) visé(s).\n\n" +
      "Compte BUUPP concerné : [votre e-mail BUUPP].\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
  restriction: {
    subject: "Demande de limitation du traitement (RGPD art. 18)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 18 du RGPD, je vous prie de bien vouloir " +
      "limiter le traitement de mes données personnelles, dans l'attente :\n\n" +
      "  • [exemple : de la vérification d'une donnée inexacte que j'ai " +
      "signalée] ;\n" +
      "  • [exemple : de l'examen d'une demande d'opposition que j'ai déjà " +
      "introduite].\n\n" +
      "Dans cette période, je vous demande de conserver mes données sans " +
      "les utiliser activement (pas de mise en relation, pas de " +
      "communication commerciale, pas de pixel de tracking).\n\n" +
      "Compte BUUPP concerné : [votre e-mail BUUPP].\n\n" +
      "Je vous remercie de bien vouloir m'accuser réception de cette demande " +
      "et de m'informer dès la levée de la limitation.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
  portability: {
    subject: "Demande de portabilité de mes données (RGPD art. 20)",
    body:
      "Madame, Monsieur,\n\n" +
      "En application de l'article 20 du RGPD, je souhaite exercer mon " +
      "droit à la portabilité des données me concernant.\n\n" +
      "Je vous prie de bien vouloir me transmettre, dans un format " +
      "structuré, couramment utilisé et lisible par machine (de préférence " +
      "JSON ou CSV), l'ensemble des données que je vous ai fournies dans " +
      "le cadre de l'exécution de mon contrat avec BUUPP :\n\n" +
      "  • mes paliers de profil (identification, localisation, style de " +
      "vie, données pro, patrimoine) ;\n" +
      "  • mon historique de campagnes acceptées et refusées ;\n" +
      "  • mon historique financier (BUUPP Coins crédités, retraits) ;\n" +
      "  • mes préférences de communication.\n\n" +
      "Compte BUUPP concerné : [votre e-mail BUUPP].\n\n" +
      "Je vous remercie de me transmettre ces données dans le délai légal " +
      "d'un mois.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
  leak: {
    subject: "Signalement d'une fuite supposée de données",
    body:
      "Madame, Monsieur,\n\n" +
      "Je souhaite porter à votre connaissance des faits laissant penser " +
      "qu'une fuite ou un usage abusif de mes données personnelles est " +
      "intervenu(e) en lien avec mon compte BUUPP.\n\n" +
      "Description des faits :\n" +
      "  • Date et heure des faits constatés : [JJ/MM/AAAA, HH:MM]\n" +
      "  • Canal concerné (e-mail, SMS, appel, courrier postal) : [préciser]\n" +
      "  • Émetteur du contact non sollicité (raison sociale ou numéro) : " +
      "[préciser]\n" +
      "  • Objet du contact : [résumé]\n" +
      "  • Élément(s) trahissant l'usage de mes données BUUPP : [ex. : " +
      "mention de mon palier non public, référence à BUUPP, etc.]\n\n" +
      "Compte BUUPP concerné : [votre e-mail BUUPP].\n\n" +
      "Je vous remercie de bien vouloir ouvrir une enquête, identifier " +
      "l'origine de la fuite et m'informer des mesures correctives " +
      "engagées. Je rappelle qu'en application de l'article 33 du RGPD, " +
      "toute violation de données doit faire l'objet d'une notification " +
      "à la CNIL dans les 72 heures lorsque la fuite est avérée.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
  other: {
    subject: "Demande RGPD diverse",
    body:
      "Madame, Monsieur,\n\n" +
      "Je vous contacte au sujet de mes données personnelles traitées par " +
      "la société Majelink (BUUPP).\n\n" +
      "Objet précis de ma demande :\n" +
      "[décrivez votre demande en quelques lignes — par exemple : question " +
      "sur la conformité d'un traitement, retrait d'un consentement " +
      "spécifique, demande de précision sur un sous-traitant, etc.]\n\n" +
      "Compte BUUPP concerné : [votre e-mail BUUPP].\n\n" +
      "Je vous remercie de bien vouloir m'apporter une réponse dans les " +
      "délais légaux prévus par le RGPD.\n\n" +
      "Cordialement,\n" +
      "[Votre prénom et nom]",
  },
};

export default function ContactDpoForm() {
  const [requestType, setRequestType] = useState("access");
  const [email, setEmail] = useState("");
  // Pré-rempli avec le modèle de la valeur initiale de requestType pour
  // qu'on voie le courrier type dès l'ouverture de la page (le user a
  // demandé que le modèle soit visible « dès le départ »).
  const [subject, setSubject] = useState(TEMPLATES.access.subject);
  const [message, setMessage] = useState(TEMPLATES.access.body);
  const [consent, setConsent] = useState(false);
  // Honeypot — caché en CSS, doit rester vide.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Toggle entre "utiliser le modèle pré-rédigé" et "saisir mon propre
  // message". Quand true, tout changement de requestType remplit auto le
  // textarea avec le modèle correspondant.
  const [useTemplate, setUseTemplate] = useState(true);
  // Buffer du texte rédigé en mode "libre" : on garde la dernière saisie
  // de l'utilisateur pour la restituer s'il bascule vers un modèle puis
  // revient en mode libre. Vide tant que l'utilisateur n'a rien tapé.
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  // Popup de confirmation après envoi réussi. On capture email + libellé
  // type au moment du submit pour que la modale puisse les afficher
  // même après le reset du form (state remis à zéro juste après).
  const [successInfo, setSuccessInfo] = useState<{
    email: string;
    requestLabel: string;
  } | null>(null);

  // Fermeture de la modale de succès via Escape — UX standard.
  useEffect(() => {
    if (!successInfo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSuccessInfo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [successInfo]);

  // Synchronise message + objet avec le modèle quand on change de type
  // de demande, à condition d'être en mode "modèle".
  useEffect(() => {
    if (!useTemplate) return;
    const tpl = TEMPLATES[requestType];
    if (!tpl) return;
    setSubject(tpl.subject);
    setMessage(tpl.body);
  }, [requestType, useTemplate]);

  function toggleTemplate() {
    if (useTemplate) {
      // Passage en mode "rédaction libre" — on restitue le brouillon
      // précédemment saisi (s'il existe), sinon feuille blanche.
      setUseTemplate(false);
      setSubject(customSubject);
      setMessage(customMessage);
      setFeedback(null);
    } else {
      // Retour au modèle — on mémorise d'abord la saisie libre courante
      // pour pouvoir la restituer plus tard si l'utilisateur rebascule.
      setCustomSubject(subject);
      setCustomMessage(message);
      setUseTemplate(true);
      const tpl = TEMPLATES[requestType];
      if (tpl) {
        setSubject(tpl.subject);
        setMessage(tpl.body);
      }
      setFeedback({
        kind: "ok",
        text: "Modèle inséré. Personnalisez les champs entre [crochets] avant d'envoyer.",
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);

    // Validation côté client (en miroir du serveur).
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedback({ kind: "err", text: "Adresse e-mail invalide." });
      return;
    }
    if (!subject.trim()) {
      setFeedback({ kind: "err", text: "L'objet est requis." });
      return;
    }
    if (!message.trim()) {
      setFeedback({ kind: "err", text: "Le message ne peut pas être vide." });
      return;
    }
    if (message.length > MAX_MESSAGE) {
      setFeedback({
        kind: "err",
        text: `Message trop long (${MAX_MESSAGE} caractères max).`,
      });
      return;
    }
    if (!consent) {
      setFeedback({
        kind: "err",
        text: "Veuillez cocher la case de consentement.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/contact-dpo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          consent,
          website, // honeypot
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        setFeedback({
          kind: "err",
          text: j?.message || "Envoi impossible. Réessayez.",
        });
        return;
      }
      // Ouvre la modale de confirmation — on capture email + libellé
      // AVANT le reset pour pouvoir les afficher dans le popup.
      setFeedback(null);
      setSuccessInfo({
        email: email.trim(),
        requestLabel:
          REQUEST_TYPES.find((rt) => rt.id === requestType)?.label ??
          "demande RGPD",
      });
      // Reset : on remet l'état initial. Si on est en mode modèle,
      // le useEffect re-remplira automatiquement message + sujet à
      // partir du nouveau requestType "access".
      setRequestType("access");
      setEmail("");
      setConsent(false);
      // Vide aussi le brouillon libre — un nouveau cycle de saisie
      // libre repart d'une feuille blanche.
      setCustomSubject("");
      setCustomMessage("");
      if (useTemplate) {
        setSubject(TEMPLATES.access.subject);
        setMessage(TEMPLATES.access.body);
      } else {
        setSubject("");
        setMessage("");
      }
    } catch {
      setFeedback({
        kind: "err",
        text: "Erreur réseau. Réessayez dans un instant.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="dpo-form" onSubmit={onSubmit} noValidate>
      <div className="dpo-row">
        <label htmlFor="dpo-type">
          <span className="dpo-label">Type de demande</span>
          <select
            id="dpo-type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            required
          >
            {REQUEST_TYPES.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="dpo-email">
          <span className="dpo-label">
            E-mail de contact <span aria-hidden="true">*</span>
          </span>
          <input
            id="dpo-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@example.com"
            required
            maxLength={320}
          />
        </label>
      </div>

      <label htmlFor="dpo-subject">
        <span className="dpo-label">
          Objet <span aria-hidden="true">*</span>
        </span>
        <input
          id="dpo-subject"
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            // En mode libre, on persiste le brouillon en temps réel pour
            // qu'un aller-retour modèle ↔ libre n'efface pas la saisie.
            if (!useTemplate) setCustomSubject(e.target.value);
          }}
          placeholder="Ex. : demande d'effacement de mon compte"
          required
          maxLength={200}
        />
      </label>

      <label htmlFor="dpo-message">
        <span className="dpo-label">
          Message <span aria-hidden="true">*</span>
          <span className="dpo-count">
            {message.length} / {MAX_MESSAGE}
          </span>
        </span>
        <textarea
          id="dpo-message"
          rows={11}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (!useTemplate) setCustomMessage(e.target.value);
          }}
          placeholder="Décrivez votre demande aussi précisément que possible. Vous pouvez aussi cliquer sur « Choisir ce modèle » ci-dessous pour pré-remplir un courrier type adapté au type de demande sélectionné."
          required
          maxLength={MAX_MESSAGE}
        />
      </label>

      {/* Toggle modèle / rédaction libre. Le textarea ci-dessus contient
          déjà le modèle correspondant au type de demande sélectionné.
          Clic → bascule en mode libre (textarea vidé). */}
      <div className="dpo-template-row">
        <span className="dpo-template-hint">
          {useTemplate
            ? "Le modèle pré-rédigé est inséré. Modifiez les champs entre [crochets] ou rédigez votre propre courrier."
            : "Vous rédigez votre propre message. Vous pouvez revenir au modèle à tout moment."}
        </span>
        <button
          type="button"
          className="dpo-template-btn"
          onClick={toggleTemplate}
          aria-pressed={useTemplate}
        >
          {useTemplate
            ? "Je saisis mon message par moi-même"
            : "Je choisis et complète le modèle type ↓"}
        </button>
      </div>

      {/* Honeypot — caché aux humains, leurre pour les bots. */}
      <label
        htmlFor="dpo-website"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        tabIndex={-1}
      >
        Site web (laisser vide)
        <input
          id="dpo-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      <label className="dpo-consent" htmlFor="dpo-consent">
        <input
          id="dpo-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          J&apos;accepte que les informations transmises ci-dessus soient
          utilisées par Majelink à seule fin de traiter ma demande RGPD,
          conformément à la <a href="/rgpd">politique RGPD</a>. Ces
          informations seront supprimées après clôture du dossier.
        </span>
      </label>

      <div className="dpo-actions">
        <button
          type="submit"
          disabled={submitting}
          className="dpo-submit"
        >
          {submitting ? "Envoi en cours…" : "Envoyer ma demande"}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={
            feedback.kind === "ok" ? "dpo-feedback ok" : "dpo-feedback err"
          }
        >
          {feedback.text}
        </div>
      )}

      {successInfo && (
        <div
          className="dpo-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dpo-success-title"
          onClick={() => setSuccessInfo(null)}
        >
          <div
            className="dpo-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="dpo-modal-close"
              aria-label="Fermer"
            >
              ✕
            </button>
            <div className="dpo-modal-check" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="5 12 10 17 19 8" />
              </svg>
            </div>
            <h2 id="dpo-success-title" className="dpo-modal-title">
              Votre demande a bien été transmise
            </h2>
            <p className="dpo-modal-text">
              Un mail récapitulatif vient d&apos;être envoyé à{" "}
              <strong>{successInfo.email}</strong>. Notre DPO traitera votre
              demande (<em>{successInfo.requestLabel}</em>) et reviendra vers
              vous dans un délai d&apos;un mois maximum, conformément au RGPD.
            </p>
            <p className="dpo-modal-text-sm">
              Pensez à vérifier vos spams si vous ne voyez rien arriver dans
              les minutes qui viennent.
            </p>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="dpo-modal-cta"
            >
              C&apos;est noté, merci
            </button>
          </div>
        </div>
      )}

      <style>{`
        .dpo-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px 20px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 12px;
        }
        .dpo-row {
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .dpo-row { grid-template-columns: 1fr 1fr; }
        }
        .dpo-form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
        }
        .dpo-label {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          color: var(--ink-2);
          font-weight: 500;
          font-size: 13px;
        }
        .dpo-count {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-5);
          font-weight: 400;
        }
        .dpo-form input[type="text"],
        .dpo-form input[type="email"],
        .dpo-form select,
        .dpo-form textarea {
          width: 100%;
          padding: 9px 11px;
          border-radius: 8px;
          border: 1px solid var(--line-2);
          background: var(--ivory);
          color: var(--ink);
          font-size: 14px;
          font-family: inherit;
          transition: border-color .15s, box-shadow .15s;
          box-sizing: border-box;
        }
        .dpo-form textarea {
          resize: vertical;
          min-height: 140px;
        }
        .dpo-form input:focus,
        .dpo-form select:focus,
        .dpo-form textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent);
        }
        .dpo-consent {
          flex-direction: row !important;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-3);
        }
        .dpo-consent input { margin-top: 3px; }
        .dpo-consent a {
          color: var(--accent);
          text-decoration: underline;
        }
        .dpo-template-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: color-mix(in oklab, var(--accent) 6%, var(--paper));
          border: 1px dashed color-mix(in oklab, var(--accent) 40%, var(--line-2));
          border-radius: 8px;
          margin-top: -4px;
        }
        .dpo-template-hint {
          flex: 1 1 220px;
          font-size: 12.5px;
          line-height: 1.45;
          color: var(--ink-3);
        }
        .dpo-template-btn {
          flex-shrink: 0;
          padding: 8px 16px;
          background: var(--paper);
          color: var(--accent);
          border: 1px solid color-mix(in oklab, var(--accent) 50%, var(--line-2));
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, color .15s;
          font-family: inherit;
        }
        .dpo-template-btn:hover {
          background: var(--accent);
          color: var(--paper);
        }
        @media (max-width: 480px) {
          .dpo-template-btn { width: 100%; }
        }
        .dpo-actions {
          display: flex;
          justify-content: flex-end;
        }
        .dpo-submit {
          padding: 10px 22px;
          background: var(--ink);
          color: var(--paper);
          border: 0;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, transform .15s;
        }
        .dpo-submit:hover:not(:disabled) {
          background: var(--accent);
        }
        .dpo-submit:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        @media (max-width: 480px) {
          .dpo-submit { width: 100%; }
        }
        .dpo-feedback {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
        }
        .dpo-feedback.ok {
          background: color-mix(in oklab, #22c55e 10%, var(--paper));
          border: 1px solid color-mix(in oklab, #22c55e 35%, transparent);
          color: #15803d;
        }
        .dpo-feedback.err {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        /* ─── Modale de confirmation après envoi réussi ──────────── */
        .dpo-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 22, 41, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          animation: dpo-fade-in 180ms ease-out;
        }
        @keyframes dpo-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dpo-pop-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dpo-modal {
          position: relative;
          width: 100%;
          max-width: 460px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 32px 28px 24px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
          animation: dpo-pop-in 200ms ease-out;
        }
        .dpo-modal-close {
          position: absolute;
          top: 12px;
          right: 14px;
          background: transparent;
          border: 0;
          color: var(--ink-4);
          font-size: 18px;
          line-height: 1;
          padding: 6px;
          cursor: pointer;
          border-radius: 6px;
        }
        .dpo-modal-close:hover {
          background: var(--ivory-2);
          color: var(--ink);
        }
        .dpo-modal-check {
          width: 56px;
          height: 56px;
          margin: 0 auto 14px;
          border-radius: 50%;
          background: color-mix(in oklab, #22c55e 14%, var(--paper));
          color: #15803d;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid color-mix(in oklab, #22c55e 40%, transparent);
        }
        .dpo-modal-title {
          margin: 0 0 10px;
          font-family: var(--serif, Georgia, serif);
          font-size: 22px;
          line-height: 1.25;
          color: var(--ink);
          font-weight: 500;
          letter-spacing: -0.01em;
        }
        .dpo-modal-text {
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.55;
          color: var(--ink-3, #3A4150);
        }
        .dpo-modal-text-sm {
          margin: 0 0 18px;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-4, #6B7180);
        }
        .dpo-modal-cta {
          display: inline-block;
          padding: 10px 22px;
          background: var(--ink);
          color: var(--paper);
          border: 1px solid var(--ink);
          border-radius: 999px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .dpo-modal-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px -8px rgba(15, 22, 41, 0.45);
        }
      `}</style>
    </form>
  );
}
