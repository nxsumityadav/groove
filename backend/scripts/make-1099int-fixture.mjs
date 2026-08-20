// Builds a brokerage-style 1099-INT PDF for testing and for the sample-docs
// picker. Like the W-2 fixture, it deliberately uses its own geometry so the
// label-anchored extractor is proven against layout drift, not fitted to it.
//
//   node backend/scripts/make-1099int-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../test-fixtures/f1099int-sample.pdf');

const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const label = await doc.embedFont(StandardFonts.Helvetica);
const value = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const ink = rgb(0.1, 0.1, 0.1);
const line = rgb(0.45, 0.45, 0.45);

function box(x, y, w, h, labelText, valueText, opts = {}) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: line, borderWidth: 0.8 });
  page.drawText(labelText, { x: x + 4, y: y + h - 10, size: 6.5, font: label, color: ink });
  if (valueText) {
    const size = opts.size ?? 10;
    const tx = opts.align === 'right' ? x + w - 6 - value.widthOfTextAtSize(valueText, size) : x + 6;
    page.drawText(valueText, { x: tx, y: y + 6, size, font: value, color: ink });
  }
}

page.drawText('Form 1099-INT', { x: 40, y: 748, size: 13, font: bold, color: ink });
page.drawText('Interest Income', { x: 160, y: 748, size: 13, font: bold, color: ink });
page.drawText('2024', { x: 500, y: 748, size: 13, font: bold, color: ink });
page.drawText('Department of the Treasury—Internal Revenue Service', { x: 40, y: 735, size: 7, font: label, color: ink });

// Left column — parties
box(40, 660, 260, 60, "PAYER'S name, street address, city, state, ZIP", '');
page.drawText('Springfield Savings Bank', { x: 46, y: 696, size: 10, font: value, color: ink });
page.drawText('12 Main Street', { x: 46, y: 684, size: 9, font: value, color: ink });
page.drawText('Springfield, IL 62704', { x: 46, y: 672, size: 9, font: value, color: ink });
box(40, 620, 126, 34, "PAYER'S TIN", '36-1122334');
box(172, 620, 128, 34, "RECIPIENT'S TIN", '123-45-6789');
box(40, 558, 260, 56, "RECIPIENT'S name", '');
page.drawText('Richard A Jenkins', { x: 46, y: 590, size: 10, font: value, color: ink });
box(40, 496, 260, 56, 'Street address (including apt. no.)', '');
page.drawText('742 Evergreen Terrace', { x: 46, y: 528, size: 10, font: value, color: ink });
page.drawText('Springfield, IL 62704', { x: 46, y: 516, size: 9, font: value, color: ink });
box(40, 456, 260, 34, 'Account number (see instructions)', 'SSB-99-40417');

// Right column — the numbered money boxes
const R = 316;
const W = 140;
box(R, 660, W, 34, '1  Interest income', '1240.55', { align: 'right' });
box(R + W + 6, 660, W, 34, '2  Early withdrawal penalty', '', { align: 'right' });
box(R, 620, W, 34, '3  Interest on U.S. Savings Bonds and Treasury obligations', '', { align: 'right' });
box(R + W + 6, 620, W, 34, '4  Federal income tax withheld', '124.00', { align: 'right' });
box(R, 580, W, 34, '5  Investment expenses', '', { align: 'right' });
box(R + W + 6, 580, W, 34, '8  Tax-exempt interest', '', { align: 'right' });
box(R, 540, W, 34, '17  State tax withheld', '62.00', { align: 'right' });

fs.writeFileSync(out, await doc.save());
console.log('wrote', out);
