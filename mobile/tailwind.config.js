/** @type {import('tailwindcss').Config} */
// Tokens repris du prototype web (public/prototype/styles.css) pour une
// cohérence visuelle web ⇄ mobile. Ajuster au fil de l'intégration UI.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      // Couleurs sémantiques pilotées par des variables CSS (cf. lib/theme.tsx) :
      // la valeur des variables bascule clair ⇄ sombre via le vars() wrapper du
      // ThemeProvider, donc toutes ces classes (bg-paper, text-ink, border-line…)
      // suivent le thème automatiquement. Triplets « r g b » + <alpha-value>
      // pour préserver bg-ink/70, text-white-like alpha, etc.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
          4: "rgb(var(--ink-4) / <alpha-value>)",
          5: "rgb(var(--ink-5) / <alpha-value>)",
        },
        paper: "rgb(var(--paper) / <alpha-value>)",
        ivory: {
          DEFAULT: "rgb(var(--ivory) / <alpha-value>)",
          2: "rgb(var(--ivory-2) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          ink: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        // Violet des mots en italique / liens dans les maquettes onboarding+auth
        violet: {
          DEFAULT: "rgb(var(--violet) / <alpha-value>)",
          soft: "rgb(var(--violet-soft) / <alpha-value>)",
          muted: "rgb(var(--violet-muted) / <alpha-value>)",
          deep: "rgb(var(--violet-deep) / <alpha-value>)",
        },
        // Navy du chip logo "buupp"
        navy: {
          DEFAULT: "rgb(var(--navy) / <alpha-value>)",
          deep: "rgb(var(--navy-deep) / <alpha-value>)",
        },
        good: "rgb(var(--good) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
        // `.muted` = variantes désaturées utilisées par TONE_BG (cartes).
        coral: {
          DEFAULT: "rgb(var(--coral) / <alpha-value>)",
          soft: "rgb(var(--coral-soft) / <alpha-value>)",
          muted: "rgb(var(--coral-muted) / <alpha-value>)",
        },
        teal: {
          DEFAULT: "rgb(var(--teal) / <alpha-value>)",
          soft: "rgb(var(--teal-soft) / <alpha-value>)",
          muted: "rgb(var(--teal-muted) / <alpha-value>)",
        },
        amber: {
          DEFAULT: "rgb(var(--amber) / <alpha-value>)",
          soft: "rgb(var(--amber-soft) / <alpha-value>)",
          muted: "rgb(var(--amber-muted) / <alpha-value>)",
        },
        sky: {
          DEFAULT: "rgb(var(--sky) / <alpha-value>)",
          soft: "rgb(var(--sky-soft) / <alpha-value>)",
          muted: "rgb(var(--sky-muted) / <alpha-value>)",
        },
        gold: "rgb(var(--gold) / <alpha-value>)",
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
