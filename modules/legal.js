import { $ } from './utils.js';

const LAST_UPDATED_PRIVACY = '11 November 2026';
const LAST_UPDATED_TERMS   = '11 November 2026';

function renderPage(screenId, title, html) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const screen = $(screenId);
  if (!screen) return;
  screen.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'inline-flex';
  import('./ui.js').then(m => m.setBottomNav('settings'));

  screen.innerHTML = `
    <div style="max-width:680px;margin:0 auto;padding:20px 0 80px">
      <h1 style="font-size:1.3rem;font-weight:800;margin-bottom:4px">${title}</h1>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:24px">Last updated: ${screenId === 'privacy-policy-screen' ? LAST_UPDATED_PRIVACY : LAST_UPDATED_TERMS}</p>
      ${html}
    </div>
  `;
}

function section(title, body) {
  return `
    <div style="margin-bottom:24px">
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--primary)">${title}</h2>
      <div style="font-size:0.88rem;line-height:1.7;color:var(--text-primary,var(--text))">${body}</div>
    </div>`;
}

function p(text) { return `<p style="margin-bottom:8px">${text}</p>`; }
function ul(items) { return `<ul style="padding-left:20px;margin-bottom:8px">${items.map(i => `<li style="margin-bottom:4px">${i}</li>`).join('')}</ul>`; }

