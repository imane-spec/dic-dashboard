/* POST /api/verify-otp (rewritten by netlify.toml to /.netlify/functions/verify-otp)
   Checks the submitted code against the stored hash. On success, issues a
   signed session token in an httpOnly cookie and the dashboard unlocks. */

const {
  isAllowedEmail,
  normalizeEmail,
  hashOtp,
  safeEqual,
  signSession,
  serializeSessionCookie,
  OTP_MAX_ATTEMPTS,
} = require('../../lib/auth');
const { getRecord, setRecord, deleteRecord } = require('../../lib/store');
const { jsonResponse } = require('../../lib/httpResponse');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  let parsedBody = {};
  try {
    parsedBody = JSON.parse(event.body || '{}');
  } catch (e) {
    parsedBody = {};
  }
  const email = normalizeEmail(parsedBody.email);
  const code = String(parsedBody.code || '').trim();

  if (!isAllowedEmail(email)) {
    return jsonResponse(403, { ok: false, error: 'That email domain is not authorized.' });
  }
  if (!/^\d{6}$/.test(code)) {
    return jsonResponse(400, { ok: false, error: 'Enter the 6-digit code from your email.' });
  }

  const record = await getRecord(email);
  if (!record) {
    return jsonResponse(400, { ok: false, error: 'No active code for this email. Request a new one.' });
  }
  if (Date.now() > record.expiresAt) {
    await deleteRecord(email);
    return jsonResponse(400, { ok: false, error: 'That code has expired. Request a new one.' });
  }
  if ((record.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await deleteRecord(email);
    return jsonResponse(429, { ok: false, error: 'Too many incorrect attempts. Request a new code.' });
  }

  const matches = safeEqual(hashOtp(email, code), record.hash);
  if (!matches) {
    await setRecord(email, Object.assign({}, record, { attempts: (record.attempts || 0) + 1 }));
    return jsonResponse(401, { ok: false, error: 'Incorrect code. Please try again.' });
  }

  await deleteRecord(email);
  const token = signSession(email);
  return jsonResponse(200, { ok: true, email: email }, { 'Set-Cookie': serializeSessionCookie(token) });
};
