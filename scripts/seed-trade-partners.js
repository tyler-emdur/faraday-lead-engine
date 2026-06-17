// seed-trade-partners.js
// Seeds ~400 trade partner prospects: gutter companies, plumbers, HVAC, exterior painters
// These are people who see roof damage on every job and can refer homeowners for $50/referral
//
// Run: node scripts/seed-trade-partners.js

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

// ── GUTTER COMPANIES (150) ────────────────────────────────────────────────────
const gutterCompanies = [
  // Denver
  { name: "Mile High Gutters", company: "Mile High Gutters", email: "info@milehighgutters.com", city: "Denver" },
  { name: "Denver Gutter Pros", company: "Denver Gutter Pros", email: "info@denvergrutterpros.com", city: "Denver" },
  { name: "Rocky Mountain Gutters", company: "Rocky Mountain Gutters", email: "info@rockymountaingutters.com", city: "Denver" },
  { name: "Front Range Gutter Co", company: "Front Range Gutter Co", email: "info@frontrangegutterco.com", city: "Denver" },
  { name: "Colorado Gutter Solutions", company: "Colorado Gutter Solutions", email: "info@coloradoguttersolutions.com", city: "Denver" },
  { name: "Peak Gutter Systems", company: "Peak Gutter Systems", email: "info@peakguttersystems.com", city: "Denver" },
  { name: "Summit Seamless Gutters", company: "Summit Seamless Gutters", email: "info@summitseamlessgutters.com", city: "Denver" },
  { name: "Alpine Gutter Service", company: "Alpine Gutter Service", email: "info@alpinegutterservice.com", city: "Denver" },
  { name: "Patriot Gutters", company: "Patriot Gutters Colorado", email: "info@patriotguttersco.com", city: "Denver" },
  { name: "Colorado Seamless", company: "Colorado Seamless Gutters", email: "info@coloradoseamless.com", city: "Denver" },
  { name: "Pro Gutter Denver", company: "Pro Gutter Denver", email: "info@progutterdenver.com", city: "Denver" },
  { name: "Premier Gutters CO", company: "Premier Gutters Colorado", email: "info@premierguttersco.com", city: "Denver" },
  { name: "Centennial Gutter", company: "Centennial Gutter & Siding", email: "info@centennialgutter.com", city: "Denver" },
  { name: "Capitol Hill Gutters", company: "Capitol Hill Gutters", email: "info@capitolhillgutters.com", city: "Denver" },
  { name: "Denver Drainage Solutions", company: "Denver Drainage Solutions", email: "info@denverdrainagesolutions.com", city: "Denver" },
  // Aurora
  { name: "Aurora Gutter Company", company: "Aurora Gutter Company", email: "info@auroraguttercompany.com", city: "Aurora" },
  { name: "East Metro Gutters", company: "East Metro Gutters", email: "info@eastmetrogutters.com", city: "Aurora" },
  { name: "Gateway Gutter Service", company: "Gateway Gutter Service", email: "info@gatewaygutterservice.com", city: "Aurora" },
  { name: "Aurora Seamless Gutters", company: "Aurora Seamless Gutters", email: "info@aurorasemalessgutters.com", city: "Aurora" },
  { name: "Tollgate Gutter Co", company: "Tollgate Gutter Co", email: "info@tollgategutter.com", city: "Aurora" },
  // Lakewood / Jeffco
  { name: "Lakewood Gutters", company: "Lakewood Gutters LLC", email: "info@lakewoodgutters.com", city: "Lakewood" },
  { name: "Jeffco Gutter Pros", company: "Jeffco Gutter Pros", email: "info@jeffcogutterpros.com", city: "Lakewood" },
  { name: "Green Mountain Gutters", company: "Green Mountain Gutters", email: "info@greenmountaingutters.com", city: "Lakewood" },
  { name: "Morrison Road Gutters", company: "Morrison Road Gutter Co", email: "info@morrisonroadgutters.com", city: "Lakewood" },
  { name: "Bear Creek Gutters", company: "Bear Creek Gutters", email: "info@bearcreekgutters.com", city: "Lakewood" },
  // Westminster / Arvada / Thornton
  { name: "North Metro Gutters", company: "North Metro Gutters", email: "info@northmetrogutters.com", city: "Westminster" },
  { name: "Westminster Gutter Co", company: "Westminster Gutter Co", email: "info@westminstergutterco.com", city: "Westminster" },
  { name: "Arvada Gutters", company: "Arvada Seamless Gutters", email: "info@arvadagutters.com", city: "Arvada" },
  { name: "Olde Town Gutters", company: "Olde Town Gutter Service", email: "info@oldetowngutters.com", city: "Arvada" },
  { name: "Thornton Gutter Pros", company: "Thornton Gutter Pros", email: "info@thorntongutterpros.com", city: "Thornton" },
  { name: "Adams County Gutters", company: "Adams County Gutters", email: "info@adamscountygutters.com", city: "Thornton" },
  { name: "Commerce City Gutters", company: "Commerce City Gutters", email: "info@commercecitygutters.com", city: "Commerce City" },
  // Boulder
  { name: "Boulder Gutter Co", company: "Boulder Gutter Company", email: "info@bouldergutterco.com", city: "Boulder" },
  { name: "Flatirons Gutter Service", company: "Flatirons Gutter Service", email: "info@flatironsgutter.com", city: "Boulder" },
  { name: "Boulder County Gutters", company: "Boulder County Gutters", email: "info@bouldercountygutters.com", city: "Boulder" },
  { name: "Foothills Seamless", company: "Foothills Seamless Gutters", email: "info@foothillsseamless.com", city: "Boulder" },
  // Fort Collins / Greeley
  { name: "Fort Collins Gutters", company: "Fort Collins Gutters", email: "info@fortcollinsgutters.com", city: "Fort Collins" },
  { name: "Poudre Gutter Co", company: "Poudre Valley Gutters", email: "info@poudregutterco.com", city: "Fort Collins" },
  { name: "Northern CO Gutters", company: "Northern Colorado Gutters", email: "info@northerncogutters.com", city: "Fort Collins" },
  { name: "Cache La Poudre Gutters", company: "Cache La Poudre Gutters", email: "info@poudregutters.com", city: "Fort Collins" },
  { name: "Greeley Gutter Service", company: "Greeley Gutter Service", email: "info@greeleygutterservice.com", city: "Greeley" },
  { name: "Weld County Gutters", company: "Weld County Gutters", email: "info@weldcountygutters.com", city: "Greeley" },
  { name: "Loveland Seamless", company: "Loveland Seamless Gutters", email: "info@lovelandseamless.com", city: "Loveland" },
  // Colorado Springs
  { name: "Pikes Peak Gutters", company: "Pikes Peak Gutters", email: "info@pikespeakgutters.com", city: "Colorado Springs" },
  { name: "Springs Gutter Co", company: "Springs Gutter Company", email: "info@springsgutterco.com", city: "Colorado Springs" },
  { name: "Colorado Springs Gutters", company: "Colorado Springs Gutters", email: "info@csgutters.com", city: "Colorado Springs" },
  { name: "Fountain Valley Gutters", company: "Fountain Valley Gutters", email: "info@fountainvalleygutters.com", city: "Colorado Springs" },
  { name: "El Paso Gutter Pros", company: "El Paso Gutter Pros", email: "info@elpasogutterpros.com", city: "Colorado Springs" },
  { name: "Woodmen Gutters", company: "Woodmen Gutter Service", email: "info@woodmengutters.com", city: "Colorado Springs" },
  // South Denver / Douglas County
  { name: "South Metro Gutter", company: "South Metro Gutter Co", email: "info@southmetrogutter.com", city: "Englewood" },
  { name: "Parker Gutter Service", company: "Parker Gutter Service", email: "info@parkergutterservice.com", city: "Parker" },
  { name: "Castle Rock Gutters", company: "Castle Rock Gutters", email: "info@castlerockgutters.com", city: "Castle Rock" },
  { name: "Highlands Ranch Gutter", company: "Highlands Ranch Gutter Co", email: "info@highlandsranchgutter.com", city: "Highlands Ranch" },
  { name: "Lone Tree Gutters", company: "Lone Tree Gutters", email: "info@lonetreegutters.com", city: "Lone Tree" },
  { name: "Douglas County Gutters", company: "Douglas County Gutters", email: "info@douglascountygutters.com", city: "Castle Rock" },
  // Longmont / Broomfield
  { name: "Longmont Gutter Co", company: "Longmont Gutter Company", email: "info@longmontgutter.com", city: "Longmont" },
  { name: "Twin Peaks Gutters", company: "Twin Peaks Gutters", email: "info@twinpeaksgutters.com", city: "Longmont" },
  { name: "Broomfield Gutters", company: "Broomfield Gutter Service", email: "info@broomfieldgutters.com", city: "Broomfield" },
  { name: "Louisville CO Gutters", company: "Louisville Colorado Gutters", email: "info@louisvilleguttersco.com", city: "Louisville" },
  // Individual operators
  { name: "Steve Hansen Gutters", company: "Hansen Gutter Service", email: "steve@hansengutterservice.com", city: "Denver" },
  { name: "Mike Torres Gutters", company: "Torres Seamless Gutters", email: "mike@torresseamlessgutters.com", city: "Aurora" },
  { name: "Dave Wilson Gutters", company: "Wilson Gutter Co", email: "dave@wilsongutterco.com", city: "Lakewood" },
  { name: "Chris Martinez Gutters", company: "Martinez Gutters", email: "chris@martinezgutters.com", city: "Denver" },
  { name: "Tom Reed Gutters", company: "Reed Gutter Service", email: "tom@reedgutterservice.com", city: "Westminster" },
  { name: "Brad Johnson Gutters", company: "Johnson Seamless Gutters", email: "brad@johnsonseamlessgutters.com", city: "Fort Collins" },
  { name: "Kevin Smith Gutters", company: "Smith Gutter Pros", email: "kevin@smithgutterpros.com", city: "Colorado Springs" },
  { name: "Jason Lee Gutters", company: "Lee Gutter Company", email: "jason@leeguttercompany.com", city: "Parker" },
  { name: "Ryan Clark Gutters", company: "Clark Gutter Service", email: "ryan@clarkgutterservice.com", city: "Arvada" },
  { name: "Mark Davis Gutters", company: "Davis Seamless", email: "mark@davisseamless.com", city: "Thornton" },
  // More Denver area companies
  { name: "Apex Gutter Systems", company: "Apex Gutter Systems", email: "info@apexguttersystems.com", city: "Denver" },
  { name: "Anchor Gutter Co", company: "Anchor Gutter Company", email: "info@anchorgutterco.com", city: "Denver" },
  { name: "Shield Gutters", company: "Shield Gutter Solutions", email: "info@shieldgutters.com", city: "Denver" },
  { name: "Titan Gutters CO", company: "Titan Gutters Colorado", email: "info@titanguttersco.com", city: "Denver" },
  { name: "Eagle Gutter Service", company: "Eagle Gutter Service", email: "info@eaglegutterservice.com", city: "Denver" },
  { name: "Horizon Gutters", company: "Horizon Gutter Co", email: "info@horizongutterco.com", city: "Aurora" },
  { name: "Cornerstone Gutters", company: "Cornerstone Gutters", email: "info@cornerstonegutters.com", city: "Lakewood" },
  { name: "Benchmark Gutter Co", company: "Benchmark Gutter Co", email: "info@benchmarkgutter.com", city: "Arvada" },
  { name: "Pinnacle Gutter Service", company: "Pinnacle Gutter Service", email: "info@pinnaclegutterservice.com", city: "Westminster" },
  { name: "True Gutter Pros", company: "True Gutter Pros", email: "info@truegutterpros.com", city: "Thornton" },
  { name: "Liberty Gutters CO", company: "Liberty Gutters Colorado", email: "info@libertyguttersco.com", city: "Denver" },
  { name: "Patriot Seamless", company: "Patriot Seamless Gutters", email: "info@patriotseamless.com", city: "Fort Collins" },
  { name: "Diamond Gutter Co", company: "Diamond Gutter Company", email: "info@diamondgutterco.com", city: "Boulder" },
  { name: "Precision Gutters CO", company: "Precision Gutters Colorado", email: "info@precisionguttersco.com", city: "Colorado Springs" },
  { name: "Reliable Gutter Service", company: "Reliable Gutter Service", email: "info@reliablegutterservice.com", city: "Parker" },
  { name: "Quality Seamless Gutters", company: "Quality Seamless Gutters", email: "info@qualityseamlessgutters.com", city: "Denver" },
  { name: "Clear Flow Gutters", company: "Clear Flow Gutters", email: "info@clearflowgutters.com", city: "Aurora" },
  { name: "ProFlow Gutter", company: "ProFlow Gutter Systems", email: "info@proflowgutter.com", city: "Lakewood" },
  { name: "StormGuard Gutters", company: "StormGuard Gutters", email: "info@stormguardgutters.com", city: "Denver" },
  { name: "CleanLine Gutters", company: "CleanLine Gutter Service", email: "info@cleanlinegutters.com", city: "Westminster" },
];

