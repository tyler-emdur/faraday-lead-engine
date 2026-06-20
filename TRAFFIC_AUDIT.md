# Traffic Acquisition Audit
**Date:** June 17, 2026  
**Single objective:** Get strangers to leads.faradaysun.com and submit name + phone + service interest.

---

## 1. FEATURES TO REMOVE (kill immediately — they consume time/money, generate zero visitors)

| Feature | Why |
|---------|-----|
| `blog-generate` cron | SEO blog posts. Zero traffic for months. Not the game. |
| `permit-monitor` Lob postcards | Physical mail. Slow. $1/piece. No tracking. No clicks. |
| `permit-monitor` neighbor letters | Manual. 0 automation. 0 traffic. |
| `storm-check` subscriber SMS blast | Storm subscriber program. Requires subscribers first. Tyler excluded Twilio. |
| `storm-check` Facebook page post | Social automation. Not traffic to lead page. |
| `storm-check` Buffer queue | Social scheduling. Same problem. |
| `storm-check` Google Ads auto-create | Ads without a budget allocation strategy aren't running. |
| `storm-check` re-engagement SMS | Lead nurturing. Not Tyler's job. |
| `meta-ad-cleanup` cron | Manages ads that don't exist. |
| `hoa-violations` cron | Finds HOA violation posts → outreach → referral partner → maybe someday someone visits. 4 hops. |
| `competitor-reviews` cron | Reputation tactic for a brand building play. |
| `review-request` cron | Reviews are SEO/reputation. Not traffic. |
| `fema-monitor` cron | FEMA disasters → outreach → referral → maybe traffic. Too many hops. |
| `bid-monitor` cron | Government RFPs. Nothing to do with homeowner traffic. |
| `weekly-report` cron | Internal reporting. No traffic. |
| `intel-digest` email | Internal dashboard. No traffic. |
| `hail-damage-unclaimed` cron | Historical data → outreach → referral. 3 hops. |

---

## 2. FEATURES TO IGNORE (don't delete, just deprioritize to zero — they might produce one or two leads eventually but are not the lever)

- `listing-monitor` — maybe 1 agent becomes a referral partner after 4 emails. Not a traffic channel.
- `outbound-prospect` cold email to B2B partners — indirect. 4-touch sequence to get a PA to refer a client. Too slow.
- `contact-form-targets` — cold form submits. Even slower.
- `prospect-scraper` — broken and even when working, just loads a B2B pipeline.
- The entire `outbound_prospects` table — B2B referral pipeline. Longest possible path to a visitor.
- The chat widget (Anna) — conversion tool, not traffic. It's fine, leave it running. Don't improve it.
- All admin/CRM views — `/admin`, `/anna` — zero traffic.
- `storm-check` NWS monitoring — keeps things warm for when storms hit. Let it run. Don't touch it.

---

## 3. FEATURES THAT ACTUALLY DRIVE TRAFFIC (keep and prioritize)

Only two things in the current system can theoretically send someone to the lead page:

1. **The lead page itself** (`/`) — the destination. Only useful if traffic exists.
2. **`outbound-prospect` cold emails to B2B partners** — the *only* currently automated outbound that contains a link to the site. Low conversion but running.

That's it. The system is mostly machinery to support a roofing business, not a traffic engine.

---

## 4. CHANNELS CAPABLE OF SENDING VISITORS TO THE LEAD PAGE

Ranked by: speed × volume × automation potential.

### Tier 1 — Immediate, scalable, automated

**A. Google Search Ads (PPC)**  
Homeowners in Colorado search "hail damage roof inspection", "free roof inspection Denver", "roof damage insurance claim Colorado" every day. Google shows your ad. They click. They land on the lead page. You pay per click (~$3–8). This is the only channel that reaches people *at the moment of intent* with zero lag time. Can be running in 2 hours.

