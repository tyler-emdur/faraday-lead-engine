// GET  /api/hail-map/check?zip=80031 → { hasActivity, mostRecentDate, severity }
// POST /api/hail-map/check { zip, name, phone, capture:true } → saves lead + Anna texts

import { NextRequest, NextResponse } from "next/server";
import { fetchColoradoAlerts } from "@/lib/nws";
import { notifyTyler } from "@/lib/notify";
import { sendSMS } from "@/lib/twilio";
import { normalizePhone } from "@/lib/phone";

// CO zip→county lookup (Front Range coverage)
const ZIP_COUNTIES: Record<string, string> = {
  "80000": "Denver", "80001": "Adams", "80002": "Jefferson", "80003": "Jefferson",
  "80004": "Jefferson", "80005": "Jefferson", "80006": "Jefferson", "80007": "Jefferson",
  "80010": "Arapahoe", "80011": "Arapahoe", "80012": "Arapahoe", "80013": "Arapahoe",
  "80014": "Arapahoe", "80015": "Arapahoe", "80016": "Arapahoe", "80017": "Arapahoe",
  "80018": "Arapahoe", "80019": "Adams", "80020": "Broomfield", "80021": "Jefferson",
  "80022": "Adams", "80023": "Broomfield", "80024": "Adams", "80025": "Boulder",
  "80026": "Boulder", "80027": "Boulder", "80028": "Jefferson", "80030": "Adams",
  "80031": "Adams", "80033": "Jefferson", "80034": "Jefferson", "80035": "Adams",
  "80036": "Adams", "80037": "Adams", "80038": "Adams", "80040": "Arapahoe",
  "80041": "Arapahoe", "80042": "Arapahoe", "80044": "Arapahoe", "80045": "Arapahoe",
  "80046": "Arapahoe", "80047": "Arapahoe", "80110": "Arapahoe", "80111": "Arapahoe",
  "80112": "Arapahoe", "80113": "Arapahoe", "80120": "Arapahoe", "80121": "Arapahoe",
  "80122": "Arapahoe", "80123": "Jefferson", "80124": "Douglas", "80125": "Douglas",
  "80126": "Douglas", "80127": "Jefferson", "80128": "Jefferson", "80129": "Douglas",
  "80130": "Douglas", "80131": "Douglas", "80132": "El Paso", "80133": "El Paso",
  "80134": "Douglas", "80135": "Douglas", "80136": "Adams", "80137": "Adams",
  "80138": "Douglas", "80150": "Arapahoe", "80151": "Arapahoe", "80155": "Arapahoe",
  "80160": "Arapahoe", "80161": "Arapahoe", "80162": "Jefferson", "80163": "Douglas",
  "80165": "Arapahoe", "80166": "Arapahoe", "80201": "Denver", "80202": "Denver",
  "80203": "Denver", "80204": "Denver", "80205": "Denver", "80206": "Denver",
  "80207": "Denver", "80208": "Denver", "80209": "Denver", "80210": "Denver",
  "80211": "Denver", "80212": "Denver", "80214": "Jefferson", "80215": "Jefferson",
  "80216": "Denver", "80217": "Denver", "80218": "Denver", "80219": "Denver",
  "80220": "Denver", "80221": "Adams", "80222": "Denver", "80223": "Denver",
  "80224": "Denver", "80225": "Jefferson", "80226": "Jefferson", "80227": "Jefferson",
  "80228": "Jefferson", "80229": "Adams", "80230": "Denver", "80231": "Denver",
  "80232": "Jefferson", "80233": "Adams", "80234": "Adams", "80235": "Jefferson",
  "80236": "Denver", "80237": "Denver", "80238": "Denver", "80239": "Denver",
  "80241": "Adams", "80243": "Denver", "80244": "Denver", "80246": "Denver",
  "80247": "Arapahoe", "80248": "Denver", "80249": "Denver", "80250": "Denver",
  "80251": "Denver", "80252": "Denver", "80256": "Denver", "80257": "Denver",
  "80259": "Denver", "80260": "Adams", "80261": "Denver", "80262": "Denver",
  "80263": "Denver", "80264": "Denver", "80265": "Denver", "80266": "Denver",
  "80271": "Denver", "80273": "Denver", "80274": "Denver", "80281": "Denver",
  "80290": "Denver", "80291": "Denver", "80293": "Denver", "80294": "Denver",
  "80295": "Denver", "80299": "Denver", "80301": "Boulder", "80302": "Boulder",
  "80303": "Boulder", "80304": "Boulder", "80305": "Boulder", "80306": "Boulder",
  "80307": "Boulder", "80308": "Boulder", "80309": "Boulder", "80310": "Boulder",
  "80314": "Boulder", "80401": "Jefferson", "80402": "Jefferson", "80403": "Jefferson",
  "80419": "Jefferson", "80420": "Park", "80421": "Park", "80422": "Jefferson",
  "80439": "Jefferson", "80452": "Clear Creek", "80453": "Jefferson", "80454": "Jefferson",
  "80455": "Boulder", "80456": "Park", "80457": "Jefferson", "80465": "Jefferson",
  "80470": "Jefferson", "80471": "Jefferson", "80481": "Boulder", "80516": "Boulder",
  "80521": "Larimer", "80523": "Larimer", "80524": "Larimer", "80525": "Larimer",
  "80526": "Larimer", "80528": "Larimer", "80534": "Weld", "80538": "Larimer",
  "80601": "Adams", "80602": "Adams", "80603": "Adams", "80610": "Weld",
  "80611": "Weld", "80612": "Weld", "80615": "Weld", "80620": "Weld",
  "80621": "Weld", "80622": "Weld", "80623": "Weld", "80624": "Weld",
  "80631": "Weld", "80632": "Weld", "80633": "Weld", "80634": "Weld",
  "80640": "Adams", "80641": "Adams", "80642": "Adams", "80643": "Adams",
  "80644": "Weld", "80645": "Weld", "80648": "Weld", "80649": "Adams",
  "80650": "Weld", "80651": "Adams", "80652": "Weld", "80653": "Adams",
  "80654": "Weld",
};

