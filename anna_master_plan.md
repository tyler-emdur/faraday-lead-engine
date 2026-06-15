# Anna Master Plan: Zero-Touch Lead Generation for Faraday Construction

> Goal: Maximum automated leads at minimum cost and effort. All strategies below are legally compliant.
> Pay rate: $100/lead through the Anna pipeline.

---

## Strategy #0 — The Central Nervous System (Build This First)

**NWS Storm Webhook Trigger**

Everything else in this plan depends on knowing when and where hail hit. Set up a single automated trigger that monitors the National Weather Service API for hail events in Colorado zip codes. The moment a storm fires, it automatically kicks off every other storm-dependent strategy: Google Ads campaigns (#15), storm articles (#7), geofencing (#12), SMS blasts to your opt-in list (#5), and social posts (#3). Without this, you're doing everything manually and losing the 2–4 hour window when intent is highest.

- **Cost:** Free (NWS API is public)
- **Automation:** Full
- **Setup:** One Python script + webhook to your other tools

---

## Tier S — Do These First (Highest ROI, Near-Zero Cost)

### 1. Storm-Alert SMS Opt-In List

Build a permanent, compounding asset. Create a page at `faradaysun.com/storm-alerts` offering free text alerts when hail hits a homeowner's zip code. Run $5/day Facebook ads targeting Colorado homeowners to drive sign-ups. Every time the NWS trigger fires, Anna automatically texts the entire opted-in list: "Hey [Name], hail just hit your zip code. Want a free inspection before claim windows close?"

This is 100% TCPA compliant because they opted in. Over time you accumulate 1,000–5,000 homeowners who hear from Anna automatically every storm. It's a permanent asset that compounds with every new subscriber.

- **Cost:** $5/day ads to build the list
- **Automation:** Full (storm trigger → auto-blast)

---

### 2. "Comment HAIL" Social DM Funnel

Post short videos of local hail on Instagram, Facebook, and TikTok. Caption: "Comment the word HAIL and our AI assistant will check if your neighborhood was hit." Using ManyChat or the Meta Graph API, Anna instantly DMs anyone who comments, qualifies them, and collects their phone number for an inspection booking.

Users initiate the conversation, which bypasses TCPA entirely. Zero cost per message. Infinite scale. This is also where your before/after job photos become valuable content — post storm damage and completed roof photos regularly to keep engagement up.

- **Cost:** Near zero (ManyChat free tier covers early volume)
- **Automation:** Full

---

### 3. "Text HAIL" Shortcode on Yard Signs

Rent a short code or use a Twilio number. Advertise: "Text HAIL to (720) XXX-XXXX to check if your neighborhood was hit." Put this on every Faraday yard sign, truck bumper, and social post. When someone texts in, Anna takes over the SMS conversation, qualifies them, and books the inspection. The act of texting in is legal TCPA opt-in.

A yard sign costs $3 and works for years. Anyone who sees a Faraday truck can become a lead without ever opening a browser.

- **Cost:** $3/sign + Twilio per-message cost
- **Automation:** Full (Anna handles all inbound SMS)

---

### 4. Hail Map Lead Magnet Funnel

Build a landing page: "Was your roof damaged? Enter your ZIP code to see the free local hail map." To see the map, visitors enter their name and phone number, creating a legal opt-in. The moment they submit, the page shows the map and Anna instantly texts them: "Hey [Name], looks like your house was in the red zone on May 12th. Want me to send an inspector by tomorrow for free?"

Lead magnets drastically lower cost-per-lead compared to generic "get a quote" ads. Every person who enters their zip is actively worried about their roof.

- **Cost:** Low ad spend
- **Automation:** Full

---

### 5. Auto Storm Keyword Google Ads

After each storm, people search the specific storm name, date, and city — and nobody else is bidding on those exact terms. When the NWS trigger fires for "Westminster CO hail May 14," a script automatically creates a Google Ads campaign with exact-match keywords: "Westminster hail May 14," "hail damage Westminster Colorado." Bid $2–3/click (no competition). The campaign auto-pauses after 2 weeks when search volume drops.

You're the only advertiser on those searches. Cost per click is $2 instead of $20. Every click is someone who just Googled the specific storm that hit their house.

- **Cost:** $2–3/click, self-limiting campaigns
- **Automation:** Full (script triggers on NWS alert)

---

## Tier A — High Value, Set Up in Week 2

### 6. Google Local Services Ads (LSA)

LSAs appear above everything else on Google — above regular ads, above the map pack. You pay per lead, not per click, and Google verifies the business. In a storm week, these dominate the top of the page. Cost per lead is often lower than Angi or Thumbtack. Faraday needs to complete Google's verification process (a few days), but once live, Anna handles all inbound calls.

- **Cost:** Per lead (variable, typically $20–60 for roofing)
- **Automation:** Full (Anna handles inbound)

---

### 7. Hyper-Local Storm News Site

Register `frontrangestormreport.com`. Every time the NWS trigger fires, Anna auto-generates and publishes an article: "May 14th Hailstorm Hits Westminster — What Homeowners Need to Know About Roof Claims." The article links to Faraday for the free inspection and ranks on Google within hours because there is zero competition for that exact storm/date/city query.

One storm article can drive 200–400 organic visitors at $0 ad spend. The content stays live and searchable for months.

- **Cost:** $10 domain, $0 per article
- **Automation:** Full (NWS trigger → auto-publish)

---

### 8. Geofencing Ads in Storm-Hit Zip Codes

When the NWS trigger fires, a script auto-creates a geofence around the affected zip codes using a DSP like StackAdapt or Simpli.fi. Anyone whose phone enters that area sees your ad in mobile apps — weather apps, news, games. Target property owners specifically using the DSP's ownership data filters. Ad copy: "Your neighborhood got hail last night. Free roof inspection — insurance pays for it."

You're reaching people while they're standing in their front yard looking at their dented car. Highest possible intent moment.

- **Cost:** Medium ad spend, highly targeted
- **Automation:** Full (NWS trigger → auto-create geofence)

---

### 9. Speed-to-Lead on Angi / HomeAdvisor / Thumbtack

Home service platforms sell the same lead to 3–5 contractors. Whoever calls first wins — and the average contractor calls back in 3.5 hours. Wire the platform webhook to Bland.ai or Vapi: new lead arrives → Anna calls the homeowner within 60 seconds. Anna qualifies them and books the inspection before the other contractors even see the notification.

Studies show first-to-call wins 50%+ of shared leads. You're beating competitors on speed alone using leads they're also paying for.

- **Cost:** Platform lead cost + AI call API cost
- **Automation:** Full

---

### 10. Insurance Agent Referral Emails

Independent insurance agents can't officially steer claims, but they informally recommend contractors when clients ask "do you know a good roofer?" Scrape independent agents in Colorado (not captive agents — independents who care about their clients). Anna sends: "Hi [Agent], when your homeowner clients have storm damage and ask for a referral, we'd love to be your go-to. We make the claim process completely painless. Can I send you our referral card?"

Follow up after every major storm automatically. No referral fee needed — agents just want to look good. One agent with 500 clients sending 2 leads/month is worth $2,400/year to you. Get 20 agents and that's $48,000/year passively.

- **Cost:** Near zero
- **Automation:** Full (scrape + email sequence + storm follow-up)

---

### 11. HOA Manager Partnership Email

HOAs manage entire communities — some with 200–500 homes. Scrape HOA management companies in Colorado. Anna emails: "We're offering HOAs a free storm damage assessment for all units after hail events — no cost to the HOA, insurance covers repairs. We provide a written report for the board. Interested?" Automate a post-storm follow-up: "Hey [Manager], hail just hit [community name]. Want us to do a free community assessment this week?"

One email to one property manager can unlock 300 homeowner leads. Even a 5% conversion in a 300-unit HOA is 15 leads = $1,500 for you.

- **Cost:** Near zero
- **Automation:** Full

---

### 12. Apartment Complex and Condo Association Managers

A separate scrape target from HOAs. Property management companies running apartment complexes need flat roof inspections after every hail event and often have pre-approved maintenance budgets. One regional property management company may manage 30 complexes. The pitch is slightly different from residential: "Faraday provides certified flat roof inspection reports for your maintenance records and insurance documentation after storm events — at no cost to you."

- **Cost:** Near zero
- **Automation:** Full

---

### 13. YouTube Pre-Roll on Storm Content

When it hails, everyone searches YouTube for "colorado hail storm [date]." Run Google Ads video campaigns targeting YouTube videos with keywords "colorado hail," "denver hail storm," "front range severe weather." 15-second unskippable ad: someone filming hail hitting their car, Anna voiceover: "If hail hit your car, it hit your roof too. Faraday covers all the paperwork. Free inspection." Activate automatically when the NWS trigger fires.

$0.02–0.05 per view. Zero other roofing companies are doing this. Storm viewers are extremely high intent.

- **Cost:** Very low per view
- **Automation:** Full (NWS trigger → activate campaign)

---

### 14. Storm Chaser Content Partnership

Colorado has dozens of popular storm chaser accounts on YouTube, Instagram, and TikTok with 10k–500k followers. Their audiences are 100% Colorado residents who care about severe weather. DM storm chasers offering a small fee or revenue share per lead for a mention. Set up a tracking link `faradaysun.com/stormchasers`. During active storm coverage, storm chasers often go live with 1,000+ viewers — one mention during a live storm could send 500 visitors in an hour.

- **Cost:** Small fee or rev share
- **Semi-manual:** Outreach is manual, link tracking is automated

---

### 15. FEMA Disaster Declaration Monitoring

When severe weather triggers a FEMA disaster declaration in Colorado, it unlocks assistance programs homeowners don't know about. Monitor FEMA's disaster declaration API. When a declaration hits: Anna auto-publishes a blog post explaining what it means for homeowners and how to file. Run ads: "FEMA just declared [county] a disaster area — here's what it means for your roof claim." These searches are completely uncontested.

- **Cost:** Near zero
- **Automation:** Full

---

### 16. Google Local Services Ads on Partner Sites (Anna Widget)

Create a lightweight embed script that puts Anna on partner websites: `<script src="faradaysun.com/anna.js"></script>`. Pitch to local realtors, mortgage brokers, and home inspectors: "Put our free tool on your site — when a homeowner asks about roof damage, our AI handles it. We split the referral fee." Anna chats from their site, collects the lead, sends it to your database.

One real estate brokerage with 50 agents could add hundreds of leads per month. You turn every partner's website into a passive lead machine.

- **Cost:** Dev time only
- **Automation:** Full once deployed

---

### 17. Government / Municipal Bid Scraping

Cities and counties constantly put out public bids for roof replacements on schools, firehouses, and government buildings. Scrape Colorado state procurement portals. Whenever a roofing or solar project is posted, Anna automatically drafts a bid proposal or emails the procurement officer requesting the RFP documents.

One municipal roof is worth $100k+. Even as a single lead, presenting massive commercial deals makes you invaluable to Faraday.

- **Cost:** Near zero
- **Automation:** Full

---

## Tier B — Strong Additions, Slightly More Setup

### 18. Faraday Past-Customer Reactivation Blasts

Faraday almost certainly has a list of past customers. Those people already trust the company, and their neighbors' roofs got hit by the same storms. After every storm, an automated text goes to the entire past-customer list: "Hey [Name], hail just hit your neighborhood again. Want us to do a quick free re-inspection to make sure nothing new came up?" Anna handles all replies.

One blast to 500 past customers after a storm could generate 20–30 leads in a single day. This is the highest-conversion outreach possible — they already bought.

- **Cost:** Near zero (Twilio per-message cost)
- **Automation:** Full (NWS trigger → blast list)

---

### 19. Mortgage and Title Company Partnerships

When someone buys a house, the lender sometimes requires a roof certification before closing. Mortgage officers and title companies deal with this constantly and hate scrambling for a roofer. Pitch: "When your borrowers need a roof certification before closing, Faraday turns it around same-day." One relationship with a mortgage officer at a mid-size local lender = steady year-round leads regardless of storm season.

- **Cost:** Near zero
- **Semi-manual:** Initial relationship building is manual; referrals are then automatic

---

### 20. County Permit Records — Roof Age Targeting

Every roof replacement in Colorado requires a building permit, which is public record. Pull all roofing permits from 2005–2013 — those homes now have 12–20 year old roofs and are prime hail claim candidates. Cross-reference with storm event data. Anna sends postcards via the Lob API or cold emails: "Your roof is entering the high-risk age range for Colorado weather. Free inspection finds issues before they become expensive."

You know exactly which houses have old roofs, down to the address and square footage.

- **Cost:** Low + postcard costs (~$1/postcard via Lob)
- **Automation:** Full

---

### 21. B2B Contact Form Outreach to Realtors and Property Managers

Realtors and property managers constantly need reliable contractors. A Python script scrapes Google Maps for "Real Estate Agency" and "Property Management" in Colorado, finds their contact pages, and Anna submits: "Hi, I'm Anna with Faraday Construction. We're offering referral bonuses to agents who send us clients needing roof repairs. Do you have 5 minutes to chat this week?"

This bypasses email spam filters. Throttle to avoid blocks and respect rate limits.

- **Cost:** Dev time only
- **Automation:** Full (throttled)

---

### 22. Speed-to-Lead on Pending Sale Listings

When a house goes under contract, the home inspection almost always flags roof issues. Use a licensed real estate data API (not scraping — use a paid provider like ATTOM Data or a Zillow partner feed) to monitor Front Range listings changing status to "Pending." Anna automatically emails the listing agent: "Saw your listing at [Address] went under contract! If the home inspector flags any roof issues, Faraday can get an inspector out there same-day."

- **Cost:** Data API subscription
- **Automation:** Full

---

### 23. FSBO and "Coming Soon" Listing Outreach

Homes about to go on the market almost always need a roof certification. Use a licensed real estate data provider to find listings tagged "For Sale By Owner" or "Coming Soon." Anna emails the seller: "If your home inspector flags the roof, it can kill your deal at the last minute. Faraday does same-day certifications — free if no issues found."

Time pressure is built in — sellers on a deadline convert at high rates.

- **Cost:** Data API subscription
- **Automation:** Full

---

### 24. Reddit Keyword Monitoring + Genuine Responses

Monitor Colorado subreddits (r/Denver, r/Boulder, r/FortCollins, r/ColoradoSprings) for posts containing "roofer," "hail," "roof damage," "insurance claim," or "storm damage." When a post matches, you get a notification and a pre-drafted response. Post it yourself in 30 seconds — do not fully automate posting, as Reddit bans bots.

Reddit comments rank on Google. A helpful comment on a post about Denver hail can be the top result when someone searches that storm. Permanent, free, and compounds.

- **Cost:** Near zero
- **Semi-manual:** Monitoring is automated; posting is manual (30 sec/response)

---

### 25. Nextdoor — Real Customer Reviews (The Right Way)

After every completed Faraday job, an automated text goes to the customer: "Mind leaving us a quick Nextdoor review? Here's the direct link for your neighborhood." One sentence, one link. Real reviews from real neighbors convert better than any advertisement, stay up permanently, and build organic trust in the exact neighborhoods where Faraday works.

- **Cost:** Near zero
- **Semi-manual:** Customer sends the review; the ask is automated

---

### 26. Google Business Q&A Seeding

Google Business Profile has a Q&A section that ranks in searches and nobody uses strategically. Post questions to Faraday's GBP as a local guide: "Do you help with insurance claims for hail damage?" "How quickly can you do a free inspection?" Answer with keyword-rich responses mentioning specific Colorado cities. After each storm, post a new Q&A mentioning the storm date and affected city.

Zero cost. Appears in Google search results. Compounds over time.

- **Cost:** Zero
- **Semi-manual:** 10 minutes per storm event

---

### 27. Before/After Photo Content Pipeline

Every Faraday job produces before/after photos of storm damage and completed roofs. This content is gold on Instagram and TikTok but only if it's systematically collected and posted. Automate the ask: crew takes photos on every job → auto-uploads to a shared folder → a tool like Buffer schedules posts on a regular cadence. These posts also become the storm content that drives the "Comment HAIL" funnel (#2).

- **Cost:** Buffer ~$15/month
- **Semi-manual:** Crew takes photos; posting is automated

---

### 28. Speed-to-Lead: Competitor Review Mining

Homeowners who left 1–2 star reviews on competitor roofers in Colorado are actively unhappy and proven to need roofing work — the warmest cold leads on the internet. Scrape Google Maps reviews for competitor roofers, filter for 1–2 stars mentioning "hail," "insurance," "slow," or "didn't show up." Reach out via the same platform they posted on (Google Maps, Yelp) rather than hunting for personal contact info.

Conversion rate is 3–5x higher than cold outreach because these people are already angry and looking for alternatives.

- **Cost:** Dev time
- **Automation:** Monitoring automated; outreach semi-manual

---

## Implementation Priority

| Week | Focus |
|------|-------|
| Week 1 | Build NWS storm trigger (#0). Launch SMS opt-in page (#1) with $5/day ads. Set up ManyChat "Comment HAIL" funnel (#2). Put "Text HAIL" on yard signs (#3). |
| Week 2 | Build hail map lead magnet (#4). Set up auto Google Ads storm campaigns (#5). Apply for Google LSA (#6). Wire Angi/Thumbtack webhook to Anna for speed-to-lead (#9). |
| Week 3 | Launch storm news site (#7). Set up geofencing trigger (#8). Email blast to insurance agents (#10) and HOA managers (#11). |
| Month 2 | Outreach to mortgage companies (#19), storm chasers (#14), realtor partners for Anna widget (#16). Automate past-customer reactivation blasts (#18). |
| Ongoing | County permit record targeting (#20), Reddit monitoring (#24), Google Q&A seeding (#26), before/after photo pipeline (#27). |

---

*Strategies removed for legal/platform risk: AI voice calling to consumers without disclosure (#5 original), fake Nextdoor neighbor personas (#8 original), burner domain cold email engine (#4 original), LinkedIn automation (#7 original).*
