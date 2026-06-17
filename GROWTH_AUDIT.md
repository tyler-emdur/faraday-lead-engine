# Faraday Lead Engine — Strategic Growth Audit
**Date:** June 17, 2026  
**Goal:** 25 Anna-generated leads as fast as possible  
**Current leads:** 6 (4 chat widget, 1 site form, 1 test)

---

## The Honest Reality

The system works. The bottleneck is volume and human action.

Anna is sending cold emails to ~122 emailable prospects. That's not enough volume, and cold email alone to referral partners converts at 1-3%. At 122 prospects and 2% conversion, you get 2-3 referral partners. Each partner might generate 1-2 leads/month. That math doesn't get to 25 leads fast.

**The only path to 25 leads in 30 days is a combination of:**
1. 10-20x more prospects in the sequence
2. Tyler making personal phone calls to the highest-intent partners (PAs, inspectors)
3. Direct homeowner outreach via physical mail (neighbor blaster)
4. Possibly one new channel that bypasses the referral chain entirely

---

## 1. Complete Channel Audit

### PUBLIC ADJUSTERS
**Current state:** 61 more seeded today (run `node scripts/seed-more-pas.js`), 4-touch sequence with $100 cash offer  
**What's missing:** Phone calls. Email alone to PAs converts poorly. PAs are entrepreneurial and respond to direct asks.  
**Time to first lead:** 7-21 days (email) / 24-48 hours (phone call to active PA)  
**Lead quality:** Highest. PA's client has an open claim, needs a contractor NOW.  
**Volume estimate:** 2-5 leads/month per active PA partner. Get 3 PAs on board = 6-15 leads/month.  
**Cost:** $0 (calls) + $100/lead paid out  
**Verdict:** HIGHEST PRIORITY. Tyler should personally call 10 Denver PAs this week.  
**Action:** Tyler calls. "I pay $100 cash same week. Do you have any active hail claims with no contractor?"

---

### HOME INSPECTORS
**Current state:** 10 in DB, 4-touch sequence with $100 offer  
**What's missing:** Scale. Colorado has 1,200+ licensed home inspectors (DORA public database). We have 10.  
**Time to first lead:** 7-14 days once a inspector with an active buyer in pipeline converts  
**Lead quality:** High. Buyer just had inspection, roof flagged, inspector sends them to Faraday. Same-week decision.  
**Volume estimate:** One inspector doing 4 inspections/week flagging roof issues on 2 = 8 referrals/month. 10 active partners = 80 referrals/month potential, 10-15% become leads = 8-12 leads/month.  
**Cost:** $0 ($100 per lead paid out)  
**Verdict:** SECOND HIGHEST PRIORITY. This is the most underseeded high-value channel.  
**Action:** Build DORA scraper, seed 200+ home inspectors. Tyler calls top 5 personally.

---

### GUTTER COMPANIES
**Current state:** 8 in DB, $50/referral offer  
**What's missing:** Volume. Denver metro has 200+ gutter companies. We have 8.  
**Time to first lead:** 7-14 days. Gutter company is on a roof TODAY seeing damage.  
**Lead quality:** High. Gutter crew points at hail dents, homeowner calls Faraday same day.  
**Volume estimate:** One active gutter company doing 5 jobs/day × 2 referrals/day = 10 referrals/week. 5 partners = 50 referrals/week potential at 10% conversion = 5 leads/week. This is the highest-volume scalable channel after storms.  
**Cost:** $50/lead paid out  
**Verdict:** EXPAND AGGRESSIVELY. Seed 150+ more gutter companies.  
**Action:** Build seed-gutter-companies.js with 150+ Denver/Front Range gutter operators.

---

### RESTORATION CONTRACTORS (Water Mitigation)
**Current state:** 10 in DB, $100/referral offer now in emails  
**What's missing:** Scale. ServiceMaster, PuroClean, Rainbow International all have local franchises. There are 100+ mitigation companies in Colorado.  
**Time to first lead:** 7-14 days if a restoration crew on a roof-leak job today takes the deal  
**Lead quality:** Extremely high. They're inside the house when the homeowner needs a roofer.  
**Volume estimate:** 3-5 leads/month per active partner  
**Cost:** $100/lead  
**Verdict:** EXPAND. Seed 50+ more restoration companies.

