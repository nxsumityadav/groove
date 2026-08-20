// Builds a W-2 as a Word file — the kind of thing a client pastes into a doc
// and emails over. Exercises the docx branch: mammoth text → signature
// detection → LLM schema fill (no positions, no OCR).
//
//   node backend/scripts/make-w2-docx-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../test-fixtures/w2-sample.docx');

const LINES = [
  'Form W-2 Wage and Tax Statement — 2024',
  'Employer: Acme Corporation, 500 Industrial Way, Springfield, IL 62704',
  'Employer identification number (EIN): 98-7654321',
  'Employee: Richard A Jenkins, 742 Evergreen Terrace, Springfield, IL 62704',
  "Employee's social security number: 123-45-6789",
  'Control number: AC-4471-22',
  'Box 1 Wages, tips, other compensation: 85000.00',
  'Box 2 Federal income tax withheld: 12500.00',
  'Box 3 Social security wages: 85000.00',
  'Box 4 Social security tax withheld: 5270.00',
  'Box 5 Medicare wages and tips: 85000.00',
  'Box 6 Medicare tax withheld: 1232.50',
  'Box 15 State: IL — Employer state ID number: 36-8891137',
  'Box 16 State wages, tips, etc.: 85000.00',
  'Box 17 State income tax: 4165.00',
];

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = LINES.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const zip = zipSync({
  '[Content_Types].xml': strToU8(contentTypes),
  '_rels/.rels': strToU8(rels),
  'word/document.xml': strToU8(documentXml),
});

fs.writeFileSync(out, zip);
console.log('wrote', out, zip.length, 'bytes');
