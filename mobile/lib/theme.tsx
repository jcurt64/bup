// Système de thème clair / sombre de l'application.
//
// Deux mécanismes alimentés par UNE seule source de vérité (PALETTE) :
//   1. Variables CSS (vars() de NativeWind) appliquées sur une View qui
//      enveloppe toute l'app → toutes les classes sémantiques Tailwind
//      (bg-paper, text-ink, border-line, bg-ivory, text-ink-3…) basculent
//      automatiquement, sans toucher les écrans.
//   2. Palette JS `useTheme().c` → pour les couleurs en style inline
//      (cartes, dégradés, ombres) qui ne passent pas par une classe.
//
// Le mode est persté via expo-secure-store et se sélectionne dans Réglages
// (« Sombre » / « Clair »). NativeWind colorScheme est aussi synchronisé
// pour la StatusBar et d'éventuelles variantes dark:.
import { colorScheme, vars } from "nativewind";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";

export type ThemeMode = "light" | "dark";

// Palette sémantique complète. Les clés « token » (ink, paper, ivory, line,
// accent…) miroir des couleurs Tailwind ; les clés sémantiques (surface,
// field, textSub, btnBg, tintViolet…) servent au style inline.
export type Palette = {
  // — Tokens Tailwind (miroir tailwind.config) —
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  ink5: string;
  paper: string;
  ivory: string;
  ivory2: string;
  line: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  violet: string;
  violetSoft: string;
  violetMuted: string;
  violetDeep: string;
  navy: string;
  navyDeep: string;
  good: string;
  warn: string;
  bad: string;
  coral: string;
  coralSoft: string;
  coralMuted: string;
  teal: string;
  tealSoft: string;
  tealMuted: string;
  amber: string;
  amberSoft: string;
  amberMuted: string;
  sky: string;
  skySoft: string;
  skyMuted: string;
  gold: string;
  // — Sémantiques (style inline) —
  bg: string; // fond application (= ivory)
  surface: string; // carte (= paper)
  surface2: string; // surface secondaire / segment
  field: string; // fond des champs / pilules ivoire
  text: string; // texte principal (= ink)
  textSub: string; // texte secondaire
  textMuted: string; // texte tertiaire / placeholder
  borderSoft: string; // bordure carte (= line, ton chaud clair)
  track: string; // rails de progression / filets
  btnBg: string; // bouton primaire plein
  btnText: string; // texte bouton primaire
  logoBg: string; // pastille logo « b »
  // Teintes pastel des tuiles icône (header de carte, paliers, lignes)
  tintViolet: string;
  tintBlue: string;
  tintGreen: string;
  tintAmber: string;
  tintCoral: string;
  // Accents forts associés (icônes / libellés sur les tuiles)
  accViolet: string;
  accVioletDeep: string;
  accBlue: string;
  accGreen: string;
  accAmber: string;
  accCoral: string;
  // Pastilles de feedback
  goodSoft: string;
  badSoft: string;
};

// ── Thème clair (valeurs historiques de l'app) ─────────────────────────
const LIGHT: Palette = {
  ink: "#0F1629",
  ink2: "#283044",
  ink3: "#5B6478",
  ink4: "#8A91A1",
  ink5: "#B7BCC7",
  paper: "#FFFFFF",
  ivory: "#F7F4EC",
  ivory2: "#EFEADD",
  line: "#E6E3DA",
  accent: "#4F46E5",
  accentSoft: "#EEF2FF",
  accentInk: "#3730A3",
  violet: "#7C5CFC",
  violetSoft: "#EDE9FE",
  violetMuted: "#F2EEF5",
  violetDeep: "#5B3FD6",
  navy: "#13235B",
  navyDeep: "#0A1330",
  good: "#16A34A",
  warn: "#D97706",
  bad: "#DC2626",
  coral: "#FF7A6B",
  coralSoft: "#FFE7E3",
  coralMuted: "#FBEDE7",
  teal: "#2FB8A6",
  tealSoft: "#DCF4F0",
  tealMuted: "#E9F4EE",
  amber: "#F2B65A",
  amberSoft: "#FCEFD6",
  amberMuted: "#F9F1E1",
  sky: "#5B8DEF",
  skySoft: "#E4ECFD",
  skyMuted: "#EDF0F4",
  gold: "#B45309",
  bg: "#F7F4EC",
  surface: "#FFFFFF",
  surface2: "#F4F1E9",
  field: "#FBF9F4",
  text: "#0A1628",
  textSub: "#6B7384",
  textMuted: "#9AA1AD",
  borderSoft: "#E7E1D2",
  track: "#ECE7D9",
  btnBg: "#0A1628",
  btnText: "#FBF9F4",
  logoBg: "#0F1629",
  tintViolet: "#F2EDFF",
  tintBlue: "#DDE9F8",
  tintGreen: "#DCEFDF",
  tintAmber: "#F8E8C9",
  tintCoral: "#F9DDD5",
  accViolet: "#7C5CFF",
  accVioletDeep: "#5B3FE0",
  accBlue: "#3F7FD6",
  accGreen: "#3F9056",
  accAmber: "#B45309",
  accCoral: "#DD5F48",
  goodSoft: "#DCFCE7",
  badSoft: "#FEE2E2",
};

