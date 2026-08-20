// Field map for IRS Form 1040 (2025 layout, 2 pages, 612x792pt).
//
// Every field has a `box` in PDF user-space coordinates (origin bottom-left)
// on form page `page` (0 = form page 1, 1 = form page 2). The same box is
// used three ways:
//   - positional extraction: text items whose baseline falls inside the box
//     are the field's value (services/positionalExtractor.js)
//   - the review UI: highlight/click targets over the rendered page
//
// Coordinates were measured from the FreeTaxUSA blank 2025 f1040.pdf via
// pdfjs getTextContent() (see scripts/build-1040-template.mjs for the
// template itself).

const PAGE = { width: 612, height: 792 };
const RIGHT_COL = [496, 578]; // amount boxes in the far-right column
const MID_COL = [244, 330]; // 2a/3a/4a/5a/6a boxes
const MID_RIGHT_COL = [404, 483]; // 1i, 25a-c, 27a-31, 36, 38 boxes

let order = 0;
function field(key, label, section, opts) {
  const { page, box, type = 'text', line = null } = opts;
  return { key, label, section, line, type, page, box: { x1: box[0], y1: box[1], x2: box[2], y2: box[3] }, order: order++ };
}
// A single-line amount at label baseline `y` in column [x1,x2].
const money = (key, label, section, line, page, y, col = RIGHT_COL) =>
  field(key, label, section, { page, type: 'money', line, box: [col[0], y - 4, col[1], y + 9] });
// Checkbox squares sit just left of their printed label. The box is anchored
// on the label's x so it covers the square but stops short of the label text
// (otherwise the label itself would read as a tick).
const check = (key, label, section, page, labelX, labelY, line = null) =>
  field(key, label, section, { page, type: 'checkbox', line, box: [labelX - 14, labelY - 5, labelX - 2, labelY + 8] });

const S = {
  you: 'Your information',
  filing: 'Filing status',
  digital: 'Digital assets',
  deps: 'Dependents',
  income: 'Income',
  tax: 'Tax and credits',
  pay: 'Payments',
  refund: 'Refund',
  owe: 'Amount you owe',
};

