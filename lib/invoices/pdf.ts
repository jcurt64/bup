/**
 * Génération PDF des factures BUUPP côté serveur (pdfkit, runtime Node).
 *
 * Le template est volontairement sobre : un en-tête vendeur (BUUPP /
 * Majelink), un bloc "Facturé à" (informations société du pro telles
 * qu'elles ont été saisies dans "Mes informations"), un tableau ligne
 * unique (libellé + montants), un récap TTC, puis un pied légal.
 *
 * Toutes les valeurs UTF-8 sont passées dans le pipeline pdfkit via la
 * police Helvetica builtin (WinAnsi : couvre les accents français).
 */
import PDFDocument from "pdfkit";

export type InvoiceData = {
  /** Numéro lisible côté UI (ex. "BUUPP-2026-04-1234"). */
  number: string;
  /** Date de la transaction (ISO). */
  date: string;
  /** Libellé humain : "Recharge crédit", "Dépense campagne"… */
  label: string;
  /** Description libre éventuelle (ex. nom de la campagne). */
  description?: string | null;
  /** Montant TTC en centimes — supposé arrondi. */
  amountCents: number;
  /** Statut humain : "Payée", "En attente"… */
  statusLabel: string;
  /** Type DB pour décider si la transaction est entrante (recharge,
   *  refund, bonus) ou sortante (campaign_charge…). Sert à formater le
   *  signe et la teinte du montant. */
  type: string;
};

export type ProBillingInfo = {
  raisonSociale: string;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
  siren: string | null;
  secteur: string | null;
  email: string | null;
  // Mentions légales obligatoires sur facture
  formeJuridique: string | null;
  capitalSocialEur: number | null;
  siret: string | null;
  rcsVille: string | null;
  rmNumber: string | null;
};

const COLOR_INK = "#0F172A";
const COLOR_SUBTLE = "#64748B";
const COLOR_LINE = "#E6E1D3";
const COLOR_ACCENT = "#4F46E5";

const SELLER = {
  name: "Majelink",
  legalForm: "BUUPP — Be Used, Paid & Proud",
  address: "12 Impasse des Étriers",
  postalCity: "64140 Lons",
  rcs: "RCS Pau 892 514 167",
  email: "contact@buupp.com",
};

const TYPE_IN = new Set(["topup", "refund", "credit", "referral_bonus"]);

