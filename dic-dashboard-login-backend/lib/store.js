/* =============================================================================
   lib/store.js — pluggable storage for one-time codes + rate limiting
   ---------------------------------------------------------------------------
   WHY THIS FILE EXISTS AND NEEDS YOUR ATTENTION BEFORE GOING LIVE:

   Serverless functions (Vercel, Netlify) are stateless between invocations —
   each request can land on a different, freshly-started instance with its
   own empty memory. The in-memory Map below works fine for local dev
   (`vercel dev` / `netlify dev`, a single warm process) and for quick
   testing, but in a REAL production deployment with more than one function
   instance, a code emailed to a user might be "remembered" only by the
   instance that generated it — a different instance handling the verify
   request wouldn't have it, and login would fail intermittently.

   Before you deploy this for real, swap the two functions at the bottom of
   this file for a persistent store. The simplest drop-in options:

     • Upstash Redis (recommended) — a REST-based Redis with a generous free
       tier, built for exactly this (serverless, no persistent connections).
       A ready-to-uncomment implementation is included below — just add the
       UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment
       variables (from your Upstash dashboard) and uncomment that block.
     • Vercel KV (also Redis-backed, same idea, if you're already on Vercel
       and prefer their integration over a separate Upstash account).
     • Any small database you already run (Postgres/Supabase/etc.) — swap
       the function bodies to read/write a `login_codes` table instead.

   Nothing else in the codebase needs to change — every other file calls
   only the four functions exported here. ================================= */

/*const memory = new Map(); // email -> { hash, expiresAt, attempts, requestTimestamps }*/

/* ---- Default implementation: in-memory (dev / single-instance only) ---- */

async function getRecord(email) {
  return memory.get(email) || null;
}

async function setRecord(email, record) {
  memory.set(email, record);
}

async function deleteRecord(email) {
  memory.delete(email);
}

 ---- Upstash Redis implementation (uncomment to use in production) -----

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY_PREFIX = 'dic-otp:';
const RECORD_TTL_SECONDS = 60 * 60; // auto-expire an hour after last write

async function upstash(command) {
  const res = await fetch(UPSTASH_URL + '/' + command.map(encodeURIComponent).join('/'), {
    headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN },
  });
  const body = await res.json();
  return body.result;
}

async function getRecord(email) {
  const raw = await upstash(['get', KEY_PREFIX + email]);
  return raw ? JSON.parse(raw) : null;
}

async function setRecord(email, record) {
  await upstash(['set', KEY_PREFIX + email, JSON.stringify(record), 'EX', RECORD_TTL_SECONDS]);
}

async function deleteRecord(email) {
  await upstash(['del', KEY_PREFIX + email]);
}

/*------------------------------------------------------------------------- */

module.exports = { getRecord, setRecord, deleteRecord };
