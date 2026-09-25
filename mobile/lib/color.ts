// Petits utilitaires couleur (hex #RRGGBB) pour les dégradés et ombres.

/** Éclaircit (amt > 0) ou fonce (amt < 0) une couleur #RRGGBB. */
export function shade(hex: string, amt: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Ajoute un canal alpha (« 33 ») à une couleur #RRGGBB. */
export function withAlpha(hex: string, aa: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${aa}` : hex;
}
