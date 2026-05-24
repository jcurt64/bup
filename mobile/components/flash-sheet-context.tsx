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

export function useFlashSheet(): Ctx {
  const ctx = useContext(FlashSheetCtx);
  if (!ctx) throw new Error("useFlashSheet hors FlashSheetProvider");
  return ctx;
}
