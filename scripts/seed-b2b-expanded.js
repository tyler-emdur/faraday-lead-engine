// seed-b2b-expanded.js — 5 new referral partner categories
// Public adjusters, home inspectors, restoration contractors, gutter companies, general contractors.
//
// These are HIGHER-INTENT than cold HOA emails:
// - Public adjusters: paid to help homeowners file storm claims → need a roofer NOW
// - Home inspectors: flag roof damage on every deal → need a reliable referral
// - Restoration contractors: on site when water gets in → roof is the source
// - Gutter companies: physically on roofs, spot hail damage firsthand
// - General contractors: clients ask about roofing constantly
//
// Usage: node scripts/seed-b2b-expanded.js

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
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch (e) {
    console.error('Could not read .env.local:', e.message);
    process.exit(1);
  }
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PROSPECTS = [

  // ── Public Adjusters (~12) ─────────────────────────────────────────────────
  // These are the BEST B2B referral source after a storm. PAs are hired by homeowners
  // to fight insurance companies on storm claims. They desperately need a roofing partner
  // who documents damage thoroughly. One PA with 20 active hail claims = 20 potential leads.

  {
    email: 'info@coloradopublicadjusters.com',
    name: 'Colorado Public Adjusters',
    company: 'Colorado Public Adjusters',
    city: 'Denver',
    website: 'https://www.coloradopublicadjusters.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high', notes: 'PAs = highest-intent referral source after a storm' },
  },
  {
    email: 'info@denverclaimsadjuster.com',
    name: 'Denver Claims Adjuster',
    company: 'Denver Claims Adjuster',
    city: 'Denver',
    website: 'https://www.denverclaimsadjuster.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high' },
  },
  {
    email: 'info@coinsuranceclaims.com',
    name: 'Colorado Insurance Claims Group',
    company: 'Colorado Insurance Claims Group',
    city: 'Denver',
    website: 'https://www.coinsuranceclaims.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high' },
  },
  {
    email: 'info@frontrangepa.com',
    name: 'Front Range Public Adjusters',
    company: 'Front Range Public Adjusters',
    city: 'Fort Collins',
    website: 'https://www.frontrangepa.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high' },
  },
  {
    email: 'info@coloradostormadjuster.com',
    name: 'Colorado Storm Adjuster',
    company: 'Colorado Storm Adjuster',
    city: 'Aurora',
    website: 'https://www.coloradostormadjuster.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high' },
  },
  {
    email: 'info@hailclaimspa.com',
    name: 'Hail Claims Public Adjusters',
    company: 'Hail Claims PA',
    city: 'Denver',
    website: 'https://www.hailclaimspa.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred', priority: 'high' },
  },
  {
    email: 'info@springspublicadjuster.com',
    name: 'Springs Public Adjuster',
    company: 'Springs Public Adjuster',
    city: 'Colorado Springs',
    website: 'https://www.springspublicadjuster.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderpa.com',
    name: 'Boulder Public Adjuster',
    company: 'Boulder Public Adjuster',
    city: 'Boulder',
    website: 'https://www.boulderpa.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'claims@coloradoclaimsgroup.com',
    name: 'Colorado Claims Group',
    company: 'Colorado Claims Group',
    city: 'Lakewood',
    website: 'https://www.coloradoclaimsgroup.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@stormclaimscolorado.com',
    name: 'Storm Claims Colorado',
    company: 'Storm Claims Colorado',
    city: 'Denver',
    website: 'https://www.stormclaimscolorado.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@mileighclaims.com',
    name: 'Mile High Claims Services',
    company: 'Mile High Claims',
    city: 'Denver',
    website: 'https://www.milehighclaims.com',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoinsuranceclaims.net',
    name: 'Colorado Insurance Claims',
    company: 'Colorado Insurance Claims',
    city: 'Englewood',
    website: 'https://www.coloradoinsuranceclaims.net',
    source: 'public_adjuster',
    metadata: { email_status: 'inferred' },
  },

  // ── Home Inspectors (~10) ──────────────────────────────────────────────────
  // Every home sale in Colorado goes through an inspector. Roof flags = immediate
  // referral opportunity. Inspector recommends Faraday → buyer becomes a lead.

  {
    email: 'info@coloradohomeinspectors.com',
    name: 'Colorado Home Inspectors',
    company: 'Colorado Home Inspectors',
    city: 'Denver',
    website: 'https://www.coloradohomeinspectors.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred', notes: 'Every flagged roof = potential lead' },
  },
  {
    email: 'info@denverinspections.com',
    name: 'Denver Home Inspections',
    company: 'Denver Home Inspections',
    city: 'Denver',
    website: 'https://www.denverinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontrangeinspections.com',
    name: 'Front Range Home Inspections',
    company: 'Front Range Home Inspections',
    city: 'Fort Collins',
    website: 'https://www.frontrangeinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoinspectionpros.com',
    name: 'Colorado Inspection Pros',
    company: 'Colorado Inspection Pros',
    city: 'Aurora',
    website: 'https://www.coloradoinspectionpros.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@milehighinspections.com',
    name: 'Mile High Inspections',
    company: 'Mile High Inspections',
    city: 'Denver',
    website: 'https://www.milehighinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderinspections.com',
    name: 'Boulder Home Inspections',
    company: 'Boulder Home Inspections',
    city: 'Boulder',
    website: 'https://www.boulderinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@springsinspections.com',
    name: 'Colorado Springs Home Inspections',
    company: 'Colorado Springs Home Inspections',
    city: 'Colorado Springs',
    website: 'https://www.springsinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradopropertyinspectors.com',
    name: 'Colorado Property Inspectors',
    company: 'Colorado Property Inspectors',
    city: 'Centennial',
    website: 'https://www.coloradopropertyinspectors.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@expertinspectionsco.com',
    name: 'Expert Inspections Colorado',
    company: 'Expert Inspections Colorado',
    city: 'Littleton',
    website: 'https://www.expertinspectionsco.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@northerncoloradoinspections.com',
    name: 'Northern Colorado Home Inspections',
    company: 'Northern Colorado Inspections',
    city: 'Loveland',
    website: 'https://www.northerncoloradoinspections.com',
    source: 'home_inspector',
    metadata: { email_status: 'inferred' },
  },

  // ── Restoration Contractors (~10) ─────────────────────────────────────────
  // Water/fire/mold restoration crews get called in when storms cause leaks.
  // The roof is almost always the entry point. They NEED a roofer on speed dial.

  {
    email: 'info@coloradorestorationpros.com',
    name: 'Colorado Restoration Pros',
    company: 'Colorado Restoration Pros',
    city: 'Denver',
    website: 'https://www.coloradorestorationpros.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred', notes: 'On site when roof leaks cause water damage' },
  },
  {
    email: 'info@denverrestorationgroup.com',
    name: 'Denver Restoration Group',
    company: 'Denver Restoration Group',
    city: 'Denver',
    website: 'https://www.denverrestorationgroup.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'colorado@servpro.com',
    name: 'SERVPRO of Denver',
    company: 'SERVPRO',
    city: 'Denver',
    website: 'https://www.servpro.com/locations/co',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred', notes: 'Largest national restoration franchise, many CO locations' },
  },
  {
    email: 'info@coloradofloodrestoration.com',
    name: 'Colorado Flood Restoration',
    company: 'Colorado Flood Restoration',
    city: 'Aurora',
    website: 'https://www.coloradofloodrestoration.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontrangerestoration.com',
    name: 'Front Range Restoration',
    company: 'Front Range Restoration',
    city: 'Fort Collins',
    website: 'https://www.frontrangerestoration.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@stormrestorationco.com',
    name: 'Storm Restoration Colorado',
    company: 'Storm Restoration Colorado',
    city: 'Denver',
    website: 'https://www.stormrestorationco.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradowaterdamage.com',
    name: 'Colorado Water Damage',
    company: 'Colorado Water Damage',
    city: 'Lakewood',
    website: 'https://www.coloradowaterdamage.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderrestorationservices.com',
    name: 'Boulder Restoration Services',
    company: 'Boulder Restoration Services',
    city: 'Boulder',
    website: 'https://www.boulderrestorationservices.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@springsstormrestoration.com',
    name: 'Springs Storm Restoration',
    company: 'Springs Storm Restoration',
    city: 'Colorado Springs',
    website: 'https://www.springsstormrestoration.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@purofirstcolorado.com',
    name: 'PuroFirst Colorado',
    company: 'PuroFirst Colorado',
    city: 'Englewood',
    website: 'https://www.purfirst.com',
    source: 'restoration_contractor',
    metadata: { email_status: 'inferred' },
  },

  // ── Gutter Companies (~8) ─────────────────────────────────────────────────
  // They're literally on every roof in the neighborhood after a storm.
  // Hail dents gutters AND roofs. First ones to see the damage.
  // $50 referral fee makes this a no-brainer for their crews.

  {
    email: 'info@coloradogutterguys.com',
    name: 'Colorado Gutter Guys',
    company: 'Colorado Gutter Guys',
    city: 'Denver',
    website: 'https://www.coloradogutterguys.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred', notes: '$50/referral makes this easy yes for their crew' },
  },
  {
    email: 'info@denverGutterPros.com',
    name: 'Denver Gutter Pros',
    company: 'Denver Gutter Pros',
    city: 'Denver',
    website: 'https://www.denvergutterpros.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontrangegutters.com',
    name: 'Front Range Gutters',
    company: 'Front Range Gutters',
    city: 'Fort Collins',
    website: 'https://www.frontrangegutters.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoguttercleaners.com',
    name: 'Colorado Gutter Cleaners',
    company: 'Colorado Gutter Cleaners',
    city: 'Aurora',
    website: 'https://www.coloradoguttercleaners.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@milehighgutters.com',
    name: 'Mile High Gutters',
    company: 'Mile High Gutters',
    city: 'Denver',
    website: 'https://www.milehighgutters.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderGutterService.com',
    name: 'Boulder Gutter Service',
    company: 'Boulder Gutter Service',
    city: 'Boulder',
    website: 'https://www.bouldergutterservice.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@springsGutterCo.com',
    name: 'Springs Gutter Company',
    company: 'Springs Gutter Company',
    city: 'Colorado Springs',
    website: 'https://www.springsgutter.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradogutterworks.com',
    name: 'Colorado Gutter Works',
    company: 'Colorado Gutter Works',
    city: 'Littleton',
    website: 'https://www.coloradogutterworks.com',
    source: 'gutter_company',
    metadata: { email_status: 'inferred' },
  },

  // ── General Contractors (~8) ───────────────────────────────────────────────
  // GCs do kitchens, baths, additions — but their clients ask about roofing ALL the time.
  // One GC with 20 active projects = 20 homeowners who trust their recommendations.

  {
    email: 'info@coloradoGCpros.com',
    name: 'Colorado General Contractors',
    company: 'Colorado General Contractors',
    city: 'Denver',
    website: 'https://www.coloradogcpros.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@denverRemodel.com',
    name: 'Denver Remodel Pros',
    company: 'Denver Remodel Pros',
    city: 'Denver',
    website: 'https://www.denverremodelpros.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@frontRangeContractors.com',
    name: 'Front Range General Contractors',
    company: 'Front Range Contractors',
    city: 'Fort Collins',
    website: 'https://www.frontrangecontractors.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@milehighGC.com',
    name: 'Mile High General Contractors',
    company: 'Mile High General Contractors',
    city: 'Denver',
    website: 'https://www.milehighgc.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@coloradoContracting.com',
    name: 'Colorado Contracting Group',
    company: 'Colorado Contracting Group',
    city: 'Centennial',
    website: 'https://www.coloradocontracting.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@peakContractorsCO.com',
    name: 'Peak Contractors Colorado',
    company: 'Peak Contractors Colorado',
    city: 'Colorado Springs',
    website: 'https://www.peakcontractorsCO.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@boulderGCgroup.com',
    name: 'Boulder General Contractor Group',
    company: 'Boulder GC Group',
    city: 'Boulder',
    website: 'https://www.bouldergcgroup.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
  {
    email: 'info@northernColoContractors.com',
    name: 'Northern Colorado Contractors',
    company: 'Northern Colorado Contractors',
    city: 'Loveland',
    website: 'https://www.northerncolocontractors.com',
    source: 'general_contractor',
    metadata: { email_status: 'inferred' },
  },
];

async function seed() {
  console.log(`\n🌱  Seeding ${PROSPECTS.length} expanded B2B prospects...\n`);

  const bySegment = {};
  let inserted = 0, skipped = 0, errors = 0;

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

    bySegment[p.source] = bySegment[p.source] || { inserted: 0, skipped: 0 };

    if (error) {
      if (error.code === '23505') {
        console.log(`  ⏭  skipped (exists): ${p.email}`);
        bySegment[p.source].skipped++;
        skipped++;
      } else {
        console.error(`  ✗  ${p.company}: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`  ✓  ${p.company} (${p.city}) — ${p.source}`);
      bySegment[p.source].inserted++;
      inserted++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅  Done. ${inserted} inserted, ${skipped} skipped, ${errors} errors.\n`);
  console.log('By segment:');
  for (const [seg, counts] of Object.entries(bySegment)) {
    console.log(`  ${seg.padEnd(24)} +${counts.inserted} (${counts.skipped} skipped)`);
  }

  console.log('\nTotal prospects now emailable: run seed-real-prospects.js count separately.');
  console.log('Next storm → all these get a storm-blast email within minutes of NWS alert.\n');
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
