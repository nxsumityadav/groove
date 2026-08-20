// Builds a realistic employer-style W-2 PDF for testing extraction.
// Real W-2s come from many payroll vendors with different geometry, so this
// fixture deliberately uses its own box layout — the extractor has to find
// values by their printed box labels, not by fixed coordinates.
//
//   node backend/scripts/make-w2-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../test-fixtures/w2-sample.pdf');

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

page.drawText('Form W-2  Wage and Tax Statement', { x: 40, y: 745, size: 13, font: bold, color: ink });
page.drawText('2024', { x: 500, y: 745, size: 13, font: bold, color: ink });
page.drawText('Department of the Treasury—Internal Revenue Service', { x: 40, y: 732, size: 7, font: label, color: ink });

// Left column — the identity boxes
box(40, 690, 250, 34, 'a  Employee’s social security number', '123-45-6789');
box(40, 650, 250, 34, 'b  Employer identification number (EIN)', '98-7654321');
// Name on the first line of the box, address beneath — as vendors print it.
box(40, 588, 250, 56, 'c  Employer’s name, address, and ZIP code', '');
page.drawText('Acme Corporation', { x: 46, y: 620, size: 10, font: value, color: ink });
page.drawText('500 Industrial Way', { x: 46, y: 608, size: 9, font: value, color: ink });
page.drawText('Springfield, IL 62704', { x: 46, y: 596, size: 9, font: value, color: ink });
box(40, 548, 250, 34, 'd  Control number', 'AC-4471-22');
box(40, 486, 250, 56, 'e  Employee’s first name and initial    Last name', '');
page.drawText('Richard A Jenkins', { x: 46, y: 518, size: 10, font: value, color: ink });
box(40, 424, 250, 56, 'f  Employee’s address and ZIP code', '');
page.drawText('742 Evergreen Terrace', { x: 46, y: 456, size: 10, font: value, color: ink });
page.drawText('Springfield, IL 62704', { x: 46, y: 444, size: 9, font: value, color: ink });

// Right columns — the numbered money boxes
const R1 = 300;
const R2 = 456;
const W = 150;
const rows = [
  ['1  Wages, tips, other compensation', '85000.00', '2  Federal income tax withheld', '12500.00'],
  ['3  Social security wages', '85000.00', '4  Social security tax withheld', '5270.00'],
  ['5  Medicare wages and tips', '85000.00', '6  Medicare tax withheld', '1232.50'],
  ['7  Social security tips', '', '8  Allocated tips', ''],
  ['10  Dependent care benefits', '', '11  Nonqualified plans', ''],
];
rows.forEach(([l1, v1, l2, v2], i) => {
  const y = 690 - i * 42;
  box(R1, y, W, 34, l1, v1, { align: 'right' });
  box(R2, y, W, 34, l2, v2, { align: 'right' });
});

// State section
box(40, 360, 60, 40, '15  State', 'IL');
box(104, 360, 186, 40, 'Employer’s state ID number', '36-8891137');
box(R1, 360, W, 40, '16  State wages, tips, etc.', '85000.00', { align: 'right' });
box(R2, 360, W, 40, '17  State income tax', '4165.00', { align: 'right' });

fs.writeFileSync(out, await doc.save());
console.log('wrote', out);
