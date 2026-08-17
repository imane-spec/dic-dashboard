/* =============================================================================
   lib/mail.js — pluggable email sending for the one-time login code
   ---------------------------------------------------------------------------
   Only this file needs to change to wire up real email. Everything else in
   the backend calls sendOtpEmail(email, code) and doesn't care how the
   message actually gets delivered.

   The default implementation below just logs the code to the function's
   server-side console — it does NOT send a real email. That's deliberate:
   it lets you test the whole login flow (request code -> read it from your
   deployment's function logs -> verify) before you've picked a mail
   provider. Replace this file's body with one of the ready-to-uncomment
   blocks below once you have credentials for a provider.
   ========================================================================= */

const FROM_ADDRESS = process.env.MAIL_FROM || 'DIC Performance Dashboard <no-reply@ibtechar.com>';

function otpEmailText(code) {
  return 'Your DIC Performance Dashboard sign-in code is: ' + code + '\n\n' +
    'This code expires in 10 minutes. If you did not request this, you can ignore this email.';
}

function otpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;font-size:15px;color:#221B1E">' +
    '<p>Your DIC Performance Dashboard sign-in code is:</p>' +
    '<p style="font-size:32px;font-weight:700;letter-spacing:4px;color:#8A1538">' + code + '</p>' +
    '<p style="color:#66575C;font-size:13px">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>' +
    '</div>';
}

/* ---- Default: log-only placeholder (no real email sent) ---------------- */

async function sendOtpEmail(toEmail, code) {
  // eslint-disable-next-line no-console
  console.log('[DIC dashboard] Login code for ' + toEmail + ': ' + code +
    ' (MAIL PROVIDER NOT CONFIGURED — see lib/mail.js — this code was only logged, not emailed)');
}

/* ---- Resend (uncomment to use — simplest option, one fetch call) --------

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendOtpEmail(toEmail, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Your DIC Performance Dashboard sign-in code',
      text: otpEmailText(code),
      html: otpEmailHtml(code),
    }),
  });
  if (!res.ok) throw new Error('Resend send failed: ' + res.status + ' ' + (await res.text()));
}

--------------------------------------------------------------------------- */

/* ---- SendGrid (uncomment to use) -----------------------------------------

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

async function sendOtpEmail(toEmail, code) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + SENDGRID_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: FROM_ADDRESS },
      subject: 'Your DIC Performance Dashboard sign-in code',
      content: [
        { type: 'text/plain', value: otpEmailText(code) },
        { type: 'text/html', value: otpEmailHtml(code) },
      ],
    }),
  });
  if (!res.ok) throw new Error('SendGrid send failed: ' + res.status + ' ' + (await res.text()));
}

--------------------------------------------------------------------------- */

/* ---- Plain SMTP via nodemailer (uncomment to use — e.g. MCIT's own mail
   server, or a Gmail/Outlook app password) — requires: npm i nodemailer ----

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendOtpEmail(toEmail, code) {
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: 'Your DIC Performance Dashboard sign-in code',
    text: otpEmailText(code),
    html: otpEmailHtml(code),
  });
}

--------------------------------------------------------------------------- */

module.exports = { sendOtpEmail };