---

### REALTORS / LISTING MONITOR
**Current state:** Listing monitor finds pending homes, emails agent if Redfin returns their email (rare), queues "FIND EMAIL" tasks when not  
**What's missing:** Redfin almost never returns agent emails. The queue fills with unacted tasks. We need to seed realtors directly — not discover them from pending listings.  
**Time to first lead:** 14-21 days  
**Lead quality:** Medium. Agent refers buyer who needs roof fixed before closing OR homeowner who needs cert. Urgency is real.  
**Volume estimate:** 500 realtors in sequence at 2% conversion = 10 active referrers. Each refers 1-2 leads/month = 10-20 leads/month ceiling.  
**Cost:** $100/lead  
**Verdict:** Seed realtors directly at scale. Stop relying on Redfin to surface emails.  
**Action:** Build seed-realtors.js with 300+ Colorado listing agents from realtor.com agent profiles.

---

### ROOFING PERMIT NEIGHBOR BLASTER
**Current state:** System generates neighbor addresses from Denver permits daily. Letters sitting in `/admin → Outreach` queue unacted on.  
**What's missing:** Tyler isn't mailing them. And we need Lob.com API to automate it.  
**Time to first lead:** 7-14 days after mailing  
**Lead quality:** High. Neighbor of a roofing job has the same roof age, same storm exposure.  
**Volume estimate:** Denver gets ~30 roofing permits/day. 4 neighbors each = 120 neighbor addresses/day. At $1/postcard × 5% response = 6 leads/day ceiling if fully automated. At manual rate (Tyler mails 20 letters/week) = 1 lead/week.  
**Cost:** $1/postcard. $14-20 cost per lead at 5-7% response rate.  
**Verdict:** Best cost-per-lead of any direct homeowner channel. AUTOMATE WITH LOB.COM.  
**Action:** Build Lob.com API integration. $1/postcard, automated. This is the closest thing to leads-while-you-sleep for homeowners.

---

### STORM-BASED OUTREACH
**Current state:** GitHub Actions runs every 30 min. B2B blast fires on every NWS alert to all prospects in affected cities. No storms currently.  
**What's missing:** Can't control weather. But when it hits, the system is ready.  
**Time to first lead:** Same day as storm  
**Lead quality:** Highest possible. Active storm damage, homeowner needs contractor now.  
**Volume:** Unlimited during storm events  
**Verdict:** KEEP RUNNING. Do not touch.

---

### INSURANCE AGENTS
**Current state:** 20 in DB, email sequence running  
**Reality:** Insurance agents are legally cautious about contractor referrals. Most won't do it formally. Some do informally.  
**Verdict:** Do not expand. Keep the 20 running and move on.

---

### HOA MANAGERS
**Current state:** 26 in DB  
**Reality:** HOAs issue roof violation notices to homeowners, forcing them to fix their roofs. But HOA managers don't refer contractors — they just cite violations. Homeowner then finds their own roofer.  
**Better angle:** Ask HOA managers to include Faraday's number in the violation letter itself. "Violation: Roof requires repair. Contact Faraday Construction for free inspection: (720) 766-1518." Some managers will do this.  
**Verdict:** Rewrite HOA email to request insertion into violation notices specifically. Don't expand.

---

### PROPERTY MANAGERS
**Current state:** 22 in DB  
**Reality:** Residential property managers ARE the decision maker for rental property roofs. They're not referring homeowners — they need service themselves. Pitch should be "when your rentals need storm repairs, Faraday is first call" not "refer homeowners."  
**Verdict:** Rewrite angle. Keep running.

---

### SEO BLOG
**Current state:** 2 posts live, 1 generating per Monday  
**Reality:** 3-6 months to rank. Irrelevant for 30-day plan.  
**Verdict:** Keep running. Don't touch.

---

### FEMA MONITOR
**Reality:** FEMA declarations are months after events. By the time it fires, the immediate opportunity is gone.  
**Verdict:** Abandon for active lead gen purposes. Keep running passively.

---

### BID MONITOR (Government RFPs)
**Reality:** Government roofing RFPs are commercial/institutional contracts with 6-12 month procurement cycles. Completely different business. Not a lead.  
**Verdict:** Abandon entirely for this purpose.