function zipToCounty(zip: string): string | null {
  return ZIP_COUNTIES[zip] || null;
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip")?.trim() || "";
  if (!zip) return NextResponse.json({ hasActivity: false, mostRecentDate: "", severity: "low" });

  const county = zipToCounty(zip);

  try {
    const alerts = await fetchColoradoAlerts();
    const relevant = alerts.filter(a =>
      a.has_hail && (
        !county || a.areas.toLowerCase().includes(county.toLowerCase()) ||
        a.affected_cities.some(c => c.length > 0)
      )
    );

    if (relevant.length > 0) {
      const mostRecent = relevant.sort((a, b) =>
        new Date(b.onset || b.expires).getTime() - new Date(a.onset || a.expires).getTime()
      )[0];
      const date = mostRecent.onset ? new Date(mostRecent.onset).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "recently";
      const hailMatch = mostRecent.description.match(/(\d+(?:\.\d+)?)\s*inch/i);
      const hailSize = hailMatch ? parseFloat(hailMatch[1]) : 0.75;
      const severity = hailSize >= 1.5 ? "high" : hailSize >= 1.0 ? "medium" : "low";
      return NextResponse.json({ hasActivity: true, mostRecentDate: date, severity });
    }

    // Check storm_alerts table for recent history
    if (process.env.SUPABASE_URL) {
      const { getSupabase } = await import("@/lib/supabase");
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data } = await getSupabase()
        .from("storm_alerts")
        .select("detected_at, has_hail, description")
        .eq("has_hail", true)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const date = new Date(data[0].detected_at).toLocaleDateString("en-US", { month: "long", day: "numeric" });
        return NextResponse.json({ hasActivity: true, mostRecentDate: date, severity: "medium" });
      }
    }

    // No data → still return true (hail data is always incomplete)
    return NextResponse.json({ hasActivity: true, mostRecentDate: "recent months", severity: "low" });
  } catch {
    return NextResponse.json({ hasActivity: true, mostRecentDate: "recently", severity: "medium" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zip, name, phone: rawPhone, capture, mostRecentDate } = body;

    if (!capture || !rawPhone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone) || rawPhone;
    const firstName = (name || "").split(" ")[0] || "there";
    const county = zipToCounty(zip || "") || "Colorado";
    const dateStr = mostRecentDate || "recently";

    let leadId: string | null = null;

    if (process.env.SUPABASE_URL) {
      const { getSupabase } = await import("@/lib/supabase");
      const db = getSupabase();

      // Deduplicate by phone
      const { data: existing } = await db.from("leads").select("id").eq("phone", phone).maybeSingle();

      if (existing) {
        leadId = existing.id;
        await db.from("leads").update({ source: "hail-map", zip, status: "contacted" }).eq("id", existing.id);
      } else {
        const { data: created } = await db.from("leads").insert({
          name: name || null,
          phone,
          zip,
          city: county,
          source: "hail-map",
          service: "hail_damage",
          status: "new",
        }).select("id").single();
        leadId = created?.id || null;
      }

      await db.from("activity_log").insert({
        type: "lead_captured",
        description: `Hail map lead: ${name || phone} in ${zip}`,
        metadata: { phone, zip, source: "hail-map" },
      });
    }

    // Anna SMS
    const hasActivity = body.hasActivity !== false;
    const sms = hasActivity
      ? `Hey ${firstName}! I checked hail records for ${zip} — looks like your area was hit ${dateStr}. Want me to schedule a free inspection? Faraday can usually get out within 48 hours. -Anna, Faraday`
      : `Hey ${firstName}! Our records for ${zip} don't show recent major hail, but a lot of damage goes unreported. A free inspection takes 20 min and costs nothing. Want me to set one up? -Anna, Faraday`;

    await sendSMS(phone, sms).catch(e => console.error("Hail map SMS failed:", e));

    // Notify Tyler
    await notifyTyler(
      `🗺 Hail Map Lead\n${name || "Unknown"} | ${phone}\nZip: ${zip} | ${hasActivity ? "Hail detected" : "No data"}\nAnna texted them`,
      `🗺 Hail Map — ${name || phone}`
    ).catch(() => {});

    // Save to conversations
    if (leadId && process.env.SUPABASE_URL) {
      const { getSupabase } = await import("@/lib/supabase");
      const { error: convErr } = await getSupabase().from("conversations").insert({
        lead_id: leadId,
        channel: "sms",
        role: "assistant",
        content: sms,
      });
      if (convErr) console.error("Conversation save failed:", convErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Hail map capture error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
