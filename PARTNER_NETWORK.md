# Partner Referral Network — Architecture & Operations

> **This is the product.** The website is infrastructure. Everything here exists to answer one
> question: *"Does this help another person generate leads for Tyler while he's doing nothing?"*

## Why this exists

Tyler is an **independent lead generator**, not Faraday. Faraday pays him **$100 per accepted
warm lead** (homeowner name + phone). He already does in-person/door-knock lead gen at his job —
this system is for **passive, compounding income while he's in school, asleep, or traveling.**

The model: people who are *already* in front of damaged homes (public adjusters, inspectors,
property managers, realtors, restoration/solar/gutter crews) refer homeowners through **their own
tracked referral link**. Tyler optionally shares revenue (`referral_fee`) so partners stay
motivated. One setup conversation → leads for years. Storm alerts make partners activate their own
client base automatically.

**Hard constraints:** $0 budget · no paid ads · no SEO requiring the company site · no door
knocking/canvassing as the *system's* job · no cold email (Resend AUP — it got the account
flagged; cold blasts were removed in Phase 2).

## Data model (`db/schema-partners.sql` — applied to live DB 2026-06-22)

**`partners`** — first-class partner records:
| column | purpose |
|--------|---------|
| `slug` (unique) | the `/api/track/<slug>` identifier; also the portal key |
| `type` | one of the partner types (drives storm messaging) |
| `contact_phone` / `contact_email` | how storm alerts reach them |
| `status` | lifecycle: `identified → contacted → interested → active → producing` (+ `inactive`) |
| `zip_codes[]` | service area → storm ZIP matching (Phase 2) |
| `referral_fee` | $ paid to partner per **accepted** lead (rev-share) |
| `last_alerted_at` | storm-alert dedupe (12h cooloff) |

**`leads`** gained: `partner_id` (attribution), `accepted` + `accepted_at` (**the $100 event**).

**`partner_clicks`** (pre-existing) — one row per referral-link click; `lead_id` is backfilled at
capture so click→lead conversion is measurable.

## How attribution works (the core loop — was broken before Phase 1)

1. Partner shares `…/api/track/<slug>` (or its QR). Click logged to `partner_clicks`, redirect to
   `/hail-map` with `utm_source=<slug>`.
2. Homeowner submits the lead form. `utm_source` rides along as `source_detail` (or pass
   `partner` explicitly in the POST body).
3. `POST /api/leads` calls `attributeLeadToPartner()` (`lib/partners.ts`): stamps
   `leads.partner_id` **and** backfills the latest uncredited `partner_clicks` row.
4. Tyler flips the lead to **accepted** in `/admin` once Faraday confirms → earnings compute as
   `accepted × ($100 − referral_fee)`.

> **"Accepted" is a manual toggle** (`PATCH /api/leads/[id]` with `{accepted:true}`). There is no
> Faraday API to automate it. This is intentional and the only $0 option.

## The four phases (all built)

### Phase 1 — Referral Infrastructure ✅
- `partners` table + lead attribution columns.
- `lib/partners.ts` — `normalizeSlug`, `getPartnerBySlug`, `attributeLeadToPartner`.
- `app/api/admin/partners/route.ts` — GET (partners + live stats), POST (create), PATCH (update).
- `app/admin/partners/page.tsx` — dashboard: create partner, **QR codes**, lifecycle dropdown,
  clicks/leads/accepted/net-earnings, copy link, portal link.
- Attribution fix in `app/api/leads/route.ts`; accept toggle in `app/api/leads/[id]/route.ts`.

### Phase 2 — Storm Partner Automation ✅
`app/api/cron/storm-check/route.ts` → `alertMatchedPartners()`: on a new hail alert, match
`alert.affected_zips` ↔ `partners.zip_codes` (status `interested`/`active`/`producing`), then
text (Twilio) + email (Resend) each partner **their referral link + forwardable homeowner copy**.
12h cooloff via `last_alerted_at`. (Replaced the old cold Resend B2B blast.)

### Phase 3 — Partner Discovery ✅
`app/api/admin/partners/discover/route.ts` (POST) — promotes existing `outbound_prospects`
(non-DNC) into `partners` as `status='identified'`, mapping `source → type`, deduped by slug.
$0, no scraping. Triggered by the "Discover candidates" button in the dashboard. Tyler then works
candidates through the lifecycle.

### Phase 4 — Network Effects ✅
- `app/api/partner/[slug]/stats/route.ts` — public, slug-keyed stats (masked lead history, no
  homeowner PII beyond first name + last initial).
- `app/partner/[slug]/page.tsx` — self-serve portal: earnings hero, funnel, tier
  (New→Bronze→Silver→Gold→Platinum), their link + QR, masked referral history. Retention surface
  partners can revisit without Tyler touching anything.

## How Tyler operates it (the only manual parts)

1. Meet a partner in the field (piggybacks on his existing job) → add them in `/admin/partners`
   with their ZIPs + a `referral_fee`. Set status to `interested`/`active`.
2. Hand them their link/QR (or the portal URL `/partner/<slug>`).
3. When Faraday accepts a lead, flip `accepted` in `/admin`.
4. Everything else — click tracking, attribution, storm alerts, earnings — runs on its own.

## Verify the loop (do after any change to capture/attribution)

1. Create a partner in `/admin/partners` (give it a ZIP + fee + your phone/email).
2. Visit `…/api/track/<slug>` → 1 click appears.
3. Submit a test lead (same browser, or `POST /api/leads {name,phone,partner:"<slug>"}`).
4. Dashboard shows 1 click / 1 lead. Flip accepted → net earnings = `$100 − fee`.
5. Open `/partner/<slug>` → portal reflects it.

## Known gaps / future

- Admin partner APIs have **no server-side auth** (only the client-side dashboard password) — same
  as the rest of `/api/admin/*`. Harden if it ever holds sensitive data.
- Portal access is slug-as-token (guessable). Fine for low-sensitivity counts; add a token if lead
  history ever needs protecting.
- Discovery currently only promotes `outbound_prospects`. A free public source (e.g. CO DORA PA
  roster CSV import) could feed it later.
