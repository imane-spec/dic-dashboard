/* POST /api/request-otp (rewritten by netlify.toml to /.netlify/functions/request-otp)
   Validates the email's domain against the allow-list, generates a 6-digit
   code, stores its hash (never the plaintext code), and emails it via
   lib/mail.js. Always responds quickly and generically on rate-limit /
   validation failure — see inline comments for exactly what each status
   code means, since the dashboard's login screen reads these directly. */

const {
  isAllowedEmail,
  normalizeEmail,
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  REQUEST_COOLDOWN_MS,
  REQUEST_MAX_PER_HOUR,
} = require('../../lib/auth');
const { getRecord, setRecord } = require('../../lib/store');
const { sendOtpEmail } = require('../../lib/mail');
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

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    return jsonResponse(400, { ok: false, error: 'Enter a valid email address.' });
  }

  if (!isAllowedEmail(email)) {
    return jsonResponse(403, {
      ok: false,
      error: 'Only @consultant.mcit.gov.qa, @mcit.gov.qa, and @ibtechar.com addresses can sign in.',
    });
  }

  const now = Date.now();
  const existing = await getRecord(email);
  const recentRequests = existing && Array.isArray(existing.requestTimestamps)
    ? existing.requestTimestamps.filter(function (t) { return now - t < 60 * 60 * 1000; })
    : [];

  if (recentRequests.length && now - recentRequests[recentRequests.length - 1] < REQUEST_COOLDOWN_MS) {
    return jsonResponse(429, { ok: false, error: 'Please wait a moment before requesting another code.' });
  }

  if (recentRequests.length >= REQUEST_MAX_PER_HOUR) {
    return jsonResponse(429, { ok: false, error: 'Too many codes requested. Please try again in an hour.' });
  }

  const code = generateOtp();
  await setRecord(email, {
    hash: hashOtp(email, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    requestTimestamps: recentRequests.concat([now]),
  });

  try {
    await sendOtpEmail(email, code);
  } catch (e) {
    return jsonResponse(502, { ok: false, error: 'Could not send the code email. Please try again shortly.' });
  }

  return jsonResponse(200, { ok: true, message: 'A sign-in code has been sent to ' + email + '.' });
};