---

## 2. Newly Discovered Channels

### PLUMBERS
**Why:** Plumbers get called for ceiling/wall leaks. When they trace the source to the roof, they say "you need a roofer." They're in the house at the moment of maximum homeowner urgency.  
**Pitch:** "$50 per referral. Next time you trace a leak to the roof, give out Faraday's number."  
**Volume:** Denver has 500+ licensed plumbers. One active partner doing 5 service calls/week with 1-2 roof-source leaks = 4-8 referrals/month.  
**Cost:** $50/lead  
**Verdict:** BUILD SEED SCRIPT. Add plumbers as a new segment with tailored email angle.

### HVAC CONTRACTORS
**Why:** HVAC crews are on roofs constantly (installing/repairing rooftop units). They see hail damage up close.  
**Pitch:** Same as gutter companies — "$50 per referral when you spot roof damage on a job."  
**Volume:** Hundreds in Denver metro.  
**Verdict:** Add to seed script alongside plumbers.

### EXTERIOR PAINTERS
**Why:** Exterior painters are on scaffolding at eave level. They see hail dents on fascia, damaged siding, soft metal gutters. They're on-site for days at a time.  
**Pitch:** "$50 per referral when you spot storm damage on a job."  
**Verdict:** Add to seed script.

### ELECTRICIANS (Service Call)
**Why:** Electricians doing attic work see water staining from roof leaks. Service call electricians are in homes constantly.  
**Pitch:** "$50/referral when you see evidence of roof leaks."  
**Verdict:** Add to seed script.

### ROOFERS WHO DON'T DO INSURANCE CLAIMS
**Why:** Many small roofers do cash repairs only and don't want to deal with insurance paperwork. They'll refer insurance jobs to a company that handles it, especially if paid.  
**Pitch:** "If a client has storm damage and wants to go through insurance, refer them to Faraday. We handle all the paperwork and pay $100 per referral."  
**Volume:** There are 400+ roofing contractors in Colorado.  
**Verdict:** High potential. Small roofers already have homeowner trust. They're the best possible referral source.  
**Action:** Build seed script targeting roofing companies under 5 employees.

### ATTIC INSULATION COMPANIES
**Why:** In attics constantly. See water staining and damaged roof decking from the inside. High-intent homeowner moment.  
**Pitch:** "$50 per referral when you see roof damage in the attic."  
**Verdict:** Add to seed script.

### REAL ESTATE INVESTORS / HOUSE FLIPPERS
**Why:** Investors buy storm-damaged properties below market and need roofs replaced immediately. They're not a referral source — they're a direct customer. High-volume, repeat buyer.  
**How to reach:** Colorado REIA (Real Estate Investors Association) has member lists. Facebook groups like "Denver Real Estate Investing" have thousands of members.  
**Pitch:** "If you're buying a property that needs a roof, Faraday does fast turnaround and handles insurance if there's a prior claim on the property."  
**Verdict:** One investor with 10 flips/year = 10 jobs/year. Get 5 investor relationships = 50 jobs/year. This is high-value B2B.

### STORM CANVASSERS (Commission-Only Door Knockers)
**Why:** The fastest path to homeowner leads is someone physically knocking on doors in hail-hit neighborhoods. You don't need to hire employees — pay $25-50 per appointment set where homeowner gives their name and number.  
**Reality check:** This is how most roofing companies generate leads. It works. Someone knocking 50 doors/day in a storm-hit neighborhood gets 3-5 appointments.  
**Cost:** $25-50 per lead  
**Verdict:** Consider for storm season. Post on Craigslist/Indeed: "Storm restoration appointment setter — $30 per qualified appointment, work your own hours."

### LOB.COM DIRECT MAIL AUTOMATION
**Why:** This isn't a channel — it's an engine for the neighbor blaster. Right now neighbor letters require manual mailing. Lob.com charges $1.09/postcard via API. Wire it to permit monitor → automatic mailing.  
**Math:** 10 permits/day × 4 neighbors = 40 postcards/day × $1 = $40/day. At 5% response = 2 leads/day. $20/lead.  
**Verdict:** HIGHEST ROI ENGINEERING TASK. Build this.

---