**B. Homeowner email list blast (B2C cold email)**  
InfoUSA, Melissa Data, Acxiom, ListGiant all sell Colorado homeowner email lists by zip code. Filters: homeowner (not renter), single-family home, zip codes in hail-prone CO Front Range. Cost: ~$200–500 for 50,000 records. Send once per week with subject "Your roof may have hail damage you haven't noticed" + link to lead page. Even 0.5% CTR = 250 visitors from one blast. This is not B2B. This goes directly to homeowners.

**C. Thumbtack / Angi / Yelp / HomeAdvisor — free listing placement**  
Homeowners actively searching for roofers visit these platforms daily. A free listing on each with the lead page URL means inbound clicks from people already looking. Angi Pro is pay-per-lead. Thumbtack is pay-to-show. Yelp free listing is free. All four can be set up today.

**D. Craigslist daily posting (automatable)**  
Thousands of Denver-area homeowners search Craigslist under Services > Skilled Trades. Post a simple ad daily: "Free Hail Damage Inspection — We Handle the Insurance Claim — (720) 766-1518 — leads.faradaysun.com". Free. Immediate. Can write a Node script to post via Craigslist's web interface or use a posting service. 5–20 clicks/day per city at zero cost.

### Tier 2 — Fast, scalable, moderate effort

**E. Nextdoor organic posting**  
Nextdoor is neighborhood-specific. Post in Denver, Aurora, Westminster, Lakewood, Fort Collins neighborhoods: "After last month's storms, we're offering free roof inspections to neighbors this week — no obligation, we handle the insurance paperwork." Link to lead page. Each post reaches a few hundred hyperlocal homeowners. Limit: account-based, manual. But: one post = 50–200 visitors if it gets engagement.

**F. Facebook community group posting (not ads)**  
Denver Homeowners group (47K members), Aurora Colorado Community (28K), Westminster Residents (12K), etc. Post organically with storm photo + free inspection offer + link. Not ads. Free. One post can drive 100+ clicks. Can run from multiple accounts. Scalable if systematized.

**G. Google Business Profile (free local listing)**  
A GBP listing for Faraday at a Denver address shows up in Google Maps and local pack results when someone searches "roofer near me" or "roof inspection Denver." Free setup. Gets indexing within 48 hours. No SEO content needed — just the listing. Can get 10–50 organic clicks/day with zero ongoing effort.

**H. Bing/Microsoft Ads**  
60% cheaper CPCs than Google. Same keyword intent. Often overlooked. Reach 30% of the search market that doesn't use Google.

**I. YouTube pre-roll ads**  
15-second unskippable: homeowner in Colorado, hail on the roof, "free inspection, only pay your deductible, click the link." Target CO homeowners 30–65, homeowner interest segments. Costs ~$0.05–0.15/view. 10,000 views = $500–1,500 = ~50–150 clicks at 0.5–1% CTR.

**J. Storm path data → cold email**  
StormGeo, NOAA, and commercial vendors (CoreLogic Hazard HQ, Verisk) sell historical storm path data. Match storm paths to county assessor addresses. Find homeowner emails via data brokers. Send "your home at [address] was in the path of [date] hailstorm" email with direct link to lead page. Extremely high open rates on personalized storm data. ~3–5% conversion to form submit.

### Tier 3 — Requires more setup but high ceiling

**K. County assessor data → email enrichment → cold email**  
Every CO county publishes property owner data. Download it. Match addresses to names. Run through a B2C email finder (BeenVerified API, TruthFinder, Whitepages Pro). Send "Hi [Name], we noticed your home at [address] is in a high-hail-frequency area — free inspection this week." Highly personalized, high open rate. Takes 1–2 weeks to set up the pipeline.

**L. Bing Maps / Apple Maps / Waze listing**  
Free. Passive. People searching for roofers on Apple Maps or Waze will find the listing. 30 minutes to set up. Gets 5–20 clicks/month per platform passively.

**M. Home service syndication sites (Porch, Houzz, Bark, BuildZoom)**  
List on all 5. Homeowners searching these platforms get shown Faraday. Free listings, some paid lead models. One-time setup = ongoing passive traffic.

