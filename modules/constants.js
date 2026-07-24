// Application-wide constants — no imports, no side effects

export const APP_VERSION = '2.4.0';

// Contact / email
export const CONTACT_ENDPOINT = 'https://formspree.io/f/maqgplzl';
export const EMAILJS_SERVICE  = 'service_1igjss7';
export const EMAILJS_TEMPLATE = 'template_8l5wbp9';
export const EMAILJS_KEY      = 'ThkI5gEmh7p74abFA';

// UK Tax 2026/27
export const PA=12570,BU=50270,HU=125140,TS=100000;
export const BR=0.20,HR=0.40,AR=0.45;
export const NL=12570,NU=50270,NM=0.08,NH=0.02;
export const MR=0.55; // mileage rate £/mile

// Student loan repayment thresholds and rates 2026/27
export const SL_PLANS = {
  plan1: { threshold: 24990, rate: 0.09, label: 'Plan 1' },
  plan2: { threshold: 28470, rate: 0.09, label: 'Plan 2' },
  plan4: { threshold: 32745, rate: 0.09, label: 'Plan 4' },
  plan5: { threshold: 25000, rate: 0.09, label: 'Plan 5' },
  pgl:   { threshold: 21000, rate: 0.06, label: 'Postgraduate Loan' },
};

// Bank holidays (MM-DD format → name)
export const BH_RAW = {
  '01-01':"New Year's Day",'01-03':"New Year's Day (sub)",
  '03-26':'Good Friday','03-29':'Good Friday','04-01':'Easter Monday',
  '04-03':'Good Friday','04-06':'Easter Monday','04-14':'Good Friday',
  '04-17':'Easter Monday','04-18':'Good Friday','04-21':'Easter Monday',
  '05-01':'Early May','05-03':'Early May','05-04':'Early May',
  '05-05':'Early May','05-06':'Early May',
  '05-25':'Spring','05-26':'Spring','05-27':'Spring','05-29':'Spring','05-31':'Spring',
  '08-25':'Summer','08-26':'Summer','08-28':'Summer','08-30':'Summer','08-31':'Summer',
  '12-25':'Christmas Day','12-26':'Boxing Day',
  '12-27':'Christmas Day (sub)','12-28':'Boxing Day (sub)',
};
// BH as YYYY-MM-DD → true (date-based lookup)
export const BH = {};

export const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const GREETINGS = [
  'Time to track your money!','Let\'s save some money!','Here comes the money!',
  'Bling bling!','We\'re here to help!','Are we rich yet?','Show me the money!',
  'Every penny counts!','Budget like a boss!','Money moves!','Stack that cash!',
];

export const SAVINGS_CATS = [
  'Emergency Fund','Holiday Savings','House Deposit','Car Savings','General Savings',
  'Stocks & Shares ISA','Cash ISA','Pension Top-Up','Christmas Fund',
];

export const ACCOUNT_GROUPS = [
  ['Housing',        ['Mortgage','Rent','Council Tax','Home Insurance','Ground Rent / Service Charge','Home Maintenance']],
  ['Utilities',      ['Gas','Electricity','Water','Broadband / Fibre','TV Licence','Home Phone']],
  ['Transport',      ['Car Loan / Finance','Car Insurance','Road Tax (VED)','MOT','Fuel','Parking','Congestion / Dart Charge','Public Transport','Cycling Costs']],
  ['Food',           ['Groceries','Eating Out','Takeaways','Coffee / Snacks','Meal Kits']],
  ['Subscriptions',  ['Netflix','Spotify','Amazon Prime','Disney+','Apple One / iCloud','Gym Membership','Newspaper / Magazine','Software / Apps','Gaming Subscription','Other Subscriptions']],
  ['Savings',        ['Emergency Fund','Holiday Savings','House Deposit','Car Savings','General Savings','Stocks & Shares ISA','Cash ISA','Pension Top-Up','Christmas Fund']],
  ['Family & Personal',['Childcare / Nursery','School Fees','Child Activities','Pocket Money','Clothing','Personal Care / Haircut','Gifts','Charity / Donations']],
  ['Health',         ['Private Health Insurance','Dental Care','Optician','Prescriptions','Gym Supplements','Therapy / Counselling']],
  ['Debt',           ['Credit Card','Personal Loan','Student Loan Overpayment','Buy Now Pay Later','Other Debt Repayment']],
  ['Motor',          ['Hire Purchase','Lease / PCP','Second Car Costs','Breakdown Cover']],
];

export const ALL_ACCOUNTS = [];
export const ACCT_TO_GROUP = {};
ACCOUNT_GROUPS.forEach(g => {
  g[1].forEach(a => {
    ALL_ACCOUNTS.push(a);
    ACCT_TO_GROUP[a] = g[0];
  });
});

export const GROUP_COLORS = {
  'Housing':'#1a73e8','Utilities':'#00897b','Transport':'#546e7a','Food':'#e37400',
  'Subscriptions':'#8430ce','Savings':'#0d904f','Family & Personal':'#d81b60',
  'Health':'#00acc1','Debt':'#c5221f','Motor':'#5d4037','Other':'#9e9e9e',
  'Direct Payment':'#ff6d00','Unassigned':'#b0bec5',
};