## 3. Top 25 Opportunities — Ranked by Expected Lead Impact (30 days)

| Rank | Opportunity | Est. Leads/Month | Cost/Lead | Confidence |
|------|-------------|-----------------|-----------|------------|
| 1 | Lob.com neighbor blaster automation | 20-40 | $20 | High |
| 2 | Home inspector mass seeding (200+) | 8-15 | $100 | High |
| 3 | Gutter company mass seeding (150+) | 10-20 | $50 | High |
| 4 | Tyler personally calls top 10 PAs | 3-10 | $100 | Very High |
| 5 | Small roofer referral program (400+ CO roofers) | 5-15 | $100 | High |
| 6 | Restoration contractor mass seeding (50+) | 3-6 | $100 | Medium-High |
| 7 | Plumber referral seeding (200+) | 4-8 | $50 | Medium |
| 8 | Realtor direct seeding (300+) | 4-10 | $100 | Medium |
| 9 | HVAC company referral seeding (100+) | 3-6 | $50 | Medium |
| 10 | PA mass seeding via DORA license DB | 5-10 | $100 | High |
| 11 | Exterior painter seeding (100+) | 2-5 | $50 | Medium |
| 12 | Tyler calls top 5 home inspectors personally | 3-8 | $100 | High |
| 13 | HOA email rewrite (request insertion in violation notices) | 1-4 | $0 | Low-Med |
| 14 | Real estate investor / flipper outreach | 2-6 | $0 | Medium |
| 15 | Storm canvassers (hire on commission) | variable | $25-50 | High |
| 16 | Attic insulation company seeding | 2-4 | $50 | Medium |
| 17 | Electrician service company seeding | 2-4 | $50 | Low-Med |
| 18 | Storm alert → neighbor blaster immediate trigger | +30% on existing | $20 | High |
| 19 | Small roofing contractor seeding (no insurance) | 4-8 | $100 | High |
| 20 | Property manager email rewrite (service not referral) | 1-3 | $0 | Low |
| 21 | Colorado REIA meetup outreach | 2-5 | $0 | Medium |
| 22 | Listing monitor direct realtor seeding | 2-5 | $100 | Medium |
| 23 | Apartment operator outreach (5+ unit buildings) | 1-3 | $0 | Low |
| 24 | Storm event → door knock canvass activation | 10-30 | $25-50 | High |
| 25 | General contractor / sub referral expansion | 2-4 | $100 | Low-Med |

---

## 4. Top 10 by Speed to First Lead

| Rank | Opportunity | Days to First Lead |
|------|-------------|-------------------|
| 1 | Tyler personally calls 10 PAs | 1-2 days |
| 2 | Mail current neighbor blaster queue manually | 7-10 days |
| 3 | Gutter company takes $50 deal, on roof this week | 7-14 days |
| 4 | Restoration contractor on active roof-leak job | 7-14 days |
| 5 | Home inspector with buyer inspection this week | 7-14 days |
| 6 | PA email sequence hits active-claim PA | 7-21 days |
| 7 | Storm hits (B2B blast + subscriber SMS) | Same day as storm |
| 8 | Lob.com neighbor blaster (once built) | 10-14 days |
| 9 | Tyler calls 5 home inspectors personally | 3-7 days |
| 10 | Small roofer referral (refer insurance jobs to Faraday) | 14-21 days |

---

## 5. Channels to Abandon

- **Insurance agents** — regulatory friction, low conversion, don't expand
- **FEMA monitor** — months-delayed, low urgency by the time it fires
- **Government bid monitor** — wrong business model entirely
- **Reddit monitoring** — Tyler explicitly killed this
- **Listing monitor via Redfin** — Redfin never returns agent emails; replace with direct realtor seeding

---

## 6. Highest ROI Engineering Tasks

Ranked by (leads generated / engineering hours):

1. **Lob.com API integration** — wire permit monitor → Lob → physical mail → homeowner leads. At $1/postcard and 5% response this is $20/lead automated. Estimated build: 4-6 hours. Estimated impact: 20-40 leads/month.

2. **DORA license scraper** — Colorado Division of Regulatory Agencies publishes all licensed PAs, home inspectors, and real estate agents. Write a script to parse the public database into outbound_prospects. Estimated build: 3-4 hours. Estimated impact: 500+ high-quality prospects seeded.

