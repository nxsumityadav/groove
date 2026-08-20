// Form 1099-INT, Interest Income. Same label-anchored approach as the W-2:
// issuer layouts vary, box labels don't.
const S = {
  parties: 'Payer and recipient',
  interest: 'Interest income',
  tax: 'Tax withheld',
};

const f = (key, label, section, type, anchors, extra = {}) => ({ key, label, section, type, anchors, line: extra.line ?? null, ...extra });

export default {
  id: 'f1099int',
  name: 'Form 1099-INT',
  title: '1099-INT Interest Income',
  jurisdiction: 'Federal',
  strategy: 'label',
  sections: Object.values(S),
  tables: [],
  detect: {
    signatures: [['1099-INT'], ['Interest Income', 'Interest income']],
  },
  fields: [
    f('payerName', 'Payer’s name and address', S.parties, 'text', ["payer's name, street address", "payer's name"], { multiline: true }),
    f('payerTin', 'Payer’s TIN', S.parties, 'text', ["payer's tin", "payer's federal identification number"]),
    f('recipientTin', 'Recipient’s TIN', S.parties, 'ssn', ["recipient's tin", "recipient's identification number"]),
    f('recipientName', 'Recipient’s name', S.parties, 'text', ["recipient's name"]),
    f('recipientAddress', 'Recipient’s address', S.parties, 'text', ['street address (including apt. no.)', "recipient's address"], { multiline: true }),
    f('accountNumber', 'Account number', S.parties, 'text', ['account number']),

    f('interestIncome', 'Interest income', S.interest, 'money', ['interest income'], { line: '1' }),
    f('earlyWithdrawalPenalty', 'Early withdrawal penalty', S.interest, 'money', ['early withdrawal penalty'], { line: '2' }),
    f('usSavingsBondInterest', 'Interest on U.S. Savings Bonds and Treasury obligations', S.interest, 'money', ['interest on u.s. savings bonds'], { line: '3' }),
    f('taxExemptInterest', 'Tax-exempt interest', S.interest, 'money', ['tax-exempt interest'], { line: '8' }),

    f('federalTaxWithheld', 'Federal income tax withheld', S.tax, 'money', ['federal income tax withheld'], { line: '4' }),
    f('investmentExpenses', 'Investment expenses', S.tax, 'money', ['investment expenses'], { line: '5' }),
    f('stateTaxWithheld', 'State tax withheld', S.tax, 'money', ['state tax withheld'], { line: '17' }),
  ],
};
