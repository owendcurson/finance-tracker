# UK Personal Finance Tracker

A progressive web app (PWA) for UK PAYE employees to calculate exact take-home pay, manage monthly spending pots, track mileage expenses, and monitor financial progress over the tax year.

## Features

- **Accurate UK Tax Calculation** — Income tax (2026/27 bands), employee National Insurance, and personal allowance tapering above £100,000
- **Monthly Pots** — Assign outgoings to named spending categories; see free money at a glance
- **Smart Payday** — Automatically adjusts your pay date when it falls on a weekend or UK bank holiday
- **Mileage Claims** — Log business miles at the HMRC rate (currently 55p/mile)
- **Dashboard** — Configurable widgets: payday countdown, overview cards, charts, year-to-date summary, spending insights, achievements
- **History** — Save every month; export individual months as Excel or PDF
- **Offline support** — Service worker caches the app for use without an internet connection
- **Dark mode** — Default dark theme with glassmorphism UI

## Tech stack

| Layer | Technology |
|---|---|
| Auth & database | Firebase Authentication + Firestore |
| Frontend | Vanilla JS ES modules, CSS Grid, custom PWA |
| Charts | Chart.js 4 (loaded lazily via IntersectionObserver) |
| Icons | Tabler Icons webfont |
| Typography | Inter (Google Fonts) |
| Hosting | GitHub Pages |
| Security rules | Firestore Rules v2 |

## Setup

### 1. Clone and configure Firebase

```bash
git clone https://github.com/owendcurson/finance-tracker.git
cd finance-tracker
```

Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com), enable **Authentication** (email/password + Google), and **Firestore** (start in test mode — you'll replace the rules below).

Replace the Firebase config object in `modules/firebase.js` with your own project's config.

### 2. Deploy Firestore security rules

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

The rules file is `firestore.rules`. It:
- Restricts all data to the authenticated owner of each user document
- Validates month documents must contain numeric `month`, `year`, and `takeHome` fields
- Denies all unauthenticated access

### 3. Deploy to GitHub Pages

Push `main` to GitHub — GitHub Pages serves the repo root automatically. No build step required.

```bash
git push origin main
```

Enable Pages in your repo's **Settings → Pages**, source: `main` branch, `/ (root)`.

## File structure

```
├── app.js                  Entry point — bootstraps all modules
├── index.html              Single-page app shell + auth overlay
├── styles.css              All CSS (single file, section-commented)
├── manifest.json           PWA manifest
├── service-worker.js       Cache-first SW with network update
├── firestore.rules         Firestore security rules (deploy separately)
├── firestore.indexes.json  Composite indexes (none currently required)
└── modules/
    ├── state.js            Shared mutable app state
    ├── constants.js        Tax rates, bank holidays, layout defaults
    ├── tax.js              UK income tax + NI calculations (2026/27)
    ├── payday.js           Pay-date engine, bank holiday expansion
    ├── tracker.js          Monthly tracker form, save/load, export
    ├── dashboard.js        Dashboard render, widgets, drag-and-drop
    ├── charts.js           Chart.js wrappers (lazy-loaded)
    ├── history.js          History list, search, filter
    ├── insights.js         Automated spending insight generation
    ├── achievements.js     Achievement badge system
    ├── auth.js             Firebase Auth, session management
    ├── firebase.js         Firebase SDK re-exports
    ├── settings.js         User settings + Firestore sync
    ├── privacy.js          Contact form + rate limiting
    ├── pots.js             Pot management UI
    ├── ui.js               Shared UI helpers (toast, skeleton, nav)
    ├── utils.js            Pure utility functions (fmt, esc, sanitise…)
    ├── theme.js            Dark mode lock + chart colour helpers
    ├── notifications.js    Payday push notification prompts
    ├── payday_modal.js     Payday celebration modal + confetti
    ├── onboarding.js       New-user onboarding flow
    ├── offline.js          Online/offline banner listeners
    ├── splash.js           Hero particle canvas + word animations
    ├── demo.js             Splash-page interactive demo
    └── inbox.js            In-app notification inbox
```

## Updating bank holidays

When the UK Government publishes new bank holiday dates, add entries to `BH_RAW` in `modules/constants.js` using the `MM-DD` format:

```js
'12-26': 'Boxing Day',
```

`initBH()` (called at startup) expands these across a ±2 year window into full `YYYY-MM-DD` keys.

## Updating tax rates

When HMRC announces changes for a new tax year, update the constants at the top of `modules/constants.js`:

```js
export const PA = 12570;  // Personal allowance
export const BU = 50270;  // Basic rate upper threshold
export const HU = 125140; // Higher rate upper threshold
export const TS = 100000; // PA tapering start
export const BR = 0.20;   // Basic rate
export const HR = 0.40;   // Higher rate
export const AR = 0.45;   // Additional rate
export const NL = 12570;  // NI lower threshold
export const NU = 50270;  // NI upper threshold
export const NM = 0.08;   // NI main rate
export const NH = 0.02;   // NI higher rate
export const MR = 0.55;   // Mileage rate (£/mile)
```

Also update the `<title>` and `<meta name="description">` in `index.html`.

## Known limitations

- **England bank holidays only** — Scotland/Wales/Northern Ireland dates differ. Update `BH_RAW` if needed.
- **Salary up to £10,000,000** — deliberately capped; values above this are likely input errors.
- **No bank connection** — this app never connects to your bank; all data is self-reported.
- **Pay-day range 1–28** — the setting is capped at 28 to avoid February edge cases.
- **mileage rate fixed at 55p** — does not handle the 25p rate for miles over 10,000/year in the same vehicle.

## Version history

| Version | Description |
|---|---|
| 2.1.2 | Security audit: Firestore rules, input validation, CSP, session timeout, keep-me-signed-in, rate limiting, global error handlers, JSDoc |
| 2.1.1 | Responsive YTD cards, fluid font scaling; em dash cleanup |
| 2.1.0 | Dashboard grid layout, drag-and-drop widget resize, layout presets, side nav |
| 2.0.0 | Sign-out modal, savings goal, glassmorphism redesign, cinematic splash |
| 1.0.0 | Initial release — PAYE calculator, monthly pots, history, Firebase sync |
