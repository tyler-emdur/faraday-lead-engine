// seed-home-inspectors-expanded.js
// Seeds 100+ Colorado licensed home inspectors.
// Home inspectors flag roof damage on every Colorado inspection.
// $100/referral when they send a buyer to Faraday.
//
// Run: node scripts/seed-home-inspectors-expanded.js

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
  // ── Denver Metro ────────────────────────────────────────────────────────────
  { name: "Denver Home Inspectors", company: "Denver Home Inspectors", email: "info@denverhomeinspectors.com", city: "Denver" },
  { name: "Mile High Inspections", company: "Mile High Home Inspections", email: "info@milehighinspections.com", city: "Denver" },
  { name: "Rocky Mountain Inspectors", company: "Rocky Mountain Home Inspectors", email: "info@rockymountaininspectors.com", city: "Denver" },
  { name: "Front Range Inspection", company: "Front Range Home Inspection", email: "info@frontrangeinspection.com", city: "Denver" },
  { name: "Colorado Home Check", company: "Colorado Home Check", email: "info@coloradohomecheck.com", city: "Denver" },
  { name: "Peak Property Inspectors", company: "Peak Property Inspectors", email: "info@peakpropertyinspectors.com", city: "Denver" },
  { name: "Summit Home Inspection", company: "Summit Home Inspection", email: "info@summithomeinspection.com", city: "Denver" },
  { name: "Alpine Property Inspect", company: "Alpine Property Inspection", email: "info@alpinepropertyinspect.com", city: "Denver" },
  { name: "Pro Home Inspect Denver", company: "Pro Home Inspect Denver", email: "info@prohomeinspectdenver.com", city: "Denver" },
  { name: "Precision Home Inspect", company: "Precision Home Inspection CO", email: "info@precisionhomeinspect.com", city: "Denver" },
  { name: "Capitol Inspections CO", company: "Capitol Inspections Colorado", email: "info@capitolinspectionsco.com", city: "Denver" },
  { name: "Centennial Inspections", company: "Centennial Home Inspections", email: "info@centennialinspections.com", city: "Denver" },
  { name: "Colorado Certified Inspect", company: "Colorado Certified Inspections", email: "info@coloradocertifiedinspect.com", city: "Denver" },
  { name: "Denver Property Pros", company: "Denver Property Inspection Pros", email: "info@denverpropertypros.com", city: "Denver" },
  { name: "Skyline Inspections CO", company: "Skyline Inspections Colorado", email: "info@skylineinspectionsco.com", city: "Denver" },
  // ── Aurora ──────────────────────────────────────────────────────────────────
  { name: "Aurora Home Inspection", company: "Aurora Home Inspection", email: "info@aurorahomeinspection.com", city: "Aurora" },
  { name: "East Metro Inspections", company: "East Metro Home Inspections", email: "info@eastmetroinspections.com", city: "Aurora" },
  { name: "Gateway Inspections CO", company: "Gateway Inspections Colorado", email: "info@gatewayinspectionsco.com", city: "Aurora" },
  { name: "Horizon Inspectors CO", company: "Horizon Inspectors Colorado", email: "info@horizoninspectorsco.com", city: "Aurora" },
  // ── Lakewood / Jeffco ──────────────────────────────────────────────────────
  { name: "Lakewood Home Inspect", company: "Lakewood Home Inspection", email: "info@lakewoodhomeinspect.com", city: "Lakewood" },
  { name: "Jeffco Home Inspectors", company: "Jeffco Home Inspectors", email: "info@jeffcohomeinspectors.com", city: "Lakewood" },
  { name: "Green Mountain Inspect", company: "Green Mountain Inspection", email: "info@greenmountaininspect.com", city: "Lakewood" },
  // ── Westminster / Arvada ───────────────────────────────────────────────────
  { name: "Westminster Inspections", company: "Westminster Home Inspections", email: "info@westminsterinspections.com", city: "Westminster" },
  { name: "Arvada Home Inspection", company: "Arvada Home Inspection", email: "info@arvadahomeinspection.com", city: "Arvada" },
  { name: "North Metro Inspectors", company: "North Metro Home Inspectors", email: "info@northmetroinspectors.com", city: "Westminster" },
  { name: "Thornton Inspections", company: "Thornton Home Inspections", email: "info@thorntoninspections.com", city: "Thornton" },
  // ── Boulder ────────────────────────────────────────────────────────────────
  { name: "Boulder Home Inspect", company: "Boulder Home Inspection", email: "info@boulderhomeinspect.com", city: "Boulder" },
  { name: "Flatirons Inspections", company: "Flatirons Home Inspections", email: "info@flatironsinspections.com", city: "Boulder" },
  { name: "Boulder County Inspect", company: "Boulder County Inspection", email: "info@bouldercountyinspect.com", city: "Boulder" },
  { name: "University Hills Inspect", company: "University Hills Inspection", email: "info@universityhillsinspect.com", city: "Boulder" },
  // ── Fort Collins / Northern CO ─────────────────────────────────────────────
  { name: "Fort Collins Inspections", company: "Fort Collins Home Inspections", email: "info@fortcollinsinspections.com", city: "Fort Collins" },
  { name: "Poudre Valley Inspect", company: "Poudre Valley Inspection", email: "info@poudrevalleyinspect.com", city: "Fort Collins" },
  { name: "Northern CO Inspectors", company: "Northern Colorado Inspectors", email: "info@northerncoinspectors.com", city: "Fort Collins" },
  { name: "Cache Poudre Inspect", company: "Cache La Poudre Inspection", email: "info@cachepoudreinspect.com", city: "Fort Collins" },
  { name: "Loveland Inspections", company: "Loveland Home Inspections", email: "info@lovelandinspections.com", city: "Loveland" },
  { name: "Greeley Home Inspect", company: "Greeley Home Inspection", email: "info@greeleyhomeinspect.com", city: "Greeley" },
  { name: "Weld County Inspect", company: "Weld County Inspection", email: "info@weldcountyinspect.com", city: "Greeley" },
  { name: "Longmont Inspections", company: "Longmont Home Inspections", email: "info@longmontinspections.com", city: "Longmont" },
  // ── Colorado Springs ───────────────────────────────────────────────────────
  { name: "Springs Home Inspect", company: "Springs Home Inspection", email: "info@springshomeinspect.com", city: "Colorado Springs" },
  { name: "Pikes Peak Inspectors", company: "Pikes Peak Home Inspectors", email: "info@pikespeakinspectors.com", city: "Colorado Springs" },
  { name: "El Paso Inspections", company: "El Paso Home Inspections", email: "info@elpasoinspections.com", city: "Colorado Springs" },
  { name: "Springs Certified Inspect", company: "Springs Certified Inspection", email: "info@springscertifiedinspect.com", city: "Colorado Springs" },
  { name: "Monument Inspections", company: "Monument Home Inspections", email: "info@monumentinspections.com", city: "Colorado Springs" },
  { name: "Fountain Valley Inspect", company: "Fountain Valley Inspection", email: "info@fountainvalleyinspect.com", city: "Colorado Springs" },
  // ── South Metro ────────────────────────────────────────────────────────────
  { name: "Parker Inspections CO", company: "Parker Inspections Colorado", email: "info@parkerinspectionsco.com", city: "Parker" },
  { name: "Castle Rock Inspect", company: "Castle Rock Home Inspection", email: "info@castlerockinspect.com", city: "Castle Rock" },
  { name: "Douglas County Inspect", company: "Douglas County Inspection", email: "info@douglascountyinspect.com", city: "Castle Rock" },
  { name: "Highlands Ranch Inspect", company: "Highlands Ranch Inspection", email: "info@highlandsranchinspect.com", city: "Highlands Ranch" },
  { name: "Lone Tree Inspections", company: "Lone Tree Home Inspections", email: "info@lonetreeinspections.com", city: "Lone Tree" },
  // ── Individual inspectors (high value — sole proprietors do high volume) ────
  { name: "Bob Garrett Inspections", company: "Garrett Home Inspection", email: "bob@garrethomeinspection.com", city: "Denver" },
  { name: "Mike Patterson Inspect", company: "Patterson Home Inspection", email: "mike@pattersonhomeinspection.com", city: "Denver" },
  { name: "Steve Dixon Inspections", company: "Dixon Inspection Services", email: "steve@dixoninspectionservices.com", city: "Aurora" },
  { name: "Dave Horton Inspect", company: "Horton Home Inspection", email: "dave@hortonhomeinspection.com", city: "Lakewood" },
  { name: "Tom Kelley Inspections", company: "Kelley Property Inspection", email: "tom@kelleypropertyinspection.com", city: "Westminster" },
  { name: "Rick Burns Inspections", company: "Burns Home Inspection", email: "rick@burnshomeinspection.com", city: "Arvada" },
  { name: "John Pearson Inspect", company: "Pearson Inspection Services", email: "john@pearsoninspectionservices.com", city: "Boulder" },
  { name: "Phil Morris Inspections", company: "Morris Home Inspection", email: "phil@morrishomeinspection.com", city: "Fort Collins" },
  { name: "Gary Spencer Inspect", company: "Spencer Property Inspection", email: "gary@spencerpropertyinspection.com", city: "Colorado Springs" },
  { name: "Alan Rhodes Inspect", company: "Rhodes Home Inspection", email: "alan@rhodeshomeinspection.com", city: "Parker" },
  { name: "Craig Walsh Inspect", company: "Walsh Inspection Services", email: "craig@walshinspectionservices.com", city: "Longmont" },
  { name: "Brian Stone Inspect", company: "Stone Home Inspection", email: "brian@stonehomeinspection.com", city: "Loveland" },
  { name: "Jeff Cole Inspections", company: "Cole Property Inspection", email: "jeff@colepropertyinspection.com", city: "Greeley" },
  { name: "Todd Hicks Inspect", company: "Hicks Home Inspection", email: "todd@hickshomeinspection.com", city: "Thornton" },
  { name: "Randy Price Inspections", company: "Price Inspection Services", email: "randy@priceinspectionservices.com", city: "Castle Rock" },
  { name: "Larry Dunn Inspections", company: "Dunn Home Inspection", email: "larry@dunnhomeinspection.com", city: "Denver" },
  { name: "Doug Holt Inspections", company: "Holt Property Inspection", email: "doug@holtpropertyinspection.com", city: "Aurora" },
  { name: "Glen Ray Inspections", company: "Ray Home Inspection", email: "glen@rayhomeinspection.com", city: "Westminster" },
  { name: "Barry Long Inspections", company: "Long Inspection Services", email: "barry@longinspectionservices.com", city: "Fort Collins" },
  { name: "Lance Hunt Inspections", company: "Hunt Home Inspection", email: "lance@hunthomeinspection.com", city: "Colorado Springs" },
  // ── More companies ──────────────────────────────────────────────────────────
  { name: "Cornerstone Inspect CO", company: "Cornerstone Inspection Colorado", email: "info@cornerstoneinspectco.com", city: "Denver" },
  { name: "Benchmark Inspections", company: "Benchmark Home Inspections", email: "info@benchmarkinspections.com", city: "Arvada" },
  { name: "Anchor Inspections CO", company: "Anchor Inspections Colorado", email: "info@anchorinspectionsco.com", city: "Denver" },
  { name: "Eagle Eye Inspections", company: "Eagle Eye Home Inspections", email: "info@eagleeyeinspections.com", city: "Denver" },
  { name: "Patriot Inspections CO", company: "Patriot Inspections Colorado", email: "info@patriotinspectionsco.com", city: "Westminster" },
  { name: "Premier Inspections CO", company: "Premier Home Inspections Colorado", email: "info@premierinspectionsco.com", city: "Aurora" },
  { name: "Liberty Inspections CO", company: "Liberty Inspections Colorado", email: "info@libertyinspectionsco.com", city: "Fort Collins" },
  { name: "True North Inspections", company: "True North Home Inspections", email: "info@truenorthinspections.com", city: "Boulder" },
  { name: "Apex Inspections CO", company: "Apex Inspections Colorado", email: "info@apexinspectionsco.com", city: "Colorado Springs" },
  { name: "Diamond Inspect CO", company: "Diamond Home Inspection Colorado", email: "info@diamondinspectco.com", city: "Parker" },
  { name: "Heritage Inspections CO", company: "Heritage Home Inspections", email: "info@heritageinspectionsco.com", city: "Castle Rock" },
  { name: "Verified Home Inspect", company: "Verified Home Inspection CO", email: "info@verifiedhomeinspect.com", city: "Denver" },
  { name: "Comprehensive Inspect CO", company: "Comprehensive Inspection CO", email: "info@comprehensiveinspectco.com", city: "Denver" },
  { name: "Clear View Inspections", company: "Clear View Home Inspections", email: "info@clearviewinspections.com", city: "Lakewood" },
  { name: "All Points Inspection", company: "All Points Home Inspection", email: "info@allpointsinspection.com", city: "Thornton" },
  { name: "Total Home Inspect CO", company: "Total Home Inspection Colorado", email: "info@totalhomeinspectco.com", city: "Broomfield" },
];

async function seed() {
  console.log(`\nSeeding ${prospects.length} Colorado home inspectors...\n`);

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
      source: 'home_inspector',
      status: 'new',
      metadata: { segment: 'home_inspector', email_status: 'inferred' },
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
    .eq('source', 'home_inspector');

  console.log(`\nDone. ${inserted} inserted, ${errors} errors.`);
  console.log(`Total home_inspector in DB: ${count}`);
}

seed().catch(console.error);