const fields = [
  // --- Page 1: identity ---
  field('firstName', 'First name and middle initial', S.you, { page: 0, box: [36, 680, 250, 697] }),
  field('lastName', 'Last name', S.you, { page: 0, box: [256, 680, 465, 697] }),
  field('ssn', 'Your social security number', S.you, { page: 0, type: 'ssn', box: [472, 680, 578, 697] }),
  field('spouseFirstName', "Spouse's first name and middle initial", S.you, { page: 0, box: [36, 656, 250, 673] }),
  field('spouseLastName', "Spouse's last name", S.you, { page: 0, box: [256, 656, 465, 673] }),
  field('spouseSsn', "Spouse's social security number", S.you, { page: 0, type: 'ssn', box: [472, 656, 578, 673] }),
  field('address', 'Home address', S.you, { page: 0, box: [36, 632, 415, 649] }),
  field('aptNo', 'Apt. no.', S.you, { page: 0, box: [422, 632, 465, 649] }),
  field('city', 'City, town, or post office', S.you, { page: 0, box: [36, 608, 330, 625] }),
  field('state', 'State', S.you, { page: 0, box: [335, 608, 395, 625] }),
  field('zip', 'ZIP code', S.you, { page: 0, box: [400, 608, 465, 625] }),

  // --- Filing status (label positions: "Single" at 110,578 etc.) ---
  check('filingSingle', 'Single', S.filing, 0, 110, 578),
  check('filingMFJ', 'Married filing jointly', S.filing, 0, 110, 566),
  check('filingMFS', 'Married filing separately (MFS)', S.filing, 0, 110, 554),
  check('filingHOH', 'Head of household (HOH)', S.filing, 0, 362, 578),
  check('filingQSS', 'Qualifying surviving spouse (QSS)', S.filing, 0, 362, 566),
  field('hohQualifyingChild', 'HOH/QSS qualifying child name', S.filing, { page: 0, box: [362, 534, 578, 547] }),

  // --- Digital assets ("Yes" label at 529,498; "No" at 565,498) ---
  check('digitalAssetsYes', 'Digital assets — Yes', S.digital, 0, 529, 498),
  check('digitalAssetsNo', 'Digital assets — No', S.digital, 0, 565, 498),

  // --- Dependents (4 columns) ---
  ...[0, 1, 2, 3].flatMap((i) => {
    const x1 = 146 + i * 108;
    const x2 = x1 + 108;
    const n = i + 1;
    return [
      field(`dep${n}FirstName`, `Dependent ${n} first name`, S.deps, { page: 0, box: [x1, 468, x2, 480] }),
      field(`dep${n}LastName`, `Dependent ${n} last name`, S.deps, { page: 0, box: [x1, 456, x2, 468] }),
      field(`dep${n}Ssn`, `Dependent ${n} SSN`, S.deps, { page: 0, type: 'ssn', box: [x1, 444, x2, 456] }),
    ];
  }),

  // --- Income (page 1) ---
  money('line1a', 'Total amount from Form(s) W-2, box 1', S.income, '1a', 0, 332),
  money('line1b', 'Household employee wages not reported on W-2', S.income, '1b', 0, 320),
  money('line1c', 'Tip income not reported on line 1a', S.income, '1c', 0, 308),
  money('line1d', 'Medicaid waiver payments not reported on W-2', S.income, '1d', 0, 296),
  money('line1e', 'Taxable dependent care benefits (Form 2441)', S.income, '1e', 0, 284),
  money('line1f', 'Employer-provided adoption benefits (Form 8839)', S.income, '1f', 0, 272),
  money('line1g', 'Wages from Form 8919', S.income, '1g', 0, 260),
  money('line1h', 'Other earned income', S.income, '1h', 0, 248),
  money('line1i', 'Nontaxable combat pay election', S.income, '1i', 0, 236, MID_RIGHT_COL),
  money('line1z', 'Add lines 1a through 1h', S.income, '1z', 0, 224),
  money('line2a', 'Tax-exempt interest', S.income, '2a', 0, 212, MID_COL),
  money('line2b', 'Taxable interest', S.income, '2b', 0, 212),
  money('line3a', 'Qualified dividends', S.income, '3a', 0, 200, MID_COL),
  money('line3b', 'Ordinary dividends', S.income, '3b', 0, 200),
  money('line4a', 'IRA distributions', S.income, '4a', 0, 176, MID_COL),
  money('line4b', 'IRA distributions — taxable amount', S.income, '4b', 0, 176),
  money('line5a', 'Pensions and annuities', S.income, '5a', 0, 152, MID_COL),
  money('line5b', 'Pensions and annuities — taxable amount', S.income, '5b', 0, 152),
  money('line6a', 'Social security benefits', S.income, '6a', 0, 128, MID_COL),
  money('line6b', 'Social security benefits — taxable amount', S.income, '6b', 0, 128),
  money('line7a', 'Capital gain or (loss)', S.income, '7a', 0, 92),
  money('line8', 'Additional income from Schedule 1, line 10', S.income, '8', 0, 68),
  money('line9', 'Total income', S.income, '9', 0, 56),
  money('line10', 'Adjustments to income from Schedule 1, line 26', S.income, '10', 0, 44),
  money('line11a', 'Adjusted gross income', S.income, '11a', 0, 32),

  // --- Tax and credits (page 2) ---
  money('line11b', 'Amount from line 11a (adjusted gross income)', S.tax, '11b', 1, 746),
  money('line12e', 'Standard deduction or itemized deductions', S.tax, '12e', 1, 686),
  money('line13a', 'Qualified business income deduction', S.tax, '13a', 1, 674),
  money('line13b', 'Additional deductions from Schedule 1-A', S.tax, '13b', 1, 662),
  money('line14', 'Add lines 12e, 13a, and 13b', S.tax, '14', 1, 650),
  money('line15', 'Taxable income', S.tax, '15', 1, 638),
  money('line16', 'Tax', S.tax, '16', 1, 626),
  money('line17', 'Amount from Schedule 2, line 3', S.tax, '17', 1, 614),
  money('line18', 'Add lines 16 and 17', S.tax, '18', 1, 602),
  money('line19', 'Child tax credit or credit for other dependents', S.tax, '19', 1, 590),
  money('line20', 'Amount from Schedule 3, line 8', S.tax, '20', 1, 578),
  money('line21', 'Add lines 19 and 20', S.tax, '21', 1, 566),
  money('line22', 'Subtract line 21 from line 18', S.tax, '22', 1, 554),
  money('line23', 'Other taxes, including self-employment tax', S.tax, '23', 1, 542),
  money('line24', 'Total tax', S.tax, '24', 1, 530),

  // --- Payments ---
  money('line25a', 'Federal income tax withheld from Form(s) W-2', S.pay, '25a', 1, 506, MID_RIGHT_COL),
  money('line25b', 'Federal income tax withheld from Form(s) 1099', S.pay, '25b', 1, 494, MID_RIGHT_COL),
  money('line25c', 'Federal income tax withheld from other forms', S.pay, '25c', 1, 482, MID_RIGHT_COL),
  money('line25d', 'Add lines 25a through 25c', S.pay, '25d', 1, 470),
  money('line26', '2025 estimated tax payments and amount applied from 2024 return', S.pay, '26', 1, 458),
  money('line27a', 'Earned income credit (EIC)', S.pay, '27a', 1, 422, MID_RIGHT_COL),
  money('line28', 'Additional child tax credit (Schedule 8812)', S.pay, '28', 1, 374, MID_RIGHT_COL),
  money('line29', 'American opportunity credit (Form 8863)', S.pay, '29', 1, 362, MID_RIGHT_COL),
  money('line30', 'Refundable adoption credit (Form 8839)', S.pay, '30', 1, 350, MID_RIGHT_COL),
  money('line31', 'Amount from Schedule 3, line 15', S.pay, '31', 1, 338, MID_RIGHT_COL),
  money('line32', 'Total other payments and refundable credits', S.pay, '32', 1, 326),
  money('line33', 'Total payments', S.pay, '33', 1, 314),

  // --- Refund ---
  money('line34', 'Amount overpaid', S.refund, '34', 1, 302),
  money('line35a', 'Amount refunded to you', S.refund, '35a', 1, 290),
  field('routingNumber', 'Routing number', S.refund, { page: 1, line: '35b', box: [160, 273, 330, 286] }),
  field('accountNumber', 'Account number', S.refund, { page: 1, line: '35d', box: [160, 261, 380, 274] }),
  money('line36', 'Amount applied to 2026 estimated tax', S.refund, '36', 1, 254, MID_RIGHT_COL),

  // --- Amount you owe ---
  money('line37', 'Amount you owe', S.owe, '37', 1, 230),
  money('line38', 'Estimated tax penalty', S.owe, '38', 1, 218, MID_RIGHT_COL),
];

