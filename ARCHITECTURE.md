# Faraday Construction — Lead Engine Architecture

> Tyler gets paid $100 per qualified lead delivered to Faraday Construction.
> The entire system is designed for zero-touch automated lead generation.

---

## What's Running Now

| Component | Status | Notes |
|-----------|--------|-------|
| Anna AI chat agent | ✅ Live | Groq `llama-3.3-70b-versatile` |
| Lead capture + scoring | ✅ Live | Supabase, /api/leads |
| Tyler notifications | ✅ Live | ntfy push + Resend email |
| 5-step email drip | ✅ Live | Follow-up cron hourly |
| Storm monitor | ✅ Live | GitHub Actions every 15 min, NWS API |
| Storm re-engagement SMS | ✅ Live | Texts past leads when hail hits their city |
| Facebook auto-post | ✅ Live | Fires on hail detection |
| Reddit monitor | ✅ Live | GitHub Actions every 15 min |
| Blog generator | ✅ Live | Monday 9am, SEO posts |
| Admin dashboard | ✅ Live | /admin (password-protected) |
| Storm tracker | ✅ Live | /storm (Tyler's internal tool) |
| Intel dashboard | ✅ Live | /intel (opportunity feed) |

---

## Tech Stack

| Layer | Tool | Cost |
|-------|------|------|
| Framework | Next.js 15 (App Router) | Free |
| Database | Supabase (Postgres) | Free tier |
| AI Agent | Groq (`llama-3.3-70b-versatile`) | Free tier |
| Notifications | ntfy.sh push + Resend email | Free |
| Customer SMS | Twilio (ready, inactive) | $0.01/msg when activated |
| Social posts | Meta Graph API | Free |
| Weather | NWS API | Free |
| Cron jobs | GitHub Actions (sub-hourly) + Vercel cron | Free |
| Hosting | Vercel | Free tier |

**Total cost: ~$0–5/month until customer SMS activates.**

---

## Data Flow

```
Visitor → Anna chat (ChatWidget.tsx)
       → POST /api/chat  →  Groq AI
       → POST /api/leads →  Supabase leads table
                         →  ntfy push + email to Tyler
                         →  Resend confirmation email to lead
                         →  5-step email drip (follow-up cron)

NWS storm →  storm-check cron (GitHub Actions, 15 min)
          →  notifyTyler() — SMS + email with post templates
          →  postToFacebook() — auto-post if token set
          →  getLeadsForReengagement() — SMS past leads in area
          →  saveOpportunity() — intel dashboard card
```

---

## File Structure

```
app/
  page.tsx                    Landing page (hero, chat, estimator, exit popup)
  chat/page.tsx               Standalone Anna chat
  admin/page.tsx              Lead dashboard (password-protected)
  storm/page.tsx              Storm tracker + community group list
  intel/page.tsx              Opportunity feed (outbound targets)
  blog/page.tsx               SEO blog posts
  canvas/page.tsx             Whiteboard / planning tool
  locations/page.tsx          City-specific landing pages

  api/
    chat/route.ts             Anna ↔ Groq proxy
    leads/route.ts            Lead save + notify
    leads/[id]/route.ts       Update lead status
    storms/route.ts           NWS alert fetch
    blog/route.ts             Blog post management
    activity/route.ts         Activity log feed
    intel/
      opportunities/route.ts  Fetch intel opportunities
      import/route.ts         Bulk import outbound targets
      track/[id]/route.ts     Mark opportunity as actioned
    inbound/
      email/route.ts          Inbound email webhook (Resend)
    cron/
      storm-check/route.ts    NWS hail monitor → notify + re-engage
      follow-up/route.ts      Lead drip sequence (email)
      reddit-monitor/route.ts Reddit keyword scan
      blog-generate/route.ts  Weekly SEO post generator
      review-request/route.ts Post-job review ask (SMS)
      intel-digest/route.ts   Daily opportunity summary email
      permit-monitor/route.ts County permit record scraper
      outbound-prospect/route.ts Outbound email campaigns
      weekly-report/route.ts  Weekly pipeline summary

components/
  ChatWidget.tsx              Anna chat (used on homepage + /chat)
  FloatingChat.tsx            Desktop chat bubble (pulses after 12s)
  ExitIntentPopup.tsx         Mouse-out / idle exit capture
  QuickCaptureForm.tsx        Hero form (name, phone, city, service)
  InsuranceEstimator.tsx      "What's my claim worth?" tool
  StormBanner.tsx             Hail banner (shows if storm < 72 hrs)
  ActivityTicker.tsx          Social proof ticker on hero

lib/
  supabase.ts                 DB client
  notify.ts                   Tyler notification layer (ntfy + email + optional SMS)
  twilio.ts                   SMS helper (ready for customer-facing SMS)
  resend.ts                   Email helper
  nws.ts                      NWS weather API parser
  social.ts                   Facebook Graph API poster
  scoring.ts                  Lead scoring algorithm
  templates.ts                Email/SMS copy templates
  intel.ts                    Opportunity scoring + AI analysis
  saturation.ts               Market saturation checker
  utm.ts                      UTM parameter tracker
  phone.ts                    Phone number normalizer

db/
  schema.sql                  Core tables (leads, storms, follow_ups, blog_posts, jobs)
  schema-intel.sql            Intel tables (opportunities, storm_affected_areas, activity_log)
  schema-outbound.sql         Outbound tables (prospects, campaigns, messages)
```

---

## Environment Variables

```bash
# AI (Groq — OpenAI-compatible)
AI_API_KEY=
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile

# Database
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Email
RESEND_API_KEY=
FROM_EMAIL=onboarding@resend.dev   # switch to faradaysun.com once DNS verified

# Tyler's notifications
TYLER_EMAIL=
NTFY_TOKEN=
NTFY_TOPIC=leads

# Customer SMS (Twilio — activate when customer-facing SMS strategies go live)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=       # needed for outbound; inbound shortcode number is separate

# Social
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=

# Auth
NEXT_PUBLIC_ADMIN_PASSWORD=
CRON_SECRET=

# Company
NEXT_PUBLIC_COMPANY_PHONE=(720) 766-1518
NEXT_PUBLIC_SITE_URL=https://leads.faradaysun.com
```

---

## Cron Schedule

| Job | Schedule | How |
|-----|----------|-----|
| Storm monitor | Every 15 min | GitHub Actions |
| Outbound prospecting | Daily 9am | GitHub Actions |
| Lead follow-up | Every hour | GitHub Actions |
| Blog generator | Monday 9am | GitHub Actions |
| Intel digest | Daily 2pm | Vercel cron |
| Permit monitor | Daily 3pm | Vercel cron |
| Review requester | Daily 11am | Vercel cron |
| Weekly report | Monday 2pm | Vercel cron |

GitHub Actions crons require these repo secrets: `SITE_URL`, `CRON_SECRET`.

---

## What's Next

See the `lead_generation_ideas.md` artifact for the full roadmap. Top priorities by week:

**Week 1:**
- Hail Map Lead Magnet (`/hail-map`) + $5/day Facebook ads
- Auto-Submit B2B Contact Forms script
- Set GitHub Actions secrets so storm monitors go live

**Week 2:**
- Activate automated B2B outbound prospecting cron
- Scale B2B scraping for Property Managers
- Connect Twilio for text reminders on scheduled appointments

**Week 3:**
- Storm news site `frontrangestormreport.com` (Strategy #7)
- Geofencing auto-trigger via StackAdapt/Simpli.fi (Strategy #8)
- Insurance agent outreach email (Strategy #10)

**Month 2:**
- Anna widget embed for partner sites (Strategy #16)
- Past-customer reactivation blast (Strategy #18) — needs Twilio number + A2P registration
- County permit record targeting via Lob postcards (Strategy #20)
