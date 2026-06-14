"use client";

import { useState } from "react";
import Link from "next/link";

type Profile = "pro" | "particulier" | "autre";
type Status = "idle" | "sending" | "ok" | "error";

const PROFILES: { value: Profile; label: string }[] = [
  { value: "pro", label: "Professionnel" },
  { value: "particulier", label: "Particulier" },
  { value: "autre", label: "Autre" },
];

/**
 * Section « Contact » de la page d'accueil.
 *
 * Permet aux professionnels comme aux particuliers de nous écrire pour en
 * savoir plus sur l'activité, sans créer de compte. Le formulaire poste vers
 * /api/contact (relai e-mail + accusé de réception, rate-limité côté serveur),
 * sur le même modèle anti-spam que le formulaire DPO (honeypot + consentement).
 */
export default function HomeContactSection() {
  const [profile, setProfile] = useState<Profile>("pro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const disabled = status === "sending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setErrorMsg("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("error");
      setErrorMsg("Merci d'indiquer une adresse e-mail valide.");
      return;
    }
    if (!message.trim()) {
      setStatus("error");
      setErrorMsg("Votre message ne peut pas être vide.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setErrorMsg("Merci d'accepter que nous utilisions ces informations pour vous répondre.");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          consent,
          website,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setErrorMsg(
          (data && typeof data.message === "string" && data.message) ||
            "Une erreur est survenue. Merci de réessayer dans quelques instants.",
        );
        return;
      }
      setStatus("ok");
      setName("");
      setEmail("");
      setMessage("");
      setConsent(false);
    } catch {
      setStatus("error");
      setErrorMsg("Impossible d'envoyer le message. Vérifiez votre connexion et réessayez.");
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-3)",
    marginBottom: 6,
  };

  return (
    <section
      id="contact"
      className="section"
      style={{ background: "var(--ivory-2)", borderTop: "1px solid var(--line)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="grid grid-2"
          style={{ gap: "clamp(32px, 5vw, 64px)", alignItems: "start" }}
        >
          {/* Colonne gauche : pitch + canaux directs */}
          <div>
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "var(--accent)",
                marginBottom: 16,
              }}
            >
              — Contact
            </div>
            <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
              Une question&nbsp;?
              <br />
              <em>Parlons-en.</em>
            </h2>
            <p
              className="muted"
              style={{
                fontSize: "clamp(15px, 1.6vw, 18px)",
                lineHeight: 1.6,
                marginTop: 20,
                maxWidth: 480,
              }}
            >
              Professionnel curieux de notre approche ou particulier qui veut en
              savoir plus avant de se lancer&nbsp;? Écrivez-nous&nbsp;: une vraie
              personne vous répondra. On vous explique comment BUUPP peut vous
              faire gagner du temps — et de l&apos;argent.
            </p>

            <div
              style={{
                marginTop: 28,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <a
                href="mailto:contact@buupp.com"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--ink)",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                <span style={{ color: "var(--accent)" }}>✉</span>
                contact@buupp.com
              </a>
              <div style={{ fontSize: 14, color: "var(--ink-4)", lineHeight: 1.6 }}>
                Pour une demande relative à vos données personnelles (accès,
                effacement, RGPD), contactez directement notre{" "}
                <Link
                  href="/contact-dpo"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Chargé à la protection des données
                </Link>
                .
              </div>
            </div>
          </div>

          {/* Colonne droite : formulaire */}
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg, 16px)",
              padding: "clamp(20px, 3vw, 32px)",
            }}
          >
            {status === "ok" ? (
              <div style={{ textAlign: "center", padding: "24px 8px" }}>
                <div
                  className="serif"
                  style={{ fontSize: 26, marginBottom: 10 }}
                >
                  Message bien reçu ✦
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-3)" }}>
                  Merci&nbsp;! Nous revenons vers vous très vite à
                  l&apos;adresse indiquée. Pensez à vérifier vos spams si vous
                  ne voyez pas notre réponse.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 20 }}
                  onClick={() => setStatus("idle")}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Je suis…</label>
                  <div className="row gap-2 wrap">
                    {PROFILES.map((p) => {
                      const active = profile === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setProfile(p.value)}
                          className="btn btn-sm"
                          style={{
                            background: active ? "var(--ink)" : "var(--paper)",
                            color: active ? "var(--paper)" : "var(--ink)",
                            border: active
                              ? "1px solid var(--ink)"
                              : "1px solid var(--line-2)",
                          }}
                          aria-pressed={active}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="contact-name" style={labelStyle}>
                    Nom <span style={{ color: "var(--ink-5)" }}>(facultatif)</span>
                  </label>
                  <input
                    id="contact-name"
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Votre nom ou votre société"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="contact-email" style={labelStyle}>
                    E-mail
                  </label>
                  <input
                    id="contact-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    required
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="contact-message" style={labelStyle}>
                    Votre message
                  </label>
                  <textarea
                    id="contact-message"
                    className="input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4000}
                    required
                    rows={5}
                    style={{ resize: "vertical", minHeight: 120 }}
                    placeholder="Dites-nous en quelques mots ce qui vous amène…"
                  />
                </div>

                {/* Honeypot anti-spam — caché aux humains */}
                <div aria-hidden style={{ position: "absolute", left: "-9999px" }}>
                  <label htmlFor="contact-website">Ne pas remplir</label>
                  <input
                    id="contact-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--ink-3)",
                    marginBottom: 18,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 3, flex: "0 0 auto" }}
                  />
                  <span>
                    J&apos;accepte que BUUPP utilise ces informations pour
                    répondre à ma demande, conformément à sa{" "}
                    <Link
                      href="/rgpd"
                      style={{ color: "var(--accent)", textDecoration: "underline" }}
                    >
                      politique de protection des données
                    </Link>
                    .
                  </span>
                </label>

                {status === "error" && errorMsg && (
                  <div
                    role="alert"
                    style={{
                      fontSize: 13,
                      color: "var(--danger)",
                      marginBottom: 14,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-lg btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={disabled}
                >
                  {disabled ? "Envoi en cours…" : "Envoyer le message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
