// One-off verification: confirms the partner schema is live and the lead WRITE
// path works end-to-end. Inserts a test lead, attributes it, reads it back, then
// deletes it (no junk left behind). Run: node scripts/verify-supabase.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const log = (...a) => console.log(...a);

// 1. Schema: partners table + new lead columns
log("\n=== 1. SCHEMA ===");
const { error: pErr, count: pCount } = await db.from("partners").select("*", { count: "exact", head: true });
log(pErr ? `❌ partners table: ${pErr.message}` : `✅ partners table exists (${pCount} rows)`);

const { error: colErr } = await db.from("leads").select("id, partner_id, accepted, accepted_at").limit(1);
log(colErr ? `❌ leads.partner_id/accepted: ${colErr.message}` : `✅ leads has partner_id / accepted / accepted_at`);

// 2. Existing partners + the tyler-test the user created
log("\n=== 2. PARTNERS ===");
const { data: partners } = await db.from("partners").select("slug, name, status, type, zip_codes, referral_fee").limit(20);
if (!partners?.length) log("(no partner records yet)");
for (const p of partners || []) log(`  • ${p.slug} — ${p.name || "?"} [${p.status}, ${p.type}] zips:${(p.zip_codes||[]).length} fee:$${p.referral_fee}`);

// 3. Recent leads + attribution
log("\n=== 3. RECENT LEADS (last 8) ===");
const { data: leads } = await db.from("leads")
  .select("name, phone, source, partner_id, accepted, created_at")
  .order("created_at", { ascending: false }).limit(8);
for (const l of leads || []) log(`  • ${(l.name||"?").padEnd(14)} ${(l.source||"?").padEnd(12)} partner:${l.partner_id ? "yes" : "—"} accepted:${l.accepted} ${l.created_at?.slice(0,16)}`);
const { count: total } = await db.from("leads").select("*", { count: "exact", head: true });
log(`  total leads: ${total}`);

// 4. WRITE TEST — insert, attribute, read back, delete
log("\n=== 4. WRITE TEST (insert → attribute → read → delete) ===");
const testPhone = "+15557770001";
await db.from("leads").delete().eq("phone", testPhone); // clean any prior run

const { data: created, error: insErr } = await db.from("leads").insert({
  name: "__verify_test", phone: testPhone, zip: "80202", city: "Denver",
  service: "hail_damage", source: "verify-script", status: "new",
}).select("id").single();

if (insErr) {
  log(`❌ INSERT FAILED: ${insErr.message}`);
} else {
  log(`✅ insert ok (id ${created.id.slice(0,8)}…)`);
  // attribute to tyler-test if it exists, else first partner
  const slug = (partners || []).find(p => p.slug === "tyler-test")?.slug || partners?.[0]?.slug;
  if (slug) {
    const { data: pr } = await db.from("partners").select("id").eq("slug", slug).maybeSingle();
    if (pr) {
      const { error: upErr } = await db.from("leads").update({ partner_id: pr.id }).eq("id", created.id);
      log(upErr ? `❌ attribute: ${upErr.message}` : `✅ attributed to partner "${slug}"`);
    }
  } else {
    log("  (no partner to attribute to — create one in /admin/partners)");
  }
  const { data: back } = await db.from("leads").select("name, partner_id, accepted").eq("id", created.id).single();
  log(`  read back: name=${back.name} partner=${back.partner_id ? "set" : "null"} accepted=${back.accepted}`);
  await db.from("leads").delete().eq("id", created.id);
  log("✅ cleaned up test lead");
}
log("\nDone.");
