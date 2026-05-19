/**
 * UI de chargement instantanée pour /prospect.
 *
 * Next.js l'affiche immédiatement (Suspense) pendant la cascade
 * serveur du page.tsx (auth Clerk → rôle → ensureRole → lecture
 * Supabase). Sans ce fichier, l'utilisateur restait sur un écran figé
 * après authentification jusqu'à la fin de la cascade.
 *
 * Volontairement identique au loader de PrototypeFrame (fond ivoire +
 * spinner indigo) : la transition loading.tsx → page → iframe est ainsi
 * visuellement continue, sans flash.
 */
export default function Loading() {
  return (
    <div
      aria-busy
      aria-label="Chargement de l'espace prospect"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F7F4EC",
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid rgba(15, 22, 41, 0.12)",
          borderTopColor: "#4F46E5",
          animation: "bupp-spin .8s linear infinite",
        }}
      />
      <style>{`@keyframes bupp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