function formatEur(cents: number): string {
  const abs = Math.abs(cents) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(abs);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Concatène les bytes d'un PDFKit doc en un Buffer pour le retour HTTP. */
async function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function buildInvoicePdf(
  invoice: InvoiceData,
  pro: ProBillingInfo,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Facture ${invoice.number}`,
      Author: SELLER.name,
      Subject: invoice.label,
    },
  });

  doc.font("Helvetica");

  // ─── En-tête : BUUPP + numéro de facture ─────────────────────────
  doc
    .fontSize(22)
    .fillColor(COLOR_INK)
    .text("BUUPP", { continued: false });
  doc
    .moveUp(0.6)
    .fontSize(10)
    .fillColor(COLOR_SUBTLE)
    .text(SELLER.legalForm, { align: "right" });

  doc.moveDown(1);
  doc
    .fontSize(11)
    .fillColor(COLOR_INK)
    .text(`Facture n° ${invoice.number}`, { align: "right" });
  doc
    .fontSize(10)
    .fillColor(COLOR_SUBTLE)
    .text(`Émise le ${formatDate(invoice.date)}`, { align: "right" });

  doc.moveDown(1.5);
  hr(doc);

  // ─── Bloc "Émetteur" / "Facturé à" en deux colonnes ───────────────
  const yStart = doc.y + 14;
  const colWidth = (doc.page.width - 56 * 2 - 24) / 2;

  // Colonne gauche : émetteur
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("ÉMETTEUR", 56, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(SELLER.name, 56, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE)
    .text(SELLER.address, 56, doc.y + 2, { width: colWidth })
    .text(SELLER.postalCity, { width: colWidth })
    .text(SELLER.rcs, { width: colWidth })
    .text(SELLER.email, { width: colWidth });

  // Colonne droite : facturé à (infos pro)
  const rightX = 56 + colWidth + 24;
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("FACTURÉ À", rightX, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(pro.raisonSociale, rightX, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  if (pro.formeJuridique) {
    doc.text(`Forme juridique : ${pro.formeJuridique}`, rightX, doc.y + 2, { width: colWidth });
  }
  if (pro.adresse) {
    doc.text(pro.adresse, rightX, doc.y + 2, { width: colWidth });
  }
  if (pro.codePostal || pro.ville) {
    doc.text([pro.codePostal, pro.ville].filter(Boolean).join(" "), { width: colWidth });
  }
  if (pro.capitalSocialEur != null) {
    doc.text(
      `Capital social : ${new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
      }).format(pro.capitalSocialEur)}`,
      { width: colWidth },
    );
  }
  if (pro.siret) {
    doc.text(`SIRET : ${pro.siret}`, { width: colWidth });
  } else if (pro.siren) {
    doc.text(`SIREN : ${pro.siren}`, { width: colWidth });
  }
  if (pro.rcsVille) {
    const rcsRef = pro.siren ? ` ${pro.siren}` : "";
    doc.text(`RCS ${pro.rcsVille}${rcsRef}`, { width: colWidth });
  }
  if (pro.rmNumber) {
    doc.text(`RM : ${pro.rmNumber}`, { width: colWidth });
  }
  if (pro.email) doc.text(pro.email, { width: colWidth });

  // Aligne le curseur au bas du bloc le plus long
  doc.x = 56;
  doc.y = Math.max(doc.y, yStart + 130);
  doc.moveDown(1.5);
  hr(doc);

  // ─── Tableau : description + montant ─────────────────────────────
  doc.moveDown(1);
  const tableTop = doc.y;
  const labelX = 56;
  const amountX = doc.page.width - 56 - 120;

  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  doc.text("DÉSIGNATION", labelX, tableTop);
  doc.text("MONTANT", amountX, tableTop, { width: 120, align: "right" });

  doc.moveDown(0.5);
  hr(doc);
  doc.moveDown(0.6);

  const rowY = doc.y;
  doc.fontSize(11).fillColor(COLOR_INK).text(invoice.label, labelX, rowY, { width: amountX - labelX - 16 });
  if (invoice.description) {
    doc.fontSize(9).fillColor(COLOR_SUBTLE).text(invoice.description, labelX, doc.y + 2, { width: amountX - labelX - 16 });
  }

  const amountStr =
    (TYPE_IN.has(invoice.type) ? "" : "− ") + formatEur(invoice.amountCents);
  doc.fontSize(11).fillColor(COLOR_INK).text(amountStr, amountX, rowY, { width: 120, align: "right" });

  doc.moveDown(2);
  hr(doc);

  // ─── Total ────────────────────────────────────────────────────────
  doc.moveDown(0.6);
  const totalY = doc.y;
  doc.fontSize(10).fillColor(COLOR_SUBTLE).text("Total TTC", labelX, totalY, { width: amountX - labelX - 16, align: "right" });
  doc.fontSize(14).fillColor(COLOR_ACCENT).text(amountStr, amountX, totalY - 4, { width: 120, align: "right" });

  doc.moveDown(2);
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text(`Statut : ${invoice.statusLabel}`, labelX, doc.y, { width: 200 });

  // ─── Pied de page légal ──────────────────────────────────────────
  const footerY = doc.page.height - 56 - 50;
  doc
    .fontSize(8)
    .fillColor(COLOR_SUBTLE)
    .text(
      `${SELLER.legalForm} — ${SELLER.name} · ${SELLER.address}, ${SELLER.postalCity} · ${SELLER.rcs}`,
      56,
      footerY,
      { width: doc.page.width - 56 * 2, align: "center" },
    );
  doc.text(
    "TVA non applicable, art. 293 B du CGI (le cas échéant). Document généré électroniquement, sans signature manuscrite requise.",
    { width: doc.page.width - 56 * 2, align: "center" },
  );

  return docToBuffer(doc);
}

function hr(doc: PDFKit.PDFDocument) {
  const y = doc.y + 4;
  doc
    .strokeColor(COLOR_LINE)
    .lineWidth(0.6)
    .moveTo(56, y)
    .lineTo(doc.page.width - 56, y)
    .stroke();
  doc.moveDown(0.5);
}
