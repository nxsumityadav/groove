// Form W-2, Wage and Tax Statement.
//
// Read by label rather than by fixed boxes: W-2s are issued by payroll
// providers whose layouts differ, but the IRS prescribes the box labels, so
// the labels are the reliable anchor. `anchors` lists the wordings we accept
// for a box (vendors abbreviate differently).
const S = {
  people: 'Employer and employee',
  wages: 'Wages and withholding',
  other: 'Other compensation',
  state: 'State and local',
};

const f = (key, label, section, type, anchors, extra = {}) => ({ key, label, section, type, anchors, line: extra.line ?? null, ...extra });

export default {
  id: 'w2',
  name: 'Form W-2',
  title: 'W-2 Wage and Tax Statement',
  jurisdiction: 'Federal',
  strategy: 'label',
  sections: Object.values(S),
  tables: [],
  detect: {
    signatures: [['Wage and Tax Statement'], ['Form W-2'], ['W-2', 'Wages, tips, other compensation']],
  },
  fields: [
    f('employeeSsn', 'Employee’s social security number', S.people, 'ssn', ["employee's social security number"], { line: 'a' }),
    f('employerEin', 'Employer identification number (EIN)', S.people, 'text', ['employer identification number'], { line: 'b' }),
    f('employerName', 'Employer’s name and address', S.people, 'text', ["employer's name, address, and zip code", "employer's name"], { line: 'c', multiline: true }),
    f('controlNumber', 'Control number', S.people, 'text', ['control number'], { line: 'd' }),
    f('employeeName', 'Employee’s name', S.people, 'text', ["employee's first name and initial", "employee's name"], { line: 'e' }),
    f('employeeAddress', 'Employee’s address', S.people, 'text', ["employee's address and zip code", "employee's address"], { line: 'f', multiline: true }),

    f('wages', 'Wages, tips, other compensation', S.wages, 'money', ['wages, tips, other compensation'], { line: '1' }),
    f('federalTaxWithheld', 'Federal income tax withheld', S.wages, 'money', ['federal income tax withheld'], { line: '2' }),
    f('socialSecurityWages', 'Social security wages', S.wages, 'money', ['social security wages'], { line: '3' }),
    f('socialSecurityTax', 'Social security tax withheld', S.wages, 'money', ['social security tax withheld'], { line: '4' }),
    f('medicareWages', 'Medicare wages and tips', S.wages, 'money', ['medicare wages and tips'], { line: '5' }),
    f('medicareTax', 'Medicare tax withheld', S.wages, 'money', ['medicare tax withheld'], { line: '6' }),

    f('socialSecurityTips', 'Social security tips', S.other, 'money', ['social security tips'], { line: '7' }),
    f('allocatedTips', 'Allocated tips', S.other, 'money', ['allocated tips'], { line: '8' }),
    f('dependentCareBenefits', 'Dependent care benefits', S.other, 'money', ['dependent care benefits'], { line: '10' }),
    f('nonqualifiedPlans', 'Nonqualified plans', S.other, 'money', ['nonqualified plans'], { line: '11' }),

    f('state', 'State', S.state, 'text', ['15 state', 'state employer'], { line: '15', boxWidth: 60 }),
    f('stateIdNumber', 'Employer’s state ID number', S.state, 'text', ["employer's state id number"], { line: '15' }),
    f('stateWages', 'State wages, tips, etc.', S.state, 'money', ['state wages, tips'], { line: '16' }),
    f('stateIncomeTax', 'State income tax', S.state, 'money', ['state income tax'], { line: '17' }),
    f('localWages', 'Local wages, tips, etc.', S.state, 'money', ['local wages, tips'], { line: '18' }),
    f('localIncomeTax', 'Local income tax', S.state, 'money', ['local income tax'], { line: '19' }),
    f('localityName', 'Locality name', S.state, 'text', ['locality name'], { line: '20' }),
  ],
};
