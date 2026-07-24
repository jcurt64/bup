"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Audience = "prospects" | "pros" | "all" | "founders_gold" | "waitlist";

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: "prospects", label: "Tous les prospects", hint: "Envoie à tous les particuliers inscrits." },
  { value: "pros", label: "Tous les pros", hint: "Envoie à tous les comptes professionnels." },
  { value: "all", label: "Tous les utilisateurs", hint: "Prospects + pros — usage parcimonieux." },
  { value: "founders_gold", label: "Fondateurs Or", hint: "Prospects au palier Or (10 filleuls)." },
  { value: "waitlist", label: "Liste d'attente", hint: "Inscrits de la waitlist (email uniquement, sans cloche)." },
];

const MAX_TITLE = 200;
const MAX_BODY = 10_000;
const MAX_VIDEO_LABEL = 90;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.md";

type VideoDraft = { url: string; thumbnailUrl: string; label: string };
const EMPTY_VIDEOS: VideoDraft[] = [
  { url: "", thumbnailUrl: "", label: "" },
  { url: "", thumbnailUrl: "", label: "" },
];

/* ─── Modèle « Lancement officiel » ──────────────────────────────────
   Message prêt à l'envoi pour l'audience liste d'attente, prévu pour
   partir 24 h AVANT l'ouverture : au moment de la lecture, la
   pré-inscription officielle n'est pas encore ouverte. Le mail annonce
   donc l'heure d'ouverture et ne renvoie pas vers le formulaire (qui
   serait un cul-de-sac) mais vers les vidéos, à regarder en attendant.

   Les liens pointent en dur sur www.buupp.com : le back-office peut
   tourner en local, le mail doit toujours viser la prod (et l'API
   refuse les URL non https). */
const SITE = "https://www.buupp.com";

/** Marqueur laissé dans le corps quand la date d'ouverture n'est pas
 *  renseignée. L'envoi est bloqué tant qu'il est présent. */
const DATE_PLACEHOLDER = "[[DATE D'OUVERTURE À COMPLÉTER]]";

/** « 2026-07-30T10:00 » → { date: "jeudi 30 juillet", heure: "10h00" } */
function formatLaunchMoment(value: string): { date: string; heure: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const heure = `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, heure };
}

function buildLaunchBody(launchAt: string): string {
  const moment = formatLaunchMoment(launchAt);
  // Sans date saisie, on laisse un marqueur voyant plutôt qu'une phrase
  // vaguement fausse — l'envoi refusera de partir tant qu'il est là.
  const quand = moment ? `demain ${moment.date}, à ${moment.heure}` : DATE_PLACEHOLDER;
  const heure = moment ? moment.heure : DATE_PLACEHOLDER;
  return [
    "Vous faites partie des tout premiers à avoir réservé votre place sur BUUPP. Merci, sincèrement.",
    "",
    "Cette première vague était une répétition générale : vérifier que le formulaire tenait la route, que les parrainages se comptaient correctement, que les compteurs disaient vrai. Vous nous avez servi de banc d'essai, et ça a fonctionné.",
    "",
    `${quand.charAt(0).toUpperCase()}${quand.slice(1)}, place au lancement officiel.`,
    "",
    "Ce qui change : la pré-inscription officielle s'ouvre, avec les vraies places, les vrais compteurs et les avantages fondateur qui vont avec. Ce qui ne change pas : vous. Vous avez déjà vu comment BUUPP fonctionne — le double consentement, les paliers de données, la rémunération au moment où vous acceptez. Pendant que les autres découvriront, vous saurez déjà quoi faire.",
    "",
    "Concrètement, vous partez avec trois longueurs d'avance :",
    "• vous connaissez le parcours d'inscription, vous irez plus vite ;",
    "• vous savez à quoi sert le parrainage — et les places de fondateur se prennent tôt ;",
    "• vous pouvez expliquer BUUPP autour de vous sans avoir à le réapprendre.",
    "",
    `Ce qu'il y aura à faire : refaire la pré-inscription. Vous connaissez déjà le parcours, il n'a pas changé — la différence, c'est qu'elle est officielle, c'est celle qui compte pour votre place et vos avantages fondateur. Le formulaire ouvre à ${heure} sur www.buupp.com. D'ici là, il n'y a rien à faire : votre place actuelle n'est pas perdue, elle change simplement de vague.`,
    "",
    "En attendant, les deux vidéos ci-dessous montrent le parcours de bout en bout : une depuis un ordinateur, une depuis un téléphone. Deux minutes pour être prêt·e — et de quoi expliquer BUUPP autour de vous sans avoir à le réapprendre.",
    "",
    "Une précision : c'est bien la pré-inscription qui ouvre, pas encore les comptes. La création de compte prospect ou professionnel viendra à la fin de la période de pré-inscription. Une chose à la fois, proprement.",
    "",
    "À demain,",
    "— L'équipe BUUPP",
  ].join("\n");
}

const LAUNCH_TEMPLATE = {
  title: "Demain, BUUPP ouvre officiellement — soyez prêt·e",
  videos: [
    {
      url: `${SITE}/tutoriels#video-1`,
      thumbnailUrl: `${SITE}/videos/pre-inscription-ordinateur.jpg`,
      label: "S'inscrire depuis un ordinateur (1 min 15)",
    },
    {
      url: `${SITE}/tutoriels#video-2`,
      thumbnailUrl: `${SITE}/videos/pre-inscription-mobile.jpg`,
      label: "S'inscrire depuis un téléphone (1 min 30)",
    },
  ] as VideoDraft[],
  // Le formulaire n'est pas encore ouvert au moment de la lecture : le
  // bouton mène aux vidéos, seule destination utile à J-1.
  ctaLabel: "Voir les 2 vidéos →",
  ctaUrl: `${SITE}/tutoriels`,
};

