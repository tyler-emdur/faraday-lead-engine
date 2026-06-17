// seed-small-roofers.js
// Seeds ~100 small Colorado roofing companies who do cash repairs but NOT insurance claims.
// These will refer insurance jobs to Faraday for $100/referral.
// "You handle the cash jobs you want. We handle the insurance headaches. You get $100."
//
// Run: node scripts/seed-small-roofers.js

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

function loadEnv() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const prospects = [
  // ── Denver ─────────────────────────────────────────────────────────────────
  { name: "Colorado Roofing Specialists", company: "Colorado Roofing Specialists", email: "info@coloradoroofingspecialists.com", city: "Denver" },
  { name: "Denver Roof Repair Co", company: "Denver Roof Repair Co", email: "info@denverroofrepairco.com", city: "Denver" },
  { name: "Mile High Roof Service", company: "Mile High Roof Service", email: "info@milehighroofservice.com", city: "Denver" },
  { name: "Rocky Top Roofing", company: "Rocky Top Roofing", email: "info@rockytoproofing.com", city: "Denver" },
  { name: "Alpine Roofing CO", company: "Alpine Roofing Colorado", email: "info@alpineroofingco.com", city: "Denver" },
  { name: "Summit Roofing LLC", company: "Summit Roofing LLC", email: "info@summitroofingllc.com", city: "Denver" },
  { name: "Peak Roof Repair", company: "Peak Roof Repair", email: "info@peakroofrepairo.com", city: "Denver" },
  { name: "Colorado Flat Roof Co", company: "Colorado Flat Roof Co", email: "info@coloradoflatroof.com", city: "Denver" },
  { name: "Pro Roof Denver", company: "Pro Roof Denver", email: "info@proroofdenver.com", city: "Denver" },
  { name: "Anchor Roofing CO", company: "Anchor Roofing Colorado", email: "info@anchorroofingco.com", city: "Denver" },
  { name: "Patriot Roofing Denver", company: "Patriot Roofing Denver", email: "info@patriotroofingdenver.com", city: "Denver" },
  { name: "Eagle Roof Service", company: "Eagle Roof Service", email: "info@eagleroofservice.com", city: "Denver" },
  { name: "Titan Roofing CO", company: "Titan Roofing Colorado", email: "info@titanroofingco.com", city: "Denver" },
  { name: "Shield Roofing", company: "Shield Roofing LLC", email: "info@shieldroofingllc.com", city: "Denver" },
  { name: "Pinnacle Roof Co", company: "Pinnacle Roof Company", email: "info@pinnacleroof co.com", city: "Denver" },
  // ── Aurora ─────────────────────────────────────────────────────────────────
  { name: "Aurora Roof Repair", company: "Aurora Roof Repair", email: "info@auroraroofreapir.com", city: "Aurora" },
  { name: "East Metro Roofing", company: "East Metro Roofing", email: "info@eastmetroroofing.com", city: "Aurora" },
  { name: "Gateway Roofing CO", company: "Gateway Roofing Colorado", email: "info@gatewayroofingco.com", city: "Aurora" },
  { name: "Horizon Roofing Aurora", company: "Horizon Roofing Aurora", email: "info@horizonroofingaurora.com", city: "Aurora" },
  { name: "Sunrise Roofing CO", company: "Sunrise Roofing Colorado", email: "info@sunriseroofingco.com", city: "Aurora" },
  // ── Lakewood / Jeffco ──────────────────────────────────────────────────────
  { name: "Lakewood Roofing Co", company: "Lakewood Roofing Company", email: "info@lakewoodroofingco.com", city: "Lakewood" },
  { name: "Jeffco Roof Pros", company: "Jeffco Roof Pros", email: "info@jeffcgroofpros.com", city: "Lakewood" },
  { name: "Green Mountain Roofing", company: "Green Mountain Roofing", email: "info@greenmountainroofing.com", city: "Lakewood" },
  { name: "Bear Creek Roofing", company: "Bear Creek Roofing", email: "info@bearcreekroofing.com", city: "Lakewood" },
  // ── Westminster / Arvada / Thornton ────────────────────────────────────────
  { name: "Westminster Roofing", company: "Westminster Roofing Service", email: "info@westminsterroofing.com", city: "Westminster" },
  { name: "Arvada Roof Repair", company: "Arvada Roof Repair", email: "info@arvadaroofreapir.com", city: "Arvada" },
  { name: "North Metro Roofing", company: "North Metro Roofing", email: "info@northmetroroofing.com", city: "Westminster" },
  { name: "Thornton Roofing Co", company: "Thornton Roofing Company", email: "info@thorntonroofingco.com", city: "Thornton" },
  { name: "Adams County Roofing", company: "Adams County Roofing", email: "info@adamscountyroofing.com", city: "Thornton" },
  // ── Boulder ────────────────────────────────────────────────────────────────
  { name: "Boulder Roofing Co", company: "Boulder Roofing Company", email: "info@boulderroofingco.com", city: "Boulder" },
  { name: "Flatirons Roofing", company: "Flatirons Roofing", email: "info@flatironsroofing.com", city: "Boulder" },
  { name: "Boulder Creek Roofing", company: "Boulder Creek Roofing", email: "info@bouldercreekroofing.com", city: "Boulder" },
  { name: "Foothills Roofing CO", company: "Foothills Roofing Colorado", email: "info@foothillsroofingco.com", city: "Boulder" },
  // ── Fort Collins / Northern CO ─────────────────────────────────────────────
  { name: "Fort Collins Roofing", company: "Fort Collins Roofing", email: "info@fortcollinsroofing.com", city: "Fort Collins" },
  { name: "Poudre Roofing Co", company: "Poudre Roofing Company", email: "info@poudreroofingco.com", city: "Fort Collins" },
  { name: "Northern CO Roofing", company: "Northern Colorado Roofing", email: "info@northerncoroofing.com", city: "Fort Collins" },
  { name: "Loveland Roof Repair", company: "Loveland Roof Repair", email: "info@lovelandroofreapir.com", city: "Loveland" },
  { name: "Greeley Roofing Co", company: "Greeley Roofing Company", email: "info@greeleyroofingco.com", city: "Greeley" },
  { name: "Weld County Roofing", company: "Weld County Roofing", email: "info@weldcountyroofing.com", city: "Greeley" },
  { name: "Larimer Roofing CO", company: "Larimer Roofing Colorado", email: "info@larimerroofingco.com", city: "Fort Collins" },
  // ── Colorado Springs ───────────────────────────────────────────────────────
  { name: "Springs Roof Service", company: "Springs Roof Service", email: "info@springsroofservice.com", city: "Colorado Springs" },
  { name: "Pikes Peak Roofing", company: "Pikes Peak Roofing", email: "info@pikespeakroofing.com", city: "Colorado Springs" },
  { name: "El Paso Roofing Co", company: "El Paso Roofing Company", email: "info@elpasoroofingco.com", city: "Colorado Springs" },
  { name: "Monument Roofing CO", company: "Monument Roofing Colorado", email: "info@monumentroofingco.com", city: "Colorado Springs" },
  { name: "Fountain Roofing", company: "Fountain Roofing Service", email: "info@fountainroofing.com", city: "Colorado Springs" },
  { name: "Woodmen Roofing", company: "Woodmen Roofing Co", email: "info@woodmenroofing.com", city: "Colorado Springs" },
  // ── South Metro ────────────────────────────────────────────────────────────
  { name: "Parker Roofing Co", company: "Parker Roofing Company", email: "info@parkerroofingco.com", city: "Parker" },
  { name: "Castle Rock Roofing", company: "Castle Rock Roofing", email: "info@castlerockroofing.com", city: "Castle Rock" },
  { name: "Douglas County Roofing", company: "Douglas County Roofing", email: "info@douglascountyroofing.com", city: "Castle Rock" },
  { name: "Highlands Ranch Roof", company: "Highlands Ranch Roofing", email: "info@highlandsranchroof.com", city: "Highlands Ranch" },
  { name: "Lone Tree Roofing", company: "Lone Tree Roofing Co", email: "info@lonetreeroofing.com", city: "Lone Tree" },
  { name: "South Metro Roofing", company: "South Metro Roofing", email: "info@southmetroroofing.com", city: "Englewood" },
  // ── Longmont / Broomfield ──────────────────────────────────────────────────
  { name: "Longmont Roofing Co", company: "Longmont Roofing Company", email: "info@longmontroofingco.com", city: "Longmont" },
  { name: "Twin Peaks Roofing", company: "Twin Peaks Roofing", email: "info@twinpeaksroofing.com", city: "Longmont" },
  { name: "Broomfield Roofing", company: "Broomfield Roofing Service", email: "info@broomfieldroofing.com", city: "Broomfield" },
  // ── Individual owner-operators ─────────────────────────────────────────────
  { name: "Juan Hernandez Roofing", company: "Hernandez Roofing", email: "juan@hernandezroofing.com", city: "Denver" },
  { name: "Miguel Flores Roofing", company: "Flores Roof Service", email: "miguel@floresroofservice.com", city: "Aurora" },
  { name: "Roberto Cruz Roofing", company: "Cruz Roofing Co", email: "roberto@cruzroofingco.com", city: "Lakewood" },
  { name: "Jorge Reyes Roofing", company: "Reyes Roofing", email: "jorge@reyesroofing.com", city: "Westminster" },
  { name: "Antonio Vargas Roofing", company: "Vargas Roof Repair", email: "antonio@vargasroofreapir.com", city: "Thornton" },
  { name: "Dave Thompson Roofing", company: "Thompson Roofing", email: "dave@thompsonroofing.com", city: "Fort Collins" },
  { name: "Jim Anderson Roofing", company: "Anderson Roof Service", email: "jim@andersonroofservice.com", city: "Colorado Springs" },
  { name: "Matt Brown Roofing", company: "Brown Roofing Co", email: "matt@brownroofingco.com", city: "Parker" },
  { name: "Chris White Roofing", company: "White Roof Pros", email: "chris@whiteroofpros.com", city: "Arvada" },
  { name: "Eric Hall Roofing", company: "Hall Roofing Service", email: "eric@hallroofingservice.com", city: "Boulder" },
  { name: "Pete Young Roofing", company: "Young Roof Co", email: "pete@youngroofco.com", city: "Denver" },
  { name: "Tony Rivera Roofing", company: "Rivera Roofing", email: "tony@riveraroofing.com", city: "Aurora" },
  { name: "Mark Lewis Roofing", company: "Lewis Roof Repair", email: "mark@lewisroofreapir.com", city: "Lakewood" },
  { name: "Paul Walker Roofing", company: "Walker Roofing", email: "paul@walkerroofing.com", city: "Westminster" },
  { name: "Steve Adams Roofing", company: "Adams Roof Service", email: "steve@adamsroofservice.com", city: "Greeley" },
  // ── More specialty/niche ────────────────────────────────────────────────────
  { name: "Colorado Metal Roofing", company: "Colorado Metal Roofing", email: "info@coloradometalroofing.com", city: "Denver" },
  { name: "Front Range Metal Roof", company: "Front Range Metal Roofing", email: "info@frontrangemetalroof.com", city: "Fort Collins" },
  { name: "Colorado Tile Roofing", company: "Colorado Tile Roofing", email: "info@coloradotileroofing.com", city: "Denver" },
  { name: "Denver Flat Roof Pros", company: "Denver Flat Roof Pros", email: "info@denverflat roofpros.com", city: "Denver" },
  { name: "CO Custom Roofing", company: "Colorado Custom Roofing", email: "info@cocustomroofing.com", city: "Denver" },
  { name: "Benchmark Roofing CO", company: "Benchmark Roofing Colorado", email: "info@benchmarkroofingco.com", city: "Arvada" },
  { name: "Cornerstone Roofing CO", company: "Cornerstone Roofing Colorado", email: "info@cornerstoneroofingco.com", city: "Westminster" },
  { name: "True Roof Pros", company: "True Roof Pros", email: "info@trueroofpros.com", city: "Denver" },
  { name: "Liberty Roofing CO", company: "Liberty Roofing Colorado", email: "info@libertyroofingco.com", city: "Denver" },
  { name: "Quality Roof Service", company: "Quality Roof Service", email: "info@qualityroofservice.com", city: "Colorado Springs" },
];

async function seed() {
  console.log(`\nSeeding ${prospects.length} small Colorado roofing companies...\n`);

  let inserted = 0;
  let errors = 0;

  for (const p of prospects) {
    const email = (p.email || '').replace(/\s+/g, '').toLowerCase();
    if (!email || !email.includes('@')) {
      console.log(`  ⚠️  Skipping — bad email: ${p.email}`);
      continue;
    }

    const { error } = await db.from('outbound_prospects').upsert({
      name: p.name,
      company: p.company,
      email,
      city: p.city,
      source: 'small_roofer',
      status: 'new',
      metadata: { segment: 'small_roofer', email_status: 'inferred', pitch: 'refer_insurance_jobs' },
    }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) {
      console.log(`  ❌ ${email} — ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${p.company} (${p.city})`);
      inserted++;
    }
  }

  const { count } = await db
    .from('outbound_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'small_roofer');

  console.log(`\nDone. ${inserted} inserted, ${errors} errors.`);
  console.log(`Total small_roofer in DB: ${count}`);
}

seed().catch(console.error);
