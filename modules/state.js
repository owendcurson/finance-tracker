// Shared mutable application state — imported by all modules
export const state = {
  currentUser: null,
  financeHistory: [],
  payDay: parseInt(localStorage.getItem('finance_payDay')) || 23,
  pots: [],
  editingId: null,
  lastTakeHome: 0,
  lastMileage: 0,
  paydayActualTH: 0,
  currentStep: 1,
  isNewUser: false,
  obPots: [],
  obSalary: 0,
  skeletonTimer: null,
  bottomNavActive: 'dashboard',
  inboxItems: [],
  insightsExpanded: false,
  insightsInboxedThisSession: new Set(),
  chartTH: null,
  chartSpend: null,
  chartFree: null,
  chartStacked: null,
  chartSavings: null,
  mpInit: false,
  emailPrefs: { email: '', enabled: false },
  fsSynced: false, // cache flag: true after first Firestore sync
  // History search/filter (Part 2)
  histSearch: '',
  histFilter: 'all',
  histSortNewest: localStorage.getItem('hist_sort') !== 'oldest',
  // Chart type preferences (Part 3)
  savingsGoal: parseFloat(localStorage.getItem('finance_savings_goal')) || 20,
  chartPrefs: {
    takehome:  localStorage.getItem('chart_pref_takehome')  || 'bar',
    breakdown: localStorage.getItem('chart_pref_breakdown') || 'doughnut',
    stacked:   localStorage.getItem('chart_pref_stacked')   || 'stacked',
    free:      localStorage.getItem('chart_pref_free')      || 'line',
    savings:   localStorage.getItem('chart_pref_savings')   || 'line',
  },
  // Dashboard grid layout (2.1.0)
  dashLayout: JSON.parse(localStorage.getItem('dashboard_layout') || 'null'),
  dashEditMode: false,
  // Collapsed sections (Part 7)
  collapsedSections: JSON.parse(localStorage.getItem('section_collapsed') || '{}'),
  // Savings goals (2.2.0) — keyed by slug derived from pot name
  savingsGoals: JSON.parse(localStorage.getItem('finance_goals') || '{}'),
  // Tax code (2.4.0)
  currentTaxCode: null,   // parseTaxCode() result for the current session
  tcHistory: [],          // [{ code: '1257L', monthYear: '04/2026' }, ...]
};