3. **seed-gutter-companies.js** — 150+ Denver metro gutter companies. Estimated build: 1 hour. Estimated impact: 10-20 leads/month once referrers convert.

4. **seed-plumbers-hvac-painters.js** — 300+ Denver metro tradespeople who see roof damage. Estimated build: 2 hours. Estimated impact: 5-10 leads/month.

5. **seed-small-roofers.js** — 400+ Colorado roofing companies under 5 employees who don't do insurance claims. Estimated build: 2 hours. Estimated impact: 5-15 leads/month.

6. **HOA email rewrite** — request inclusion in roof violation notices specifically. 30 minutes. Impact: unknown but nonzero.

7. **Property manager email rewrite** — pivot from "refer homeowners" to "we service your rentals." 30 minutes. Might unlock B2B service relationships.

---

## 7. Highest ROI Non-Engineering Tasks

1. **Tyler personally calls 10 Denver public adjusters.** Find them on NAPIA, Yelp, Google. Call and say: "I pay $100 cash same week for every homeowner referral. Do you have any active hail claims with no contractor?" This single action has the highest probability of a lead within 48 hours. Time: 2-3 hours.

2. **Tyler personally calls 5 home inspectors.** Find Colorado licensed inspectors on ASHI (American Society of Home Inspectors) or the DORA site. Same pitch: $100/referral. Time: 1 hour.

3. **Mail the neighbor blaster queue.** Go to `/admin → Outreach` and find all "MAIL TO:" items. Print the pre-written letters. Mail them. $1/stamp. First homeowner lead possible in 7 days. Time: 1 hour + postage.

4. **Post in local contractor Facebook groups.** "Faraday is paying $50-100 per roofing referral to any trade company (gutters, plumbers, HVAC, painters) who spots storm damage on a job. Text me." Groups: Denver Contractors Network, Colorado Roofing Association Facebook, Colorado Home Improvement Pros. Time: 30 minutes.

5. **Drop physical referral cards at gutter supply houses.** Contractors pick up materials at ABC Supply, SRS Distribution, Beacon Roofing. Leave a card at the counter: "Faraday pays $50/referral for roof damage you spot on the job." Contractors pick them up all day. Time: 2 hours driving.

---

## 8. Lead-Generation Bottlenecks

**Bottleneck #1: Volume.** 122 prospects is not enough for the math to work at 1-3% conversion. Need 1,000+ prospects across all segments.

**Bottleneck #2: Human follow-through.** The neighbor blaster queue fills with letters that never get mailed. The "FIND EMAIL" realtor tasks never get acted on. Systems generate lists but humans have to act.

**Bottleneck #3: Cold email alone doesn't convert referral partners.** A PA or inspector who gets an email needs a reason to care RIGHT NOW. That reason is a phone call asking "do you have an active client who needs this TODAY?"

**Bottleneck #4: No direct homeowner channel without storms.** Every channel above runs through a referral partner. Faraday has no way to reach homeowners directly except the Lob.com neighbor blaster and SEO. SEO is slow. Lob.com is not built yet.

**Bottleneck #5: Email deliverability unknown.** Anna is sending from anna@faradayleads.com. If SPF/DKIM/DMARC aren't verified in Resend, emails may be landing in spam. 0% conversion if 0% delivery. Check Resend dashboard.

**Bottleneck #6: No phone number Tyler monitors.** Outreach references (720) 766-1518. If that's not a real monitored number, every inbound lead inquiry is lost.

---

## 9. Estimated Lead Volume by Channel (Month 1 vs Month 3)

| Channel | Month 1 | Month 3 | Notes |
|---------|---------|---------|-------|
| Public Adjusters (active email + calls) | 2-5 | 8-15 | Grows as referrers trust Faraday |
| Home Inspectors (200+ seeded) | 2-5 | 8-12 | Requires 3-4 email touches + conversion |
| Gutter Companies (150+ seeded) | 3-8 | 15-25 | Highest storm-season multiplier |
| Neighbor Blaster (Lob.com automated) | 5-15 | 20-40 | Depends on permit volume |
| Restoration Contractors (50+ seeded) | 1-3 | 4-8 | Slow warm-up |
| Realtors (300+ seeded directly) | 1-3 | 5-10 | Long relationship cycle |
| Plumbers / HVAC / Painters | 1-3 | 4-8 | New channel, slow start |
| Small Roofers (referral of insurance jobs) | 1-3 | 5-10 | Relationship dependent |
| Storm Events | 0 (no storm) | variable | Could be 20+/event |
| SEO Organic | 0 | 1-2 | 3-6 month lag |
| **Total** | **16-45** | **65-130** | |

