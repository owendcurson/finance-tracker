/**
 * modules/tax.js
 * UK PAYE income tax and National Insurance calculations for 2026/27.
 *
 * Exports: gPA, cTax, cNI, cStudentLoan, parseTaxCode, cTaxWithCode
 *
 * All inputs are annual gross income in pounds (GBP).
 * All outputs are annual amounts in pounds (GBP).
 * Constants are imported from constants.js — update those when HMRC
 * announces new rates for the following tax year.
 */

import { PA, BU, HU, TS, BR, HR, AR, NL, NU, NM, NH, SL_PLANS } from './constants.js';

/**
 * Calculates the adjusted personal allowance for a given gross income.
 * The personal allowance is tapered by £1 for every £2 of income above £100,000,
 * reaching zero at £125,140 (2026/27 threshold).
 *
 * @param {number} grossIncome - Annual gross income in pounds
 * @returns {number} Adjusted personal allowance in pounds (0–12,570)
 */
export function gPA(grossIncome) {
  if (grossIncome <= TS) return PA;
  return Math.max(0, PA - Math.floor((grossIncome - TS) / 2));
}

/**
 * Calculates annual UK income tax (PAYE) for 2026/27.
 *
 * Bands applied after personal allowance:
 *   Basic rate (20%)  — up to £50,270
 *   Higher rate (40%) — £50,271 to £125,140
 *   Additional rate (45%) — above £125,140
 *
 * @param {number} grossIncome - Annual gross income in pounds
 * @returns {number} Annual income tax liability in pounds
 */
export function cTax(grossIncome) {
  const pa = gPA(grossIncome);
  let taxable = Math.max(0, grossIncome - pa);
  let tax = 0;

  const basicBand = Math.min(taxable, Math.max(0, BU - pa));
  tax += basicBand * BR;
  taxable -= basicBand;

  const higherBand = Math.min(taxable, HU - BU);
  tax += higherBand * HR;
  taxable -= higherBand;

  tax += taxable * AR; // Additional rate on remainder
  return tax;
}

/**
 * Calculates annual student loan repayment for a given plan (2026/27 thresholds).
 * Student loan is deducted after tax and NI — it does not reduce taxable income.
 *
 * @param {number} grossIncome - Annual gross income in pounds
 * @param {string} plan - Plan key: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'pgl'
 * @returns {number} Annual repayment in pounds (0 if below threshold)
 */
export function cStudentLoan(grossIncome, plan) {
  const p = SL_PLANS[plan];
  if (!p) return 0;
  return Math.max(0, grossIncome - p.threshold) * p.rate;
}

/**
 * Calculates annual employee National Insurance contributions for 2026/27.
 *
 * Rates applied:
 *   8% (NM) on earnings between £12,570 (NL) and £50,270 (NU)
 *   2% (NH) on earnings above £50,270
 *
 * @param {number} grossIncome - Annual gross income in pounds
 * @returns {number} Annual NI contributions in pounds
 */
export function cNI(grossIncome) {
  if (grossIncome <= NL) return 0;
  return Math.max(0, Math.min(grossIncome, NU) - NL) * NM
       + (grossIncome > NU ? (grossIncome - NU) * NH : 0);
}

/**
 * Parses a UK HMRC tax code string and returns its meaning and calculation effects.
 *
 * Handles: numeric codes (1257L, 1100M, 1191N), special codes (BR, D0, D1, NT, 0T),
 * K prefix (negative allowance), S/C prefix (Scottish/Welsh rates),
 * emergency suffixes (W1, M1, X).
 *
 * @param {string} rawInput - Raw tax code string e.g. '1257L', 'BR', 'K100', 'S1257L/W1'
 * @returns {{ raw, pa, flatRate, noTax, isEmergency, emergencyType, isScottish, isWelsh, isK, explanation, warning }}
 */