// ── Thème sombre — « nuit indigo » : base bleu-charbon profonde, surfaces
// surélevées légèrement bleutées, accent indigo/violet lumineux, accents
// pastel re-densifiés pour rester lisibles sur fond foncé. ─────────────
const DARK: Palette = {
  ink: "#ECEEF5",
  ink2: "#C9D0DF",
  ink3: "#98A1B5",
  ink4: "#6C748A",
  ink5: "#495064",
  paper: "#181D2D",
  ivory: "#0E121F",
  ivory2: "#20273A",
  line: "#2B3247",
  accent: "#7D74FF",
  accentSoft: "#232A45",
  accentInk: "#C3BDFF",
  violet: "#9785FF",
  violetSoft: "#272348",
  violetMuted: "#221F33",
  violetDeep: "#B6A6FF",
  navy: "#34468C",
  navyDeep: "#1A2750",
  good: "#34D399",
  warn: "#F5B85C",
  bad: "#F2766F",
  coral: "#FF8C7E",
  coralSoft: "#36241F",
  coralMuted: "#2A2019",
  teal: "#3FCDBB",
  tealSoft: "#123430",
  tealMuted: "#15302A",
  amber: "#F3C271",
  amberSoft: "#352B17",
  amberMuted: "#2A2315",
  sky: "#6FA0FF",
  skySoft: "#1A2941",
  skyMuted: "#1A2230",
  gold: "#DBA05A",
  bg: "#0E121F",
  surface: "#181D2D",
  surface2: "#20273A",
  field: "#1C2233",
  text: "#ECEEF5",
  textSub: "#98A1B5",
  textMuted: "#6C748A",
  borderSoft: "#2B3247",
  track: "#2B3247",
  btnBg: "#ECEEF5",
  btnText: "#0E121F",
  logoBg: "#2E3650",
  tintViolet: "#242147",
  tintBlue: "#1B2940",
  tintGreen: "#163127",
  tintAmber: "#322914",
  tintCoral: "#34231D",
  accViolet: "#9785FF",
  accVioletDeep: "#B6A6FF",
  accBlue: "#6FA0FF",
  accGreen: "#4FBF7E",
  accAmber: "#E8B468",
  accCoral: "#FF8C7E",
  goodSoft: "#16352A",
  badSoft: "#3A2122",
};

export const PALETTE: Record<ThemeMode, Palette> = { light: LIGHT, dark: DARK };

// hex « #RRGGBB » → triplet « r g b » pour rgb(var(--x) / <alpha-value>).
function rgbTriplet(hex: string): string {
  const s = hex.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// Variables CSS Tailwind (noms = ceux référencés dans tailwind.config.js).
function themeVars(p: Palette): Record<string, string> {
  return {
    "--ink": rgbTriplet(p.ink),
    "--ink-2": rgbTriplet(p.ink2),
    "--ink-3": rgbTriplet(p.ink3),
    "--ink-4": rgbTriplet(p.ink4),
    "--ink-5": rgbTriplet(p.ink5),
    "--paper": rgbTriplet(p.paper),
    "--ivory": rgbTriplet(p.ivory),
    "--ivory-2": rgbTriplet(p.ivory2),
    "--line": rgbTriplet(p.line),
    "--accent": rgbTriplet(p.accent),
    "--accent-soft": rgbTriplet(p.accentSoft),
    "--accent-ink": rgbTriplet(p.accentInk),
    "--violet": rgbTriplet(p.violet),
    "--violet-soft": rgbTriplet(p.violetSoft),
    "--violet-muted": rgbTriplet(p.violetMuted),
    "--violet-deep": rgbTriplet(p.violetDeep),
    "--navy": rgbTriplet(p.navy),
    "--navy-deep": rgbTriplet(p.navyDeep),
    "--good": rgbTriplet(p.good),
    "--warn": rgbTriplet(p.warn),
    "--bad": rgbTriplet(p.bad),
    "--coral": rgbTriplet(p.coral),
    "--coral-soft": rgbTriplet(p.coralSoft),
    "--coral-muted": rgbTriplet(p.coralMuted),
    "--teal": rgbTriplet(p.teal),
    "--teal-soft": rgbTriplet(p.tealSoft),
    "--teal-muted": rgbTriplet(p.tealMuted),
    "--amber": rgbTriplet(p.amber),
    "--amber-soft": rgbTriplet(p.amberSoft),
    "--amber-muted": rgbTriplet(p.amberMuted),
    "--sky": rgbTriplet(p.sky),
    "--sky-soft": rgbTriplet(p.skySoft),
    "--sky-muted": rgbTriplet(p.skyMuted),
    "--gold": rgbTriplet(p.gold),
  };
}

const LIGHT_VARS = vars(themeVars(LIGHT));
const DARK_VARS = vars(themeVars(DARK));

const STORAGE_KEY = "buupp.theme.mode";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
  c: Palette;
  isDark: boolean;
  /** Style « vars » du thème courant — à ré-appliquer dans les contenus
   *  rendus hors de l'arbre (RN Modal / portails) pour que les classes
   *  NativeWind y basculent aussi (sinon elles retombent sur le défaut clair). */
  varStyle: ReturnType<typeof vars>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  // Restaure le mode persté au démarrage.
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (alive && (v === "dark" || v === "light")) {
          setModeState(v);
          colorScheme.set(v);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Synchronise NativeWind colorScheme (StatusBar / variantes dark:).
  useEffect(() => {
    colorScheme.set(mode);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    colorScheme.set(m);
    SecureStore.setItemAsync(STORAGE_KEY, m).catch(() => {});
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
      c: PALETTE[mode],
      isDark: mode === "dark",
      varStyle: mode === "dark" ? DARK_VARS : LIGHT_VARS,
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, mode === "dark" ? DARK_VARS : LIGHT_VARS]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Hors provider (ex. rendu isolé) → thème clair par défaut.
    return {
      mode: "light",
      setMode: () => {},
      toggle: () => {},
      c: LIGHT,
      isDark: false,
      varStyle: LIGHT_VARS,
    };
  }
  return ctx;
}