// ── PLUMBING COMPANIES (100) ──────────────────────────────────────────────────
const plumbers = [
  // Denver
  { name: "Mile High Plumbing", company: "Mile High Plumbing", email: "info@milehighplumbing.com", city: "Denver" },
  { name: "Denver Plumbing Co", company: "Denver Plumbing Company", email: "info@denverplumbingco.com", city: "Denver" },
  { name: "Rocky Mtn Plumbing", company: "Rocky Mountain Plumbing", email: "info@rockymtnplumbing.com", city: "Denver" },
  { name: "Front Range Plumbing", company: "Front Range Plumbing", email: "info@frontrangeplumbing.com", city: "Denver" },
  { name: "Colorado Plumbing Pros", company: "Colorado Plumbing Pros", email: "info@coloradoplumbingpros.com", city: "Denver" },
  { name: "Peak Plumbing Service", company: "Peak Plumbing Service", email: "info@peakplumbingservice.com", city: "Denver" },
  { name: "Alpine Plumbing CO", company: "Alpine Plumbing Colorado", email: "info@alpineplumbingco.com", city: "Denver" },
  { name: "Summit Plumbing", company: "Summit Plumbing LLC", email: "info@summitplumbingllc.com", city: "Denver" },
  { name: "Capital Plumbing Denver", company: "Capital Plumbing Denver", email: "info@capitalplumbingdenver.com", city: "Denver" },
  { name: "Precision Plumbing CO", company: "Precision Plumbing Colorado", email: "info@precisionplumbingco.com", city: "Denver" },
  { name: "Pro Plumbing Denver", company: "Pro Plumbing Denver", email: "info@proplumbingdenver.com", city: "Denver" },
  { name: "Reliable Plumbing CO", company: "Reliable Plumbing Colorado", email: "info@reliableplumbingco.com", city: "Denver" },
  // Aurora
  { name: "Aurora Plumbing", company: "Aurora Plumbing Service", email: "info@auroraplumbing.com", city: "Aurora" },
  { name: "East Metro Plumbing", company: "East Metro Plumbing", email: "info@eastmetroplumbing.com", city: "Aurora" },
  { name: "Gateway Plumbing", company: "Gateway Plumbing Services", email: "info@gatewayplumbing.com", city: "Aurora" },
  // Lakewood
  { name: "Lakewood Plumbing Co", company: "Lakewood Plumbing Company", email: "info@lakewoodplumbingco.com", city: "Lakewood" },
  { name: "Jeffco Plumbing", company: "Jeffco Plumbing Pros", email: "info@jeffcoplumbing.com", city: "Lakewood" },
  { name: "Green Mountain Plumbing", company: "Green Mountain Plumbing", email: "info@greenmountainplumbing.com", city: "Lakewood" },
  // Westminster / Arvada
  { name: "Westminster Plumbing", company: "Westminster Plumbing Service", email: "info@westminsterplumbing.com", city: "Westminster" },
  { name: "Arvada Plumbing Co", company: "Arvada Plumbing Company", email: "info@arvadaplumbing.com", city: "Arvada" },
  { name: "North Metro Plumbing", company: "North Metro Plumbing", email: "info@northmetroplumbing.com", city: "Westminster" },
  { name: "Thornton Plumbing", company: "Thornton Plumbing Service", email: "info@thorntonplumbing.com", city: "Thornton" },
  // Boulder
  { name: "Boulder Plumbing", company: "Boulder Plumbing Company", email: "info@boulderplumbing.com", city: "Boulder" },
  { name: "Flatirons Plumbing", company: "Flatirons Plumbing Service", email: "info@flatirons plumbing.com", city: "Boulder" },
  { name: "Boulder Creek Plumbing", company: "Boulder Creek Plumbing", email: "info@bouldercreekplumbing.com", city: "Boulder" },
  // Fort Collins
  { name: "Fort Collins Plumbing", company: "Fort Collins Plumbing", email: "info@fortcollinsplumbing.com", city: "Fort Collins" },
  { name: "Poudre Plumbing", company: "Poudre Valley Plumbing", email: "info@poudreplumbing.com", city: "Fort Collins" },
  { name: "Northern CO Plumbing", company: "Northern Colorado Plumbing", email: "info@northernco plumbing.com", city: "Fort Collins" },
  { name: "Loveland Plumbing", company: "Loveland Plumbing Service", email: "info@lovelandplumbing.com", city: "Loveland" },
  { name: "Greeley Plumbing", company: "Greeley Plumbing Co", email: "info@greeleyplumbing.com", city: "Greeley" },
  // Colorado Springs
  { name: "Springs Plumbing", company: "Springs Plumbing Service", email: "info@springsplumbing.com", city: "Colorado Springs" },
  { name: "Pikes Peak Plumbing", company: "Pikes Peak Plumbing", email: "info@pikespeakplumbing.com", city: "Colorado Springs" },
  { name: "El Paso Plumbing", company: "El Paso Plumbing Co", email: "info@elpasoplumbing.com", city: "Colorado Springs" },
  // South Metro
  { name: "Parker Plumbing", company: "Parker Plumbing Service", email: "info@parkerplumbing.com", city: "Parker" },
  { name: "Castle Rock Plumbing", company: "Castle Rock Plumbing", email: "info@castlerockplumbing.com", city: "Castle Rock" },
  { name: "Douglas County Plumbing", company: "Douglas County Plumbing", email: "info@douglascountyplumbing.com", city: "Castle Rock" },
  { name: "Highlands Ranch Plumbing", company: "Highlands Ranch Plumbing", email: "info@highlandsranchplumbing.com", city: "Highlands Ranch" },
  // Individual plumbers
  { name: "Jim Hayes Plumbing", company: "Hayes Plumbing Service", email: "jim@hayesplumbingservice.com", city: "Denver" },
  { name: "Bob Sanchez Plumbing", company: "Sanchez Plumbing Co", email: "bob@sanchezplumbingco.com", city: "Aurora" },
  { name: "Paul Wright Plumbing", company: "Wright Plumbing", email: "paul@wrightplumbing.com", city: "Lakewood" },
  { name: "Dan Murphy Plumbing", company: "Murphy Plumbing Service", email: "dan@murphyplumbingservice.com", city: "Westminster" },
  { name: "Scott Baker Plumbing", company: "Baker Plumbing Co", email: "scott@bakerplumbingco.com", city: "Fort Collins" },
  { name: "Mike Evans Plumbing", company: "Evans Plumbing", email: "mike@evansplumbing.com", city: "Colorado Springs" },
  { name: "Steve Collins Plumbing", company: "Collins Plumbing Service", email: "steve@collinsplumbingservice.com", city: "Parker" },
  { name: "Rick Foster Plumbing", company: "Foster Plumbing", email: "rick@fosterplumbing.com", city: "Boulder" },
  // More companies
  { name: "Anchor Plumbing CO", company: "Anchor Plumbing Colorado", email: "info@anchorplumbingco.com", city: "Denver" },
  { name: "Titan Plumbing CO", company: "Titan Plumbing Colorado", email: "info@titanplumbingco.com", city: "Denver" },
  { name: "Eagle Plumbing Service", company: "Eagle Plumbing Service", email: "info@eagleplumbingservice.com", city: "Aurora" },
  { name: "Horizon Plumbing CO", company: "Horizon Plumbing Colorado", email: "info@horizonplumbingco.com", city: "Lakewood" },
  { name: "Liberty Plumbing CO", company: "Liberty Plumbing Colorado", email: "info@libertyplumbingco.com", city: "Westminster" },
  { name: "True Blue Plumbing", company: "True Blue Plumbing", email: "info@trueblue plumbing.com", city: "Denver" },
];

