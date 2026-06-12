// Google Sheets integration — appends every captured lead as a new row
// Tyler's billing tracker: $100/job sent to Faraday Construction
//
// Setup:
// 1. console.cloud.google.com → New Project → Enable "Google Sheets API"
// 2. IAM & Admin → Service Accounts → Create → Download JSON key
// 3. Add env var: GOOGLE_SHEETS_CREDENTIALS = <the entire JSON key file as a single-line string>
// 4. Create your Google Sheet, share it with the service account email as Editor
// 5. Add env var: GOOGLE_SPREADSHEET_ID = (from the sheet URL: /spreadsheets/d/THIS_PART/edit)

import { google } from "googleapis";

const HEADERS = [
  "Timestamp",
  "Name",
  "Phone",
  "Email",
  "City / Zip",
  "Service",
  "Grade",
  "Score",
  "Urgency",
  "Insurance Filed",
  "Homeowner",
  "Damage Visible",
  "Roof Age",
  "Source",
  "Damage Description",
  "Status",
  "Lead ID",
];

function getClient() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set");

  const credentials = typeof raw === "string" ? JSON.parse(raw) : raw;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function appendLeadToSheet(lead: {
  id?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  zip?: string | null;
  service?: string | null;
  grade?: string | null;
  score?: number | null;
  urgency?: string | null;
  insurance_filed?: string | null;
  homeowner?: boolean | null;
  damage_visible?: boolean | null;
  roof_age?: number | null;
  source?: string | null;
  damage_description?: string | null;
  status?: string | null;
}): Promise<boolean> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.warn("GOOGLE_SPREADSHEET_ID not set — skipping sheet append");
    return false;
  }

  try {
    const sheets = getClient();

    // On first use, ensure the header row exists
    await ensureHeaders(sheets, spreadsheetId);

    const serviceLabel: Record<string, string> = {
      roofing: "Roofing",
      hail_damage: "Hail Damage",
      windows: "Windows & Doors",
      solar: "Solar",
      multiple: "Multiple Services",
    };

    const urgencyLabel: Record<string, string> = {
      emergency: "EMERGENCY",
      immediate: "Immediate",
      this_month: "This Month",
      exploring: "Exploring",
    };

    const insuranceLabel: Record<string, string> = {
      true: "Filed",
      planning_to: "Planning to File",
      false: "Not Filed",
    };

    const row = [
      new Date().toLocaleString("en-US", { timeZone: "America/Denver" }),
      lead.name || "",
      lead.phone || "",
      lead.email || "",
      [lead.city, lead.zip].filter(Boolean).join(" ") || "",
      serviceLabel[lead.service || ""] || lead.service || "",
      lead.grade || "",
      lead.score ?? "",
      urgencyLabel[lead.urgency || ""] || lead.urgency || "",
      insuranceLabel[lead.insurance_filed || ""] || "",
      lead.homeowner === true ? "Yes" : lead.homeowner === false ? "No" : "",
      lead.damage_visible === true ? "Yes" : lead.damage_visible === false ? "No" : "",
      lead.roof_age ?? "",
      lead.source || "chat",
      lead.damage_description || "",
      "New",
      lead.id || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Leads!A:Q",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    console.log(`Lead appended to Google Sheet: ${lead.name || "Unknown"}`);
    return true;
  } catch (error) {
    console.error("Google Sheets append error:", error);
    return false;
  }
}

export interface ReengagementLead {
  name: string;
  phone: string;
  cityZip: string;
  service: string;
  status: string;
}

// Read past leads from the sheet — used to re-engage when a storm hits their area
export async function getLeadsForReengagement(
  cities: string[]
): Promise<ReengagementLead[]> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId || cities.length === 0) return [];

  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Leads!A:Q",
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    const citiesLower = cities.map(c => c.toLowerCase());

    return rows
      .slice(1)
      .map(row => ({
        timestamp: row[0] || "",
        name: row[1] || "",
        phone: row[2] || "",
        cityZip: (row[4] || "").toLowerCase(),
        service: row[5] || "",
        status: row[15] || "New",
      }))
      .filter(lead => {
        if (!lead.phone) return false;
        if (lead.status === "Won - Job Confirmed") return false;
        const age = now - new Date(lead.timestamp).getTime();
        if (age < TWO_DAYS || age > NINETY_DAYS) return false;
        return citiesLower.some(city => lead.cityZip.includes(city.toLowerCase()));
      });
  } catch (e) {
    console.error("Failed to read leads from sheet for re-engagement:", e);
    return [];
  }
}

// Writes the header row if the sheet is empty
async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Leads!A1:A1",
    });

    if (!res.data.values || res.data.values.length === 0) {
      // Sheet is empty — write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Leads!A1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
      console.log("Google Sheet headers initialized");
    }
  } catch {
    // Tab might not exist — try to create it or use Sheet1
  }
}
