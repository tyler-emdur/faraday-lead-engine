# Claude Code Quickstart for Faraday Lead Engine

## What You Have Right Now

This project contains all the backend logic, database schema, cron jobs,
and API routes. Claude Code needs to wire up the frontend pages and
deploy it. Here's exactly what to do.

## Step 0: Prerequisites (one-time, ~10 minutes)

Install these if you don't have them:
```bash
# Node.js (required)
# Download from: https://nodejs.org (LTS version)

# Claude Code
npm install -g @anthropic-ai/claude-code

# Vercel CLI (for deployment)
npm install -g vercel
```

## Step 1: Open Claude Code in the Project

```bash
cd faraday-lead-engine
claude
```

## Step 2: Give Claude Code This Initial Prompt

Copy this entire block and paste it into Claude Code:

---

```
I have a Next.js lead generation app for Faraday Construction (roofing, hail damage, windows, solar in Colorado). The backend is already built — look at the existing files in this project:

- /lib/ has all helpers (supabase, twilio, resend, nws, social, scoring, templates)
- /app/api/ has the API routes (chat, leads, all 4 cron jobs)
- /db/schema.sql has the full Supabase database schema
- /vercel.json has cron schedules
- /.env.example has all required env vars

I need you to:

1. Run `npm install` to install dependencies
2. Set up tailwind config and postcss config
3. Create the app/layout.tsx with dark theme globals (bg-gray-950, font import)
4. Create the ChatWidget component (reusable) that:
   - Calls POST /api/chat with conversation history
   - Shows chat bubbles (amber for Anna, dark for user)
   - Has real-time lead intelligence panel on the right
   - Shows lead score updating live as data is extracted
   - Has "Save Lead" button that POSTs to /api/leads when complete
5. Create app/page.tsx — public landing page with:
   - Hero: "Colorado's Trusted Roofing & Solar Experts"
   - 4 service cards (Hail Damage, Roofing, Windows, Solar)
   - Embedded ChatWidget
   - Trust signals (licensed, insured, BBB, Google reviews)
   - Footer with contact info
6. Create app/chat/page.tsx — standalone chat page (for sharing links)
7. Create app/admin/page.tsx — protected dashboard with tabs:
   - Leads: table of all leads from GET /api/leads, filterable by service/grade
   - Storms: shows NWS alerts from GET /api/storms (create this route if missing)
   - Content: lists blog posts, shows when next one generates
   - Activity: recent activity log
   - Simple password protection using ADMIN_PASSWORD env var

Use Tailwind CSS. Dark theme: bg-gray-950 main, bg-gray-900 cards, amber-500 accent, emerald for success, red for urgent. Make it look professional, not generic.
```

---

## Step 3: Set Up Your Accounts

While Claude Code builds, set up your accounts. Tell Claude Code:

```
Help me set up my .env.local file. Walk me through each service:
1. Supabase - create project and run db/schema.sql
2. Anthropic API key from console.anthropic.com
3. Twilio account + phone number
4. Resend account + domain verification
5. Facebook developer app + page access token
```

## Step 4: Test Locally

```
Run the dev server and let me test the chat widget. Also test the
storm-check cron by hitting /api/cron/storm-check directly with
the cron secret header.
```

## Step 5: Deploy

```
Deploy this to Vercel. Walk me through:
1. Initializing the Vercel project
2. Setting all environment variables
3. Confirming cron jobs are registered
4. Testing the production URL
```

## Step 6: Connect to WordPress

After deploying, tell Claude Code:

```
Give me the embed code to add the chat widget to my WordPress site.
I want:
1. A floating "Chat with us" button on every page
2. The full chat widget embedded on my Services page
3. Google Analytics event tracking for lead captures
```

## Step 7: Enhancements (Optional)

Once the base system is running, give Claude Code these follow-up prompts:

### Add UTM/Source Tracking
```
Add UTM parameter tracking to the chat widget so I can see which
traffic source (Facebook, Google, Nextdoor, direct) generates the
most leads. Store the source on the lead record.
```

### Add Weekly Report Email
```
Add a new cron job that runs every Friday at 5pm and emails me a
weekly summary: total leads captured, breakdown by grade, breakdown
by service, active storm alerts this week, follow-ups sent, and
blog posts published.
```

### Add Zapier Webhook Alternative
```
Add a webhook endpoint at POST /api/webhook/lead-captured that fires
to a configurable URL (WEBHOOK_URL env var) whenever a lead is saved.
This lets me connect to Zapier/Make.com for custom automations without
code changes.
```

### Add Lead Assignment
```
I have 3 sales reps. Add a round-robin assignment system that
automatically assigns new leads to reps and sends them a personal
SMS with the lead details. Store rep info in a new 'team_members'
table with name, phone, email, and active status.
```

## Architecture Summary

```
Every 30 min: Storm cron checks NWS → hail detected → auto-posts Facebook + GBP
Every hour:  Follow-up cron sends scheduled emails/texts to opted-in leads
Every Monday: Blog cron generates SEO post targeting "[city] roof repair" keywords
Every day:   Review cron texts completed-job customers asking for Google review

24/7:        Anna AI chat agent qualifies website visitors into scored leads
On capture:  Team gets instant SMS + email with lead score and details
On capture:  5-step follow-up sequence auto-scheduled (3 emails + 2 texts over 7 days)
```

## Cost Estimate

| Service | Monthly Cost | What It Does |
|---------|-------------|--------------|
| Claude API | $5-20 | Powers Anna + blog generation |
| Twilio | $5-15 | SMS follow-ups + team alerts |
| Resend | $0 (free tier) | Email follow-ups + notifications |
| Vercel | $0 (free tier) | Hosting + cron jobs |
| Supabase | $0 (free tier) | Database |
| Facebook API | $0 | Auto-posting |
| NWS API | $0 | Storm monitoring |
| **TOTAL** | **$10-35/mo** | **vs $50/lead from vendors** |