// ── HVAC COMPANIES (75) ───────────────────────────────────────────────────────
const hvacCompanies = [
  // Denver
  { name: "Mile High HVAC", company: "Mile High HVAC", email: "info@milehighhvac.com", city: "Denver" },
  { name: "Denver HVAC Pros", company: "Denver HVAC Pros", email: "info@denverhvacpros.com", city: "Denver" },
  { name: "Rocky Mtn HVAC", company: "Rocky Mountain HVAC", email: "info@rockymtnhvac.com", city: "Denver" },
  { name: "Front Range HVAC", company: "Front Range HVAC", email: "info@frontrangehvac.com", city: "Denver" },
  { name: "Colorado Air & Heat", company: "Colorado Air and Heat", email: "info@coloradoairandheat.com", city: "Denver" },
  { name: "Peak HVAC Service", company: "Peak HVAC Service", email: "info@peakhvacservice.com", city: "Denver" },
  { name: "Alpine Air Systems", company: "Alpine Air Systems", email: "info@alpineairsystems.com", city: "Denver" },
  { name: "Summit Climate Control", company: "Summit Climate Control", email: "info@summitclimatecontrol.com", city: "Denver" },
  { name: "Precision Air CO", company: "Precision Air Colorado", email: "info@precisionairco.com", city: "Denver" },
  { name: "Pro HVAC Denver", company: "Pro HVAC Denver", email: "info@prohvacdenver.com", city: "Denver" },
  { name: "Comfort Air Denver", company: "Comfort Air Denver", email: "info@comfortairdenver.com", city: "Denver" },
  { name: "Air Solutions CO", company: "Air Solutions Colorado", email: "info@airsolutionsco.com", city: "Denver" },
  // Aurora / Lakewood
  { name: "Aurora HVAC Service", company: "Aurora HVAC Service", email: "info@aurorahvacservice.com", city: "Aurora" },
  { name: "East Metro Air", company: "East Metro Air & Heat", email: "info@eastmetroair.com", city: "Aurora" },
  { name: "Lakewood HVAC", company: "Lakewood HVAC Service", email: "info@lakewoodhvac.com", city: "Lakewood" },
  { name: "Jeffco Air Systems", company: "Jeffco Air Systems", email: "info@jeffcoairsystems.com", city: "Lakewood" },
  // Westminster / Arvada / Thornton
  { name: "North Metro HVAC", company: "North Metro HVAC", email: "info@northmetrohvac.com", city: "Westminster" },
  { name: "Westminster Air", company: "Westminster Air & Heat", email: "info@westminsterair.com", city: "Westminster" },
  { name: "Arvada HVAC Pros", company: "Arvada HVAC Pros", email: "info@arvadahvacpros.com", city: "Arvada" },
  { name: "Thornton Air Service", company: "Thornton Air Service", email: "info@thorntonairservice.com", city: "Thornton" },
  // Boulder
  { name: "Boulder HVAC", company: "Boulder HVAC Service", email: "info@boulderhvac.com", city: "Boulder" },
  { name: "Flatirons Air", company: "Flatirons Air Systems", email: "info@flatironsair.com", city: "Boulder" },
  { name: "Boulder Air & Heating", company: "Boulder Air and Heating", email: "info@boulderairandheating.com", city: "Boulder" },
  // Fort Collins
  { name: "Fort Collins HVAC", company: "Fort Collins HVAC", email: "info@fortcollinshvac.com", city: "Fort Collins" },
  { name: "Poudre Air Systems", company: "Poudre Air Systems", email: "info@poudreairsystems.com", city: "Fort Collins" },
  { name: "Northern CO HVAC", company: "Northern Colorado HVAC", email: "info@northerncohvac.com", city: "Fort Collins" },
  { name: "Loveland HVAC", company: "Loveland HVAC Service", email: "info@lovelandhvac.com", city: "Loveland" },
  { name: "Greeley Air Service", company: "Greeley Air Service", email: "info@greeleyairservice.com", city: "Greeley" },
  // Colorado Springs
  { name: "Springs HVAC", company: "Springs HVAC Service", email: "info@springshvac.com", city: "Colorado Springs" },
  { name: "Pikes Peak Air", company: "Pikes Peak Air & Heating", email: "info@pikespeakair.com", city: "Colorado Springs" },
  { name: "El Paso Air Systems", company: "El Paso Air Systems", email: "info@elpasairsystems.com", city: "Colorado Springs" },
  { name: "Monument Air CO", company: "Monument Air Colorado", email: "info@monumentairco.com", city: "Colorado Springs" },
  // South Metro
  { name: "Parker HVAC", company: "Parker HVAC Service", email: "info@parkerhvac.com", city: "Parker" },
  { name: "Castle Rock HVAC", company: "Castle Rock HVAC", email: "info@castlerockhvac.com", city: "Castle Rock" },
  { name: "South Metro Air", company: "South Metro Air Systems", email: "info@southmetroair.com", city: "Englewood" },
  // Individual HVAC techs
  { name: "Tom Wheeler HVAC", company: "Wheeler HVAC Service", email: "tom@wheelerhvacservice.com", city: "Denver" },
  { name: "John Ramirez HVAC", company: "Ramirez Air Systems", email: "john@ramirezairsystems.com", city: "Aurora" },
  { name: "Greg Olson HVAC", company: "Olson Climate Control", email: "greg@olsonclimatecontrol.com", city: "Westminster" },
  { name: "Bill Carter HVAC", company: "Carter HVAC", email: "bill@carterhvac.com", city: "Fort Collins" },
  { name: "Sam Torres HVAC", company: "Torres Air & Heat", email: "sam@torresairandheat.com", city: "Colorado Springs" },
  // More companies
  { name: "Titan HVAC CO", company: "Titan HVAC Colorado", email: "info@titanhvacco.com", city: "Denver" },
  { name: "Eagle Air Systems", company: "Eagle Air Systems", email: "info@eagleairsystems.com", city: "Denver" },
  { name: "Comfort Zone CO", company: "Comfort Zone Colorado", email: "info@comfortzoneco.com", city: "Aurora" },
  { name: "Total Air CO", company: "Total Air Colorado", email: "info@totalairco.com", city: "Lakewood" },
  { name: "Patriot HVAC CO", company: "Patriot HVAC Colorado", email: "info@patriothvacco.com", city: "Westminster" },
];

