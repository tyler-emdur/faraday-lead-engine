# B2B Prospecting — Handoff (audited 2026-06-16)

> Context for whoever picks this up next. This is one of three lead channels (storm SMS, SEO blog, B2B referral outreach) in the Faraday Lead Engine. Tyler earns $100 per warm lead (name + phone). See `CLAUDE.md` for the full system rules — they apply here too: **the system is feature-complete, do not build new functionality.** This channel was previously tagged lowest-priority of the three; it's being looked at now because Tyler explicitly asked for an audit.

## Don't trust CLAUDE.md's numbers for this channel — they're stale

CLAUDE.md says "20 prospects seeded" and "6 leads total." Querying the live Supabase DB directly on 2026-06-16 found:

- **40 outbound prospects** (20 hand-seeded + ~20 added by the `hoa-violations` cron)
- **1 lead total**, source `inbound_email_unmatched` (not a B2B conversion)
- **0 leads ever** from a matched B2B prospect reply
- **0 rows in `email_threads`** — the cold-email engine has never sent a single email
- **15 rows in `contact_form_queue`**: 2 `sent`, 13 stuck `pending_send`

Also: **the `/anna` war room and `/api/anna/status` currently show 0 for outbound prospects and 0 for contact-form-queue** — the dashboard is undercounting this channel (same root-cause class as the storm-alerts bug fixed earlier today: a DB migration — `cron_logs` table — was never applied to production, and at least one dashboard query silently fails as a result). **Don't fix the dashboard** — Tyler's standing rule is reporting/dashboard work is out of scope for the ROI-only mission. Just don't trust it; query Supabase directly instead.

## The actual bottleneck

Not prospect count. The 4-touch AI cold-email sequence (`outbound-prospect` cron) is fully built and has never fired, because **0 of 40 prospects have a usable email address** — the seed list and `hoa-violations` cron both produce website-only or guessed (`info@domain`) rows, and `outbound-prospect` only sends to non-null emails.

## Priority-ordered next actions

1. **Get real, named emails into prospect rows.** This is the single highest-leverage move — it's what turns on the dormant cold-email engine. Source manually (no new code) from: CO DORA license search (insurance agents, realtors), CAI Rocky Mountain (HOA management directory), IREM Colorado (property managers). Reuse the existing insert pattern in `scripts/seed-prospects.js` — just new rows with real `email` values, not website-only.
2. **Weight new prospects toward property managers / HOA / condo / apartment managers first, insurance agents second.** These are the only referral types Tyler's own notes call "what actually matters." Mortgage brokers and title companies (currently 20% of the seed) are tangential — don't keep matching that ratio.
3. **Clear the 13 stuck `pending_send` rows in `contact_form_queue`** — these are AI-drafted messages for JS/CAPTCHA-gated sites the auto-submitter couldn't post. Finishing them by hand (copy/paste into the business's contact form) is free, already-done work sitting idle.
4. **Before scaling volume, sanity-check deliverability once**: verify SPF/DKIM/DMARC for the sending domain behind `FROM_EMAIL` (`anna@faradayleads.com`) via Resend. A deliverability problem looks identical to a "bad copy" problem but isn't fixable by better copy.
5. **Target size: ~500 prospects**, not arbitrary — `outbound-prospect` sends up to 40/run, so 500 well-emailed prospects covers ~2–3 months of fully-utilized sending capacity at current cadence without touching code.

## Known structural gap (don't fix unless asked — just know it exists)

When a B2B reply with a phone number converts to a lead (`app/api/inbound/email/route.ts:139`), the new lead row is tagged `source: "outbound_email"` but **not which prospect segment** (insurance agent vs. property manager, etc.) produced it — that detail only lives in free-text `notes`. Until/unless that's populated, "which prospect type converts best" can't be answered from the `leads` table directly.

## Key files

- `app/api/cron/outbound-prospect/route.ts` — cold-email sender (4 touches, days 0/3/5/12), currently has nothing to send
- `app/api/cron/contact-form-targets/route.ts` + `lib/form-submit.ts` — auto-submit fallback for website-only prospects, ~13% success rate observed
- `app/api/cron/hoa-violations/route.ts` — only currently-working prospect source, produces website-only/guessed-email rows
- `app/api/cron/prospect-scraper/route.ts` — broken (Overpass API timeout from Vercel)
- `app/api/inbound/email/route.ts` — reply handler; phone in reply → lead capture, else AI follow-up
- `scripts/seed-prospects.js` — the reusable manual-insert pattern for adding curated prospects with real data
- `db/schema-outbound.sql` + `db/schema-hardening.sql` — `outbound_prospects` / `contact_form_queue` / `email_threads` schema (note: not all hardening migrations are confirmed applied to production — `cron_logs` table is confirmed missing live)

## How to check real state (don't rely on `/anna` for this channel)

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const env = {}; for (const l of readFileSync('.env.local','utf8').split('\n')) { const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i===-1)continue; env[t.slice(0,i)]=t.slice(i+1).replace(/^[\"']|[\"']$/g,''); }
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: p } = await db.from('outbound_prospects').select('source,status,email');
  console.log('prospects:', p.length, 'with email:', p.filter(x=>x.email).length);
  const { data: q } = await db.from('contact_form_queue').select('status');
  console.log('form queue by status:', q.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}));
  const { data: l } = await db.from('leads').select('source');
  console.log('leads by source:', l.reduce((a,r)=>(a[r.source]=(a[r.source]||0)+1,a),{}));
})();
"
```
