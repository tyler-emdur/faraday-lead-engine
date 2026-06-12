# Faraday Construction — Full-Stack Lead Generation Engine

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED LEAD ENGINE                         │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  STORM   │───▶│AUTO-POST │───▶│ LANDING  │───▶│  ANNA    │  │
│  │ MONITOR  │    │ Facebook │    │  PAGES   │    │ AI CHAT  │  │
│  │ (cron)   │    │ GBP Post │    │  (SEO)   │    │ AGENT    │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                       │         │
│       ┌───────────────────────────────────────────────┘         │
│       ▼                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  LEAD    │───▶│  SCORE   │───▶│  NOTIFY  │───▶│ FOLLOW   │  │
│  │ CAPTURE  │    │  & RANK  │    │  TEAM    │    │   UP     │  │
│  │   (DB)   │    │          │    │ SMS+Email│    │ SEQUENCE │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  ┌──────────┐    ┌──────────┐                                   │
│  │  SEO     │    │ REVIEW   │                                   │
│  │ CONTENT  │    │ REQUEST  │                                   │
│  │  (cron)  │    │  (cron)  │                                   │
│  └──────────┘    └──────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

## What Runs Automatically (Zero Touch)

| Automation              | Trigger                  | Action                                                    |
|-------------------------|--------------------------|-----------------------------------------------------------|
| Storm Monitor           | Every 30 min (cron)      | Checks NWS for hail/storm alerts in CO Front Range        |
| Storm Auto-Post         | Storm detected           | Posts to Facebook page + Google Business Profile           |
| SEO Blog Generator      | Weekly (cron)            | AI-writes blog posts targeting "[city] + hail/roof" keywords |
| Lead Follow-Up          | New lead captured        | Sends 3-email + 2-text drip sequence over 7 days          |
| Team Notification       | New lead captured        | Instant SMS + email to your sales team with lead score     |
| Review Requester        | Job marked complete      | Auto-texts customer asking for Google review               |
| Anna AI Chat Agent      | 24/7 on your website     | Qualifies visitors into scored leads automatically         |

## Tech Stack

| Layer        | Tool               | Cost        | Why                                       |
|--------------|--------------------| ------------|-------------------------------------------|
| Framework    | Next.js 15         | Free        | Full-stack React, API routes, cron support |
| Database     | Supabase (Postgres)| Free tier   | Real database, auth, realtime             |
| AI Agent     | Claude API         | ~$5-20/mo   | Powers Anna conversations                  |
| SMS          | Twilio             | ~$0.01/text | Lead follow-up + team alerts               |
| Email        | Resend             | Free tier   | Lead delivery + follow-up sequences        |
| Social Posts | Meta Graph API     | Free        | Auto-post to Facebook business page        |
| GBP Posts    | Google Business API| Free        | Auto-post to Google Business Profile       |
| Weather      | NWS API            | Free        | Storm/hail monitoring                      |
| Hosting      | Vercel             | Free tier   | Deploys from Git, includes cron            |
| **TOTAL**    |                    | **$5-30/mo**| vs $50/lead × unlimited leads              |

## Setup With Claude Code

### Step 1: Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Step 2: Create the project
```bash
mkdir faraday-leads && cd faraday-leads
claude
```

### Step 3: Give Claude Code this prompt
Copy-paste this entire block into Claude Code:

```
Build me a full-stack Next.js 15 app for lead generation. Here's the complete spec:

PROJECT: Faraday Construction Lead Engine
STACK: Next.js 15 (App Router), Supabase (Postgres), Tailwind CSS, Claude API, Twilio, Resend

DATABASE TABLES (Supabase):
- leads: id, name, phone, email, zip, city, service (enum: roofing/hail_damage/windows/solar/multiple), homeowner (bool), roof_age (int), damage_visible (bool), damage_description (text), insurance_filed (text), urgency (enum: emergency/immediate/this_month/exploring), score (int), grade (char), conversation (text), status (enum: new/contacted/quoted/won/lost), created_at, updated_at
- storm_alerts: id, event, headline, severity, areas, description, detected_at, posted_to_facebook (bool), posted_to_gbp (bool)
- follow_ups: id, lead_id (fk), type (enum: email/sms), step (int 1-5), sent_at, content
- blog_posts: id, title, slug, content, target_keyword, city, published (bool), created_at
- jobs: id, lead_id (fk), status (enum: scheduled/in_progress/complete), completed_at, review_requested (bool)

PAGES:
1. "/" - Public landing page with embedded Anna chat widget. Hero section: "Colorado's Trusted Roofing & Solar Experts — Chat with us now for a free estimate". Service cards for Hail Damage, Roofing, Windows, Solar.
2. "/chat" - Standalone Anna AI chat page (for sharing links)
3. "/admin" - Dashboard with tabs: Leads, Storms, Content, Settings (protected by simple password env var)
4. "/blog/[slug]" - SEO blog post pages

API ROUTES:
1. POST /api/chat - Proxies to Claude API with Anna system prompt (see below)
2. POST /api/leads - Saves qualified lead to DB, triggers notification
3. GET /api/leads - Returns all leads for dashboard
4. PATCH /api/leads/[id] - Update lead status
5. POST /api/notify - Sends team SMS (Twilio) + email (Resend) for new lead
6. GET /api/storms - Fetches NWS alerts and returns them
7. POST /api/storms/post - Posts storm alert to Facebook + GBP
8. POST /api/blog/generate - AI generates SEO blog post
9. POST /api/follow-up - Sends next follow-up in sequence

CRON JOBS (Vercel cron via vercel.json):
1. /api/cron/storm-check - Every 30 min - checks NWS API for CO severe weather, saves new alerts, auto-posts to social if hail detected
2. /api/cron/follow-up - Every hour - checks for leads needing next follow-up step, sends email/SMS
3. /api/cron/blog-generate - Every Monday 9am - generates 1 SEO blog post targeting "[city] hail damage roof repair" or similar keyword
4. /api/cron/review-request - Daily at 10am - checks for jobs completed 3+ days ago without review request, sends text

ANNA AI SYSTEM PROMPT:
[Include full prompt from the existing app - the one about being a friendly specialist for Faraday Construction]

ENVIRONMENT VARIABLES (.env.local):
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
TEAM_PHONE=
TEAM_EMAIL=
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
GOOGLE_BUSINESS_ACCOUNT=
ADMIN_PASSWORD=
CRON_SECRET=

Build the complete app with all files. Use Tailwind for styling with a dark theme (bg-gray-950 base, amber-500 accents). Make the Anna chat component reusable so it works on both the landing page and /chat route.
```

### Step 4: Set up accounts (one-time, ~30 minutes)

**Supabase (Database):**
1. Go to supabase.com → New Project (free)
2. Go to SQL Editor → Run the schema from `db/schema.sql` (included in this project)
3. Copy your project URL and anon key to `.env.local`

**Claude API:**
1. Go to console.anthropic.com → API Keys → Create key
2. Add to `.env.local` as ANTHROPIC_API_KEY
3. Add $20 credits to start (~$5-20/mo usage)

**Twilio (SMS):**
1. Go to twilio.com → Sign up (free trial gives $15 credit)
2. Get a phone number ($1/mo)
3. Copy Account SID, Auth Token, Phone Number to `.env.local`

**Resend (Email):**
1. Go to resend.com → Sign up (free tier: 3,000 emails/mo)
2. Add your domain or use their test domain
3. Copy API key to `.env.local`

**Facebook Auto-Posting:**
1. Go to developers.facebook.com → Create App → Business type
2. Add "Pages" permission
3. Generate Page Access Token (needs: pages_manage_posts, pages_read_engagement)
4. Copy token and your Page ID to `.env.local`

**Google Business Profile (optional but powerful):**
1. Go to console.cloud.google.com → Enable "My Business" API
2. Create OAuth credentials
3. This one is more complex — Claude Code can walk you through it

**Vercel (Hosting):**
1. Push your code to GitHub
2. Go to vercel.com → Import project → Connect GitHub repo
3. Add all env vars in Vercel dashboard → Settings → Environment Variables
4. Deploy — cron jobs start automatically

### Step 5: Verify everything works
```bash
# In Claude Code:
claude "Run the dev server, test the chat endpoint with a sample conversation,
verify the storm check cron works, and confirm the database is connected"
```

