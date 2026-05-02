import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "BUPP — Connexion",
};

export default function ConnexionPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      <SignIn
        path="/connexion"
        routing="path"
        signUpUrl="/inscription"
        fallbackRedirectUrl="/prospect"
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 440 },
            card: {
              background: "var(--paper)",
              borderRadius: 16,
              boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
              border: "1px solid var(--line)",
            },
            headerTitle: { fontFamily: "var(--font-fraunces, serif)" },
            formButtonPrimary: {
              background: "var(--ink)",
              "&:hover, &:focus, &:active": { background: "#1a2342" },
            },
          },
          variables: {
            colorPrimary: "#0F1629",
            colorText: "#0F1629",
            colorTextSecondary: "#5b6478",
            borderRadius: "10px",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          },
        }}
      />
    </main>
  );
}
