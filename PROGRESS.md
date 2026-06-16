# Faraday Lead Engine — Progress Tracker

> Last updated: June 13, 2026
> You get paid $100 per warm lead delivered to Faraday Construction.

---

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Anna AI chat | ✅ Working | Groq llama-3.3-70b-versatile, end-to-end tested |
| Lead saved to Supabase | ✅ Working | Visible in /admin |
| ntfy push notification | ✅ Working | Topic: `leads`, pushes to Tyler's computer |
| Email notification (Resend) | ✅ Working | Sends to tgemdur01@gmail.com |
| Lead score hidden from customers | ✅ Fixed | Intel panel removed from public chat |
| Chat scroll | ✅ Fixed | No longer jumps the whole page |
| Exit popup suppression | ✅ Fixed | Doesn't fire after Anna captures a lead |
| QuickCaptureForm (hero) | ✅ Built | Name, phone, city, service |
| InsuranceEstimator | ✅ Built | On main page |
| ExitIntentPopup | ✅ Built | Fires on mouse-out or 60s idle (suppressed post-capture) |
| FloatingChat | ✅ Built | Desktop, pulses after 12s |
| Hail Map Magnet (/hail-map) | ✅ Built | B2C intent capture tool |
| Outbound B2B Prospecting | ✅ Built | /api/cron/outbound-prospect |
| Inbound Email Router | ✅ Built | /api/inbound/email |
| SMS notifications (Twilio) | ⏭ On hold | Shifted to Resend B2B strategy to avoid TCPA risks |
| 5-step follow-up drip | ✅ Built | Email sequence via Supabase trigger |
| Storm monitor cron | ✅ Built | GitHub Actions every 30 min |
| Follow-up sender cron | ✅ Built | GitHub Actions every hour — **needs secrets** |
| Blog generator cron | ✅ Built | GitHub Actions Monday 9am |
| Storm tracker page (/storm) | ✅ Built | Tyler's internal tool |
| Admin dashboard (/admin) | ✅ Built | Password: `faraday2024` |
| Blog (/blog) | ✅ Built | Auto-published SEO posts |
| /intel dashboard | ✅ Built | Needs intel schema applied to Supabase |
| Google Sheets billing record | ✅ Removed | Supabase is source of truth |

---

## Notification Pipeline (fully working)

When Anna captures a lead (name + phone):
1. Lead saved to Supabase → visible at `/admin`
2. ntfy push → instant notification on Tyler's computer
3. Resend email → `tgemdur01@gmail.com`

Email sends from `anna@faradayleads.com` (dedicated burner domain for outbound to protect main site reputation).

---

## Environment Variables

| Variable | Status | Notes |
|----------|--------|-------|
| `AI_API_KEY` | ✅ Set | **Rotate** — was exposed in chat |
| `AI_BASE_URL` | ✅ Set | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | ✅ Set | `llama-3.3-70b-versatile` |
| `RESEND_API_KEY` | ✅ Set | |
| `FROM_EMAIL` | ✅ Set | `anna@faradayleads.com` |
| `TYLER_EMAIL` | ✅ Set | `tgemdur01@gmail.com` |
| `NTFY_TOKEN` | ✅ Set | **Rotate** — was exposed in chat |
| `NTFY_TOPIC` | ✅ Set | `leads` |
| `CRON_SECRET` | ✅ Set | |
| `SUPABASE_URL` | ✅ Set | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | |
| `NEXT_PUBLIC_SITE_URL` | ✅ Set | `https://leads.faradaysun.com` |
| `NEXT_PUBLIC_COMPANY_PHONE` | ✅ Set | |
| `TWILIO_ACCOUNT_SID` | ✅ Set | Inactive — needed when customer SMS activates (masterplan #1 #3 #18) |
| `TWILIO_AUTH_TOKEN` | ✅ Set | **Rotate** — was exposed in chat |
| `TWILIO_PHONE_NUMBER` | ❌ Missing | Need a Twilio number for outbound; separate shortcode for "Text HAIL" |

---

## Remaining Tasks

### 🔴 Security — Do Soon
- [ ] Rotate Groq API key (console.groq.com) — was shared in chat
- [ ] Rotate ntfy access token (ntfy.sh account settings) — was shared in chat
- [ ] Rotate Twilio Auth Token (twilio.com/console) — was shared in chat

### 🟡 Activate Free Lead Sources
- [ ] Set GitHub Actions secrets so storm monitors run
  - `SITE_URL` = `https://leads.faradaysun.com`
  - `CRON_SECRET` = same value as Vercel env var
- [ ] Confirm intel & outbound schemas applied to Supabase
- [ ] Join every community group listed on `/storm` page (Facebook + Nextdoor) — must do before a storm hits

### 🟢 Nice to Have
- [ ] Real before/after photos on landing page (30–50% conversion lift)
- [ ] Delete `app/api/debug/route.ts` (debugging remnant)

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

---

## Bugs Fixed

- Trailing newline in Vercel env vars — root cause of Anna's "quick hiccup" error
- Wrong AI provider (Cerebras) → switched to Groq
- Wrong Groq model name (`llama-3.3-70b` → `llama-3.3-70b-versatile`)
- Sub-hourly crons blocked on Vercel Hobby → moved to GitHub Actions
- FROM_EMAIL using unverified domain → switched to `onboarding@resend.dev`
- TYLER_EMAIL pointing to wrong address → fixed to Resend account email
- NTFY_TOPIC mismatch (`faraday-leads` → `leads`)
- Lead score panel visible to customers → hidden behind `showIntelPanel` prop
- Chat scroll jumping whole page → fixed to scroll only within container
- Exit popup firing after Anna captured lead → suppressed when chat session is saved
- Storm SMS had `[your-domain]` placeholder → fixed
