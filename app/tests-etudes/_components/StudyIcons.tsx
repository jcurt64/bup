/** Icônes (traits 1.8, style Lucide) du module Tests & Études. */
import type { SVGProps } from "react";

export type StudyIconName =
  | "survey" | "product_test" | "visit" | "clock" | "pin" | "users" | "euro" | "check"
  | "shield" | "wallet" | "arrow" | "share" | "flag" | "sparkles" | "timer" | "target" | "search" | "filter" | "lock";

const PATHS: Record<StudyIconName, React.ReactNode> = {
  survey: (<><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  product_test: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="m9.5 10 1.8 1.8L15 8" /></>),
  visit: (<><path d="M4 10 5.5 4h13L20 10" /><path d="M4 10h16v10H4z" /><path d="M10 20v-5h4v5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  timer: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>),
  pin: (<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  euro: (<><path d="M17 6.5A7 7 0 1 0 17 17.5" /><path d="M4 10h9M4 14h9" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>),
  shield: (<><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>),
  wallet: (<><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7z" /><path d="M4 7V6a2 2 0 0 1 2-2h10v3" /><circle cx="16" cy="13.5" r="1.2" /></>),
  arrow: (<path d="M5 12h14M13 6l6 6-6 6" />),
  share: (<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></>),
  flag: (<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>),
  sparkles: (<><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  filter: (<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
};

export function StudyIcon({ name, size = 18, ...rest }: { name: StudyIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {PATHS[name]}
    </svg>
  );
}

/** Dégradé et teinte par type de campagne. */
export const TYPE_THEME: Record<string, { from: string; to: string; soft: string; ink: string; label: string }> = {
  survey: { from: "#6366F1", to: "#A855F7", soft: "#EEF2FF", ink: "#4338CA", label: "Sondage" },
  product_test: { from: "#0EA5E9", to: "#14B8A6", soft: "#ECFEFF", ink: "#0E7490", label: "Test site / appli" },
  visit: { from: "#F97316", to: "#F43F5E", soft: "#FFF7ED", ink: "#C2410C", label: "Visite / rendez-vous" },
};
