// Context pour piloter l'ouverture du FlashDealsSheet depuis n'importe
// quel écran (deep-link push `?openFlash=...`). Le sheet lui-même
// reste rendu une seule fois dans AppHeader — le context expose juste
// open/close. V1 : pas de `initialDealId` (le user voit la liste
// complète, scroll manuel s'il y a plusieurs deals).
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const FlashSheetCtx = createContext<Ctx | null>(null);

export function FlashSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo<Ctx>(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <FlashSheetCtx.Provider value={value}>{children}</FlashSheetCtx.Provider>;
}

// No-op stable hors provider : AppHeader est partagé (prospect + pro + écrans
// racine comme /account). Le flash deals sheet n'existe que côté prospect ;
// ailleurs, open/close ne font rien plutôt que de planter le rendu.
const NOOP_CTX: Ctx = { isOpen: false, open: () => {}, close: () => {} };

export function useFlashSheet(): Ctx {
  return useContext(FlashSheetCtx) ?? NOOP_CTX;
}