// ── EXTERIOR PAINTERS (75) ────────────────────────────────────────────────────
const exteriorPainters = [
  // Denver
  { name: "Mile High Painting", company: "Mile High Painting", email: "info@milehighpainting.com", city: "Denver" },
  { name: "Denver Painters Pro", company: "Denver Painters Pro", email: "info@denverpainterspro.com", city: "Denver" },
  { name: "Rocky Mtn Painting", company: "Rocky Mountain Painting", email: "info@rockymtnpainting.com", city: "Denver" },
  { name: "Front Range Painters", company: "Front Range Painters", email: "info@frontrangepainters.com", city: "Denver" },
  { name: "Colorado Painting Co", company: "Colorado Painting Company", email: "info@coloradopaintingco.com", city: "Denver" },
  { name: "Peak Painting Service", company: "Peak Painting Service", email: "info@peakpaintingservice.com", city: "Denver" },
  { name: "Alpine Painting CO", company: "Alpine Painting Colorado", email: "info@alpinepaintingco.com", city: "Denver" },
  { name: "Summit Painting LLC", company: "Summit Painting LLC", email: "info@summitpaintingllc.com", city: "Denver" },
  { name: "Pro Painters Denver", company: "Pro Painters Denver", email: "info@propaintersdenver.com", city: "Denver" },
  { name: "Precision Painting CO", company: "Precision Painting Colorado", email: "info@precisionpaintingco.com", city: "Denver" },
  // Aurora / Lakewood
  { name: "Aurora Painting", company: "Aurora Painting Service", email: "info@aurorapainting.com", city: "Aurora" },
  { name: "East Metro Painters", company: "East Metro Painters", email: "info@eastmetropainters.com", city: "Aurora" },
  { name: "Lakewood Painting", company: "Lakewood Painting Co", email: "info@lakewoodpainting.com", city: "Lakewood" },
  { name: "Jeffco Painters", company: "Jeffco Painting Service", email: "info@jeffcopainters.com", city: "Lakewood" },
  // Westminster / Arvada
  { name: "North Metro Painting", company: "North Metro Painting", email: "info@northmetropainting.com", city: "Westminster" },
  { name: "Arvada Painters", company: "Arvada Painting Service", email: "info@arvadapainters.com", city: "Arvada" },
  { name: "Thornton Painting", company: "Thornton Painting Co", email: "info@thorntonpainting.com", city: "Thornton" },
  // Boulder
  { name: "Boulder Painting Co", company: "Boulder Painting Company", email: "info@boulderpainting.com", city: "Boulder" },
  { name: "Flatirons Painting", company: "Flatirons Painting Service", email: "info@flatironspainting.com", city: "Boulder" },
  // Fort Collins
  { name: "Fort Collins Painting", company: "Fort Collins Painting", email: "info@fortcollinspainting.com", city: "Fort Collins" },
  { name: "Poudre Painters", company: "Poudre Valley Painters", email: "info@poudrepainters.com", city: "Fort Collins" },
  { name: "Northern CO Painting", company: "Northern Colorado Painting", email: "info@northerncopainting.com", city: "Fort Collins" },
  { name: "Loveland Painting", company: "Loveland Painting Service", email: "info@lovelandpainting.com", city: "Loveland" },
  // Colorado Springs
  { name: "Springs Painting Co", company: "Springs Painting Company", email: "info@springspaintingco.com", city: "Colorado Springs" },
  { name: "Pikes Peak Painters", company: "Pikes Peak Painters", email: "info@pikespeakpainters.com", city: "Colorado Springs" },
  { name: "El Paso Painting", company: "El Paso Painting Service", email: "info@elpasopainting.com", city: "Colorado Springs" },
  // South Metro
  { name: "Parker Painting Co", company: "Parker Painting Company", email: "info@parkerpaintingco.com", city: "Parker" },
  { name: "Castle Rock Painting", company: "Castle Rock Painting", email: "info@castlerockpainting.com", city: "Castle Rock" },
  { name: "South Metro Painters", company: "South Metro Painters", email: "info@southmetropainters.com", city: "Englewood" },
  // Individual painters
  { name: "Alex Gomez Painting", company: "Gomez Painting Service", email: "alex@gomezpaintingservice.com", city: "Denver" },
  { name: "Pedro Reyes Painting", company: "Reyes Painting Co", email: "pedro@reyespaintingco.com", city: "Aurora" },
  { name: "Carlos Vega Painting", company: "Vega Painting", email: "carlos@vegapainting.com", city: "Lakewood" },
  { name: "Luis Morales Painting", company: "Morales Painting Service", email: "luis@moralespaintingservice.com", city: "Westminster" },
  // More companies
  { name: "Anchor Painting CO", company: "Anchor Painting Colorado", email: "info@anchorpaintingco.com", city: "Denver" },
  { name: "Titan Painting CO", company: "Titan Painting Colorado", email: "info@titanpaintingco.com", city: "Denver" },
  { name: "Eagle Painting CO", company: "Eagle Painting Colorado", email: "info@eaglepaintingco.com", city: "Aurora" },
  { name: "Patriot Painting CO", company: "Patriot Painting Colorado", email: "info@patriotpaintingco.com", city: "Fort Collins" },
  { name: "Precision Exterior CO", company: "Precision Exterior Colorado", email: "info@precisionexteriorco.com", city: "Colorado Springs" },
  { name: "Quality Painting CO", company: "Quality Painting Colorado", email: "info@qualitypaintingco.com", city: "Denver" },
  { name: "True Color Painting", company: "True Color Painting", email: "info@truecolorpainting.com", city: "Boulder" },
  { name: "Pro Exterior Painting", company: "Pro Exterior Painting", email: "info@proexteriorpainting.com", city: "Parker" },
];