export function showPrivacyPolicy() {
  renderPage('privacy-policy-screen', 'Privacy Policy', `
    ${section('Who we are', `
      ${p('PayUnite is a free UK pay and finance tracking tool operated by Owen Curson, based in the United Kingdom. You can contact us at: <a href="mailto:help@payunite.co.uk" style="color:var(--primary)">help@payunite.co.uk</a>')}
      ${p('This policy explains what personal data we collect, how we use it, and your rights under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.')}
    `)}
    ${section('What data we collect', `
      ${p('When you use PayUnite we collect the following:')}
      ${ul([
        '<strong>Account data:</strong> your email address and display name, provided when you sign in via Google or email.',
        '<strong>Financial data you enter:</strong> your gross salary, pay day setting, monthly take-home pay, outgoings, pot names and amounts, mileage, pension and student loan preferences, and free money figures.',
        '<strong>App preferences:</strong> dark mode, dashboard layout, density settings, and notification preferences.',
        '<strong>Contact messages:</strong> name, email address, and message content if you use the contact form.',
        '<strong>Usage data:</strong> basic analytics such as page views and error logs, collected by Cloudflare (see below).',
      ])}
      ${p('We do not collect bank login details, card numbers, account numbers, sort codes, or any banking credentials. PayUnite does not connect to your bank.')}
    `)}
    ${section('How we use your data', `
      ${p('We use your data to:')}
      ${ul([
        'Provide, operate, and improve the PayUnite service.',
        'Display your financial history and calculate take-home pay, tax, and NI figures.',
        'Send payday notifications if you enable them (browser push notifications only — no email is sent without your explicit opt-in).',
        'Respond to messages you send via the contact form.',
        'Monitor for errors and ensure the service runs correctly.',
      ])}
      ${p('Our lawful basis for processing is <strong>contract performance</strong> (providing the service you signed up for) and <strong>legitimate interests</strong> (keeping the service secure and operational).')}
    `)}
    ${section('Where your data is stored', `
      ${p('All financial and account data is stored in <strong>Google Firebase Firestore</strong>, in the <strong>eur3 multi-region cluster (Europe)</strong>. Google LLC acts as a data processor on our behalf under a Data Processing Agreement. Database security rules enforce that each user can only access their own data — no other user, including the operator, can read your data through the app. The operator has technical console access to the database for administrative purposes only and does not view individual users' financial data.')}
      ${p('Contact form submissions are processed by <strong>Formspree Inc.</strong>, a third-party form service. Submissions are forwarded to our email address and stored temporarily by Formspree.')}
      ${p('Cloudflare processes network traffic and provides basic analytics. No personally identifiable information is shared with Cloudflare beyond what is inherent in routing web requests (IP address, user agent).')}
    `)}
    ${section('How long we keep your data', `
      ${p('We keep your account and financial data for as long as your account remains active. You can delete your account and all associated data at any time from Settings.')}
      ${p('Contact form messages are kept for up to 12 months.')}
      ${p('Cloudflare analytics data is retained according to Cloudflare\'s own retention policy (typically 90 days for free plans).')}
    `)}
    ${section('Cookies and local storage', `
      ${p('PayUnite does not use advertising or tracking cookies.')}
      ${p('We use <strong>browser localStorage</strong> to store your app preferences (theme, layout settings, dismissed notifications) locally on your device. This data never leaves your browser.')}
      ${p('Firebase uses session cookies to keep you signed in. These are essential for the service to function.')}
    `)}
    ${section('Your rights', `
      ${p('Under UK GDPR you have the right to:')}
      ${ul([
        '<strong>Access</strong> the personal data we hold about you.',
        '<strong>Rectification</strong> — correct inaccurate data.',
        '<strong>Erasure</strong> — delete your account and all associated data via Settings at any time.',
        '<strong>Data portability</strong> — export your financial history using the export buttons on each saved month.',
        '<strong>Object</strong> to processing based on legitimate interests.',
        '<strong>Lodge a complaint</strong> with the Information Commissioner\'s Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener" style="color:var(--primary)">ico.org.uk</a> if you believe we have mishandled your data.',
      ])}
      ${p('To exercise any of these rights, contact us at <a href="mailto:help@payunite.co.uk" style="color:var(--primary)">help@payunite.co.uk</a>.')}
    `)}
    ${section('Changes to this policy', `
      ${p('We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date above. Continued use of PayUnite after changes constitutes acceptance of the revised policy.')}
    `)}
  `);
}

export function showTerms() {
  renderPage('terms-screen', 'Terms of Use', `
    ${section('Acceptance', `
      ${p('By accessing or using PayUnite ("the Service") you agree to be bound by these Terms of Use. If you do not agree, please do not use the Service.')}
    `)}
    ${section('The Service', `
      ${p('PayUnite is a free personal finance tracking tool for UK employees. It allows you to record your monthly salary, calculate estimated take-home pay, track outgoings, and analyse your finances over time.')}
      ${p('The Service is provided free of charge and without warranty. We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice.')}
    `)}
    ${section('Not financial advice', `
      ${p('<strong>PayUnite is not a financial adviser.</strong> Nothing in the Service constitutes financial, tax, investment, or legal advice. All calculations (including tax and National Insurance estimates) are approximations based on publicly available UK HMRC rates and are provided for informational purposes only.')}
      ${p('You should not make financial decisions based solely on figures shown in PayUnite. Consult a qualified financial adviser for personalised advice. We are not authorised or regulated by the Financial Conduct Authority (FCA).')}
    `)}
    ${section('Accuracy of calculations', `
      ${p('Tax and NI calculations use the 2026/27 UK rates and standard thresholds. They do not account for all individual circumstances, including but not limited to: Scottish or Welsh income tax rates (approximated as UK rates), complex pension arrangements, multiple income sources, or specific HMRC tax code adjustments.')}
      ${p('Always verify figures against your actual payslip. We accept no liability for errors arising from reliance on the Service\'s calculations.')}
    `)}
    ${section('Your account and data', `
      ${p('You are responsible for maintaining the security of your account credentials. You must not share your account with others.')}
      ${p('You retain ownership of all financial data you enter. We do not sell your data to third parties. See our Privacy Policy for full details of how we handle your data.')}
    `)}
    ${section('Acceptable use', `
      ${p('You agree not to:')}
      ${ul([
        'Use the Service for any unlawful purpose.',
        'Attempt to gain unauthorised access to other users\' accounts or our systems.',
        'Reverse engineer, copy, or redistribute any part of the Service.',
        'Use the Service in a way that could damage, disable, or impair it.',
      ])}
    `)}
    ${section('Limitation of liability', `
      ${p('To the fullest extent permitted by law, PayUnite and its operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.')}
      ${p('Our total liability for any claim arising from these Terms shall not exceed £0, as the Service is provided free of charge.')}
    `)}
    ${section('Third-party services', `
      ${p('The Service uses Google Firebase for authentication and data storage, Cloudflare for hosting and network delivery, and Formspree for contact form processing. Use of these services is subject to their respective terms and privacy policies.')}
      ${p('The Service may display links to third-party financial products (clearly marked as partner offers). We may receive a commission if you sign up for a product via such a link. This does not affect the price you pay. We are not responsible for the products or services of third-party providers.')}
    `)}
    ${section('Governing law', `
      ${p('These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.')}
    `)}
    ${section('Changes to these Terms', `
      ${p('We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.')}
    `)}
    ${section('Contact', `
      ${p('For any questions about these Terms, contact us at <a href="mailto:help@payunite.co.uk" style="color:var(--primary)">help@payunite.co.uk</a>.')}
    `)}
  `);
}
