-- ═══════════════════════════════════════════════════════════════════════════
-- PARTNER NETWORK — Phase 1: Referral Infrastructure
-- ═══════════════════════════════════════════════════════════════════════════
-- Turns ghost-slug "partners" (free text on partner_clicks) into first-class
-- records that can be assigned ZIP codes (Phase 2 storm automation), tracked
-- through a discovery lifecycle (Phase 3), and shown their own stats (Phase 4).
--
-- Run AFTER schema.sql and schema-hardening.sql (which create leads + partner_clicks).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,          -- the /api/track/<slug> identifier
  name          TEXT,                          -- contact person
  company       TEXT,
  -- partner type drives storm-check messaging segment (matches B2B_STORM_SEGMENTS keys)
  type          TEXT NOT NULL DEFAULT 'other'
                CHECK (type IN (
                  'public_adjuster','home_inspector','property_manager','realtor',
                  'restoration_contractor','solar_installer','gutter_company',
                  'insurance_agent','hoa_manager','plumber','hvac_company',
                  'general_contractor','mortgage_broker','title_company','other'
                )),
  contact_phone TEXT,                          -- E.164 for Twilio storm alerts
  contact_email TEXT,
  -- Discovery → activation lifecycle (Phase 3)
  status        TEXT NOT NULL DEFAULT 'identified'
                CHECK (status IN ('identified','contacted','interested','active','producing','inactive')),
  zip_codes     TEXT[] DEFAULT '{}',           -- service area → storm ZIP matching (Phase 2)
  referral_fee  INTEGER NOT NULL DEFAULT 0,    -- $ you pay partner per ACCEPTED lead (rev-share)
  notes         TEXT,
  source        TEXT,                          -- how they were found (discovery channel)
  last_alerted_at TIMESTAMPTZ,                 -- last storm alert sent (dedupe)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_slug   ON partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_zips   ON partners USING GIN (zip_codes);

-- updated_at trigger (function defined in schema-outbound.sql; recreate defensively)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_partners ON partners;
CREATE TRIGGER set_timestamp_partners
BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access partners" ON partners;
CREATE POLICY "Service role full access partners" ON partners FOR ALL USING (true);

-- ── Lead attribution + the $100 "accepted" event ────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS partner_id  UUID REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_partner ON leads(partner_id) WHERE partner_id IS NOT NULL;