export function groupForPot(p) {
  if (p.account === 'Direct Payment') return 'Direct Payment';
  if (p.account && ACCT_TO_GROUP[p.account]) return ACCT_TO_GROUP[p.account];
  if (p.account) return 'Other';
  return 'Unassigned';
}

// Legacy (kept for Firestore migration path)
export const DEFAULT_SIZES = {
  countdown: 'full', overview: 'full', takehome: 'full', breakdown: 'half',
  stacked: 'full', free: 'half', savings: 'half', ytd: 'full', insights: 'half', achievements: 'half',
};
export const DEFAULT_WIDGETS = {
  countdown: true, overview: true, takehome: true, breakdown: true,
  stacked: true, free: true, savings: true, ytd: true, insights: true, achievements: true,
};
export const DEFAULT_ORDER = [
  'countdown','overview','takehome','breakdown','stacked','free','savings','ytd','insights','achievements',
];

export const WIDGET_LABELS = {
  countdown: 'Payday countdown', overview: 'Overview cards', takehome: 'Monthly take-home chart',
  breakdown: 'Spending breakdown', stacked: 'Spending over time', free: 'Free money trend',
  savings: 'Savings rate tracker', ytd: 'Year-to-date summary', insights: 'Insights', achievements: 'Achievements',
};

// 12-column grid layout
export const DEFAULT_LAYOUT = [
  { id: 'countdown',    visible: true, colSpan: 12, rowSpan: 1 },
  { id: 'overview',     visible: true, colSpan: 12, rowSpan: 1 },
  { id: 'takehome',     visible: true, colSpan: 6,  rowSpan: 2 },
  { id: 'breakdown',    visible: true, colSpan: 6,  rowSpan: 2 },
  { id: 'free',         visible: true, colSpan: 6,  rowSpan: 2 },
  { id: 'savings',      visible: true, colSpan: 6,  rowSpan: 2 },
  { id: 'stacked',      visible: true, colSpan: 12, rowSpan: 2 },
  { id: 'insights',     visible: true, colSpan: 4,  rowSpan: 3 },
  { id: 'achievements', visible: true, colSpan: 8,  rowSpan: 3 },
  { id: 'ytd',          visible: true, colSpan: 12, rowSpan: 2 },
];

export const WIDGET_MIN = {
  countdown:    { minCols: 6,  minRows: 1 },
  overview:     { minCols: 6,  minRows: 1 },
  takehome:     { minCols: 4,  minRows: 2 },
  breakdown:    { minCols: 3,  minRows: 2 },
  free:         { minCols: 3,  minRows: 2 },
  savings:      { minCols: 3,  minRows: 2 },
  stacked:      { minCols: 6,  minRows: 2 },
  insights:     { minCols: 4,  minRows: 2 },
  achievements: { minCols: 4,  minRows: 2 },
  ytd:          { minCols: 6,  minRows: 1 },
};

export const LAYOUT_PRESETS = {
  default: {
    label: 'Default',
    description: 'Balanced layout with all widgets visible',
    widgets: null,
  },
  focus: {
    label: 'Focus',
    description: 'Only the essentials: minimal and clean',
    widgets: [
      { id: 'countdown',    visible: true,  colSpan: 12, rowSpan: 1 },
      { id: 'overview',     visible: true,  colSpan: 12, rowSpan: 1 },
      { id: 'free',         visible: true,  colSpan: 12, rowSpan: 2 },
      { id: 'takehome',     visible: false, colSpan: 12, rowSpan: 2 },
      { id: 'breakdown',    visible: false, colSpan: 6,  rowSpan: 2 },
      { id: 'savings',      visible: false, colSpan: 6,  rowSpan: 2 },
      { id: 'stacked',      visible: false, colSpan: 12, rowSpan: 2 },
      { id: 'insights',     visible: false, colSpan: 4,  rowSpan: 3 },
      { id: 'achievements', visible: false, colSpan: 8,  rowSpan: 3 },
      { id: 'ytd',          visible: false, colSpan: 12, rowSpan: 2 },
    ],
  },
  analytics: {
    label: 'Analytics',
    description: 'All charts maximised, data-focused view',
    widgets: [
      { id: 'countdown',    visible: true,  colSpan: 12, rowSpan: 1 },
      { id: 'ytd',          visible: true,  colSpan: 12, rowSpan: 2 },
      { id: 'takehome',     visible: true,  colSpan: 12, rowSpan: 3 },
      { id: 'stacked',      visible: true,  colSpan: 12, rowSpan: 3 },
      { id: 'breakdown',    visible: true,  colSpan: 6,  rowSpan: 3 },
      { id: 'free',         visible: true,  colSpan: 6,  rowSpan: 3 },
      { id: 'savings',      visible: true,  colSpan: 12, rowSpan: 3 },
      { id: 'overview',     visible: false, colSpan: 12, rowSpan: 1 },
      { id: 'insights',     visible: false, colSpan: 4,  rowSpan: 3 },
      { id: 'achievements', visible: false, colSpan: 8,  rowSpan: 3 },
    ],
  },
};