**N. Reddit (manual, targeted)**  
r/Denver, r/ColoradoSprings, r/homeimprovement, r/FirstTimeHomeBuyer — when someone posts "anyone recommend a roofer in Denver" or "hail damage what do I do" — reply with specific helpful advice and mention Faraday + link. Not a paid ad. High trust. 5–20 clicks per relevant reply.

**O. Insurance agent email blast (B2B but short path)**  
Insurance agents have clients who just filed hail claims. Direct email to 500 CO insurance agents: "When your client has a hail claim, text us their address and we inspect same day. Your client gets a faster resolution, you get a happy customer." Agent texts address → Faraday calls homeowner → homeowner goes to lead page. One email blast to 500 agents could generate 20–50 homeowner contacts.

---

## 5. TOP 20 HIGHEST ROI TRAFFIC ACQUISITION OPPORTUNITIES

Ranked by: leads generated / dollar spent / time to first result.

| # | Channel | Cost | Time to First Lead | Est. Leads/Month | Automation |
|---|---------|------|-------------------|-----------------|------------|
| 1 | Google Search Ads — "hail damage roof inspection CO" | $5–15/lead | 2 hours | 20–100 | Full |
| 2 | Thumbtack listing + paid visibility | $25–50/lead | 1 day | 5–20 | Semi |
| 3 | Angi Pro (HomeAdvisor) listing | $40–80/lead | 1 day | 10–30 | Semi |
| 4 | Craigslist daily posting (automatable) | $0/lead | 4 hours | 5–15 | Full |
| 5 | Homeowner email list blast (InfoUSA/Melissa) | $2–8/lead | 3 days | 20–80 | Full |
| 6 | Google Business Profile listing | $0 | 48 hours | 5–20 passive | Set-once |
| 7 | Facebook community group organic posts | $0 | 1 hour | 3–15/post | Manual |
| 8 | Yelp free listing | $0 | 1 day | 2–10 passive | Set-once |
| 9 | Bing/Microsoft Ads | $3–8/lead | 4 hours | 5–25 | Full |
| 10 | Nextdoor organic posts | $0 | 2 hours | 5–30/post | Manual |
| 11 | Storm path data → targeted email | $1–4/lead | 1 week setup | 15–50 | Full |
| 12 | YouTube pre-roll (CO homeowner targeting) | $8–20/lead | 2 days | 5–30 | Full |
| 13 | Porch.com listing | $0 | 1 day | 2–8 passive | Set-once |
| 14 | Houzz listing | $0 | 1 day | 1–5 passive | Set-once |
| 15 | Bark.com listing | $0–20/lead | 1 day | 3–10 | Semi |
| 16 | Insurance agent cold email blast | $0 | 3 days | 5–20 | Full |
| 17 | County assessor → email enrichment pipeline | $2–6/lead | 2 weeks | 30–100 | Full (after setup) |
| 18 | Reddit targeted replies | $0 | 1 hour | 1–5/reply | Manual |
| 19 | BuildZoom listing | $0 | 2 days | 1–5 passive | Set-once |
| 20 | Apple Maps / Bing Places listing | $0 | 48 hours | 1–5 passive | Set-once |

---

## 6. SHORTEST PATH TO 100 LEAD PAGE VISITORS

**Timeline: 48 hours**

**Hour 1–2:** Turn on Google Search Ads.
- Campaign: "Free Roof Inspection Colorado"
- Keywords: "hail damage roof inspection", "free roof inspection denver", "roof damage insurance claim colorado", "roof hail damage colorado"
- Budget: $50/day
- Landing page: leads.faradaysun.com
- Match type: Phrase and Exact
- Expected: 10–30 clicks/day at $3–8 CPC

**Hour 2–3:** Set up Google Business Profile, Yelp, Angi, Thumbtack free listings.
- Expected: 5–15 passive clicks/day combined, starting day 2–3

