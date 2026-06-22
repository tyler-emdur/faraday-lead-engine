# Faraday Lead Engine — Rules for Claude

## What this system does

Tyler is an **independent lead generator** (not Faraday). Faraday pays him **$100 per accepted
warm lead** (homeowner name + phone). Faraday's sales team handles everything after capture.

**The product is the PARTNER REFERRAL NETWORK** — a passive, compounding asset that generates
leads while Tyler is in school/asleep/traveling. The website is infrastructure. See
**`PARTNER_NETWORK.md`** for the full architecture; read it before touching partner code.

> Tyler already door-knocks at his job. This system must NOT depend on his physical presence or
> daily manual effort. Score every idea by: *"How many leads does it generate while Tyler does
> nothing?"* (See memory: `feedback-passive-asset`.)

---

## The only objective

People who are already in front of damaged homes (PAs, inspectors, PMs, realtors,
restoration/solar/gutter crews) refer homeowners via **their own tracked referral link** →
homeowner submits name + phone at the lead page → lead is auto-attributed to that partner.

Every feature must answer: **does this help another person generate leads for Tyler while he's
doing nothing?**

## Hard constraints ($0 budget, results-only)

- ❌ No paid ads, no SEO requiring the company site, no purchased email lists
- ❌ No cold email (Resend AUP — it flagged the account; cold blasts removed in Phase 2)
- ❌ No door-knocking/canvassing as the *system's* job (Tyler does that at his job)
- ✅ Storm-triggered automation, referral automation, partner network — yes

---

## What is NOT this system's job

- Follow-up drip sequences after lead capture → Faraday's sales team
- Appointment booking → Faraday's sales team
- Review requests → Faraday's sales team
- Re-engaging old leads → Faraday's sales team
- Anything that happens after a phone number is captured

Do not build or suggest features in these areas.

---

## Active crons

| Cron | Schedule | Purpose |
|------|----------|---------|
| storm-check | 8am daily (+ every 30 min via GH Actions) | NWS hail → text Tyler post templates **+ alert partners assigned to affected ZIPs with their referral link + forwardable homeowner copy** (Phase 2) |
| craigslist-poster | Daily 8am MT | Emails Tyler ready-to-paste ad copy + city post links |

**outbound-prospect** (cold B2B email) and the storm cold-blast are **deprecated** — cold email
violates Resend AUP (flagged the account) and is replaced by the warm partner network. Do not
re-enable cold outreach. **homeowner-blast** requires a purchased list (violates $0) — leave off.

## Removed (deleted from codebase — no blog anymore)

The entire blog/SEO system is gone: `app/blog`, `app/api/blog`, the `blog-generate`
cron, `lib/blog-keywords.ts`, and the blog-coupled disabled crons `fema-monitor` and
`hoa-violations` (they existed mainly to auto-publish blog posts), plus `weekly-report`.
Do not reintroduce blog content — it generated zero lead-page traffic.

## Disabled crons (route files still present, not scheduled)

prospect-scraper, contact-form-targets, competitor-reviews, listing-monitor, permit-monitor, bid-monitor, hail-damage-unclaimed, meta-ad-cleanup, review-request, follow-up, intel-digest

---

## Current system state

**Leads:** 6 total (4 chat widget, 1 website, 1 test).

**Partner network:** All 4 phases built (2026-06-22) — see `PARTNER_NETWORK.md`. `partners` table
live in Supabase. Attribution loop fixed (`/api/leads` → `attributeLeadToPartner`). Dashboard at
`/admin/partners` (create, QR, lifecycle, earnings). Partner portal at `/partner/<slug>`.

**Storm monitoring:** Active every 30 min via GitHub Actions; now alerts ZIP-matched partners.

**Prospect pool:** ~hundreds in `outbound_prospects` (legacy cold-email data). Use the dashboard
"Discover candidates" button to promote non-burned ones into `partners` as `identified`.

---

## Immediate next actions (priority order)

1. **Verify the attribution loop** — create a test partner in `/admin/partners`, click its
   `/api/track/<slug>` link, submit a test lead, confirm it shows 1 click/1 lead and flips to
   earnings when accepted. (Steps in `PARTNER_NETWORK.md`.)

2. **Seed real partners** — Tyler adds partners he meets in the field (PAs, inspectors, PMs) with
   their service ZIPs + a `referral_fee`. Set status `interested`/`active` so storm alerts fire.

3. **Run "Discover candidates"** — promote the existing prospect pool into partner candidates to
   work through the lifecycle.

4. **(Free, optional) Angi + Thumbtack + Yelp + Google Business Profile** — free listings, passive.

---

## Key URLs

- Live site: https://leads.faradaysun.com
- Admin: https://leads.faradaysun.com/admin
- War room: https://leads.faradaysun.com/anna
- GitHub: tyler-emdur/faraday-lead-engine

## Tech stack

Next.js 15 App Router · TypeScript · Tailwind · Supabase · Groq (llama-3.3-70b) · Resend · Twilio · Vercel · GitHub Actions
