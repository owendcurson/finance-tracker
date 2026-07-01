import { BH, BH_RAW, MF, MS, DN } from './constants.js';
import { state } from './state.js';
import { ds, os, fdl, fds } from './utils.js';

// Populate BH object from BH_RAW — called once at startup in app.js
export function initBH() {
  // BH_RAW keys are MM-DD. We populate across a ±2 year window.
  const now = new Date();
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
    Object.keys(BH_RAW).forEach(k => {
      const [mm, dd] = k.split('-');
      BH[`${y}-${mm}-${dd}`] = true;
    });
  }
}

export function isWD(d) {
  const day = d.getDay();
  return day >= 1 && day <= 5 && !BH[ds(d)];
}

export function getPD(y, m, pd) {
  pd = pd ?? state.payDay;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const actualDay = Math.min(pd, lastDay);
  const t = new Date(y, m, actualDay), o = new Date(t);
  while (!isWD(t)) t.setDate(t.getDate() - 1);
  return { payDate: t, original: o, moved: t.getTime() !== o.getTime() };
}

export function getNextPD(y, m, pd) {
  let nm = m + 1, ny = y;
  if (nm > 11) { nm = 0; ny++; }
  return getPD(ny, nm, pd);
}

export function movedReason(o, pd) {
  pd = pd ?? state.payDay;
  const actualDay = o.getDate(), s = actualDay + os(actualDay);
  const day = o.getDay(), k = ds(o);
  const mmdd = k.substring(5);
  if (day === 0) return `${s} falls on a Sunday`;
  if (day === 6) return `${s} falls on a Saturday`;
  if (BH[k]) return `${s} is ${(BH_RAW[mmdd] || 'a bank holiday')}`;
  return `${s} is a non-working day`;
}

export function taxYearStart(d) {
  const y = d.getFullYear();
  const start = new Date(y, 3, 6);
  if (d < start) return new Date(y - 1, 3, 6);
  return start;
}

export function inTaxYear(h, start) {
  const end = new Date(start.getFullYear() + 1, 3, 5);
  const hd = new Date(h.year, h.month, 15);
  return hd >= new Date(start.getFullYear(), start.getMonth(), 1) && hd <= end;
}

export function ytdMonths() {
  const start = taxYearStart(new Date());
  return state.financeHistory.filter(h => inTaxYear(h, start));
}
