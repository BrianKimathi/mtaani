import PDFDocument from 'pdfkit';
import type { Swap } from '../lib/types.js';

type SwapRow = Pick<
  Swap,
  | 'swappedAt'
  | 'tukTukReg'
  | 'incomingBarcode'
  | 'incomingPct'
  | 'outgoingBarcode'
  | 'outgoingPct'
  | 'netPercent'
  | 'totalCharged'
  | 'companyShare'
  | 'stationShare'
>;

export interface ReportMeta {
  title: string;
  organizationName: string;
  substationName?: string;
  periodLabel: string;
  from: Date;
  to: Date;
  totals: {
    swapCount: number;
    grossRevenue: number;
    companyShare: number;
    stationShare: number;
    energyPercent: number;
  };
}

export function buildSwapPdf(meta: ReportMeta, swaps: SwapRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Bekye Battery Swap Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#444');
    doc.text(meta.organizationName, { align: 'center' });
    if (meta.substationName) doc.text(`Substation: ${meta.substationName}`, { align: 'center' });
    doc.text(`Period: ${meta.periodLabel}`, { align: 'center' });
    doc.text(
      `${meta.from.toLocaleString('en-KE')} — ${meta.to.toLocaleString('en-KE')}`,
      { align: 'center' }
    );
    doc.moveDown(1);
    doc.fillColor('#000');

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Total swaps: ${meta.totals.swapCount}`);
    doc.text(`Energy transferred (net %): ${meta.totals.energyPercent}`);
    doc.text(`Gross revenue: KES ${meta.totals.grossRevenue.toFixed(2)}`);
    doc.text(`Company share (60%): KES ${meta.totals.companyShare.toFixed(2)}`);
    doc.text(`Station share (40%): KES ${meta.totals.stationShare.toFixed(2)}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Transactions', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(8);

    const header =
      'Date/Time | Tuk-Tuk | In Batt | In% | Out Batt | Out% | Net% | Total | Co.60% | St.40%';
    doc.text(header);
    doc.moveDown(0.3);

    for (const s of swaps) {
      const line = [
        new Date(s.swappedAt).toLocaleString('en-KE'),
        s.tukTukReg,
        s.incomingBarcode,
        `${s.incomingPct}%`,
        s.outgoingBarcode,
        `${s.outgoingPct}%`,
        `${s.netPercent}%`,
        Number(s.totalCharged).toFixed(2),
        Number(s.companyShare).toFixed(2),
        Number(s.stationShare).toFixed(2),
      ].join(' | ');
      doc.text(line);
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#666').text('© Bekye Investments Ltd — Confidential', {
      align: 'center',
    });
    doc.end();
  });
}
