import { PA, BU, HU, TS, BR, HR, AR, NL, NU, NM, NH } from './constants.js';

// Adjusted personal allowance (tapered above £100k)
export function gPA(g) {
  if (g <= TS) return PA;
  return Math.max(0, PA - Math.floor((g - TS) / 2));
}

// Annual income tax
export function cTax(g) {
  const pa = gPA(g);
  let tx = Math.max(0, g - pa), t = 0;
  const b = Math.min(tx, Math.max(0, BU - pa));
  t += b * BR; tx -= b;
  const h = Math.min(tx, HU - BU);
  t += h * HR; tx -= h;
  return t + tx * AR;
}

// Annual National Insurance
export function cNI(g) {
  if (g <= NL) return 0;
  return Math.max(0, Math.min(g, NU) - NL) * NM + (g > NU ? (g - NU) * NH : 0);
}
