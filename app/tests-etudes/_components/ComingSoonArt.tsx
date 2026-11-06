/**
 * Illustration animée de l'état « aucune campagne » : une fiche d'avis dont
 * les lignes se cochent et les étoiles s'allument, des pièces en euros qui
 * flottent autour, quelques étincelles. SVG + CSS (studies.css, préfixe
 * `.cs-`), animations coupées si l'utilisateur préfère réduire le mouvement.
 */
export default function ComingSoonArt() {
  return (
    <svg className="cs-art" viewBox="0 0 320 220" role="img" aria-label="Illustration : une fiche d'avis qui se remplit et des pièces qui s'envolent">
      <defs>
        <linearGradient id="cs-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="cs-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>

      {/* halo */}
      <ellipse cx="160" cy="196" rx="92" ry="10" fill="#0F172A" opacity=".08" className="cs-shadow" />

      {/* fiche d'avis flottante */}
      <g className="cs-card">
        <rect x="100" y="30" width="120" height="150" rx="16" fill="url(#cs-card)" />
        <rect x="100" y="30" width="120" height="150" rx="16" fill="#fff" opacity=".06" />
        <rect x="116" y="46" width="56" height="8" rx="4" fill="#fff" opacity=".9" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(116 ${72 + i * 26})`}>
            <rect width="14" height="14" rx="4" fill="#fff" opacity=".22" />
            <path d="M3 7.5 6 10.5 11 4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              className="cs-check" style={{ animationDelay: `${0.6 + i * 0.6}s` }} />
            <rect x="22" y="3" width={60 - i * 10} height="8" rx="4" fill="#fff" opacity=".55" className="cs-line" style={{ animationDelay: `${0.4 + i * 0.6}s` }} />
          </g>
        ))}
        {/* étoiles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} transform={`translate(${118 + i * 18} 152) scale(.62)`}
            d="M12 2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17l-6 3.3 1.3-6.7-5-4.6 6.8-.8z"
            className="cs-star" style={{ animationDelay: `${2.4 + i * 0.18}s` }} />
        ))}
      </g>

      {/* pièces qui flottent */}
      {[
        { x: 58, y: 120, d: 0, s: 1 },
        { x: 262, y: 92, d: 1.2, s: 0.85 },
        { x: 244, y: 168, d: 2.1, s: 0.7 },
        { x: 74, y: 58, d: 2.8, s: 0.6 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
          <g className="cs-coin" style={{ animationDelay: `${c.d}s` }}>
            <circle r="17" fill="url(#cs-coin)" />
            <circle r="12.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" />
            <text y="5.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">€</text>
          </g>
        </g>
      ))}

      {/* étincelles */}
      {[
        { x: 238, y: 40, d: 0.3 },
        { x: 84, y: 166, d: 1.5 },
        { x: 284, y: 136, d: 2.4 },
      ].map((p, i) => (
        <path key={i} transform={`translate(${p.x} ${p.y})`} d="M0-8 2 -2 8 0 2 2 0 8-2 2-8 0-2-2Z"
          fill="#EC4899" className="cs-spark" style={{ animationDelay: `${p.d}s` }} />
      ))}
    </svg>
  );
}
