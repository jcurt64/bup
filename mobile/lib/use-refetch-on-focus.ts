// Refetch au focus d'écran (expo-router/react-navigation). Complète le
// câblage AppState→focusManager de app/_layout.tsx : ici on couvre la
// navigation interne (revenir sur un onglet/écran déjà monté). Choix
// produit : fraîcheur = focus uniquement, pas de polling.
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

type Refetchable = { refetch: () => unknown };

export function useRefetchOnFocus(...queries: Refetchable[]) {
  useFocusEffect(
    useCallback(() => {
      for (const q of queries) q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}
