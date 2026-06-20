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

/** Crée un document PDFKit configuré (A4, marges, police, métadonnées). */
function newDoc(title: string, subject: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: title,
      Author: SELLER.name,
      Subject: subject,
    },
  });
  doc.font("Helvetica");
  return doc;
}

/**
 * Dessine une facture complète sur la page courante du document.
 * Toutes les positions sont relatives à la page en cours, donc cette
 * fonction peut être rappelée après `doc.addPage()` pour empiler
 * plusieurs factures dans un même document (cf. `buildInvoicesPdf`).
 */
function renderInvoice(
  doc: PDFKit.PDFDocument,
  invoice: InvoiceData,
  pro: ProBillingInfo,
): void {
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
}

/** Génère le PDF d'une facture unique. */
export async function buildInvoicePdf(
  invoice: InvoiceData,
  pro: ProBillingInfo,
): Promise<Buffer> {
  const doc = newDoc(`Facture ${invoice.number}`, invoice.label);
  renderInvoice(doc, invoice, pro);
  return docToBuffer(doc);
}

/**
 * Génère un PDF unique regroupant plusieurs factures, une par page
 * (bouton « Tout télécharger » de l'onglet Facturation). L'ordre des
 * factures est conservé. Lève si la liste est vide (l'appelant doit
 * filtrer en amont).
 */
export async function buildInvoicesPdf(
  invoices: InvoiceData[],
  pro: ProBillingInfo,
): Promise<Buffer> {
  if (invoices.length === 0) {
    throw new Error("no_invoices");
  }
  const doc = newDoc(
    `Factures BUUPP — ${pro.raisonSociale} (${invoices.length})`,
    "Historique des factures",
  );
  invoices.forEach((invoice, i) => {
    if (i > 0) doc.addPage();
    renderInvoice(doc, invoice, pro);
  });
  return docToBuffer(doc);
}

/* ─────────────────────────────────────────────────────────────────────
   Relevé de campagne (bouton « Relevé complet » de l'onglet Facturation
   du détail d'une campagne). Ce n'est PAS une facture fiscale : c'est un
   récapitulatif des débits d'une campagne (budget consommé, commission
   BUUPP, contacts facturés). Les identités prospect ne sont incluses que
   si la campagne est clôturée (parité avec le gating séquestre côté API,
   cf. proCanSeeContacts).
   ───────────────────────────────────────────────────────────────────── */

export type CampaignStatementContact = {
  /** Nom du prospect — masqué (« Prospect ») tant que la campagne n'est pas clôturée. */
  name: string;
  tierLabel: string;
  /** Date de décision (ISO). */
  decidedAt: string;
  amountEur: number;
  statusLabel: string;
};

export type CampaignStatementData = {
  campaignName: string;
  objectiveLabel: string;
  statusLabel: string;
  createdAtLabel: string | null;
  endsAtLabel: string | null;
  budgetEur: number;
  /** Budget campagne consommé (hors commission). */
  spentEur: number;
  /** Commission BUUPP acquise (10 % du consommé). */
  commissionSpentEur: number;
  /** Total réellement débité du solde (consommé + commission). */
  totalDebitedEur: number;
  /** Nombre de contacts facturés (acceptés + crédités). */
  winCount: number;
  /** Objectif de contacts (budget / coût unitaire). */
  plannedContacts: number;
  avgCostEur: number;
  /** Liste détaillée — vide si la campagne n'est pas clôturée. */
  contacts: CampaignStatementContact[];
  contactsLocked: boolean;
};

