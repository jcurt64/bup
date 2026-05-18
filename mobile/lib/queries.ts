// Couche de synchro (cf. MOBILE_APP_SPEC.md §6) : React Query au-dessus
// du wrapper /api/*. 1 queryKey par endpoint ; invalidation après
// mutation = équivalent mobile des events web (prospect:profile-changed,
// pro:overview-changed). Refetch on focus/reconnect réglé dans _layout.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./api";

// — Session / rôle —
export type Role = "prospect" | "pro" | null;

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Record<string, unknown>>("/api/me"),
  });
}

export function useRole() {
  const api = useApi();
  return useQuery({
    queryKey: ["me", "role"],
    queryFn: () => api<{ role: Role }>("/api/me/role"),
    staleTime: 60_000,
  });
}

// — Prospect : portefeuille (1er écran branché) —
export type ProspectWallet = {
  balanceEur?: number;
  monthGainsEur?: number;
  // … forme réelle renvoyée par /api/prospect/wallet (à typer finement
  //   au fil de l'intégration des écrans).
  [k: string]: unknown;
};

export function useProspectWallet() {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect", "wallet"],
    queryFn: () => api<ProspectWallet>("/api/prospect/wallet"),
    staleTime: 15_000, // écran "vivant" → fraîcheur courte (§6.2)
  });
}

// — Exemple de mutation avec invalidation (patron à réutiliser) —
export function useDecideRelation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; decision: "accept" | "refuse" }) =>
      api(`/api/prospect/relations/${vars.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: vars.decision }),
      }),
    onSuccess: () => {
      // Équivalent mobile de l'event web : on resynchronise les vues
      // impactées (relations + portefeuille + score).
      qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
    },
  });
}
