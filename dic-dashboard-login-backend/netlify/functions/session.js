/* GET /api/session (rewritten by netlify.toml to /.netlify/functions/session)
   The dashboard calls this once on page load to decide whether to show the
   login screen or the dashboard itself. Always 200 — "authenticated: false"
   is a normal, expected response, not an error. */

const { getSessionFromRequest } = require('../../lib/auth');
const { jsonResponse } = require('../../lib/httpResponse');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }
  const cookieHeader = event.headers && (event.headers.cookie || event.headers.Cookie);
  const session = getSessionFromRequest({ headers: { cookie: cookieHeader } });
  if (!session) {
    return jsonResponse(200, { authenticated: false });
  }
  return jsonResponse(200, { authenticated: true, email: session.email });
};
