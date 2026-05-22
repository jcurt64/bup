/** @type {import('tailwindcss').Config} */
// Tokens repris du prototype web (public/prototype/styles.css) pour une
// cohérence visuelle web ⇄ mobile. Ajuster au fil de l'intégration UI.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F1629",
          2: "#283044",
          3: "#5B6478",
          4: "#8A91A1",
          5: "#B7BCC7",
        },
        paper: "#FFFFFF",
        ivory: { DEFAULT: "#F7F4EC", 2: "#EFEADD" },
        line: "#E6E3DA",
        accent: { DEFAULT: "#4F46E5", soft: "#EEF2FF", ink: "#3730A3" },
        // Violet des mots en italique / liens dans les maquettes onboarding+auth
        violet: { DEFAULT: "#7C5CFC", soft: "#EDE9FE", muted: "#F2EEF5", deep: "#5B3FD6" },
        // Navy du chip logo "buupp"
        navy: { DEFAULT: "#13235B", deep: "#0A1330" },
        good: "#16A34A",
        warn: "#D97706",
        bad: "#DC2626",
        // `.muted` = variantes désaturées (mix ~50% avec ivory) utilisées
        // par TONE_BG sur les cartes Portefeuille pour une teinte plus douce.
        coral: { DEFAULT: "#FF7A6B", soft: "#FFE7E3", muted: "#FBEDE7" },
        teal: { DEFAULT: "#2FB8A6", soft: "#DCF4F0", muted: "#E9F4EE" },
        amber: { DEFAULT: "#F2B65A", soft: "#FCEFD6", muted: "#F9F1E1" },
        sky: { DEFAULT: "#5B8DEF", soft: "#E4ECFD", muted: "#EDF0F4" },
        gold: "#B45309",
      },
      fontFamily: {
        // Fraunces (police serif du prototype web), chargée via
        // @expo-google-fonts/fraunces dans app/_layout.tsx. iOS ne
        // synthétise pas italique/gras pour une police custom → familles
        // dédiées.
        serif: ["Fraunces_400Regular"],
        "serif-italic": ["Fraunces_400Regular_Italic"],
        "serif-semibold": ["Fraunces_600SemiBold"],
        "serif-bold": ["Fraunces_700Bold"],
        // Police script Google « Dancing Script » — utilisée pour le mot
        // « buupp » signature dans le footer de la modale détail mouvement.
        script: ["DancingScript_700Bold"],
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