export default function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("prospects");
  const [attachment, setAttachment] = useState<File | null>(null);
  // Blocs vidéo (2 max) + CTA personnalisé — pris en compte par l'audience
  // « liste d'attente » uniquement (cf. template waitlist-broadcast.ts).
  const [videos, setVideos] = useState<VideoDraft[]>(EMPTY_VIDEOS);
  // Date+heure d'ouverture officielle, injectée dans le corps du modèle
  // (le mail part 24 h avant : « demain jeudi 30 juillet, à 10h00 »).
  const [launchAt, setLaunchAt] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Pilote la modale de confirmation custom (remplace `window.confirm`,
  // qui ne respecte pas le design du back-office et passe mal sur mobile).
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Nombre de destinataires réels de la liste d'attente, remonté par
  // l'aperçu d'audience → affiché dans la modale de confirmation.
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setBody("");
    setAudience("prospects");
    setAttachment(null);
    setVideos(EMPTY_VIDEOS);
    setCtaLabel("");
    setCtaUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Remplit le formulaire avec le message de lancement prêt à relire.
   *  La date d'ouverture saisie est injectée dans le corps ; la modifier
   *  ensuite suppose de recharger le modèle (le corps est éditable à la
   *  main, on ne le réécrit pas dans le dos de l'admin). */
  function loadLaunchTemplate() {
    setError(null);
    setSuccess(null);
    setAudience("waitlist");
    setTitle(LAUNCH_TEMPLATE.title);
    setBody(buildLaunchBody(launchAt));
    setVideos(LAUNCH_TEMPLATE.videos.map((v) => ({ ...v })));
    setCtaLabel(LAUNCH_TEMPLATE.ctaLabel);
    setCtaUrl(LAUNCH_TEMPLATE.ctaUrl);
  }

  function patchVideo(index: number, patch: Partial<VideoDraft>) {
    setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function pickFile(file: File | null) {
    setError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Pièce jointe trop volumineuse (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} Mo).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAttachment(file);
  }

  function onSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);

    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError("Titre et contenu requis.");
      return;
    }
    // Garde-fou : le modèle laisse un marqueur voyant tant que la date
    // d'ouverture n'a pas été renseignée. Mieux vaut refuser l'envoi que
    // d'annoncer un lancement « [[DATE À COMPLÉTER]] » à toute la liste.
    if (b.includes(DATE_PLACEHOLDER)) {
      setError(
        "Renseigne la date d'ouverture officielle puis recharge le modèle — le corps du message contient encore un marqueur.",
      );
      return;
    }

    // Bascule sur la modale custom — l'envoi effectif se fait dans
    // `doSend()` après confirmation utilisateur.
    setConfirmOpen(true);
  }

  async function doSend() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("body", body.trim());
      form.set("audience", audience);
      if (attachment) form.set("attachment", attachment);
      // Blocs vidéo + CTA : envoyés seulement pour l'audience liste d'attente
      // (le template des autres audiences ne les exploite pas).
      if (audience === "waitlist") {
        const fieldNames = [
          { url: "videoUrl", thumb: "videoThumbnailUrl", label: "videoLabel" },
          { url: "video2Url", thumb: "video2ThumbnailUrl", label: "video2Label" },
        ];
        videos.forEach((v, i) => {
          const names = fieldNames[i];
          if (!names) return;
          if (v.url.trim()) form.set(names.url, v.url.trim());
          if (v.thumbnailUrl.trim()) form.set(names.thumb, v.thumbnailUrl.trim());
          if (v.label.trim()) form.set(names.label, v.label.trim());
        });
        if (ctaLabel.trim()) form.set("ctaLabel", ctaLabel.trim());
        if (ctaUrl.trim()) form.set("ctaUrl", ctaUrl.trim());
      }

      const res = await fetch("/api/admin/broadcasts", { method: "POST", body: form });
      const json: {
        id?: string;
        recipientCount?: number;
        error?: string;
        debug?: { code?: string; message?: string };
      } = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        const base = errorLabel(json.error) ?? "Échec de l'envoi.";
        // Le bloc `debug` n'est renvoyé qu'en dev (côté API). Permet à
        // l'admin de comprendre immédiatement si la table manque, si RLS
        // bloque, etc. — sans avoir à aller dans les logs.
        const detail = json.debug?.message ? ` — ${json.debug.message}` : "";
        setError(base + detail);
        setConfirmOpen(false);
        return;
      }
      setSuccess(
        `Message créé — ${json.recipientCount ?? 0} destinataire${(json.recipientCount ?? 0) > 1 ? "s" : ""}. Les emails partent en arrière-plan.`,
      );
      reset();
      setConfirmOpen(false);
      // Rafraîchit la table d'historique en bas de la page.
      router.refresh();
    } catch (err) {
      console.error("[BroadcastComposer] submit failed", err);
      setError("Une erreur réseau est survenue.");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const titleLen = title.length;
  const bodyLen = body.length;
  const inputStyle = {
    background: "var(--paper)",
    border: "1px solid var(--line)",
    color: "var(--ink)",
  } as const;

  return (
    <>
    <form className="space-y-4" onSubmit={onSubmit}>
      {/* Raccourci : charge le message d'annonce du lancement officiel
          (audience liste d'attente + 2 vidéos + CTA). Tout reste éditable
          avant l'envoi. */}
      <div
        className="space-y-2.5 rounded-md px-3 py-2.5"
        style={{ background: "var(--ivory-2)", border: "1px dashed var(--line-2)" }}
      >
        <span className="block text-xs" style={{ color: "var(--ink-3)", lineHeight: 1.5 }}>
          Modèle prêt&nbsp;: <strong>annonce du lancement officiel</strong> — liste
          d&apos;attente, 2 vidéos, bouton « Voir les 2 vidéos ». À envoyer{" "}
          <strong>24&nbsp;h avant</strong> l&apos;ouverture&nbsp;: le corps du message dit
          « demain », et la date ci-dessous y est insérée.
        </span>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-52">
            <span
              className="block text-[11px] font-bold uppercase mb-1"
              style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
            >
              Ouverture officielle
            </span>
            <input
              type="datetime-local"
              value={launchAt}
              onChange={(e) => setLaunchAt(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md text-sm px-3 py-2"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            />
          </label>
          <button
            type="button"
            onClick={loadLaunchTemplate}
            disabled={submitting}
            className="rounded-md text-xs font-semibold h-9 px-3 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
          >
            Charger le modèle
          </button>
        </div>
        {launchAt && formatLaunchMoment(launchAt) && (
          <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
            Le message annoncera « demain {formatLaunchMoment(launchAt)!.date}, à{" "}
            {formatLaunchMoment(launchAt)!.heure} » — à envoyer la veille. Changer la date
            après coup suppose de recharger le modèle.
          </p>
        )}
      </div>

      <Field label="Titre" hint={`${titleLen} / ${MAX_TITLE}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder="Ex. Mise à jour des conditions générales"
          required
          disabled={submitting}
          className="w-full rounded-md text-sm px-3 py-2"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        />
      </Field>

      <Field label="Contenu" hint={`${bodyLen} / ${MAX_BODY}`}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder="Écrivez votre message ici. Les retours à la ligne sont préservés."
          required
          rows={8}
          disabled={submitting}
          className="w-full rounded-md text-sm px-3 py-2 leading-relaxed"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            resize: "vertical",
            fontFamily: "var(--sans)",
          }}
        />
      </Field>

      <Field label="Audience">
        <div className="grid sm:grid-cols-2 gap-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audience === opt.value;
            return (
              <label
                key={opt.value}
                className="rounded-md p-3 cursor-pointer transition-colors"
                style={{
                  background: active ? "var(--ink)" : "var(--ivory-2)",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                  border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={active}
                  onChange={() => setAudience(opt.value)}
                  disabled={submitting}
                  className="sr-only"
                />
                <div className="text-sm font-semibold">{opt.label}</div>
                <div
                  className="text-[11px] mt-1"
                  style={{ color: active ? "rgba(255,254,248,0.7)" : "var(--ink-4)" }}
                >
                  {opt.hint}
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      {audience === "waitlist" && <WaitlistAudiencePreview onCount={setWaitlistCount} />}

      {audience === "waitlist" && (
        <div
          className="space-y-4 rounded-md p-3.5"
          style={{ background: "var(--ivory-2)", border: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
          >
            Blocs vidéo &amp; bouton (liste d&apos;attente)
          </div>
          <p className="text-[11px]" style={{ color: "var(--ink-4)", lineHeight: 1.5, marginTop: -8 }}>
            Optionnel, deux vidéos maximum. Chaque bloc a besoin d&apos;une miniature ET
            d&apos;un lien pour être rendu : la miniature devient une vignette cliquable
            (bouton ▶) dans le mail — aucun client mail ne lit une vidéo en ligne. Sans CTA
            personnalisé, le bouton par défaut « Créer mon compte » est conservé.
          </p>

          {videos.map((video, i) => (
            <div
              key={i}
              className="space-y-3 rounded-md p-3"
              style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
            >
              <div
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
              >
                Vidéo {i + 1}
              </div>
              <Field label="Lien de la vidéo" hint="https://…">
                <input
                  type="url"
                  value={video.url}
                  onChange={(e) => patchVideo(i, { url: e.target.value })}
                  placeholder={`https://www.buupp.com/tutoriels#video-${i + 1}`}
                  disabled={submitting}
                  className="w-full rounded-md text-sm px-3 py-2"
                  style={inputStyle}
                />
              </Field>
              <Field label="Miniature (image)" hint="https://… · 16:9, hébergée">
                <input
                  type="url"
                  value={video.thumbnailUrl}
                  onChange={(e) => patchVideo(i, { thumbnailUrl: e.target.value })}
                  placeholder={`https://www.buupp.com/videos/pre-inscription-${i + 1}.jpg`}
                  disabled={submitting}
                  className="w-full rounded-md text-sm px-3 py-2"
                  style={inputStyle}
                />
              </Field>
              <Field label="Légende (optionnel)" hint={`${video.label.length} / ${MAX_VIDEO_LABEL}`}>
                <input
                  type="text"
                  value={video.label}
                  onChange={(e) =>
                    patchVideo(i, { label: e.target.value.slice(0, MAX_VIDEO_LABEL) })
                  }
                  placeholder="S'inscrire sur la liste d'attente (1 min)"
                  disabled={submitting}
                  className="w-full rounded-md text-sm px-3 py-2"
                  style={inputStyle}
                />
              </Field>
            </div>
          ))}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Libellé du bouton (optionnel)" hint={`${ctaLabel.length} / 60`}>
              <input
                type="text"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value.slice(0, 60))}
                placeholder="Créer mon compte →"
                disabled={submitting}
                className="w-full rounded-md text-sm px-3 py-2"
                style={inputStyle}
              />
            </Field>
            <Field label="Lien du bouton (optionnel)" hint="https://…">
              <input
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://www.buupp.com/inscription/prospect"
                disabled={submitting}
                className="w-full rounded-md text-sm px-3 py-2"
                style={inputStyle}
              />
            </Field>
          </div>
        </div>
      )}

      <Field
        label="Pièce jointe (optionnel)"
        hint={attachment ? formatBytes(attachment.size) : "PDF, image, docx, xlsx, txt — max 5 Mo"}
      >
        {/* L'input file natif est masqué : son `click()` est déclenché par
            le bouton ci-dessous pour offrir un visuel cohérent avec le reste
            du composer (un input file brut demande un double-clic et casse
            le rythme visuel des champs). */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          className="sr-only"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="rounded-md text-sm inline-flex items-center gap-2 h-9 px-3 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--paper)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
            onMouseEnter={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--ivory-2)";
            }}
            onMouseLeave={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--paper)";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
            </svg>
            {attachment ? "Changer la pièce jointe" : "Joindre un fichier"}
          </button>
          {attachment && (
            <>
              <span
                className="inline-flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 max-w-full"
                style={{
                  background: "var(--ivory-2)",
                  color: "var(--ink-2)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--mono)",
                }}
                title={attachment.name}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M7 3h8l4 4v14H7V3z" />
                  <path d="M14 3v5h5" />
                </svg>
                <span className="truncate max-w-55">{attachment.name}</span>
              </span>
              <button
                type="button"
                onClick={() => pickFile(null)}
                disabled={submitting}
                aria-label="Retirer la pièce jointe"
                className="rounded-md inline-flex items-center justify-center w-8 h-8 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "transparent",
                  color: "var(--ink-4)",
                  border: "1px solid var(--line)",
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "var(--danger)";
                    e.currentTarget.style.color = "var(--paper)";
                    e.currentTarget.style.borderColor = "var(--danger)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--ink-4)";
                    e.currentTarget.style.borderColor = "var(--line)";
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </Field>

      {error && (
        <div
          className="rounded-md text-sm px-3 py-2"
          style={{
            background: "color-mix(in oklab, var(--danger) 12%, transparent)",
            color: "var(--danger)",
            border: "1px solid color-mix(in oklab, var(--danger) 35%, transparent)",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded-md text-sm px-3 py-2"
          style={{
            background: "color-mix(in oklab, var(--accent) 10%, transparent)",
            color: "var(--accent-ink)",
            border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
          }}
        >
          {success}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 h-10 px-4 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          {submitting ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-spin"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-6.2-8.55" />
              </svg>
              Envoi…
            </>
          ) : (
            "Envoyer le message"
          )}
        </button>
      </div>
    </form>

    {confirmOpen && (
      <ConfirmSendModal
        audience={audience}
        title={title.trim()}
        recipientCount={audience === "waitlist" ? waitlistCount : null}
        videoCount={
          audience === "waitlist"
            ? videos.filter((v) => v.url.trim() && v.thumbnailUrl.trim()).length
            : 0
        }
        hasAttachment={!!attachment}
        attachmentName={attachment?.name ?? null}
        submitting={submitting}
        onCancel={() => { if (!submitting) setConfirmOpen(false); }}
        onConfirm={doSend}
      />
    )}
  </>
  );
}

// Modale de confirmation avant envoi. Pattern aligné sur la modale de
// déconnexion d'AdminShell (paper bg, ombre douce, actions empilées sur
// mobile via `flex-col-reverse sm:flex-row`). Bouton confirm en accent
// car l'action est consequentielle mais pas destructive.
function ConfirmSendModal({
  audience,
  title,
  recipientCount,
  videoCount,
  hasAttachment,
  attachmentName,
  submitting,
  onCancel,
  onConfirm,
}: {
  audience: Audience;
  title: string;
  /** Destinataires réels connus d'avance (audience waitlist), sinon null. */
  recipientCount: number | null;
  videoCount: number;
  hasAttachment: boolean;
  attachmentName: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // ESC ferme la modale tant qu'on n'est pas en plein envoi (sinon on
  // pourrait annuler l'action côté UI pendant que la requête tourne).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const AUDIENCE_LABEL_MAP: Record<Audience, string> = {
    all: "tous les utilisateurs (prospects + pros)",
    prospects: "tous les prospects",
    pros: "tous les pros",
    founders_gold: "les fondateurs Or (10 filleuls)",
    waitlist: "les inscrits de la liste d'attente",
  };
  const audienceLabel = AUDIENCE_LABEL_MAP[audience];
  // Les inscrits waitlist n'ont pas de compte → pas de cloche in-app,
  // uniquement un email. On adapte la phrase de confirmation.
  const isWaitlist = audience === "waitlist";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          boxShadow: "0 18px 48px -16px rgba(15,22,41,.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="broadcast-confirm-title"
          style={{
            fontFamily: "var(--serif)",
            fontSize: "20px",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Envoyer ce message&nbsp;?
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--ink-3)", lineHeight: 1.5 }}
        >
          Le message <strong style={{ color: "var(--ink)" }}>« {title} »</strong> sera
          envoyé par email à <strong style={{ color: "var(--ink)" }}>{audienceLabel}</strong>
          {isWaitlist
            ? " (par email uniquement — ces inscrits n'ont pas encore de compte)."
            : " et apparaîtra dans la cloche de leur espace."}
        </p>

        <div
          className="mt-4 rounded-md px-3 py-2.5 text-xs space-y-1"
          style={{
            background: "var(--ivory-2)",
            border: "1px solid var(--line)",
            color: "var(--ink-2)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.01em",
          }}
        >
          <div className="flex items-start gap-2">
            <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Audience</span>
            <span>{audienceLabel}</span>
          </div>
          {recipientCount !== null && (
            <div className="flex items-start gap-2">
              <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Destinataires</span>
              <span>
                {recipientCount} réel{recipientCount > 1 ? "s" : ""} (comptes de test exclus)
              </span>
            </div>
          )}
          {isWaitlist && (
            <div className="flex items-start gap-2">
              <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Vidéos</span>
              <span>{videoCount > 0 ? `${videoCount} vignette${videoCount > 1 ? "s" : ""}` : "—"}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Pièce jointe</span>
            <span className="truncate" title={attachmentName ?? ""}>
              {hasAttachment ? attachmentName ?? "fichier joint" : "—"}
            </span>
          </div>
        </div>

        <p
          className="mt-3 text-xs"
          style={{ color: "var(--ink-4)", lineHeight: 1.5 }}
        >
          L'envoi est irréversible — une fois lancé, les destinataires recevront le
          mail dans les minutes qui suivent.
        </p>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--paper)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
            onMouseEnter={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--ivory-2)";
            }}
            onMouseLeave={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--paper)";
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "var(--paper)",
              border: "1px solid var(--accent)",
            }}
          >
            {submitting ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="animate-spin"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
                Envoi en cours…
              </>
            ) : (
              "Confirmer l'envoi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Aperçu de l'audience « liste d'attente » ──────────────────────
   La table waitlist mélange de vrais inscrits et des lignes de fixtures
   (parrainage de test, honeypot anti-bot, sondes de diagnostic). L'envoi
   étant irréversible, on montre AVANT confirmation qui recevra le mail et
   ce qui a été écarté, avec le motif. Le filtrage lui-même est fait côté
   serveur (lib/waitlist/test-accounts) — cet aperçu ne fait que le lire. */
type AudiencePreview = {
  totalRows: number;
  recipientCount: number;
  excludedCount: number;
  excluded: { email: string; prenom: string; label: string }[];
  recipients: { email: string; prenom: string; ville: string }[];
};

function WaitlistAudiencePreview({ onCount }: { onCount: (n: number | null) => void }) {
  const [data, setData] = useState<AudiencePreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/broadcasts/audience?audience=waitlist");
        if (!res.ok) throw new Error(String(res.status));
        const json: AudiencePreview = await res.json();
        if (cancelled) return;
        setData(json);
        onCount(json.recipientCount);
      } catch (err) {
        console.error("[BroadcastComposer] audience preview failed", err);
        if (!cancelled) {
          setFailed(true);
          onCount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      onCount(null);
    };
  }, [onCount]);

  if (failed) {
    return (
      <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
        Aperçu de l&apos;audience indisponible — le filtrage des comptes de test reste
        appliqué à l&apos;envoi.
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
        Calcul de l&apos;audience…
      </p>
    );
  }

  return (
    <div
      className="rounded-md p-3.5 space-y-2"
      style={{ background: "var(--ivory-2)", border: "1px solid var(--line)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <strong style={{ color: "var(--ink)" }}>
          {data.recipientCount} destinataire{data.recipientCount > 1 ? "s" : ""} réel
          {data.recipientCount > 1 ? "s" : ""}
        </strong>
        <span style={{ color: "var(--ink-4)" }}>
          sur {data.totalRows} ligne{data.totalRows > 1 ? "s" : ""} en base
          {data.excludedCount > 0 && ` — ${data.excludedCount} écartée${data.excludedCount > 1 ? "s" : ""}`}
        </span>
      </div>

      {data.excludedCount > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] font-semibold cursor-pointer underline"
            style={{ color: "var(--ink-3)", background: "none", border: 0, padding: 0 }}
          >
            {open ? "Masquer" : "Voir"} le détail des lignes écartées
          </button>
          {open && (
            <ul className="space-y-1 mt-1">
              {data.excluded.map((e) => (
                <li
                  key={e.email}
                  className="flex flex-wrap items-baseline gap-x-2 text-[11px]"
                  style={{ fontFamily: "var(--mono)", color: "var(--ink-3)" }}
                >
                  <span className="truncate max-w-70">{e.email}</span>
                  <span style={{ color: "var(--ink-4)" }}>— {e.label}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <label
          className="text-[11px] font-bold uppercase"
          style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
        >
          {label}
        </label>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

function errorLabel(code: string | undefined): string | null {
  switch (code) {
    case "invalid_title":
      return "Titre invalide (vide ou trop long).";
    case "invalid_body":
      return "Contenu invalide (vide ou trop long).";
    case "invalid_audience":
      return "Audience invalide.";
    case "attachment_too_large":
      return "Pièce jointe trop volumineuse (max 5 Mo).";
    case "attachment_mimetype":
      return "Format de pièce jointe non autorisé.";
    case "invalid_url":
      return "Lien invalide (la vidéo, la miniature et le bouton doivent être en https://).";
    case "invalid_cta_label":
      return "Libellé du bouton trop long (max 60 caractères).";
    case "invalid_video_label":
      return "Légende de vidéo trop longue (max 90 caractères).";
    case "invalid_form":
      return "Formulaire invalide.";
    case "insert_failed":
    case "read_failed":
      return "Erreur serveur. Réessayez.";
    default:
      return null;
  }
}
