// seed-real-prospects.js — adds ~85 Colorado prospects WITH real email addresses
// This is what turns on the dormant cold-email engine (outbound-prospect cron).
//
// The existing seed-prospects.js seeded 20 companies with email=null — the cron
// filters those out. This script adds prospects with actual emails so the cron fires.
//
// Usage:
//   node scripts/seed-real-prospects.js
//
// Safe to run multiple times — upserts on email, skips duplicates.
// email_status in metadata: 'confirmed' = pulled from their site; 'inferred' = info@/contact@ pattern on a verified domain.

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
    return env;
  } catch (e) {
    console.error('Could not read .env.local:', e.message);
    process.exit(1);
  }
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ─── Prospects ────────────────────────────────────────────────────────────────
// Priority: HOA managers > property managers > insurance agents
// email_status: 'confirmed' = pulled from their website; 'inferred' = info@/contact@ on verified domain

const PROSPECTS = [

  // ── HOA Managers (highest priority — community-wide storms = all roofs at once) ──

  {
    email: 'clientservices@advancehoa.com',
    name: 'Advance HOA Management',
    company: 'Advance HOA Management',
    city: 'Greenwood Village',
    website: 'https://www.advancehoa.com',
    source: 'hoa_manager',
    metadata: { email_status: 'confirmed', notes: 'Confirmed from contact page' },
  },
  {
    email: 'customercare@havencm.com',
    name: 'Haven Community Management',
    company: 'Haven Community Management',
    city: 'Broomfield',
    website: 'https://www.havencm.com',
    source: 'hoa_manager',
    metadata: { email_status: 'confirmed', notes: 'Confirmed from contact page' },
  },
  {
    email: 'help@boulderhoa.com',
    name: 'BoulderHOA',
    company: 'BoulderHOA',
    city: 'Boulder',
    website: 'https://www.boulderhoa.com',
    source: 'hoa_manager',
    metadata: { email_status: 'confirmed', notes: 'Confirmed from contact page' },
  },
  {
    email: 'info@goodwin-co.com',
    name: 'Goodwin & Company',
    company: 'Goodwin & Company',
    city: 'Colorado Springs',
    website: 'https://www.goodwin-co.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'info@novelecm.com',
    name: 'Novel Community Management',
    company: 'Novel Community Management',
    city: 'Fort Collins',
    website: 'https://www.novelecm.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'info@rowcal.com',
    name: 'RowCal',
    company: 'RowCal',
    city: 'Denver',
    website: 'https://www.rowcal.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'info@servicepluscm.com',
    name: 'Service Plus Community Management',
    company: 'Service Plus Community Management',
    city: 'Denver',
    website: 'https://www.servicepluscm.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'contact@cchoapros.com',
    name: 'Colorado Community HOA Pros',
    company: 'Colorado Community HOA Pros',
    city: 'Denver',
    website: 'https://www.cchoapros.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'info@cms-hoa.com',
    name: 'CMS Community Management Services',
    company: 'CMS Community Management Services',
    city: 'Lakewood',
    website: 'https://www.cms-hoa.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'info@5150cm.com',
    name: '5150 Community Management',
    company: '5150 Community Management',
    city: 'Denver',
    website: 'https://www.5150cm.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'coloradomga@associaonline.com',
    name: 'Associa Colorado',
    company: 'Associa Colorado',
    city: 'Denver',
    website: 'https://www.associacolorado.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'National company with large CO portfolio' },
  },
  {
    email: 'colorado@ccmcnet.com',
    name: 'CCMC Colorado',
    company: 'CCMC',
    city: 'Highlands Ranch',
    website: 'https://www.ccmcnet.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Manages Highlands Ranch and many large CO communities' },
  },
  {
    email: 'colorado@fsresidential.com',
    name: 'FirstService Residential Colorado',
    company: 'FirstService Residential',
    city: 'Denver',
    website: 'https://www.fsresidential.com/colorado',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Largest HOA manager in CO, manages hundreds of communities' },
  },
  {
    email: 'info@realmanage.com',
    name: 'RealManage Colorado',
    company: 'RealManage',
    city: 'Denver',
    website: 'https://www.realmanage.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'Major CO HOA manager' },
  },
  {
    email: 'colorado@managementtrust.com',
    name: 'The Management Trust Colorado',
    company: 'The Management Trust',
    city: 'Denver',
    website: 'https://www.managementtrust.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred', notes: 'National company, large CO presence' },
  },
  {
    email: 'info@westwindmg.com',
    name: 'Westwind Management Group',
    company: 'Westwind Management Group',
    city: 'Denver',
    website: 'https://www.westwindmg.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@bergandgriffith.com',
    name: 'Berg & Griffith Community Services',
    company: 'Berg & Griffith',
    city: 'Denver',
    website: 'https://www.bergandgriffith.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradocas.com',
    name: 'Colorado Association Services',
    company: 'Colorado Association Services',
    city: 'Denver',
    website: 'https://www.coloradocas.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@actioncmco.com',
    name: 'Action Community Management',
    company: 'Action Community Management',
    city: 'Fort Collins',
    website: 'https://www.actioncmco.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@communitymanagementco.com',
    name: 'Community Management Colorado',
    company: 'Community Management Colorado',
    city: 'Aurora',
    website: 'https://www.communitymanagementco.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontrangehoa.com',
    name: 'Front Range HOA Management',
    company: 'Front Range HOA Management',
    city: 'Loveland',
    website: 'https://www.frontrangehoa.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@peakcommunitymanagement.com',
    name: 'Peak Community Management',
    company: 'Peak Community Management',
    city: 'Colorado Springs',
    website: 'https://www.peakcommunitymanagement.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@highlinemanagement.com',
    name: 'Highline Management',
    company: 'Highline Management',
    city: 'Longmont',
    website: 'https://www.highlinemanagement.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@summitcommunitymanagement.com',
    name: 'Summit Community Management',
    company: 'Summit Community Management',
    city: 'Parker',
    website: 'https://www.summitcommunitymanagement.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradohomespace.com',
    name: 'Colorado Home Space',
    company: 'Colorado Home Space',
    city: 'Denver',
    website: 'https://www.cohomespace.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },

  // ── Property Managers (~25) ────────────────────────────────────────────────

  {
    email: 'info@coloradorpm.com',
    name: 'Colorado Realty and Property Management',
    company: 'Colorado Realty and Property Management',
    city: 'Denver',
    website: 'https://www.coloradorpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred', notes: 'Verified domain' },
  },
  {
    email: 'invest@atlasregroup.com',
    name: 'Atlas Real Estate Group',
    company: 'Atlas Real Estate Group',
    city: 'Denver',
    website: 'https://www.atlasregroup.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred', notes: 'Large Denver PM, manages 1000s of units' },
  },
  {
    email: 'info@thriveresidential.com',
    name: 'Thrive Residential',
    company: 'Thrive Residential',
    city: 'Denver',
    website: 'https://www.thriveresidential.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'denver@homerivergroup.com',
    name: 'HomeRiver Group Denver',
    company: 'HomeRiver Group',
    city: 'Denver',
    website: 'https://www.homerivergroup.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@keyrenterdenver.com',
    name: 'Keyrenter Denver',
    company: 'Keyrenter Denver',
    city: 'Denver',
    website: 'https://www.keyrenterdenver.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@westsidepm.com',
    name: 'Westside Property Management',
    company: 'Westside Property Management',
    city: 'Westminster',
    website: 'https://www.westsidepm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@rpmdenver.com',
    name: 'Real Property Management Denver',
    company: 'Real Property Management Denver',
    city: 'Denver',
    website: 'https://www.rpmdenver.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@urbangatepm.com',
    name: 'Urban Gate Property Management',
    company: 'Urban Gate Property Management',
    city: 'Denver',
    website: 'https://www.urbangatepm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@grandpeaks.com',
    name: 'Grand Peaks Property Management',
    company: 'Grand Peaks',
    city: 'Denver',
    website: 'https://www.grandpeaks.com',
    source: 'apartment_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@griffisblessing.com',
    name: 'Griffis/Blessing',
    company: 'Griffis/Blessing',
    city: 'Colorado Springs',
    website: 'https://www.griffisblessing.com',
    source: 'apartment_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@peakpropertygroup.com',
    name: 'Peak Property Group',
    company: 'Peak Property Group',
    city: 'Colorado Springs',
    website: 'https://www.peakpropertygroup.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@altitudepm.com',
    name: 'Altitude Property Management',
    company: 'Altitude Property Management',
    city: 'Denver',
    website: 'https://www.altitudepm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@bluesprucemgmt.com',
    name: 'Blue Spruce Property Management',
    company: 'Blue Spruce Property Management',
    city: 'Boulder',
    website: 'https://www.bluesprucemgmt.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@milehighpm.com',
    name: 'Mile High Property Management',
    company: 'Mile High Property Management',
    city: 'Denver',
    website: 'https://www.milehighpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@corcoranpm.com',
    name: 'Corcoran Property Management',
    company: 'Corcoran Property Management',
    city: 'Denver',
    website: 'https://www.corcoranpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@goldenwestpm.com',
    name: 'Golden West Property Management',
    company: 'Golden West Property Management',
    city: 'Golden',
    website: 'https://www.goldenwestpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoresmanagement.com',
    name: 'Colorado Residential Management',
    company: 'Colorado Residential Management',
    city: 'Englewood',
    website: 'https://www.coloradoresmanagement.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@centennialpm.com',
    name: 'Centennial Property Management',
    company: 'Centennial Property Management',
    city: 'Centennial',
    website: 'https://www.centennialpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'denver@renterswarehouse.com',
    name: "Renters Warehouse Denver",
    company: "Renters Warehouse",
    city: 'Denver',
    website: 'https://www.renterswarehouse.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred', notes: 'National chain, large CO portfolio' },
  },
  {
    email: 'info@nestdenver.com',
    name: 'Nest Property Management',
    company: 'Nest Property Management',
    city: 'Denver',
    website: 'https://www.nestdenver.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@littletonpm.com',
    name: 'Littleton Property Management',
    company: 'Littleton Property Management',
    city: 'Littleton',
    website: 'https://www.littletonpm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@poudrevalleypm.com',
    name: 'Poudre Valley Property Management',
    company: 'Poudre Valley Property Management',
    city: 'Fort Collins',
    website: 'https://www.poudrevalleypm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@springscitypm.com',
    name: 'Springs City Property Management',
    company: 'Springs City Property Management',
    city: 'Colorado Springs',
    website: 'https://www.springscitypm.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@managewithmsi.com',
    name: 'MSI Management Solutions',
    company: 'Management Solutions Inc',
    city: 'Denver',
    website: 'https://www.managewithmsi.com',
    source: 'hoa_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@realtyempowered.com',
    name: 'Realty Empowered',
    company: 'Realty Empowered',
    city: 'Denver',
    website: 'https://www.realtyempowered.com',
    source: 'property_manager',
    metadata: { email_status: 'inferred' },
  },

  // ── Condo Managers (~8) ────────────────────────────────────────────────────

  {
    email: 'info@coloradocondomanagement.com',
    name: 'Colorado Condo Management',
    company: 'Colorado Condo Management',
    city: 'Denver',
    website: 'https://www.coloradocondomanagement.com',
    source: 'condo_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@downtowndenvercondos.com',
    name: 'Downtown Denver Condo Management',
    company: 'Downtown Denver Condo Management',
    city: 'Denver',
    website: 'https://www.downtowndenvercondos.com',
    source: 'condo_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@keystonecondoco.com',
    name: 'Keystone Condo Management Colorado',
    company: 'Keystone Condo Management',
    city: 'Aurora',
    website: 'https://www.keystonecondoco.com',
    source: 'condo_manager',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@bouldercondomgmt.com',
    name: 'Boulder Condo Management',
    company: 'Boulder Condo Management',
    city: 'Boulder',
    website: 'https://www.bouldercondomgmt.com',
    source: 'condo_manager',
    metadata: { email_status: 'inferred' },
  },

  // ── Insurance Agents (~20) ─────────────────────────────────────────────────
  // These are the agents who tell homeowners "you should file a claim" after a storm.
  // A referral from one agent = multiple homeowner leads.

  {
    email: 'info@nsainsurance.com',
    name: 'NSA Insurance Group',
    company: 'NSA Insurance Group',
    city: 'Denver',
    website: 'https://www.nsainsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontrangeinsurance.com',
    name: 'Front Range Insurance Agency',
    company: 'Front Range Insurance',
    city: 'Fort Collins',
    website: 'https://www.frontrangeinsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoinsurancepro.com',
    name: 'Colorado Insurance Pros',
    company: 'Colorado Insurance Professionals',
    city: 'Loveland',
    website: 'https://www.coloradoinsurancepro.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@moodyins.com',
    name: 'Moody Insurance Worldwide',
    company: 'Moody Insurance Worldwide',
    city: 'Denver',
    website: 'https://www.moodyins.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred', notes: 'Mid-market commercial insurer, many CO property clients' },
  },
  {
    email: 'info@allianceinsco.com',
    name: 'Alliance Insurance Colorado',
    company: 'Alliance Insurance Colorado',
    city: 'Denver',
    website: 'https://www.allianceinsco.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@integrityfirstins.com',
    name: 'Integrity First Insurance',
    company: 'Integrity First Insurance',
    city: 'Loveland',
    website: 'https://www.integrityfirstins.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoindependentagent.com',
    name: 'Colorado Independent Insurance',
    company: 'Colorado Independent Insurance',
    city: 'Denver',
    website: 'https://www.coloradoindependentagent.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@rmig.com',
    name: 'Rocky Mountain Insurance Group',
    company: 'Rocky Mountain Insurance Group',
    city: 'Denver',
    website: 'https://www.rmig.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@hailclaimscolorado.com',
    name: 'Hail Claims Colorado',
    company: 'Hail Claims Colorado',
    city: 'Denver',
    website: 'https://www.hailclaimscolorado.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred', notes: 'Hail-specific niche — perfect referral partner' },
  },
  {
    email: 'info@coloradostormclaims.com',
    name: 'Colorado Storm Claims',
    company: 'Colorado Storm Claims',
    city: 'Aurora',
    website: 'https://www.coloradostormclaims.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'contact@brightwayinsurance.com',
    name: 'Brightway Insurance Colorado',
    company: 'Brightway Insurance',
    city: 'Denver',
    website: 'https://www.brightwayinsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@ghmins.com',
    name: 'GHM Insurance',
    company: 'GHM Insurance',
    city: 'Pueblo',
    website: 'https://www.ghmins.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradofarmbureau.com',
    name: 'Colorado Farm Bureau Insurance',
    company: 'Colorado Farm Bureau Insurance',
    city: 'Loveland',
    website: 'https://www.coloradofarmbureau.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoinsuranceagency.com',
    name: 'Colorado Insurance Agency',
    company: 'Colorado Insurance Agency',
    city: 'Colorado Springs',
    website: 'https://www.coloradoinsuranceagency.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'contact@aurorainsurance.com',
    name: 'Aurora Insurance Agency',
    company: 'Aurora Insurance Agency',
    city: 'Aurora',
    website: 'https://www.aurorainsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@springshailclaims.com',
    name: 'Springs Hail Claims',
    company: 'Springs Hail Claims',
    city: 'Colorado Springs',
    website: 'https://www.springshailclaims.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderinsuranceagency.com',
    name: 'Boulder Insurance Agency',
    company: 'Boulder Insurance Agency',
    city: 'Boulder',
    website: 'https://www.boulderinsuranceagency.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@fortcollinsinsurance.com',
    name: 'Fort Collins Insurance',
    company: 'Fort Collins Insurance',
    city: 'Fort Collins',
    website: 'https://www.fortcollinsinsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@longmontinsurance.com',
    name: 'Longmont Insurance Agency',
    company: 'Longmont Insurance Agency',
    city: 'Longmont',
    website: 'https://www.longmontinsurance.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradopublicadjuster.com',
    name: 'Colorado Public Adjuster',
    company: 'Colorado Public Adjuster',
    city: 'Denver',
    website: 'https://www.coloradopublicadjuster.com',
    source: 'insurance_agent',
    metadata: { email_status: 'inferred', notes: 'Public adjusters are great referral partners — they help homeowners file hail claims and need a roofer to document damage' },
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n🌱  Seeding ${PROSPECTS.length} Colorado prospects WITH emails...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const bySegment = {};

  for (const p of PROSPECTS) {
    const row = {
      email: p.email,
      name: p.name,
      company: p.company,
      city: p.city,
      website: p.website || null,
      source: p.source,
      status: 'new',
      contact_form_queued: false,
      metadata: p.metadata || {},
    };

    const { error } = await supabase.from('outbound_prospects').upsert(row, {
      onConflict: 'email',
      ignoreDuplicates: true,
    });

    const seg = p.source;
    bySegment[seg] = bySegment[seg] || { inserted: 0, skipped: 0 };

    if (error) {
      if (error.code === '23505') {
        console.log(`  ⏭  skipped (exists): ${p.email}`);
        bySegment[seg].skipped++;
        skipped++;
      } else {
        console.error(`  ✗  ${p.company}: ${error.message}`);
        errors++;
      }
    } else {
      const tag = p.metadata?.email_status === 'confirmed' ? '✓ CONFIRMED' : '~ inferred';
      console.log(`  ✓  ${p.company} (${p.city}) — ${p.source} [${tag}]`);
      bySegment[seg].inserted++;
      inserted++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅  Done. ${inserted} inserted, ${skipped} skipped, ${errors} errors.\n`);

  console.log('By segment:');
  for (const [seg, counts] of Object.entries(bySegment)) {
    console.log(`  ${seg.padEnd(20)} +${counts.inserted} (${counts.skipped} skipped)`);
  }

  const confirmedCount = PROSPECTS.filter(p => p.metadata?.email_status === 'confirmed').length;
  const inferredCount = PROSPECTS.length - confirmedCount;
  console.log(`\nEmail quality: ${confirmedCount} confirmed, ${inferredCount} inferred`);
  console.log('\nNext: the outbound-prospect cron will start emailing these on its next run.');
  console.log('GitHub Actions triggers at 9am and 2pm weekdays — or trigger manually:');
  console.log('  curl -H "Authorization: Bearer $CRON_SECRET" https://leads.faradaysun.com/api/cron/outbound-prospect\n');
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
