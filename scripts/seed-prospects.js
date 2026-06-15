// Seed 20 real Colorado businesses as Anna's first outbound targets.
// Run AFTER applying scripts/activate-anna.sql in Supabase.
//
// Usage:
//   node scripts/seed-prospects.js
//
// All prospects use the website-only path (email=null).
// Anna's contact-form-targets cron will draft a personalized message for each one.
// You copy/paste Tyler's name + the message into their contact form — takes 30s per company.

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

// Parse .env.local without dotenv
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
const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 20 real Colorado companies across 7 referral-partner segments.
// All use website-only path so contact-form-targets cron drafts personalized messages.
const PROSPECTS = [
  // HOA Management
  { name: 'Associa Colorado',             company: 'Associa Colorado',             city: 'Denver',          source: 'hoa_manager',      website: 'https://www.associaonline.com', city_hint: 'Denver' },
  { name: 'MSI Management Solutions',     company: 'Management Solutions Inc',      city: 'Denver',          source: 'hoa_manager',      website: 'https://www.managewithmsi.com', city_hint: 'Denver' },
  { name: 'Colorado Association Services',company: 'Colorado Association Services', city: 'Denver',          source: 'hoa_manager',      website: 'https://www.cohomespace.com',   city_hint: 'Denver' },

  // Property Managers
  { name: 'HomeRiver Group Denver',       company: 'HomeRiver Group',              city: 'Denver',          source: 'property_manager', website: 'https://www.homerivergroup.com',  city_hint: 'Denver' },
  { name: 'Keyrenter Denver',             company: 'Keyrenter Denver',             city: 'Denver',          source: 'property_manager', website: 'https://www.keyrenterdenver.com', city_hint: 'Denver' },
  { name: 'Real Property Management',     company: 'Real Property Management',     city: 'Denver',          source: 'property_manager', website: 'https://www.rpmdenver.com',       city_hint: 'Denver' },
  { name: 'Westside Property Management', company: 'Westside Property Management', city: 'Westminster',     source: 'property_manager', website: 'https://www.westsidepm.com',      city_hint: 'Westminster' },
  { name: 'Thrive Residential',           company: 'Thrive Residential',           city: 'Denver',          source: 'property_manager', website: 'https://www.thriveresidential.com', city_hint: 'Denver' },

  // Apartment / Condo Managers
  { name: 'Grand Peaks Property Mgmt',   company: 'Grand Peaks',                  city: 'Fort Collins',    source: 'apartment_manager',website: 'https://www.grandpeaks.com',         city_hint: 'Fort Collins' },
  { name: 'Griffis/Blessing',             company: 'Griffis/Blessing',             city: 'Colorado Springs',source: 'apartment_manager',website: 'https://www.griffisblessing.com',     city_hint: 'Colorado Springs' },
  { name: 'Cornerstone Properties',       company: 'Cornerstone Properties',       city: 'Colorado Springs',source: 'apartment_manager',website: 'https://www.cornerstoneproperties.net',city_hint: 'Colorado Springs' },

  // Insurance Agents
  { name: 'NSA Insurance Group',          company: 'NSA Insurance Group',          city: 'Denver',          source: 'insurance_agent',  website: 'https://www.nsainsurance.com',          city_hint: 'Denver' },
  { name: 'Front Range Insurance Agency', company: 'Front Range Insurance',        city: 'Fort Collins',    source: 'insurance_agent',  website: 'https://www.frontrangeinsurance.com',   city_hint: 'Fort Collins' },
  { name: 'Colorado Insurance Pros',      company: 'Colorado Insurance Professionals', city: 'Loveland',   source: 'insurance_agent',  website: 'https://www.coloradoinsurancepro.com',  city_hint: 'Loveland' },

  // Mortgage Brokers
  { name: 'Cherry Creek Mortgage',        company: 'Cherry Creek Mortgage',        city: 'Denver',          source: 'mortgage_broker',  website: 'https://www.cherrycreekmortgage.com',   city_hint: 'Denver' },
  { name: 'Universal Lending Corp',       company: 'Universal Lending Corporation',city: 'Denver',          source: 'mortgage_broker',  website: 'https://www.universallending.com',      city_hint: 'Denver' },

  // Title Companies
  { name: 'Land Title Guarantee Co',      company: 'Land Title Guarantee Company', city: 'Golden',          source: 'title_company',    website: 'https://www.ltgc.com',                  city_hint: 'Denver Metro' },
  { name: 'Heritage Title Company',       company: 'Heritage Title Company',       city: 'Denver',          source: 'title_company',    website: 'https://www.heritagetitle.com',          city_hint: 'Denver' },

  // Realtors
  { name: '8z Real Estate',               company: '8z Real Estate',               city: 'Denver',          source: 'realtor',          website: 'https://www.8z.com',                    city_hint: 'Denver' },
  { name: 'RE/MAX Alliance Colorado',     company: 'RE/MAX Alliance',              city: 'Thornton',        source: 'realtor',          website: 'https://www.remaxalliance.com',          city_hint: 'Thornton' },
];

async function seed() {
  console.log('\n🌱  Seeding Anna\'s first batch of Colorado prospects...\n');

  let inserted = 0;
  let skipped = 0;

  for (const p of PROSPECTS) {
    const row = {
      ...p,
      email: null,
      status: 'new',
      follow_up_count: 0,
      contact_form_queued: false,
      metadata: {},
    };

    const { error } = await supabase.from('outbound_prospects').upsert(row, {
      onConflict: 'email',
      ignoreDuplicates: true,
    });

    if (error) {
      if (error.code === '23505') {
        console.log(`  ⏭  skipped (already exists): ${p.company}`);
        skipped++;
      } else {
        console.error(`  ✗  ${p.company}:`, error.message);
      }
    } else {
      console.log(`  ✓  inserted: ${p.company} (${p.city}) — ${p.source}`);
      inserted++;
    }
  }

  console.log(`\n✅  Done. Inserted ${inserted}, skipped ${skipped}.`);
  console.log('\nNext step: run scripts/trigger-crons.sh');
  console.log('Anna\'s contact-form-targets cron will draft a personalized message for each company.\n');
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