## File Structure
```
faraday-leads/
├── app/
│   ├── layout.tsx              # Root layout with dark theme
│   ├── page.tsx                # Public landing page + chat widget
│   ├── chat/page.tsx           # Standalone chat page
│   ├── blog/[slug]/page.tsx    # SEO blog posts
│   ├── admin/page.tsx          # Dashboard (leads, storms, content)
│   └── api/
│       ├── chat/route.ts       # Claude API proxy for Anna
│       ├── leads/route.ts      # CRUD leads
│       ├── leads/[id]/route.ts # Update lead status
│       ├── notify/route.ts     # Team SMS + email notifications
│       ├── storms/route.ts     # Fetch NWS alerts
│       ├── storms/post/route.ts # Post to Facebook + GBP
│       ├── blog/generate/route.ts # AI blog post generator
│       ├── follow-up/route.ts  # Send follow-up messages
│       └── cron/
│           ├── storm-check/route.ts    # Every 30 min
│           ├── follow-up/route.ts      # Every hour
│           ├── blog-generate/route.ts  # Weekly
│           └── review-request/route.ts # Daily
├── components/
│   ├── ChatWidget.tsx          # Reusable Anna chat component
│   ├── LeadsDashboard.tsx      # Admin leads table
│   ├── StormRadar.tsx          # Storm alerts panel
│   └── BlogEditor.tsx          # Content management
├── lib/
│   ├── supabase.ts             # DB client
│   ├── claude.ts               # Claude API wrapper
│   ├── twilio.ts               # SMS helper
│   ├── resend.ts               # Email helper
│   ├── facebook.ts             # Facebook Graph API posting
│   ├── scoring.ts              # Lead scoring algorithm
│   └── nws.ts                  # Weather API helper
├── db/
│   └── schema.sql              # Supabase database schema
├── vercel.json                 # Cron job schedules
├── .env.local                  # Environment variables (never commit)
├── package.json
└── README.md
```

## Follow-Up Sequence (Auto-Sent to Opted-In Leads)

| Step | Timing           | Channel | Content                                                    |
|------|------------------|---------|------------------------------------------------------------|
| 1    | Immediately      | Email   | "Thanks for chatting! Here's what to expect from your free inspection..." |
| 2    | 1 hour later     | SMS     | "Hey [name], it's Faraday Construction. We've got your info — a specialist will call you today." |
| 3    | Next day         | Email   | "Did you know most hail damage is covered by insurance? Here's how we help..." |
| 4    | Day 3            | SMS     | "Quick check-in — still need that roof inspection? We have openings this week." |
| 5    | Day 7            | Email   | "Last chance for your free inspection this month. Book here: [link]" |

## Storm Auto-Post Templates

**Facebook Post (auto-generated when hail detected):**
```
⚠️ Hail just hit [AREA]! If you're in [CITIES], your roof may have damage you can't see from the ground.

Faraday Construction is offering FREE roof inspections this week for affected homeowners.

Most hail damage is fully covered by your homeowner's insurance — we handle the claims process for you.

💬 Chat with us now for a free assessment: [LINK]
📞 Or call: [PHONE]

#[City]Hail #RoofRepair #FaradayConstruction #Colorado
```

**Google Business Profile Post:**
```
🏠 Free Hail Damage Inspections — [AREA]

Recent storms brought significant hail to the Front Range. Our certified inspectors are available this week for free roof assessments.

We work directly with your insurance company. Chat with us online or call for same-day scheduling.
```

## SEO Blog Post Keywords (Auto-Targeted Weekly)

The blog generator cycles through high-value local keywords:
- "hail damage roof repair [city] CO"
- "roof replacement cost [city] Colorado"
- "solar panel installation [city] CO"
- "replacement windows [city] Colorado"
- "storm damage roof insurance claim Colorado"
- "how to tell if your roof has hail damage"
- "best roofing company [city] CO"
- "free roof inspection [city]"

Cities rotated: Denver, Boulder, Fort Collins, Colorado Springs, Longmont,
Loveland, Broomfield, Thornton, Arvada, Westminster, Aurora, Castle Rock,
Parker, Golden, Brighton, Greeley

## What to Tell Claude Code Next

After the initial build, use these prompts to enhance:

```
"Add Google Ads conversion tracking pixel to the chat widget
so I can track which keywords generate leads if I ever run ads"

"Add a /api/cron/nextdoor-monitor endpoint that checks for
Nextdoor posts mentioning hail damage or roofing in Colorado
and alerts me so I can respond manually"

"Add lead source tracking — when someone arrives from Facebook
vs Google vs direct, tag the lead so I know which channel works best"

"Add a weekly email report that summarizes: leads captured,
lead scores, storms detected, follow-ups sent, and estimated
pipeline value"

"Add a /admin/jobs page where I can mark leads as
scheduled/in-progress/complete, and when I mark complete
it triggers the review request automation"
```