function eur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Dessine le bloc « ÉMETTEUR / DESTINATAIRE » (réutilisé du template facture). */
function renderParties(doc: PDFKit.PDFDocument, pro: ProBillingInfo): void {
  const yStart = doc.y + 14;
  const colWidth = (doc.page.width - 56 * 2 - 24) / 2;

  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("ÉMETTEUR", 56, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(SELLER.name, 56, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE)
    .text(SELLER.address, 56, doc.y + 2, { width: colWidth })
    .text(SELLER.postalCity, { width: colWidth })
    .text(SELLER.rcs, { width: colWidth })
    .text(SELLER.email, { width: colWidth });

  const rightX = 56 + colWidth + 24;
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("DESTINATAIRE", rightX, yStart);
  doc.fontSize(11).fillColor(COLOR_INK).text(pro.raisonSociale, rightX, yStart + 14, { width: colWidth });
  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  if (pro.adresse) doc.text(pro.adresse, rightX, doc.y + 2, { width: colWidth });
  if (pro.codePostal || pro.ville) {
    doc.text([pro.codePostal, pro.ville].filter(Boolean).join(" "), { width: colWidth });
  }
  if (pro.siret) doc.text(`SIRET : ${pro.siret}`, { width: colWidth });
  else if (pro.siren) doc.text(`SIREN : ${pro.siren}`, { width: colWidth });
  if (pro.email) doc.text(pro.email, { width: colWidth });

  doc.x = 56;
  doc.y = Math.max(doc.y, yStart + 110);
}

/** Génère le PDF « Relevé complet » d'une campagne. */
export async function buildCampaignStatementPdf(
  data: CampaignStatementData,
  pro: ProBillingInfo,
): Promise<Buffer> {
  const doc = newDoc(`Relevé de campagne — ${data.campaignName}`, "Relevé de campagne BUUPP");

  // ─── En-tête ──────────────────────────────────────────────────────
  doc.fontSize(22).fillColor(COLOR_INK).text("BUUPP", { continued: false });
  doc.moveUp(0.6).fontSize(10).fillColor(COLOR_SUBTLE).text("Relevé de campagne", { align: "right" });

  doc.moveDown(1.2);
  doc.fontSize(15).fillColor(COLOR_INK).text(data.campaignName, 56, doc.y, { width: doc.page.width - 56 * 2 });
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text(
    [
      data.objectiveLabel && data.objectiveLabel !== "—" ? data.objectiveLabel : null,
      `Statut : ${data.statusLabel}`,
      data.createdAtLabel ? `Créée le ${data.createdAtLabel}` : null,
      data.endsAtLabel ? `Diffusion jusqu'au ${data.endsAtLabel}` : null,
    ].filter(Boolean).join("  ·  "),
    { width: doc.page.width - 56 * 2 },
  );

  doc.moveDown(1);
  hr(doc);
  renderParties(doc, pro);
  doc.moveDown(1);
  hr(doc);

  // ─── Récapitulatif financier ──────────────────────────────────────
  doc.moveDown(1);
  const labelX = 56;
  const amountX = doc.page.width - 56 - 160;
  const amountW = 160;
  const rows: Array<[string, string, boolean]> = [
    ["Budget campagne consommé", eur(data.spentEur), false],
    ["Commission BUUPP (10 %)", eur(data.commissionSpentEur), false],
    [
      "Contacts facturés",
      `${data.winCount}${data.plannedContacts > 0 ? ` / ${data.plannedContacts}` : ""}`,
      false,
    ],
    ["Coût moyen par contact", eur(data.avgCostEur), false],
  ];
  doc.fontSize(9).fillColor(COLOR_SUBTLE);
  doc.text("RÉCAPITULATIF", labelX, doc.y);
  doc.moveDown(0.5);
  hr(doc);
  doc.moveDown(0.4);
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.fontSize(10).fillColor(COLOR_INK).text(label, labelX, y, { width: amountX - labelX - 16 });
    doc.fontSize(10).fillColor(COLOR_INK).text(value, amountX, y, { width: amountW, align: "right" });
    doc.moveDown(0.5);
  }
  doc.moveDown(0.4);
  hr(doc);
  doc.moveDown(0.6);
  const totalY = doc.y;
  doc.fontSize(11).fillColor(COLOR_SUBTLE).text("Total débité du solde", labelX, totalY, { width: amountX - labelX - 16, align: "right" });
  doc.fontSize(15).fillColor(COLOR_ACCENT).text(eur(data.totalDebitedEur), amountX, totalY - 4, { width: amountW, align: "right" });
  doc.x = 56;
  doc.moveDown(1.4);

  doc.fontSize(8).fillColor(COLOR_SUBTLE).text(
    data.winCount === 0
      ? "Aucune commission n'est due tant qu'aucun prospect n'a accepté."
      : "La commission BUUPP correspond à 10 % du gain de chaque prospect ayant accepté.",
    labelX,
    doc.y,
    { width: doc.page.width - 56 * 2 },
  );

  // ─── Détail des contacts facturés ─────────────────────────────────
  doc.moveDown(1.4);
  hr(doc);
  doc.moveDown(0.8);
  doc.fontSize(9).fillColor(COLOR_SUBTLE).text("CONTACTS FACTURÉS", labelX, doc.y);
  doc.moveDown(0.6);

  if (data.contactsLocked) {
    doc.fontSize(9).fillColor(COLOR_SUBTLE).text(
      "Le détail par prospect (identité, palier, montant) sera disponible une fois la campagne clôturée.",
      labelX,
      doc.y,
      { width: doc.page.width - 56 * 2 },
    );
  } else if (data.contacts.length === 0) {
    doc.fontSize(9).fillColor(COLOR_SUBTLE).text(
      "Aucun contact facturé pour le moment.",
      labelX,
      doc.y,
      { width: doc.page.width - 56 * 2 },
    );
  } else {
    // Colonnes : Date · Contact · Palier · Montant · Statut
    const dateX = 56;
    const nameX = 130;
    const tierX = 290;
    const amtX = doc.page.width - 56 - 200;
    const statusX = doc.page.width - 56 - 100;
    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(8).fillColor(COLOR_SUBTLE);
      doc.text("DATE", dateX, y);
      doc.text("CONTACT", nameX, y, { width: tierX - nameX - 8 });
      doc.text("PALIER", tierX, y, { width: amtX - tierX - 8 });
      doc.text("MONTANT", amtX, y, { width: statusX - amtX - 8, align: "right" });
      doc.text("STATUT", statusX, y, { width: 100 });
      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.4);
    };
    drawHeader();
    for (const c of data.contacts) {
      // Saut de page si on approche du pied.
      if (doc.y > doc.page.height - 90) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc.fontSize(9).fillColor(COLOR_INK);
      doc.text(formatDate(c.decidedAt), dateX, y, { width: nameX - dateX - 8 });
      doc.text(c.name, nameX, y, { width: tierX - nameX - 8 });
      doc.text(c.tierLabel, tierX, y, { width: amtX - tierX - 8 });
      doc.text(eur(c.amountEur), amtX, y, { width: statusX - amtX - 8, align: "right" });
      doc.text(c.statusLabel, statusX, y, { width: 100 });
      doc.moveDown(0.7);
    }
  }

  // ─── Pied de page légal ───────────────────────────────────────────
  doc.fontSize(8).fillColor(COLOR_SUBTLE).text(
    `Document indicatif émis par ${SELLER.name} (${SELLER.legalForm}). Pour vos factures fiscales, voir l'onglet Facturation.`,
    56,
    doc.page.height - 56 - 24,
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
