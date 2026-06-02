// Mémorise la page (et le drawer) depuis laquelle le drawer a été ouvert, pour
// que le bouton « retour » d'une page du drawer réouvre le drawer SUR cette
// page d'origine (au lieu de retomber sur l'accueil — navigation par onglets).
type Origin = { path: string; drawer: string };
let origin: Origin | null = null;

export function setDrawerOrigin(path: string, drawer: string): void {
  origin = { path, drawer };
}
export function getDrawerOrigin(): Origin | null {
  return origin;
}
