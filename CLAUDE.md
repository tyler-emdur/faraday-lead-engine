# Faraday Lead Engine — Rules for Claude

## What this system does

Gets homeowners with roof damage to submit their **name and phone number**. That's it.

Tyler gets paid **$100 per warm lead** (name + phone captured). Nothing else earns money.

Faraday's sales team handles everything after the lead is captured. That is not this system's job.

---

## The three channels that matter

1. **Storm detection** → NWS alert fires → SMS blast to storm subscribers → homeowners visit site → submit form
2. **SEO blog posts** → rank on Google for hail/roof keywords → organic traffic → submit form
3. **B2B referral outreach** → cold email insurance agents, property managers, HOA managers → they refer homeowners → submit form

Every cron job, every feature, every line of code should serve one of these three channels.

---

## What is NOT this system's job

- Follow-up drip sequences after lead capture → **Faraday's sales team does this**
- Appointment booking → **Faraday's sales team does this**
- Review requests after jobs → **Faraday does this**
- Re-engaging old leads → **Faraday does this**
- Anything that happens after a phone number is captured

Do not add features in these areas. Do not suggest them.

---

## Active crons (15 total — all once-daily for Vercel Hobby)

### Find opportunities
- `storm-check` — NWS hail detection, triggers subscriber blast + blog + Meta ads
- `reddit-monitor` — CO subreddits for homeowners mentioning damage
- `permit-monitor` — Denver permits (neighbors of recent roofing jobs)
- `fema-monitor` — FEMA disaster declarations
- `listing-monitor` — Redfin pending homes (listing agents need roof certs)
- `hoa-violations` — HOA management companies + Reddit roof violation posts
- `hail-damage-unclaimed` — historical storm areas with no permit activity
- `bid-monitor` — Colorado government roofing RFPs (emails Tyler bid proposals)
- `competitor-reviews` — 1-star reviews on competitor roofers → personalized outreach

### Drive traffic + outreach
- `blog-generate` — Weekly SEO blog post on hail/roofing keyword
- `prospect-scraper` — Loads Colorado B2B referral partners into outbound table
- `outbound-prospect` — Sends cold emails to B2B referral partners (Mon–Fri 9am)
- `contact-form-targets` — Auto-submits contact forms for prospects without email

### Cleanup
- `meta-ad-cleanup` — Pauses Facebook storm ads after 7 days
- `weekly-report` — Monday summary email to Tyler (leads, cron health)

### High-frequency (GitHub Actions — need CRON_SECRET in repo secrets)
- `storm-check` every 30min
- `reddit-monitor` every 15min
- `outbound-prospect` 9am + 2pm weekdays
- `fema-monitor` 8am + 6pm

---

## Critical missing setup

- `TWILIO_PHONE_NUMBER` not set in Vercel → **all SMS broken**
- Twilio webhook not configured → `https://leads.faradaysun.com/api/inbound/sms`
- `GOOGLE_PLACES_API_KEY` not set → competitor-reviews cron does nothing
- GitHub Actions `CRON_SECRET` secret → needs adding to repo for high-frequency crons

---

## Before starting any new session

1. Hit `/api/anna/status` to see real lead counts and cron health
2. Check `cron_logs` table — verify crons are actually running
3. Don't assume anything is working until you see data

---

## Tech stack

- Next.js 15 App Router, TypeScript, Tailwind CSS
- Supabase (database + auth)
- Groq / llama-3.3-70b-versatile (AI — set via AI_BASE_URL, AI_API_KEY, AI_MODEL)
- Resend (email)
- Twilio (SMS — inbound + outbound)
- Vercel (hosting + daily crons)
- GitHub Actions (high-frequency crons, free)

**Live:** https://leads.faradaysun.com  
**War room:** https://leads.faradaysun.com/anna  
**Admin:** https://leads.faradaysun.com/admin  
**GitHub:** tyler-emdur/faraday-lead-engine
