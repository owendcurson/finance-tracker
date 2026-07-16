/**
 * modules/tax.js
 * UK PAYE income tax and National Insurance calculations for 2026/27.
 *
 * Exports: gPA, cTax, cNI
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
