/* =============================================================================
   lib/httpResponse.js — tiny helper shared by the Netlify function handlers
   in netlify/functions/. Netlify (like AWS Lambda, which it runs on) expects
   a function to return a plain { statusCode, headers, body } object rather
   than calling methods on a response object, so this just saves repeating
   that shape in every handler file.
   ========================================================================= */

function jsonResponse(statusCode, bodyObj, extraHeaders) {
  return {
    statusCode: statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}),
    body: JSON.stringify(bodyObj),
  };
}

module.exports = { jsonResponse: jsonResponse };
