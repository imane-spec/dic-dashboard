/* =============================================================================
   lib/auth.js — shared login logic for the DIC Performance Dashboard
   ---------------------------------------------------------------------------
   Domain allow-list, one-time-code generation/hashing, session token
   sign/verify, and cookie helpers. Everything here is plain Node.js (no
   framework dependency) so it works the same whether it's called from a
   Vercel-style /api function, a Netlify function, or a plain Express route.
   ========================================================================= */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/* ---- Configuration ------------------------------------------------------ */

// Only these three domains may log in. Match is exact (case-insensitive) on
// the part after "@" — "user@mcit.gov.qa" matches, "user@sub.mcit.gov.qa"
// or "user@fakemcit.gov.qa" do not. Add or remove domains here only.
const ALLOWED_DOMAINS = [
  'consultant.mcit.gov.qa',
  'mcit.gov.qa',
  'ibtechar.com',
];

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;        // a code is valid for 10 minutes
const OTP_MAX_ATTEMPTS = 5;               // wrong-code guesses allowed per code
const REQUEST_COOLDOWN_MS = 60 * 1000;    // min gap between two codes to the same email
const REQUEST_MAX_PER_HOUR = 5;           // max codes sent to the same email per hour

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const SESSION_COOKIE_NAME = 'dic_session';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET is not set (or is too short). Set a long random string as ' +
      'the AUTH_SECRET environment variable before deploying — see .env.example.'
    );
  }
  return secret;
}

/* ---- Email / domain validation ------------------------------------------ */

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isAllowedEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return false;
  const domain = email.slice(at + 1);
  return ALLOWED_DOMAINS.indexOf(domain) >= 0;
}

/* ---- One-time codes ------------------------------------------------------
   The code itself is never stored — only a salted hash of it — so a leak of
   the store (in-memory dump, Redis snapshot, DB backup) doesn't hand out
   working codes. ------------------------------------------------------- */

function generateOtp() {
  // 6-digit numeric code, zero-padded, using a CSPRNG (not Math.random()).
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, '0');
}

function hashOtp(email, code) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(normalizeEmail(email) + ':' + code)
    .digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/* ---- Session tokens (JWT in an httpOnly cookie) -------------------------- */

function signSession(email) {
  return jwt.sign({ email: normalizeEmail(email) }, getSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

function verifySession(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    if (!isAllowedEmail(payload.email)) return null; // domain removed after issuance
    return payload;
  } catch (e) {
    return null;
  }
}

/* ---- Cookie helpers -------------------------------------------------------
   Framework-agnostic: build/parse the Cookie / Set-Cookie header text
   directly rather than depending on a request object shape, so the same
   helpers work under Vercel's (req, res), Netlify's (event, context), or a
   plain Node http.IncomingMessage/ServerResponse. ------------------------ */

function parseCookies(cookieHeader) {
  const out = {};
  String(cookieHeader || '').split(';').forEach(function (part) {
    const eq = part.indexOf('=');
    if (eq < 0) return;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function serializeSessionCookie(token) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    SESSION_COOKIE_NAME + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + SESSION_TTL_SECONDS,
  ];
  // Secure requires HTTPS, which is how Vercel/Netlify serve everything in
  // production; skip it for plain-http local dev so cookies still get set.
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function serializeLogoutCookie() {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    SESSION_COOKIE_NAME + '=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

module.exports = {
  ALLOWED_DOMAINS,
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  REQUEST_COOLDOWN_MS,
  REQUEST_MAX_PER_HOUR,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE_NAME,
  normalizeEmail,
  isAllowedEmail,
  generateOtp,
  hashOtp,
  safeEqual,
  signSession,
  verifySession,
  parseCookies,
  serializeSessionCookie,
  serializeLogoutCookie,
  getSessionFromRequest,
};
