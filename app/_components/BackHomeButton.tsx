import Link from "next/link";

/* Bouton stylé "Retour à l'accueil" partagé entre les pages légales
   (CGU, CGV, RGPD, Contact DPO). Pill ink + flèche, hover qui éclaircit
   et glisse légèrement la flèche vers la gauche. */
export default function BackHomeButton() {
  return (
    <Link
      href="/"
      className="back-home-btn"
      aria-label="Retour à l'accueil BUUPP"
    >
      <span aria-hidden className="back-home-btn__arrow">
        ←
      </span>
      <span>Retour à l&apos;accueil</span>
    </Link>
  );
}
