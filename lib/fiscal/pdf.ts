/**
 * Génération des documents fiscaux du prospect (PDF, runtime Node).
 *
 * Deux templates :
 *   - Récapitulatif annuel  (`buildAnnualRecapPdf`)
 *     destiné à l'usager pour préparer sa déclaration fiscale.
 *   - Reçu / attestation DGFiP (`buildDgfipReceiptPdf`)
 *     trace écrite que BUUPP a transmis le récap au fisc en application
 *     de l'article 242 bis du CGI (déclaration des plateformes).
 *
 * Les fontes Helvetica builtin de pdfkit (WinAnsi) couvrent les accents
 * français — pas besoin d'embarquer une TTF.
 */
import PDFDocument from "pdfkit";

export type ProspectFiscalIdentity = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
};

export type FiscalRecapData = {
  year: number;
  /** Cumul TTC en centimes des transactions de type credit / referral_bonus. */
  totalCents: number;
  transactionCount: number;
  /** Référence interne stable (transmise même côté reçu DGFiP). */
  reference: string;
  /** Date d'émission du document — pour le récap on met la date du jour,
   *  pour le reçu DGFiP la date de transmission théorique (31 janvier N+1). */
  emittedAt: string; // ISO
};

const COLOR_INK = "#0F172A";
const COLOR_SUBTLE = "#64748B";
const COLOR_LINE = "#E6E1D3";
const COLOR_ACCENT = "#4F46E5";

const PLATFORM = {
  name: "BUUPP",
  legalForm: "BUUPP — Be Used, Paid & Proud",
  operator: "Majelink",
  address: "12 Impasse des Étriers",
  postalCity: "64140 Lons",
  rcs: "RCS Pau 892 514 167",
  email: "fiscal@buupp.com",
};

const eurFmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatEur(cents: number): string {
  return eurFmt.format(Math.round(cents) / 100);
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}
function fullName(p: ProspectFiscalIdentity): string {
  const out = `${(p.prenom ?? "").trim()} ${(p.nom ?? "").trim()}`.trim();
  return out || "—";
}

async function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
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

function header(doc: PDFKit.PDFDocument, kicker: string, title: string, ref: string) {
  doc
    .fontSize(22)
    .fillColor(COLOR_INK)
    .text(PLATFORM.name);
  doc
    .moveUp(0.6)
    .fontSize(10)
    .fillColor(COLOR_SUBTLE)
    .text(PLATFORM.legalForm, { align: "right" });
  doc.moveDown(1);
  doc.fontSize(10).fillColor(COLOR_SUBTLE).text(kicker);
  doc.fontSize(18).fillColor(COLOR_INK).text(title, { width: doc.page.width - 56 * 2 });
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text(`Référence : ${ref}`);
  doc.moveDown(1);
  hr(doc);
}