export function parseTaxCode(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return _defaultTC();
  const raw = rawInput.trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return _defaultTC();

  let s = raw;
  let isScottish = false, isWelsh = false, isK = false;
  let isEmergency = false, emergencyType = '';
  let pa = PA, flatRate = null, noTax = false;
  let explanation = '', warning = '';

  // 1. Strip emergency suffix
  if (/\/W1$|(?<![A-Z])W1$/.test(s)) { isEmergency = true; emergencyType = 'W1'; s = s.replace(/\/?W1$/, ''); }
  else if (/\/M1$|(?<![A-Z])M1$/.test(s)) { isEmergency = true; emergencyType = 'M1'; s = s.replace(/\/?M1$/, ''); }
  else if (/\/X$/.test(s)) { isEmergency = true; emergencyType = 'X'; s = s.slice(0, -2); }

  // 2. S or C prefix (only when followed by digit, K, or known special code)
  const _validAfterPrefix = /^(\d|K|BR|D0|D1|NT|0T)/;
  if (s[0] === 'S' && s.length > 1 && _validAfterPrefix.test(s.slice(1))) { isScottish = true; s = s.slice(1); }
  else if (s[0] === 'C' && s.length > 1 && _validAfterPrefix.test(s.slice(1))) { isWelsh = true; s = s.slice(1); }

  // 3. K prefix (negative allowance — only before digits)
  if (s[0] === 'K' && /^\d/.test(s.slice(1))) { isK = true; s = s.slice(1); }

  // 4. Special flat-rate or no-allowance codes
  if      (s === 'BR') { pa = 0; flatRate = BR; explanation = 'All income taxed at the basic rate (20%) with no personal allowance. Common for a second job or second pension.'; }
  else if (s === 'D0') { pa = 0; flatRate = HR; explanation = 'All income taxed at the higher rate (40%) with no personal allowance. Usually applies to additional income sources.'; }
  else if (s === 'D1') { pa = 0; flatRate = AR; explanation = 'All income taxed at the additional rate (45%) with no personal allowance.'; }
  else if (s === 'NT') { pa = 0; noTax = true;  explanation = 'No tax is deducted from this income source.'; }
  else if (s === '0T') { pa = 0; explanation = 'No personal allowance — all income is taxable. Applied when HMRC lacks information or your allowance is used up elsewhere.'; }
  else {
    // 5. Numeric code: digits + optional letter suffix
    const m = s.match(/^(\d+)([A-Z]*)$/);
    if (m) {
      const num = parseInt(m[1]);
      const letter = m[2] || '';
      if (isK) {
        pa = -(num * 10);
        explanation = `K${num}: £${(num * 10).toLocaleString('en-GB')} is added to your taxable pay because you have income that is not being taxed elsewhere (e.g. company car, medical insurance, or tax owed from a prior year).`;
      } else {
        pa = num * 10;
        const letterNote = {
          L: 'You are entitled to the standard tax-free personal allowance.',
          M: 'Increased by 10% of your partner\'s allowance via Marriage Allowance.',
          N: 'Reduced by 10% transferred to your partner via Marriage Allowance.',
        }[letter] || '';
        explanation = `Tax-free personal allowance: £${pa.toLocaleString('en-GB')}. ${letterNote}`.trim();
      }
    } else {
      // Unrecognised
      explanation = `Tax code "${raw}" is not fully recognised. Standard personal allowance used as a fallback.`;
      warning = `"${raw}" is not a standard tax code format. Check your payslip or contact HMRC on 0300 200 3300.`;
    }
  }

  // 6. Prefix and emergency warnings
  if (isScottish) warning = ('Scottish income tax rates apply (S prefix). This calculator uses UK rates as an estimate. ' + warning).trim();
  else if (isWelsh) warning = ('Welsh income tax rates apply (C prefix). This calculator uses UK rates as an estimate. ' + warning).trim();

  if (isEmergency) {
    const eMsg = {
      W1: 'Week 1 (non-cumulative) emergency code — tax is calculated each week independently. You may overpay. Contact HMRC on 0300 200 3300 to get a corrected code.',
      M1: 'Month 1 (non-cumulative) emergency code — tax is calculated each month independently. You may overpay. Contact HMRC on 0300 200 3300 to get a corrected code.',
      X:  'Emergency tax code — contact HMRC on 0300 200 3300 to confirm your correct code.',
    };
    warning = (warning ? warning + ' ' : '') + eMsg[emergencyType];
  }

  return { raw, pa, flatRate, noTax, isEmergency, emergencyType, isScottish, isWelsh, isK, explanation, warning };
}

function _defaultTC() {
  return { raw: '', pa: PA, flatRate: null, noTax: false, isEmergency: false, emergencyType: '', isScottish: false, isWelsh: false, isK: false, explanation: '', warning: '' };
}

/**
 * Calculates annual UK income tax using a parsed tax code object.
 * Falls back to standard cTax() when no code is provided (raw === '').
 *
 * @param {number} grossIncome - Annual gross income in pounds
 * @param {object} parsedCode - Result of parseTaxCode()
 * @returns {number} Annual income tax in pounds
 */
export function cTaxWithCode(grossIncome, parsedCode) {
  if (!parsedCode || !parsedCode.raw) return cTax(grossIncome);
  if (parsedCode.noTax) return 0;
  if (parsedCode.flatRate !== null) return Math.max(0, grossIncome * parsedCode.flatRate);

  if (parsedCode.isK) {
    // K code: add the K amount to gross then apply standard tax brackets
    return cTax(grossIncome + Math.abs(parsedCode.pa));
  }

  // Custom personal allowance (may be 0 for 0T)
  const cp = Math.max(0, parsedCode.pa);
  let taxable = Math.max(0, grossIncome - cp);
  let tax = 0;
  const basicBand = Math.min(taxable, Math.max(0, BU - cp));
  tax += basicBand * BR;
  taxable -= basicBand;
  const higherBand = Math.min(taxable, HU - BU);
  tax += higherBand * HR;
  taxable -= higherBand;
  tax += taxable * AR;
  return Math.max(0, tax);
}