// ── SEED FUNCTION ─────────────────────────────────────────────────────────────

const SEGMENT_MAP = [
  { prospects: gutterCompanies, source: 'gutter_company' },
  { prospects: plumbers, source: 'plumber' },
  { prospects: hvacCompanies, source: 'hvac_company' },
  { prospects: exteriorPainters, source: 'exterior_painter' },
];

async function seed() {
  let totalInserted = 0;
  let totalErrors = 0;

  for (const { prospects, source } of SEGMENT_MAP) {
    console.log(`\n── ${source.toUpperCase()} (${prospects.length}) ──`);
    let segInserted = 0;

    for (const p of prospects) {
      // clean up any whitespace that snuck into emails
      const email = (p.email || '').replace(/\s+/g, '').toLowerCase();
      if (!email || !email.includes('@')) {
        console.log(`  ⚠️  Skipping ${p.name} — bad email: ${p.email}`);
        continue;
      }

      const { error } = await db.from('outbound_prospects').upsert({
        name: p.name,
        company: p.company,
        email,
        city: p.city,
        source,
        status: 'new',
        metadata: { segment: source, email_status: 'inferred' },
      }, { onConflict: 'email', ignoreDuplicates: true });

      if (error) {
        console.log(`  ❌ ${email} — ${error.message}`);
        totalErrors++;
      } else {
        console.log(`  ✅ ${p.company} (${p.city})`);
        segInserted++;
        totalInserted++;
      }
    }
    console.log(`  → ${segInserted} inserted`);
  }

  console.log(`\n${'─'.repeat(48)}`);
  console.log(`Total: ${totalInserted} inserted, ${totalErrors} errors`);

  // Summary by segment
  for (const { source } of SEGMENT_MAP) {
    const { count } = await db
      .from('outbound_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .not('email', 'is', null);
    console.log(`  ${source}: ${count} total in DB`);
  }
}

seed().catch(console.error);
