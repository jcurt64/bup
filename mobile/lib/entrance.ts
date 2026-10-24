// Animation d'apparition « une seule fois par ouverture de l'appli » :
// le registre vit en mémoire du module, il est donc vidé à chaque
// lancement de l'appli. Le premier montage d'une clé (ex. une route)
// anime ; les retours suivants sur la même page s'affichent directement.
import { useEffect, useState } from "react";

const seen = new Set<string>();

export function useEntranceOnce(key: string): boolean {
  // Initialiseur pur (pas d'écriture) : sûr en double rendu StrictMode.
  const [animate] = useState(() => !seen.has(key));
  useEffect(() => {
    seen.add(key);
  }, [key]);
  return animate;
}
