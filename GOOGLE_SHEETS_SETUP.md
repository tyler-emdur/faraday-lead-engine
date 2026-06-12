# Google Sheets Lead Tracker Setup

Every lead Anna captures automatically appears as a new row in your Google Sheet.
This is your billing record — proof of every lead you sent to Faraday.

## Columns in the Sheet

| Column | What it contains |
|--------|-----------------|
| Timestamp | When the lead came in (Mountain Time) |
| Name | Homeowner's name |
| Phone | Their phone number ← most important |
| Email | Their email |
| City / Zip | Location |
| Service | Hail Damage / Roofing / Solar / Windows / Multiple |
| Grade | A (Hot) / B (Warm) / C (Cool) / D (Cold) |
| Score | 0–100 lead quality score |
| Urgency | EMERGENCY / Immediate / This Month / Exploring |
| Insurance Filed | Filed / Planning to File / Not Filed |
| Homeowner | Yes / No |
| Damage Visible | Yes / No |
| Roof Age | Years |
| Source | chat / estimator / exit_intent |
| Damage Description | What they described |
| Status | New (update manually when Faraday confirms a job) |
| Lead ID | Internal reference ID |

---

## One-Time Setup (~15 minutes)

### Step 1: Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it "Faraday Leads" → Create
3. In the search bar, search **"Google Sheets API"** → Enable it

### Step 2: Service Account (your bot's credentials)
1. Go to **IAM & Admin → Service Accounts** → **Create Service Account**
2. Name: `faraday-leads-bot` → Create and Continue → Done
3. Click the service account → **Keys** tab → **Add Key → Create new key → JSON**
4. A JSON file downloads to your computer — **keep this safe**

### Step 3: Add credentials to your environment
Open the downloaded JSON file in a text editor. Copy the **entire contents**.

In your Vercel dashboard (or `.env.local` for local dev), add:
```
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"...entire JSON on one line..."}
```

Make sure it's on a single line (no line breaks inside the JSON).

### Step 4: Create your Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) → Blank spreadsheet
2. Rename the first tab to exactly: **`Leads`** (capital L)
3. Get the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_IS_YOUR_ID`**`/edit`
4. Add to your environment:
   ```
   GOOGLE_SPREADSHEET_ID=your_sheet_id_here
   ```

### Step 5: Share the sheet with your service account
1. In the JSON file you downloaded, find: `"client_email": "faraday-leads-bot@..."`
2. In your Google Sheet → **Share** → paste that email address → **Editor** → Share
3. The bot can now write to your sheet

### Step 6: Deploy
Push your code to Vercel. The first lead captured will auto-create the header row and start filling in data.

---

## Tracking Your $100/Job

When Faraday confirms a job was won from one of your leads:
1. Open the sheet
2. Find the lead by name/phone
3. Change the **Status** column from "New" → "Won - Job Confirmed"
4. Add the invoice amount in a notes column if you want

You can also add a formula to count your earnings:
- In an empty cell: `=COUNTIF(P:P,"Won - Job Confirmed") * 100`
- This shows your total earnings automatically

---

## Troubleshooting

**No rows appearing?**
- Check that `GOOGLE_SHEETS_CREDENTIALS` is valid JSON (no line breaks, properly escaped)
- Check Vercel logs for "Google Sheets append error"
- Make sure the sheet tab is named exactly `Leads`
- Make sure the service account email has Editor access

**"Permission denied" error?**
- The service account wasn't added as an Editor to the sheet
- Re-share the sheet with the service account email
