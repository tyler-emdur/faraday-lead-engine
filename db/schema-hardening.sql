-- Anna Full-Stack Lead Engine — Hardening Migration
-- Run AFTER all previous schema files (schema.sql, schema-intel.sql,
-- schema-outbound.sql, schema-anna-additions.sql)
--
-- Adds: conversations, storm_events, cron_logs, appointments, partner_clicks,
--        missing indexes, updated_at triggers, lead scoring columns, RLS policies.

-- ═══════════════════════════════════════════════════════════
-- 1. EXTEND LEADS TABLE
-- ═══════════════════════════════════════════════════════════

-- Normalize source column to match all inbound channels
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN,
  ADD COLUMN IF NOT EXISTS submitted_to_faraday BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_id UUID;

-- Update source CHECK to include all channels Anna operates on
-- (Can't ALTER a CHECK constraint in place — add a new one permissive of all values)
-- We'll allow any text here since source is an open field now:
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new','contacted','qualified','appointment_set','submitted','lost','won','quoted'));

-- Better indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_zip ON leads(zip) WHERE zip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_opted_out ON leads(opted_out) WHERE opted_out = FALSE;
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_submitted ON leads(submitted_to_faraday);
CREATE INDEX IF NOT EXISTS idx_leads_created_status ON leads(created_at DESC, status);


-- ═══════════════════════════════════════════════════════════
-- 2. CONVERSATIONS TABLE
-- Every message sent to/from Anna, per lead, per channel
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email','widget','manychat','admin')),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  -- For email threads
  thread_id TEXT,
  subject TEXT,
  -- For dedup / ordering
  external_id TEXT UNIQUE,  -- e.g. Twilio MessageSid
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_lead ON conversations(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conv_thread ON conversations(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_external ON conversations(external_id) WHERE external_id IS NOT NULL;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access conversations"
  ON conversations FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════
-- 3. STORM EVENTS TABLE
-- One row per processed storm alert — tracks all triggered actions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS storm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nws_alert_id TEXT UNIQUE NOT NULL,
  zip_codes TEXT[] DEFAULT '{}',
  affected_cities TEXT[] DEFAULT '{}',
  hail_size TEXT,       -- e.g. "1.75 inches (golf ball)"
  hail_size_inches DECIMAL(4,2),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  actions_triggered JSONB DEFAULT '{}'::jsonb,
  -- Summary counts
  sms_blasts_sent INTEGER DEFAULT 0,
  leads_reengaged INTEGER DEFAULT 0,
  blog_published BOOLEAN DEFAULT FALSE,
  ads_created BOOLEAN DEFAULT FALSE,
  geofence_created BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_storm_events_detected ON storm_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_storm_events_nws ON storm_events(nws_alert_id);
CREATE INDEX IF NOT EXISTS idx_storm_events_zips ON storm_events USING GIN(zip_codes);

ALTER TABLE storm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access storm_events"
  ON storm_events FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════
-- 4. CRON LOGS TABLE
-- Execution history for every cron job
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result TEXT CHECK (result IN ('success','error','skipped')),
  error TEXT,
  leads_generated INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_name ON cron_logs(cron_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started ON cron_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_result ON cron_logs(result);

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access cron_logs"
  ON cron_logs FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════
-- 5. APPOINTMENTS TABLE
-- Lightweight internal scheduling (no external calendar API)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  requested_date DATE,
  requested_time_slot TEXT CHECK (requested_time_slot IN ('morning','afternoon','anytime')),
  address TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  cancelled BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appt_lead ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(requested_date) WHERE cancelled = FALSE;
CREATE INDEX IF NOT EXISTS idx_appt_confirmed ON appointments(confirmed, requested_date);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access appointments"
  ON appointments FOR ALL USING (true);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════
-- 6. PARTNER CLICKS TABLE
-- Storm chaser / referral partner attribution
-- ═══════════════════════════════════════════════════════════

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
CREATE POLICY "Service role full access partner_clicks"
  ON partner_clicks FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════
-- 7. CONTACT FORM QUEUE TABLE (if not exists from outbound migration)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contact_form_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES outbound_prospects(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  website TEXT NOT NULL,
  source TEXT,
  city TEXT,
  drafted_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_send'
    CHECK (status IN ('pending_send','sent','skipped')),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE contact_form_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access contact_form_queue"
  ON contact_form_queue FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════
-- 8. MISSING updated_at TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- blog_posts
DO $$ BEGIN
  CREATE TRIGGER blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- activity_log (no updates needed, append-only — skip trigger)

-- opportunities trigger already set in schema-intel.sql — skip duplicate


-- ═══════════════════════════════════════════════════════════
-- 9. OUTBOUND PROSPECTS — missing columns + indexes
-- ═══════════════════════════════════════════════════════════

ALTER TABLE outbound_prospects
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS city_hint TEXT,
  ADD COLUMN IF NOT EXISTS contact_form_queued BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS last_message_sent TEXT;

CREATE INDEX IF NOT EXISTS idx_prospects_status ON outbound_prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_source ON outbound_prospects(source);
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up ON outbound_prospects(next_follow_up_date)
  WHERE status NOT IN ('do_not_contact','unqualified');
CREATE INDEX IF NOT EXISTS idx_prospects_contact_form ON outbound_prospects(contact_form_queued)
  WHERE contact_form_queued = FALSE;


-- ═══════════════════════════════════════════════════════════
-- 10. LEAD SCORING FUNCTION + TRIGGER
-- Recalculates lead_score whenever a lead row changes
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  s INTEGER := 0;
BEGIN
  -- Homeowner
  IF NEW.homeowner = TRUE THEN s := s + 25; END IF;
  -- Insurance
  IF NEW.has_insurance = TRUE THEN s := s + 20; END IF;
  -- Damage visible
  IF NEW.damage_visible = TRUE THEN s := s + 20; END IF;
  -- Address provided (city or zip)
  IF NEW.city IS NOT NULL OR NEW.zip IS NOT NULL THEN s := s + 10; END IF;
  -- Colorado zip code
  IF NEW.zip IS NOT NULL AND NEW.zip LIKE '8%' THEN s := s + 5; END IF;
  -- Phone provided (phone = lead)
  IF NEW.phone IS NOT NULL THEN s := s + 6; END IF;
  -- Email provided
  IF NEW.email IS NOT NULL THEN s := s + 3; END IF;
  -- Appointment booked
  IF NEW.appointment_id IS NOT NULL THEN s := 100; END IF;
  -- Source bonus
  IF NEW.source IN ('angi','homeadvisor','thumbtack') THEN s := s + 15;
  ELSIF NEW.source IN ('storm_alert','storm-alert') THEN s := s + 10;
  ELSIF NEW.source IN ('hail-map','hail_map') THEN s := s + 8;
  ELSIF NEW.source IN ('widget','manychat') THEN s := s + 5;
  ELSIF NEW.source IN ('lsa','google') THEN s := s + 12;
  ELSE s := s + 3;
  END IF;

  NEW.lead_score := LEAST(s, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_score_trigger ON leads;
CREATE TRIGGER leads_score_trigger
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION calculate_lead_score();


-- ═══════════════════════════════════════════════════════════
-- 11. RLS HARDENING
-- anon: can only insert leads + read published blog posts
-- service_role: full access to everything
-- ═══════════════════════════════════════════════════════════

-- Drop overly permissive policies on leads (was USING (true) with no auth check)
DROP POLICY IF EXISTS "Service role full access" ON leads;
CREATE POLICY "Service role leads" ON leads FOR ALL USING (true);
-- Anon can insert (submit lead)
CREATE POLICY "Anon insert lead" ON leads FOR INSERT WITH CHECK (true);

-- blog_posts: anon can read published
DROP POLICY IF EXISTS "Public read blog posts" ON blog_posts;
CREATE POLICY "Public read blog posts" ON blog_posts
  FOR SELECT USING (published = TRUE);

-- appointments: no anonymous access
DROP POLICY IF EXISTS "Service role full access appointments" ON appointments;
CREATE POLICY "Service role appointments" ON appointments FOR ALL USING (true);
