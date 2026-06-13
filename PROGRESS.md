# Faraday Lead Engine — Progress Tracker

> Last updated: June 12, 2026
> You get paid $100 per warm lead delivered to Faraday Construction.

---

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Anna AI chat | ✅ Built | Full 6-phase closer, books appointment slots |
| QuickCaptureForm (hero) | ✅ Built | Name, phone, city, service |
| InsuranceEstimator | ✅ Built | On main page — shows personalized $ amount |
| ExitIntentPopup | ✅ Built | Fires on mouse-out or 60s idle |
| FloatingChat | ✅ Built | Desktop only, pulses after 12s |
| StormBanner | ✅ Built | Shows if hail hit within 72 hrs |
| ActivityTicker | ✅ Built | Social proof on hero section |
| Lead scoring | ✅ Built | A/B/C/D grades, 0–100 score |
| Google Sheets logging | ✅ Built | Billing record — always appends |
| Supabase storage | ✅ Built | Optional, enables follow-up automation |
| Phone normalization | ✅ Built | All phones stored in (XXX) XXX-XXXX format |
| Duplicate detection | ✅ Built | Same phone in 30 days = update, not new record |
| Rate limiting | ✅ Built | 5 leads/10min, 30 chat msgs/hr per IP |
| UTM tracking | ✅ Built | Captures utm_source, fbclid, gclid on all 4 forms |
| SMS notifications (Twilio) | ✅ Built | Tyler gets instant SMS per lead |
| Email notifications (Resend) | ✅ Built | Tyler gets email + lead gets confirmation |
| 5-step follow-up drip | ✅ Built | Email + SMS sequence via Supabase trigger |
| Storm monitor cron | ✅ Built | Every 30 min — NWS hail detection |
| Reddit monitor cron | ✅ Built | Every 15 min — 7 CO subreddits |
| Follow-up sender cron | ✅ Built | Every hour — processes pending follow-ups |
| Blog generator cron | ✅ Built | Every Monday — SEO posts per city/keyword |
| Review request cron | ✅ Built | Daily — requests Google reviews from completed jobs |
| Weekly report cron | ✅ Built | Monday — email summary of leads + pipeline |
| Storm tracker page (/storm) | ✅ Built | Tyler's internal tool — NWS alerts + post templates |
| Admin dashboard (/admin) | ✅ Built | Password-protected lead dashboard |
| Blog (/blog) | ✅ Built | Auto-published SEO posts |
| **Lead Intelligence Engine** | | |
| /intel dashboard | ✅ Built | HIGH/MED/LOW priority opportunities, conversion tracking |
| Storm opportunity mapper | ✅ Built | Creates per-city opportunity records + affected_areas on every storm |
| Reddit opportunity logger | ✅ Built | Saves scored opportunities to DB instead of just sending SMS |
| Community post importer | ✅ Built | Paste Facebook/Nextdoor posts → auto-scored + AI analysis |
| AI opportunity analysis | ✅ Built | why_it_matters, close_probability, outreach_message, follow_up |
| Daily Intel Digest | ✅ Built | 7am email — top 20 opportunities, stats, revenue tracker |
| Conversion tracking | ✅ Built | new → contacted → replied → booked → won/lost per opportunity |
| Property scoring (ZIP-based) | ✅ Built | 50+ CO ZIP codes mapped to home age for neighborhood scoring |

---

## Deploy Checklist

### 🔴 Required Before Anything Works

- [ ] **Push code to GitHub**
  ```
  git add -A
  git commit -m "upgrade lead engine: Anna v2, UTM, dedup, estimator on homepage"
  git push
  ```

- [ ] **Deploy to Vercel**
  ```
  vercel --prod
  ```
  Or auto-deploys if GitHub is connected.

- [ ] **Upgrade Vercel to Pro ($20/mo)**
  Storm monitor runs every 30 min. Reddit monitor runs every 15 min. Follow-up cron runs hourly.
  On Hobby plan, all 3 silently fall back to once/day — making them mostly useless.
  One extra lead pays for the plan.

### 🟡 Environment Variables (set in Vercel dashboard)

