/**
 * modules/payday.js
 * Pay-date calculation engine for UK PAYE workers.
 *
 * Exports: initBH, isWD, getPD, getNextPD, movedReason, taxYearStart, inTaxYear, ytdMonths
 *
 * The user sets a day-of-month pay date (e.g. 23rd). If that day falls on a
 * weekend or UK bank holiday the pay date is moved to the preceding working day.
 *
 * Bank holidays are stored in BH_RAW (constants.js) as MM-DD keys.
 * initBH() expands them into YYYY-MM-DD keys across a ±2 year window — call
 * it once at startup. When HMRC/GOV.UK announce new bank holidays, add the
 * MM-DD entries to BH_RAW in constants.js.
 */

import { BH, BH_RAW, MF, MS, DN } from './constants.js';
import { state } from './state.js';
import { ds, os, fdl, fds } from './utils.js';

/**
 * Populates the BH (bank holiday) lookup object for the current ±2 year window.
 * Keys are YYYY-MM-DD strings; values are true.
 * Must be called once at app startup (initBH() in payday.js, called from app.js).
 */
export function initBH() {
  const now = new Date();
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
    Object.keys(BH_RAW).forEach(k => {
      const [mm, dd] = k.split('-');
      BH[`${y}-${mm}-${dd}`] = true;
    });
  }
}

/**
 * Returns true if the given date is a working day (Monday–Friday, not a bank holiday).
 * @param {Date} date
 * @returns {boolean}
 */
export function isWD(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5 && !BH[ds(date)];
}

/**
 * Calculates the actual pay date for a given month, accounting for weekends
 * and bank holidays. If the nominal pay day is not a working day, the result
 * is moved back to the nearest preceding working day.
 *
 * @param {number} year  - Full year (e.g. 2026)
 * @param {number} month - Month index 0–11
 * @param {number} [pd]  - Pay day of month (defaults to state.payDay)
 * @returns {{ payDate: Date, original: Date, moved: boolean }}
 */
export function getPD(year, month, pd) {
  pd = pd ?? state.payDay;
  const lastDay   = new Date(year, month + 1, 0).getDate();
  const actualDay = Math.min(pd, lastDay);
  const t = new Date(year, month, actualDay);
  const o = new Date(t);
  while (!isWD(t)) t.setDate(t.getDate() - 1);
  return { payDate: t, original: o, moved: t.getTime() !== o.getTime() };
}

/**
 * Calculates the pay date for the month after the given month/year.
 * @param {number} year
 * @param {number} month - 0–11
 * @param {number} [pd]
 * @returns {{ payDate: Date, original: Date, moved: boolean }}
 */
export function getNextPD(year, month, pd) {
  let nextMonth = month + 1;
  let nextYear  = year;
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }
  return getPD(nextYear, nextMonth, pd);
}

/**
 * Returns a human-readable reason why a pay date was moved.
 * @param {Date} original - The nominal pay date before adjustment
 * @param {number} [pd]
 * @returns {string} e.g. "23rd falls on a Saturday"
 */
export function movedReason(original, pd) {
  pd = pd ?? state.payDay;
  const actualDay = original.getDate();
  const suffix = actualDay + os(actualDay);
  const day    = original.getDay();
  const key    = ds(original);
  const mmdd   = key.substring(5);
  if (day === 0) return `${suffix} falls on a Sunday`;
  if (day === 6) return `${suffix} falls on a Saturday`;
  if (BH[key])   return `${suffix} is ${BH_RAW[mmdd] || 'a bank holiday'}`;
  return `${suffix} is a non-working day`;
}

/**
 * Returns the start date of the UK tax year that contains the given date.
 * The UK tax year runs 6 April to 5 April the following year.
 * @param {Date} date
 * @returns {Date} The 6 April that opened the current tax year
 */
export function taxYearStart(date) {
  const year  = date.getFullYear();
  const start = new Date(year, 3, 6); // April 6
  if (date < start) return new Date(year - 1, 3, 6);
  return start;
}

/**
 * Returns true if the given month record falls within the tax year starting at `start`.
 * @param {{ year: number, month: number }} monthRecord
 * @param {Date} start - Tax year start date from taxYearStart()
 * @returns {boolean}
 */
export function inTaxYear(monthRecord, start) {
  const end    = new Date(start.getFullYear() + 1, 3, 5); // April 5 following year
  const recDate = new Date(monthRecord.year, monthRecord.month, 15);
  return recDate >= new Date(start.getFullYear(), start.getMonth(), 1) && recDate <= end;
}

/**
 * Returns the month records in state.financeHistory that fall within the
 * current UK tax year.
 * @returns {Array} Subset of state.financeHistory
 */
export function ytdMonths() {
  const start = taxYearStart(new Date());
  return state.financeHistory.filter(h => inTaxYear(h, start));
}