export default {
  id: 'f1040-2025',
  name: 'Form 1040',
  title: '1040 U.S. Individual Income Tax Return',
  jurisdiction: 'Federal',
  year: 2025,
  pageSize: PAGE,
  pageCount: 2,
  sections: Object.values(S),
  // Sections the form prints as a grid, shown the same way in the review UI.
  // The slots are fixed by the form, so entries can be cleared but not added.
  tables: [
    {
      id: 'dependents',
      section: S.deps,
      columns: [
        { key: 'firstName', label: '(1) First name' },
        { key: 'lastName', label: '(2) Last name' },
        { key: 'ssn', label: '(3) SSN' },
      ],
      rows: [1, 2, 3, 4].map((n) => ({
        id: `dep${n}`,
        label: `Dependent ${n}`,
        fields: { firstName: `dep${n}FirstName`, lastName: `dep${n}LastName`, ssn: `dep${n}Ssn` },
      })),
    },
  ],
  detect: {
    // Any one of these phrase sets appearing (case-insensitive) on a page
    // identifies the form. Several alternatives because OCR often drops the
    // banner title while keeping section headings.
    signatures: [
      ['U.S. Individual Income Tax Return'],
      ['Form 1040', 'Filing Status'],
      ['Form 1040', 'adjusted gross income'],
    ],
    // Label positions that pin down this exact layout. If most anchors miss,
    // it's still a 1040 (text matched) but a different year's layout, so
    // positional extraction is skipped in favour of the LLM path.
    // (x,y) is the label's left baseline in PDF points.
    anchors: [
      { page: 0, text: 'Your first name and middle initial', x: 36, y: 700 },
      { page: 0, text: 'Filing Status', x: 36, y: 577 },
      { page: 0, text: 'Total amount from Form(s) W-2, box 1', x: 115, y: 332 },
      { page: 0, text: 'Digital Assets', x: 36, y: 502 },
      { page: 1, text: 'Standard deduction', x: 115, y: 686 },
      { page: 1, text: 'Federal income tax withheld from', x: 115, y: 518 },
    ],
    minAnchors: 3,
    // Text-layer items are exact; OCR line positions get a looser tolerance.
    tolerance: 4,
    ocrTolerance: 9,
  },
  fields,
};