- [ ] `AI_API_KEY` — Groq API key (free at console.groq.com)
- [ ] `AI_BASE_URL` — `https://api.groq.com/openai/v1`
- [ ] `AI_MODEL` — `llama-3.3-70b-versatile`
- [ ] `TWILIO_ACCOUNT_SID` — from twilio.com/console
- [ ] `TWILIO_AUTH_TOKEN` — from twilio.com/console
- [ ] `TWILIO_FROM_NUMBER` — your Twilio phone number
- [ ] `RESEND_API_KEY` — from resend.com
- [ ] `TYLER_PHONE` — your cell (gets instant SMS per lead)
- [ ] `TYLER_EMAIL` — your email (gets lead notifications)
- [ ] `CRON_SECRET` — any random string (e.g. `openssl rand -hex 32`)
- [ ] `SUPABASE_URL` — from Supabase project settings
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
- [ ] `GOOGLE_SPREADSHEET_ID` — from your Google Sheet URL
- [ ] `GOOGLE_SHEETS_CREDENTIALS` — full service account JSON as one line
- [ ] `NEXT_PUBLIC_SITE_URL` — your live domain (e.g. `https://faradaysun.com`)
- [ ] `NEXT_PUBLIC_COMPANY_PHONE` — `(720) 766-1518`

### 🟡 Database Setup

- [ ] **Apply Supabase schema** — paste `db/schema.sql` into Supabase SQL Editor
  - Creates: `leads`, `follow_ups`, `storm_alerts`, `blog_posts`, `jobs`, `activity_log`
  - Creates: auto-follow-up trigger (schedules 5-step drip on every new lead)

### 🟢 End-to-End Test

- [ ] Open live site → chat with Anna → give real phone number
- [ ] Confirm Tyler gets SMS notification within 60 seconds
- [ ] Confirm lead gets welcome SMS/email
- [ ] Confirm row appears in Google Sheet
- [ ] Confirm row appears in Supabase
- [ ] Check `/admin` dashboard shows the lead
- [ ] Confirm follow-up sequence was auto-scheduled in `follow_ups` table

---

## Pre-Storm Season Checklist (free money multiplier)

- [ ] **Join community groups** — open `/storm` page, click every group, join all of them
  - Boulder, Denver Metro, Fort Collins, Aurora, Broomfield, Westminster, Parker, Arvada
  - Also join local Nextdoor neighborhoods for each area
  - **Must join BEFORE a storm** or you can't post immediately
  - Takes ~30 minutes. Worth thousands when hail hits.

- [ ] **Set up Facebook Ads account**
  - Create a saved audience: Colorado homeowners, 30–65, $60K+ HHI
  - Have ad creative ready (storm post images)
  - Budget: $200–500 to launch within 2 hours of a storm

- [ ] **Create UTM-tagged ad URLs**
  - Example: `https://yoursite.com?utm_source=facebook&utm_campaign=hail_2026`
  - Now you know which ads produce which leads

- [ ] **Set up Google Business Profile** (free)
  - Shows up when people search "roofer near me" after a storm
  - Add photos, hours, service area (Front Range)

---

## Revenue Tracking

| Source | Leads | Paid ($100 each) |
|--------|-------|-----------------|
| Chat (Anna) | — | — |
| Hero form | — | — |
| Insurance Estimator | — | — |
| Exit Intent | — | — |
| Storm re-engagement | — | — |
| Reddit | — | — |
| **Total** | **0** | **$0** |

_Update this manually or pull from Google Sheets weekly._

---

## Bugs Fixed (June 12, 2026)

- Cron schedules corrected (were all running once/day)
- Reddit cutoff window aligned to 15-min run frequency
- Blog JSON parse crash fixed
- Lead score in ChatWidget now matches server-side scoring
- Estimator submit guard fixed
- QuickCaptureForm `homeowner: true` hardcode removed

## Features Added (June 12, 2026)

- Phone normalization + duplicate detection
- Rate limiting on `/api/leads` and `/api/chat`
- UTM tracking across all 4 lead capture forms
- InsuranceEstimator added to main page (was hidden)
- ActivityTicker social proof component
- Anna completely rewritten — 6-phase closer, books specific slots, handles every objection
- New Anna intro message (benefit-first)

---

## Backlog (future improvements)

- [ ] Real before/after roof photos on landing page (30–50% better conversion than text)
- [ ] Google Business Profile auto-posting on storm events
- [ ] Webhook from Supabase → notify Tyler when follow-up is sent
- [ ] A/B test hero headline
- [ ] Add ZIP code field to QuickCaptureForm for better geo targeting
- [ ] Admin page: mark leads as Won/Lost, update status
- [ ] Lead de-duplication across Google Sheets (currently only in Supabase)
