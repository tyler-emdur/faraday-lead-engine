-- MISSING TABLE — run this in the Supabase SQL editor.
-- partner_clicks records every referral-link click (/api/track/<slug>) and gets
-- its lead_id backfilled when a lead converts. It was defined in schema-hardening.sql
-- but never applied to the live DB, so click counts always read 0.
-- (Attribution still works without it — that uses leads.partner_id — but clicks
-- and conversion % can't record until this exists.)

CREATE TABLE IF NOT EXISTS partner_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_slug TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_hash TEXT,     -- SHA-256 of IP for privacy
  referrer TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL  -- set when a lead converts
);

CREATE INDEX IF NOT EXISTS idx_partner_clicks_slug ON partner_clicks(partner_slug, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_clicks_lead ON partner_clicks(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE partner_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access partner_clicks" ON partner_clicks;
CREATE POLICY "Service role full access partner_clicks"
  ON partner_clicks FOR ALL USING (true);
