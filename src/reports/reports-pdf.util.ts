import PDFDocument = require('pdfkit');

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function writeTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  columns: { label: string; width: number }[],
  y: number,
): number {
  let x = doc.page.margins.left;
  doc.font('Helvetica-Bold').fontSize(9);
  for (const col of columns) {
    doc.text(col.label, x, y, { width: col.width, lineBreak: false });
    x += col.width;
  }
  doc
    .moveTo(doc.page.margins.left, y + 14)
    .lineTo(doc.page.width - doc.page.margins.right, y + 14)
    .stroke();
  return y + 20;
}

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed: number): void {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

export interface SalesPdfRow {
  orderNumber: string;
  date: Date;
  customerName: string;
  status: string;
  total: number;
}

export interface SalesPdfInput {
  periodLabel: string;
  revenue: number;
  ordersCount: number;
  rows: SalesPdfRow[];
}

export interface CustomersPdfRow {
  email: string;
  name: string;
  phone: string;
  active: boolean;
  emailConsent: boolean;
  whatsappConsent: boolean;
  orderCount: number;
  revenue: number;
  segments: string;
}

export interface CustomersPdfInput {
  total: number;
  active: number;
  withConsentEmail: number;
  withConsentWhatsapp: number;
  rows: CustomersPdfRow[];
}

export function buildSalesPdf(input: SalesPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('Rapport ventes — Kaniê', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).fillColor('#444444');
    doc.text(`Période : ${input.periodLabel}`, { align: 'center' });
    doc.text(`Généré le ${formatDate(new Date())}`, { align: 'center' });
    doc.moveDown();

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('Synthèse');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Chiffre d'affaires : ${formatFcfa(input.revenue)}`);
    doc.text(`Nombre de commandes : ${input.ordersCount}`);
    doc.moveDown();

    const columns = [
      { label: 'N° commande', width: 90 },
      { label: 'Date', width: 65 },
      { label: 'Client', width: 120 },
      { label: 'Statut', width: 80 },
      { label: 'Total', width: 80 },
    ];

    doc.font('Helvetica-Bold').fontSize(11).text('Détail des commandes');
    doc.moveDown(0.5);

    let y = writeTableHeader(doc, columns, doc.y);
    doc.font('Helvetica').fontSize(8);

    for (const row of input.rows) {
      ensureSpace(doc, 16);
      let x = doc.page.margins.left;
      const cells = [
        row.orderNumber,
        formatDate(row.date),
        row.customerName.slice(0, 28),
        row.status,
        formatFcfa(row.total),
      ];
      for (let i = 0; i < columns.length; i += 1) {
        doc.text(cells[i], x, y, { width: columns[i].width, lineBreak: false });
        x += columns[i].width;
      }
      y += 14;
    }

    if (input.rows.length === 0) {
      doc.text('Aucune commande sur cette période.', doc.page.margins.left, y);
    }

    doc.end();
  });
}

export function buildCustomersPdf(input: CustomersPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('Rapport clients — Kaniê', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).fillColor('#444444');
    doc.text(`Généré le ${formatDate(new Date())}`, { align: 'center' });
    doc.moveDown();

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('Synthèse');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total clients : ${input.total}`);
    doc.text(`Actifs : ${input.active} · Email : ${input.withConsentEmail} · WhatsApp : ${input.withConsentWhatsapp}`);
    doc.moveDown();

    const columns = [
      { label: 'Email', width: 130 },
      { label: 'Nom', width: 100 },
      { label: 'Tél.', width: 80 },
      { label: 'Actif', width: 35 },
      { label: 'Cmd.', width: 35 },
      { label: 'CA', width: 75 },
      { label: 'Groupes', width: 120 },
    ];

    doc.font('Helvetica-Bold').fontSize(11).text('Liste des clients');
    doc.moveDown(0.5);

    let y = writeTableHeader(doc, columns, doc.y);
    doc.font('Helvetica').fontSize(8);

    for (const row of input.rows) {
      ensureSpace(doc, 16);
      let x = doc.page.margins.left;
      const cells = [
        row.email.slice(0, 32),
        row.name.slice(0, 24),
        row.phone.slice(0, 16),
        row.active ? 'Oui' : 'Non',
        String(row.orderCount),
        formatFcfa(row.revenue),
        row.segments.slice(0, 40) || '—',
      ];
      for (let i = 0; i < columns.length; i += 1) {
        doc.text(cells[i], x, y, { width: columns[i].width, lineBreak: false });
        x += columns[i].width;
      }
      y += 14;
    }

    if (input.rows.length === 0) {
      doc.text('Aucun client enregistré.', doc.page.margins.left, y);
    }

    doc.end();
  });
}
