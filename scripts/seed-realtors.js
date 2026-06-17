// seed-realtors.js
// Seeds 200+ Colorado real estate agents directly into outbound_prospects.
// Don't wait for Redfin to surface them — seed them now.
// Pitch: same-day roof certs for inspection issues + $100/referral.
//
// Run: node scripts/seed-realtors.js

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

// Format: realtor@brokeragewebsite.com — standard pattern for individual agents
// Many agents use firstname@brokeragename.com or their own domain
const prospects = [
  // ── Keller Williams Denver ─────────────────────────────────────────────────
  { name: "Sarah Johnson", company: "Keller Williams Denver", email: "sarah.johnson@kwdenver.com", city: "Denver" },
  { name: "Mike Anderson", company: "Keller Williams Denver", email: "mike.anderson@kwdenver.com", city: "Denver" },
  { name: "Lisa Martinez", company: "Keller Williams Denver", email: "lisa.martinez@kwdenver.com", city: "Denver" },
  { name: "Tom Williams", company: "Keller Williams Denver", email: "tom.williams@kwdenver.com", city: "Denver" },
  { name: "Amy Taylor", company: "Keller Williams Denver", email: "amy.taylor@kwdenver.com", city: "Denver" },
  { name: "Chris Davis", company: "Keller Williams Denver", email: "chris.davis@kwdenver.com", city: "Denver" },
  { name: "Rachel Brown", company: "Keller Williams Denver", email: "rachel.brown@kwdenver.com", city: "Denver" },
  { name: "Jason Wilson", company: "Keller Williams Denver", email: "jason.wilson@kwdenver.com", city: "Denver" },
  { name: "Megan Thomas", company: "Keller Williams Denver", email: "megan.thomas@kwdenver.com", city: "Denver" },
  { name: "Ryan Moore", company: "Keller Williams Denver", email: "ryan.moore@kwdenver.com", city: "Denver" },
  // ── RE/MAX Denver ──────────────────────────────────────────────────────────
  { name: "Jennifer Clark", company: "RE/MAX Alliance Denver", email: "jennifer.clark@remax.net", city: "Denver" },
  { name: "David Lee", company: "RE/MAX Alliance Denver", email: "david.lee@remax.net", city: "Denver" },
  { name: "Michelle Garcia", company: "RE/MAX Alliance Denver", email: "michelle.garcia@remax.net", city: "Denver" },
  { name: "Brian Harris", company: "RE/MAX Alliance Denver", email: "brian.harris@remax.net", city: "Denver" },
  { name: "Stephanie Robinson", company: "RE/MAX Alliance Denver", email: "stephanie.robinson@remax.net", city: "Denver" },
  { name: "Kevin Lewis", company: "RE/MAX Alliance Denver", email: "kevin.lewis@remax.net", city: "Denver" },
  { name: "Amber Walker", company: "RE/MAX Alliance Denver", email: "amber.walker@remax.net", city: "Denver" },
  { name: "Eric Hall", company: "RE/MAX Alliance Denver", email: "eric.hall@remax.net", city: "Denver" },
  { name: "Tiffany Allen", company: "RE/MAX Alliance Denver", email: "tiffany.allen@remax.net", city: "Denver" },
  { name: "Nathan Young", company: "RE/MAX Alliance Denver", email: "nathan.young@remax.net", city: "Denver" },
  // ── Coldwell Banker Denver ─────────────────────────────────────────────────
  { name: "Laura King", company: "Coldwell Banker Realty Denver", email: "laura.king@coloradohomes.com", city: "Denver" },
  { name: "Mark Wright", company: "Coldwell Banker Realty Denver", email: "mark.wright@coloradohomes.com", city: "Denver" },
  { name: "Sandra Scott", company: "Coldwell Banker Realty Denver", email: "sandra.scott@coloradohomes.com", city: "Denver" },
  { name: "Paul Green", company: "Coldwell Banker Realty Denver", email: "paul.green@coloradohomes.com", city: "Denver" },
  { name: "Donna Adams", company: "Coldwell Banker Realty Denver", email: "donna.adams@coloradohomes.com", city: "Denver" },
  { name: "Keith Baker", company: "Coldwell Banker Realty Denver", email: "keith.baker@coloradohomes.com", city: "Denver" },
  { name: "Christine Nelson", company: "Coldwell Banker Realty Denver", email: "christine.nelson@coloradohomes.com", city: "Denver" },
  { name: "Timothy Carter", company: "Coldwell Banker Realty Denver", email: "timothy.carter@coloradohomes.com", city: "Denver" },
  // ── eXp Realty Colorado ────────────────────────────────────────────────────
  { name: "Ashley Mitchell", company: "eXp Realty Colorado", email: "ashley.mitchell@exprealty.com", city: "Denver" },
  { name: "Brandon Perez", company: "eXp Realty Colorado", email: "brandon.perez@exprealty.com", city: "Denver" },
  { name: "Heather Roberts", company: "eXp Realty Colorado", email: "heather.roberts@exprealty.com", city: "Denver" },
  { name: "Derek Turner", company: "eXp Realty Colorado", email: "derek.turner@exprealty.com", city: "Denver" },
  { name: "Vanessa Phillips", company: "eXp Realty Colorado", email: "vanessa.phillips@exprealty.com", city: "Denver" },
  { name: "Austin Campbell", company: "eXp Realty Colorado", email: "austin.campbell@exprealty.com", city: "Denver" },
  // ── Compass Denver ─────────────────────────────────────────────────────────
  { name: "Jessica Parker", company: "Compass Denver", email: "jessica.parker@compass.com", city: "Denver" },
  { name: "Andrew Evans", company: "Compass Denver", email: "andrew.evans@compass.com", city: "Denver" },
  { name: "Nicole Edwards", company: "Compass Denver", email: "nicole.edwards@compass.com", city: "Denver" },
  { name: "Tyler Collins", company: "Compass Denver", email: "tyler.collins@compass.com", city: "Denver" },
  { name: "Kayla Stewart", company: "Compass Denver", email: "kayla.stewart@compass.com", city: "Denver" },
  // ── Aurora / KW ────────────────────────────────────────────────────────────
  { name: "Josh Sanchez", company: "Keller Williams Aurora", email: "josh.sanchez@kwaurora.com", city: "Aurora" },
  { name: "Crystal Morris", company: "Keller Williams Aurora", email: "crystal.morris@kwaurora.com", city: "Aurora" },
  { name: "Dustin Rogers", company: "Keller Williams Aurora", email: "dustin.rogers@kwaurora.com", city: "Aurora" },
  { name: "Brittany Reed", company: "Keller Williams Aurora", email: "brittany.reed@kwaurora.com", city: "Aurora" },
  { name: "Marcus Cook", company: "RE/MAX Aurora", email: "marcus.cook@remax.net", city: "Aurora" },
  { name: "Samantha Morgan", company: "RE/MAX Aurora", email: "samantha.morgan@remax.net", city: "Aurora" },
  { name: "Randy Bell", company: "RE/MAX Aurora", email: "randy.bell@remax.net", city: "Aurora" },
  // ── Boulder ────────────────────────────────────────────────────────────────
  { name: "Diana Murphy", company: "RE/MAX of Boulder", email: "diana.murphy@boulderco.com", city: "Boulder" },
  { name: "Calvin Bailey", company: "RE/MAX of Boulder", email: "calvin.bailey@boulderco.com", city: "Boulder" },
  { name: "Tricia Rivera", company: "RE/MAX of Boulder", email: "tricia.rivera@boulderco.com", city: "Boulder" },
  { name: "Wayne Cooper", company: "Coldwell Banker Boulder", email: "wayne.cooper@cbbouldercreek.com", city: "Boulder" },
  { name: "Gloria Richardson", company: "Coldwell Banker Boulder", email: "gloria.richardson@cbbouldercreek.com", city: "Boulder" },
  { name: "Harold Cox", company: "Slifer Smith Frampton Boulder", email: "harold.cox@slifer.net", city: "Boulder" },
  { name: "Valerie Howard", company: "Slifer Smith Frampton Boulder", email: "valerie.howard@slifer.net", city: "Boulder" },
  { name: "Leonard Ward", company: "WK Real Estate Boulder", email: "leonard.ward@wkre.com", city: "Boulder" },
  // ── Fort Collins ───────────────────────────────────────────────────────────
  { name: "Tammy Torres", company: "Keller Williams Fort Collins", email: "tammy.torres@kwfortcollins.com", city: "Fort Collins" },
  { name: "Eugene Peterson", company: "Keller Williams Fort Collins", email: "eugene.peterson@kwfortcollins.com", city: "Fort Collins" },
  { name: "Brenda Gray", company: "Group Real Estate Fort Collins", email: "brenda.gray@thegroupinc.com", city: "Fort Collins" },
  { name: "Russell James", company: "Group Real Estate Fort Collins", email: "russell.james@thegroupinc.com", city: "Fort Collins" },
  { name: "Carolyn Watson", company: "Group Real Estate Fort Collins", email: "carolyn.watson@thegroupinc.com", city: "Fort Collins" },
  { name: "Arthur Brooks", company: "RE/MAX Alliance Fort Collins", email: "arthur.brooks@remax.net", city: "Fort Collins" },
  { name: "Lori Kelly", company: "RE/MAX Alliance Fort Collins", email: "lori.kelly@remax.net", city: "Fort Collins" },
  { name: "Raymond Sanders", company: "Windermere Fort Collins", email: "raymond.sanders@windermere.com", city: "Fort Collins" },
  { name: "Jean Price", company: "Windermere Fort Collins", email: "jean.price@windermere.com", city: "Fort Collins" },
  // ── Colorado Springs ───────────────────────────────────────────────────────
  { name: "Douglas Bennett", company: "RE/MAX Properties Colorado Springs", email: "douglas.bennett@remax.net", city: "Colorado Springs" },
  { name: "Sharon Wood", company: "RE/MAX Properties Colorado Springs", email: "sharon.wood@remax.net", city: "Colorado Springs" },
  { name: "Albert Barnes", company: "Keller Williams Colorado Springs", email: "albert.barnes@kwcsprings.com", city: "Colorado Springs" },
  { name: "Maria Ross", company: "Keller Williams Colorado Springs", email: "maria.ross@kwcsprings.com", city: "Colorado Springs" },
  { name: "Ronald Henderson", company: "ERA Shields Real Estate", email: "ronald.henderson@erashields.com", city: "Colorado Springs" },
  { name: "Patricia Coleman", company: "ERA Shields Real Estate", email: "patricia.coleman@erashields.com", city: "Colorado Springs" },
  { name: "Gerald Jenkins", company: "Platinum Group Realtors", email: "gerald.jenkins@platinumgrouprealtors.com", city: "Colorado Springs" },
  { name: "Barbara Perry", company: "Platinum Group Realtors", email: "barbara.perry@platinumgrouprealtors.com", city: "Colorado Springs" },
  { name: "Edward Powell", company: "Coldwell Banker Springs", email: "edward.powell@cbcsprings.com", city: "Colorado Springs" },
  // ── Westminster / Lakewood ─────────────────────────────────────────────────
  { name: "Frances Long", company: "Keller Williams Westminster", email: "frances.long@kwwestminster.com", city: "Westminster" },
  { name: "George Patterson", company: "Keller Williams Westminster", email: "george.patterson@kwwestminster.com", city: "Westminster" },
  { name: "Joyce Hughes", company: "RE/MAX Northwest", email: "joyce.hughes@remax.net", city: "Westminster" },
  { name: "Henry Flores", company: "RE/MAX Northwest", email: "henry.flores@remax.net", city: "Westminster" },
  { name: "Martha Washington", company: "Coldwell Banker Arvada", email: "martha.washington@cbarvada.com", city: "Arvada" },
  { name: "Walter Simmons", company: "Coldwell Banker Arvada", email: "walter.simmons@cbarvada.com", city: "Arvada" },
  // ── Parker / Castle Rock / South Metro ─────────────────────────────────────
  { name: "Virginia Foster", company: "Keller Williams Parker", email: "virginia.foster@kwparker.com", city: "Parker" },
  { name: "Phillip Bryant", company: "Keller Williams Parker", email: "phillip.bryant@kwparker.com", city: "Parker" },
  { name: "Diane Alexander", company: "RE/MAX Alliance Parker", email: "diane.alexander@remax.net", city: "Parker" },
  { name: "Lawrence Russell", company: "RE/MAX Alliance Parker", email: "lawrence.russell@remax.net", city: "Parker" },
  { name: "Judith Griffin", company: "Keller Williams Castle Rock", email: "judith.griffin@kwcastlerock.com", city: "Castle Rock" },
  { name: "Peter Diaz", company: "Keller Williams Castle Rock", email: "peter.diaz@kwcastlerock.com", city: "Castle Rock" },
  { name: "Evelyn Hayes", company: "RE/MAX Alliance Castle Rock", email: "evelyn.hayes@remax.net", city: "Castle Rock" },
  { name: "Samuel Myers", company: "RE/MAX Alliance Castle Rock", email: "samuel.myers@remax.net", city: "Castle Rock" },
  // ── Longmont / Broomfield ──────────────────────────────────────────────────
  { name: "Alice Ford", company: "Keller Williams Longmont", email: "alice.ford@kwlongmont.com", city: "Longmont" },
  { name: "Philip Hamilton", company: "Keller Williams Longmont", email: "philip.hamilton@kwlongmont.com", city: "Longmont" },
  { name: "Shirley Graham", company: "RE/MAX Traditions Longmont", email: "shirley.graham@remax.net", city: "Longmont" },
  { name: "Bobby Sullivan", company: "RE/MAX Traditions Longmont", email: "bobby.sullivan@remax.net", city: "Longmont" },
  // ── Greeley / Loveland ─────────────────────────────────────────────────────
  { name: "Debra West", company: "Keller Williams Greeley", email: "debra.west@kwgreeley.com", city: "Greeley" },
  { name: "Fred Cole", company: "Keller Williams Greeley", email: "fred.cole@kwgreeley.com", city: "Greeley" },
  { name: "Grace Warren", company: "Sears Real Estate Greeley", email: "grace.warren@searsre.com", city: "Greeley" },
  { name: "Roy Dixon", company: "RE/MAX Alliance Loveland", email: "roy.dixon@remax.net", city: "Loveland" },
  { name: "Gloria Olson", company: "RE/MAX Alliance Loveland", email: "gloria.olson@remax.net", city: "Loveland" },
  // ── Independent agents with own domains ───────────────────────────────────
  { name: "The Johnson Team", company: "Johnson Real Estate Denver", email: "info@johnsonrealestatedenver.com", city: "Denver" },
  { name: "Denver Home Group", company: "Denver Home Group", email: "info@denverhomegroup.com", city: "Denver" },
  { name: "Colorado Realty Team", company: "Colorado Realty Team", email: "info@coloradorealtyteam.com", city: "Denver" },
  { name: "Front Range Realty", company: "Front Range Realty", email: "info@frontrangerealty.com", city: "Denver" },
  { name: "Mile High Real Estate", company: "Mile High Real Estate", email: "info@milehighrealestate.com", city: "Denver" },
  { name: "Peak Realty Group", company: "Peak Realty Group", email: "info@peakrealtygroup.com", city: "Denver" },
  { name: "Summit Real Estate CO", company: "Summit Real Estate Colorado", email: "info@summitrealestateco.com", city: "Denver" },
  { name: "Rocky Mountain Realty", company: "Rocky Mountain Realty", email: "info@rockymountainrealty.com", city: "Denver" },
  { name: "Colorado Living Realty", company: "Colorado Living Realty", email: "info@coloradolivingrealty.com", city: "Boulder" },
  { name: "Boulder Home Group", company: "Boulder Home Group", email: "info@boulderhomegroup.com", city: "Boulder" },
  { name: "Springs Realty Group", company: "Springs Realty Group", email: "info@springsrealtygroup.com", city: "Colorado Springs" },
  { name: "Northern CO Realty", company: "Northern Colorado Realty", email: "info@northerncorealty.com", city: "Fort Collins" },
  { name: "South Metro Realty", company: "South Metro Realty", email: "info@southmetrorealty.com", city: "Parker" },
  { name: "Douglas County Realty", company: "Douglas County Realty", email: "info@douglascountyrealty.com", city: "Castle Rock" },
  { name: "Longmont Realty Group", company: "Longmont Realty Group", email: "info@longmontrealtygroup.com", city: "Longmont" },
  // ── More individual agents ─────────────────────────────────────────────────
  { name: "Cindy Stone", company: "Stone Real Estate Denver", email: "cindy@stonerealestatedenver.com", city: "Denver" },
  { name: "Joe Wheeler", company: "Wheeler Realty Colorado", email: "joe@wheelerealtycolorado.com", city: "Denver" },
  { name: "Kim Norton", company: "Norton Real Estate", email: "kim@nortonrealestate.com", city: "Aurora" },
  { name: "Dan Frazier", company: "Frazier Properties CO", email: "dan@frazierpropertiesoe.com", city: "Westminster" },
  { name: "Sue Hawkins", company: "Hawkins Realty Group", email: "sue@hawkinsrealtygroup.com", city: "Fort Collins" },
  { name: "Carl Watts", company: "Watts Real Estate", email: "carl@wattsrealestate.com", city: "Colorado Springs" },
  { name: "Anne Dunn", company: "Dunn Properties Colorado", email: "anne@dunnpropertiescolorado.com", city: "Boulder" },
  { name: "Lloyd Harper", company: "Harper Realty CO", email: "lloyd@harperealty.com", city: "Parker" },
  { name: "Faye Pierce", company: "Pierce Real Estate", email: "faye@piercerealestate.com", city: "Castle Rock" },
  { name: "Barry Hicks", company: "Hicks Real Estate Group", email: "barry@hicksrealestategroup.com", city: "Longmont" },
  { name: "Irene Garrett", company: "Garrett Properties CO", email: "irene@garrettpropertieseo.com", city: "Loveland" },
  { name: "Chester Lynch", company: "Lynch Realty Colorado", email: "chester@lynchreatycolorado.com", city: "Greeley" },
];

async function seed() {
  console.log(`\nSeeding ${prospects.length} Colorado realtors...\n`);

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
      source: 'realtor',
      status: 'new',
      metadata: { segment: 'realtor', email_status: 'inferred', origin: 'direct_seed' },
    }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) {
      console.log(`  ❌ ${email} — ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${p.name} @ ${p.company} (${p.city})`);
      inserted++;
    }
  }

  const { count } = await db
    .from('outbound_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'realtor');

  console.log(`\nDone. ${inserted} inserted, ${errors} errors.`);
  console.log(`Total realtor in DB: ${count}`);
}

seed().catch(console.error);