**Hour 3–4:** Post on Craigslist in Denver, Aurora, Colorado Springs, Fort Collins, Boulder.
- Expected: 5–20 clicks from first posts

**Hour 4–6:** Post in 5 Facebook community groups (Denver Homeowners, Aurora Community, Westminster Residents, Lakewood CO, Fort Collins Homeowners).
- Expected: 20–60 clicks within 24 hours if post gets traction

**Hour 6–12:** Post on Nextdoor in 10 Denver-area neighborhoods.
- Expected: 10–50 clicks combined

**Day 2:** Order homeowner email list from ListGiant.com (CO Front Range, homeowner filter, 10,000 records). While it arrives, draft the blast email.

**Result:** 100+ visitors within 48 hours, primarily from Google Ads + Facebook groups + Craigslist, with passive trickle from directory listings starting day 3.

**Cost:** ~$100–300 (mostly Google Ads budget).

---

## 7. SHORTEST PATH TO 25 SUBMITTED LEADS

**Baseline assumption:** Landing page converts at ~5–10% of visitors (form is simple, offer is strong).

To get 25 leads you need ~250–500 qualified visitors.

**The math:**
- Google Ads at $50/day: 10–20 clicks/day. 25 leads in 3–5 days at 10% conversion. Cost: $150–500.
- Facebook community groups: free, 50–150 clicks per well-timed post. 1–2 posts/day across multiple groups = 25 leads in 3–5 days if posts get traction.
- Angi Pro (pay-per-lead model): buy 25 leads directly at ~$40–80 each. $1,000–2,000. Instant.

**Recommended path (fastest, cheapest):**

**Day 1:**
1. Google Ads live with $100/day budget. Target 3 high-intent keywords.
2. Angi Pro listing live — homeowners searching for roofers will start seeing it today.
3. Thumbtack listing live.
4. Post in 10 Facebook groups.
5. 5 Craigslist posts.

**Day 2:**
6. Google Business Profile approved (usually <24h for existing business).
7. HomeAdvisor lead buying — buy 10 leads directly.
8. More Facebook group posts in different neighborhoods.

**Day 3–5:**
9. Homeowner email blast to 10,000 CO homeowners. Even 0.3% submit = 30 leads.

**Expected result:** 25 leads within 5–7 days.  
**Estimated cost:** $300–800 in ads + $200–500 for email list = $500–1,300 total.  
**Cost per lead:** $20–52.

---

## WHAT TYLER SHOULD DO TODAY (in order)

1. **Google Ads** — create account, 3 campaigns, $100/day budget. 2 hours. This is the only channel that starts working same-day at scale with no manual effort.

2. **Angi + Thumbtack + Yelp + HomeAdvisor** — free listings on all four. 1 hour. Passive traffic forever.

3. **Google Business Profile** — verify business at CO address. 30 minutes. Free local search placement.

4. **Facebook community group posts** — 10 groups, 1 post each, link to lead page. 1 hour. Free.

5. **Craigslist** — post in 5 CO cities today. Free. Takes 30 minutes.

6. **Order homeowner email list** — ListGiant, Melissa Data, or InfoUSA. Filter: CO, Front Range zip codes, homeowner, single-family. 10,000 records. ~$150. Send blast this week.

7. **Disable or ignore** everything else in the system.

---

## WHAT THE SYSTEM SHOULD BUILD NEXT (only if it drives traffic)

The only automation worth building:

1. **Craigslist auto-poster** — Node script that posts a fresh ad daily to 5 CO cities via Puppeteer or a posting API. Zero ongoing effort. $0/lead.

2. **Homeowner email blast pipeline** — automated weekly blast to purchased email list. Template: storm-specific subject + personalized with zip code + link to lead page. Full automation. ~$2–8/lead.

3. **Google Ads keyword auto-refresh** — when a new storm hits, auto-add storm-specific keywords ("Westminster hail damage June 2026"). This is the only valid reason to keep storm detection running.

Everything else is not a traffic system. It's a roofing company management system that happens to have a lead form attached.