function identityBlock(
  doc: PDFKit.PDFDocument,
  prospect: ProspectFiscalIdentity,
  emittedAt: string,
) {
  const yStart = doc.y + 10;
  const colWidth = (doc.page.width - 56 * 2 - 24) / 2;

  // Plateforme (gauche)
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("PLATEFORME ÉMETTRICE", 56, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(PLATFORM.operator, 56, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  doc.text(PLATFORM.legalForm, 56, doc.y + 2, { width: colWidth });
  doc.text(PLATFORM.address, { width: colWidth });
  doc.text(PLATFORM.postalCity, { width: colWidth });
  doc.text(PLATFORM.rcs, { width: colWidth });
  doc.text(PLATFORM.email, { width: colWidth });

  // Bénéficiaire (droite)
  const rightX = 56 + colWidth + 24;
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("BÉNÉFICIAIRE", rightX, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(fullName(prospect), rightX, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  if (prospect.email) doc.text(prospect.email, rightX, doc.y + 2, { width: colWidth });
  if (prospect.adresse) doc.text(prospect.adresse, rightX, doc.y + 2, { width: colWidth });
  if (prospect.codePostal || prospect.ville) {
    doc.text(
      [prospect.codePostal, prospect.ville].filter(Boolean).join(" "),
      rightX,
      doc.y + 2,
      { width: colWidth },
    );
  }
  doc.text(`Émis le ${formatDate(emittedAt)}`, rightX, doc.y + 2, { width: colWidth });

  doc.x = 56;
  doc.y = Math.max(doc.y, yStart + 110);
  doc.moveDown(1.5);
  hr(doc);
}

function totalsTable(
  doc: PDFKit.PDFDocument,
  data: FiscalRecapData,
) {
  doc.moveDown(0.6);
  const labelX = 56;
  const valueX = doc.page.width - 56 - 200;

  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  doc.text("PÉRIODE", labelX, doc.y);
  doc.text("CUMUL", valueX, doc.y, { width: 200, align: "right" });
  doc.moveDown(0.4);
  hr(doc);
  doc.moveDown(0.6);

  const rowY = doc.y;
  const periodLabel = `Du 01/01/${data.year} au 31/12/${data.year}`;
  doc.fontSize(11).fillColor(COLOR_INK).text(periodLabel, labelX, rowY, { width: valueX - labelX - 16 });
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text(
    `Sommes versées par BUUPP au bénéficiaire (récompenses de mise en relation et bonus parrainage).`,
    labelX,
    doc.y + 2,
    { width: valueX - labelX - 16 },
  );

  doc.fontSize(11).fillColor(COLOR_INK).text(formatEur(data.totalCents), valueX, rowY, { width: 200, align: "right" });
  doc.moveDown(2);
  hr(doc);

  // Stats
  doc.moveDown(0.6);
  const statsY = doc.y;
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("Nombre de transactions", labelX, statsY);
  doc.fontSize(11).fillColor(COLOR_INK).text(String(data.transactionCount), valueX, statsY, { width: 200, align: "right" });

  doc.moveDown(1.2);
  const totalY = doc.y;
  doc.fontSize(10).fillColor(COLOR_SUBTLE).text("Total cumulé", labelX, totalY);
  doc.fontSize(18).fillColor(COLOR_ACCENT).text(formatEur(data.totalCents), valueX, totalY - 6, { width: 200, align: "right" });
}

function footerNote(doc: PDFKit.PDFDocument, lines: string[]) {
  const footerY = doc.page.height - 56 - lines.length * 12 - 6;
  doc.fontSize(8).fillColor(COLOR_SUBTLE);
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], 56, footerY + i * 12, {
      width: doc.page.width - 56 * 2,
      align: "center",
    });
  }
}

/* ─── Récapitulatif annuel ────────────────────────────────────────── */
export async function buildAnnualRecapPdf(
  data: FiscalRecapData,
  prospect: ProspectFiscalIdentity,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Récapitulatif annuel ${data.year}`,
      Author: PLATFORM.operator,
      Subject: `Récap fiscal ${data.year} pour ${fullName(prospect)}`,
    },
  });
  doc.font("Helvetica");

  header(
    doc,
    "Document fiscal — usage personnel",
    `Récapitulatif annuel ${data.year}`,
    data.reference,
  );
  identityBlock(doc, prospect, data.emittedAt);
  totalsTable(doc, data);

  doc.moveDown(2);
  doc.fontSize(11).fillColor(COLOR_INK).text("À retenir pour votre déclaration", 56);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor(COLOR_SUBTLE);
  doc.text(
    "• Les sommes ci-dessus correspondent aux gains nets crédités sur votre portefeuille BUUPP au cours de l'exercice.",
    56,
    doc.y,
    { width: doc.page.width - 56 * 2 },
  );
  doc.text(
    "• Au-delà de 305 € annuels, ces revenus doivent être déclarés (régime micro-BIC ou BNC selon votre activité principale).",
    { width: doc.page.width - 56 * 2 },
  );
  doc.text(
    "• Au-delà de 3 000 € OU 20 transactions sur l'année, BUUPP transmet automatiquement votre récapitulatif à la DGFiP au plus tard le 31 janvier de l'année suivante (article 242 bis du CGI).",
    { width: doc.page.width - 56 * 2 },
  );

  footerNote(doc, [
    `${PLATFORM.legalForm} — ${PLATFORM.operator} · ${PLATFORM.address}, ${PLATFORM.postalCity} · ${PLATFORM.rcs}`,
    "Document généré électroniquement par BUUPP, sans signature manuscrite requise. Réf. unique stable par exercice.",
  ]);

  return docToBuffer(doc);
}

/* ─── Reçu / Attestation DGFiP ────────────────────────────────────── */
export async function buildDgfipReceiptPdf(
  data: FiscalRecapData,
  prospect: ProspectFiscalIdentity,
  options: { reportedToDgfip: boolean; transmittedAt?: string | null },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Attestation DGFiP ${data.year}`,
      Author: PLATFORM.operator,
      Subject: `Reçu de transmission DGFiP ${data.year} pour ${fullName(prospect)}`,
    },
  });
  doc.font("Helvetica");

  header(
    doc,
    "Attestation de transmission",
    `Reçu DGFiP — Exercice ${data.year}`,
    data.reference,
  );
  identityBlock(doc, prospect, data.emittedAt);
  totalsTable(doc, data);

  // Bloc transmission
  doc.moveDown(2);
  const status = options.reportedToDgfip
    ? "Transmis aux services fiscaux"
    : "Non transmis (seuil non atteint)";
  doc.fontSize(11).fillColor(COLOR_INK).text("Statut de transmission DGFiP", 56);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(COLOR_SUBTLE);
  doc.text(status, 56, doc.y, { width: doc.page.width - 56 * 2 });
  if (options.reportedToDgfip && options.transmittedAt) {
    doc.text(`Date de transmission : ${formatDate(options.transmittedAt)}`, { width: doc.page.width - 56 * 2 });
  } else if (!options.reportedToDgfip) {
    doc.text(
      "Les seuils déclaratifs (3 000 € ou 20 transactions) n'ont pas été dépassés sur l'exercice. Aucune transmission DGFiP n'a été effectuée.",
      { width: doc.page.width - 56 * 2 },
    );
  }

  doc.moveDown(1.4);
  doc.fontSize(11).fillColor(COLOR_INK).text("Référence légale", 56);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(COLOR_SUBTLE);
  doc.text(
    "Article 242 bis du Code général des impôts — obligation pour les opérateurs de plateformes de communiquer chaque année à l'administration fiscale et à leurs usagers le récapitulatif des sommes perçues.",
    56,
    doc.y,
    { width: doc.page.width - 56 * 2 },
  );

  footerNote(doc, [
    `${PLATFORM.legalForm} — ${PLATFORM.operator} · ${PLATFORM.address}, ${PLATFORM.postalCity} · ${PLATFORM.rcs}`,
    "Attestation générée électroniquement par BUUPP en exécution de l'article 242 bis du CGI. Document conservé en archive sécurisée.",
  ]);

  return docToBuffer(doc);
}

/* Référence stable par (prospect, année, type). Sert à la fois à l'UI
   (reproductibilité d'un téléchargement à l'autre) et à la traçabilité
   éventuelle d'une transmission DGFiP. */
export function fiscalReference(prospectId: string, year: number, kind: "recap" | "dgfip"): string {
  const suffix = prospectId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `BUUPP-${kind === "dgfip" ? "DGFIP" : "RECAP"}-${year}-${suffix}`;
}
