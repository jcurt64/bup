/**
 * Mapping partagé `event.type` → rendu humain (icône, label, sous-ligne,
 * lien admin). Utilisé par LiveFeed (colonne live de l'accueil admin) et
 * par NotificationBell (dropdown en header). Ajouter une entrée ici quand
 * un nouveau type d'event mérite un rendu spécifique — les types non
 * mappés retombent sur un fallback brut.
 */

export type AdminEventLike = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  prospect_id: string | null;
  pro_account_id: string | null;
  campaign_id: string | null;
  relation_id: string | null;
  transaction_id: string | null;
  created_at: string;
};

/** Détail enrichi affichable sous l'event (un item = une ligne). */
export type EventDetail = {
  /** Texte principal (ex. nom du pro). */
  label: string;
  /** Texte secondaire à droite (ex. date formatée). */
  value?: string;
};

export type EventMeta = {
  icon: string;
  label: string;
  /** Sous-ligne contextuelle dérivée du payload et des IDs de l'event. */
  subLine?: (ev: AdminEventLike) => string | null;
  /** Liste de détails enrichis (un par ligne) à afficher sous le subLine. */
  details?: (ev: AdminEventLike) => EventDetail[] | null;
  /** Lien admin pertinent (page de détail, liste filtrée, etc.). */
  link?: (ev: AdminEventLike) => string | null;
};

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export const EVENT_META: Record<string, EventMeta> = {
  "prospect.non_atteint_threshold": {
    icon: "🔕",
    label: "Prospect injoignable",
    subLine: (ev) => {
      const count = Number(ev.payload?.count ?? 0);
      return `${count}× signalé non atteint — message gentil envoyé au prospect.`;
    },
    details: (ev) => {
      const pros = ev.payload?.pros;
      if (!Array.isArray(pros) || pros.length === 0) return null;
      return pros.slice(0, 10).map((p) => {
        const pp = p as { raisonSociale?: string; flaggedAt?: string };
        return {
          label: pp.raisonSociale || "Pro anonyme",
          value: formatDateFr(pp.flaggedAt ?? null),
        };
      });
    },
    link: () => "/buupp-admin/non-atteint",
  },
  "prospect.report": {
    icon: "🚩",
    label: "Signalement prospect",
    subLine: (ev) => {
      const reasonLabels: Record<string, string> = {
        sollicitation_multiple: "Sollicitation multiple",
        faux_compte: "Faux compte",
        echange_abusif: "Échange abusif",
      };
      const reason = String(ev.payload?.reason ?? "");
      return reasonLabels[reason] ?? "Signalement";
    },
    link: () => "/buupp-admin/signalements?status=open",
  },
  "admin.report_pro_notified": {
    icon: "✉️",
    label: "Pro notifié d'un signalement",
    subLine: (ev) => {
      const reason = String(ev.payload?.reason ?? "");
      return reason ? `Motif : ${reason}` : "Avertissement transmis au pro";
    },
    // Renvoie vers l'onglet signalements — pour voir l'historique des
    // notifications envoyées et la fiche associée.
    link: () => "/buupp-admin/signalements",
  },
  "waitlist.signup": {
    icon: "📝",
    label: "Inscription liste d'attente",
    subLine: (ev) => {
      const domain = ev.payload?.emailDomain
        ? String(ev.payload.emailDomain)
        : null;
      return domain ? `Email @${domain}` : "Nouvelle inscription";
    },
    link: () => "/buupp-admin/waitlist",
  },
  "waitlist.honeypot_blocked": {
    icon: "🛡️",
    label: "Bot bloqué (honeypot waitlist)",
    subLine: () => "Tentative bot interceptée silencieusement",
    // Pas de page de détail dédiée pour les bots — on renvoie sur la
    // waitlist où l'admin peut voir le contexte global des inscriptions.
    link: () => "/buupp-admin/waitlist",
  },
  "prospect.tier_completed": {
    icon: "🎯",
    label: "Palier complété",
    subLine: (ev) => {
      const tier = ev.payload?.tier;
      return tier ? `Palier ${tier}` : "Palier complété par un prospect";
    },
    // Renvoie vers la fiche prospect quand on a l'id, sinon liste prospects.
    link: (ev) =>
      ev.prospect_id ? `/buupp-admin/prospects/${ev.prospect_id}` : "/buupp-admin/prospects",
  },
  // Ajoute ici d'autres types quand pertinents.
};
