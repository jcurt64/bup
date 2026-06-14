"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./SiteChrome";

type Profile = "pro" | "particulier" | "autre";
type Status = "idle" | "sending" | "ok" | "error";

const PROFILES: { value: Profile; label: string }[] = [
  { value: "pro", label: "Professionnel" },
  { value: "particulier", label: "Particulier" },
  { value: "autre", label: "Autre" },
];

// Une ligne de réassurance de la carte sombre (icône + titre + sous-titre).
function Assurance({
  icon,
  title,
  sub,
}: {
  icon: "user" | "shield";
  title: string;
  sub: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span
        className="row center"
        style={{
          width: 38,
          height: 38,
          flex: "0 0 auto",
          justifyContent: "center",
          borderRadius: 11,
          background: "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.12)",
          color: "#C4B5FD",
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--paper)" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

/**
 * Section « Contact » (page /contact).
 *
 * Mise en page d'après public/prototype/cont.pdf : un en-tête pleine largeur
 * (titre + pastille « Réponse sous 24h »), puis deux colonnes — à gauche une
 * carte sombre dégradée « À votre écoute » (réassurance + e-mail direct), à
 * droite le formulaire. Le formulaire poste vers /api/contact (relai e-mail +
 * accusé de réception, rate-limité côté serveur), avec honeypot + consentement.
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
        {/* En-tête pleine largeur : titre à gauche, pastille délai à droite */}
        <div
          className="row between wrap"
          style={{
            gap: 20,
            alignItems: "flex-end",
            marginBottom: "clamp(28px, 4vw, 48px)",
          }}
        >
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
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 16px",
              borderRadius: 999,
              background: "var(--paper)",
              border: "1px solid var(--line)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-3)",
              boxShadow: "0 6px 18px -10px rgba(15,23,42,.25)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#16a34a",
                flex: "0 0 auto",
              }}
            />
            Réponse sous 24&nbsp;h ouvrées
          </span>
        </div>

        <div
          className="grid grid-2"
          style={{ gap: "clamp(24px, 4vw, 48px)", alignItems: "stretch" }}
        >
          {/* Colonne gauche : carte sombre « À votre écoute » */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "var(--r-lg, 16px)",
              padding: "clamp(28px, 3.5vw, 44px)",
              color: "var(--paper)",
              background:
                "linear-gradient(158deg, #0E1430 0%, #181a44 56%, #241f5e 100%)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Halo violet + anneau décoratif en haut à droite */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "-40px",
                right: "-30px",
                width: 320,
                height: 320,
                borderRadius: "50%",
                background:
                  "radial-gradient(closest-side, rgba(139,108,255,.42), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "-110px",
                right: "-110px",
                width: 340,
                height: 340,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.10)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                className="mono caps"
                style={{ fontSize: 11, letterSpacing: ".2em", color: "#A78DFF", marginBottom: 18 }}
              >
                À votre écoute
              </div>
              <h3
                className="serif"
                style={{ fontSize: "clamp(26px, 3vw, 34px)", lineHeight: 1.15, color: "var(--paper)" }}
              >
                Une vraie personne,
                <br />
                une <em style={{ color: "#C4B5FD" }}>vraie réponse</em>.
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: "rgba(255,255,255,.66)",
                  marginTop: 16,
                  maxWidth: 440,
                }}
              >
                Professionnel curieux de notre approche ou particulier qui veut
                en savoir plus avant de se lancer&nbsp;? Écrivez-nous — on vous
                explique comment buupp vous fait gagner du temps{" "}
                <em>et de l&apos;argent</em>.
              </p>

              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <Assurance
                  icon="user"
                  title="Pas de bot, pas de file d'attente"
                  sub="Notre équipe lit et répond elle-même."
                />
                <Assurance
                  icon="shield"
                  title="Confidentiel & conforme RGPD"
                  sub="Vos infos servent uniquement à vous répondre."
                />
              </div>

              {/* Bloc e-mail direct, poussé en bas de la carte */}
              <a
                href="mailto:contact@buupp.com"
                style={{
                  marginTop: "auto",
                  paddingTop: 28,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  className="row center"
                  style={{
                    width: 44,
                    height: 44,
                    flex: "0 0 auto",
                    justifyContent: "center",
                    borderRadius: 12,
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.14)",
                    color: "#C4B5FD",
                  }}
                >
                  <Icon name="mail" size={20} />
                </span>
                <span>
                  <span
                    className="mono caps"
                    style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "rgba(255,255,255,.45)" }}
                  >
                    Écrivez-nous
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--paper)" }}>
                    contact@buupp.com
                  </span>
                </span>
              </a>

              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.6, marginTop: 18 }}>
                Une demande relative à vos données personnelles (accès,
                effacement, RGPD)&nbsp;? Contactez directement notre{" "}
                <Link
                  href="/contact-dpo"
                  style={{ color: "#C4B5FD", textDecoration: "underline" }}
                >
                  spécialiste RGPD
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
                  {!disabled && <Icon name="arrow" size={16} />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
