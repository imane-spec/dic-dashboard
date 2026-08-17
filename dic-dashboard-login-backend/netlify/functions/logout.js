/* POST /api/logout (rewritten by netlify.toml to /.netlify/functions/logout)
   Clears the session cookie. */

const { serializeLogoutCookie } = require('../../lib/auth');
const { jsonResponse } = require('../../lib/httpResponse');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }
  return jsonResponse(200, { ok: true }, { 'Set-Cookie': serializeLogoutCookie() });
};