---

## 10. The 30-Day Execution Plan

### Week 1 (Days 1-7) — Seeding and Calling
**Engineering (Anna does):**
- Build and run seed-gutter-companies.js (150+ gutter companies)
- Build and run seed-plumbers-hvac-painters.js (300+ tradespeople)
- Build and run seed-small-roofers.js (200+ small CO roofers)
- Start Lob.com API integration

**Tyler does:**
- Run `node scripts/seed-more-pas.js` (already built — 61 PAs)
- **Call 10 Denver public adjusters** (find on NAPIA.com, Google "public adjuster Denver")
- **Call 5 home inspectors** (find on ASHI.org or Colorado DORA)
- Go to /admin → Outreach, print and mail all "MAIL TO:" neighbor letters
- Verify Resend email deliverability (Resend dashboard → domain settings → SPF/DKIM/DMARC)
- Confirm (720) 766-1518 is a real number Tyler monitors

### Week 2 (Days 8-14) — Amplify
**Engineering:**
- Finish Lob.com integration (permits → auto-mail neighbor letters)
- Build DORA scraper for home inspectors and PAs
- Seed 300+ realtors directly

**Tyler does:**
- Follow up PA calls (anyone who didn't answer week 1)
- Post referral offer in 3-5 contractor Facebook groups
- Drop referral cards at ABC Supply / SRS Distribution (Thornton, Aurora, Denver locations)
- Check email engagement in Resend — did any PAs open? Click?

### Week 3 (Days 15-21) — First Conversions
**Engineering:**
- Lob.com should be live — verify letters are going out
- Monitor contact_form_queue for any "MAIL TO:" items → Lob.com handles these now

**Tyler does:**
- Any PA or inspector who opened an email → Tyler calls them personally
- Any referral that came in → deliver it to Faraday, collect $100
- Assess: which email segment has the highest open rate? Double down on that segment.

### Week 4 (Days 22-30) — Double Down
- Identify which channel produced any lead
- Seed 300+ more prospects in the winning segment
- Kill cold outreach to any segment with 0% engagement after 3 touches
- If Lob.com letters are going out: track response rate, optimize letter copy

---

## Shortest Path to First 25 Anna-Generated Leads

**The honest math:**

If Tyler makes 10 PA calls this week and lands 2 active PA referral partners, and each generates 3 leads in 30 days = 6 leads from calls.

If gutter company seeding goes from 8 to 150 and 5 convert at 3 leads each = 15 leads.

If Lob.com neighbor blaster goes live and mails 200 letters over 30 days at 5% = 10 leads.

**Total: ~31 leads in 30 days.** Achievable if Tyler makes the calls and Lob.com gets built.

The single highest-leverage action in this entire plan is Tyler picking up the phone and calling a public adjuster who has an active hail claim. That one call could generate 3-5 leads in a week. No code required.

**The single highest-leverage engineering task is Lob.com integration.** Once built, neighbor blaster runs itself: permits → letters → homeowner leads, automated, at $20/lead, indefinitely.

---

## What Anna Cannot Do Alone

Anna can email. Anna cannot call. Anna cannot mail postcards (yet). Anna cannot show up at a supply house. Anna cannot build trust the way a 5-minute phone call does.

The channels where Tyler must act personally to unlock leads:
- PA phone calls
- Inspector phone calls  
- Physical card drops at supply houses
- Contractor Facebook groups
- Mailing the neighbor blaster queue until Lob.com is live

Every channel Anna runs autonomously (email sequences) is a slow burn — 2-4 week cycles before anyone converts. Every channel Tyler activates personally is a 24-48 hour burn.

The fastest path to 25 leads is Anna running all sequences in the background while Tyler personally works the PA and inspector channels by phone.

---

*Generated: June 17, 2026*
