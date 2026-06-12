-- Faraday Construction Lead Engine — Supabase Schema
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════
-- LEADS — Core lead capture table
-- ═══════════════════════════════════
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  phone TEXT,
  email TEXT,
  zip TEXT,
  city TEXT,
  service TEXT CHECK (service IN ('roofing', 'hail_damage', 'windows', 'solar', 'multiple')),
  homeowner BOOLEAN,
  roof_age INTEGER,
  damage_visible BOOLEAN,
  damage_description TEXT,
  insurance_filed TEXT CHECK (insurance_filed IN ('true', 'false', 'planning_to')),
  urgency TEXT CHECK (urgency IN ('emergency', 'immediate', 'this_month', 'exploring')),
  electric_bill TEXT,
  notes TEXT,
  score INTEGER DEFAULT 0,
  grade CHAR(1) DEFAULT 'D',
  conversation TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  source TEXT DEFAULT 'chat', -- chat, facebook, google, direct, referral
  source_detail TEXT, -- specific campaign or keyword
  team_notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast dashboard queries
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_service ON leads(service);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- ═══════════════════════════════════
-- STORM ALERTS — Weather event tracking
-- ═══════════════════════════════════
CREATE TABLE storm_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nws_id TEXT UNIQUE, -- Deduplicate NWS alerts
  event TEXT NOT NULL,
  headline TEXT,
  severity TEXT,
  areas TEXT,
  affected_cities TEXT[], -- Array of Front Range cities hit
  description TEXT,
  onset TIMESTAMPTZ,
  expires TIMESTAMPTZ,
  has_hail BOOLEAN DEFAULT FALSE,
  posted_to_facebook BOOLEAN DEFAULT FALSE,
  posted_to_gbp BOOLEAN DEFAULT FALSE,
  facebook_post_id TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storms_detected ON storm_alerts(detected_at DESC);
CREATE INDEX idx_storms_hail ON storm_alerts(has_hail) WHERE has_hail = TRUE;

-- ═══════════════════════════════════
-- FOLLOW-UPS — Automated drip sequence tracking
-- ═══════════════════════════════════
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  step INTEGER NOT NULL, -- 1-5
  template TEXT, -- Which template was sent
  content TEXT, -- Actual content sent
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_followups_pending ON follow_ups(status, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_followups_lead ON follow_ups(lead_id);

-- ═══════════════════════════════════
-- BLOG POSTS — Auto-generated SEO content
-- ═══════════════════════════════════
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  meta_description TEXT,
  target_keyword TEXT,
  target_city TEXT,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_published ON blog_posts(published, published_at DESC);
CREATE INDEX idx_blog_slug ON blog_posts(slug);

-- ═══════════════════════════════════
-- JOBS — Track work for review automation
-- ═══════════════════════════════════
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  service_type TEXT,
  address TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'complete', 'cancelled')),
  completed_at TIMESTAMPTZ,
  review_requested BOOLEAN DEFAULT FALSE,
  review_requested_at TIMESTAMPTZ,
  review_received BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_review ON jobs(status, review_requested)
  WHERE status = 'complete' AND review_requested = FALSE;

-- ═══════════════════════════════════
-- ACTIVITY LOG — Track all system actions
-- ═══════════════════════════════════
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- lead_captured, storm_detected, post_published, email_sent, sms_sent, review_requested
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_type ON activity_log(type);

-- ═══════════════════════════════════
-- FUNCTIONS — Auto-update timestamps
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════
-- FOLLOW-UP SCHEDULING FUNCTION
-- Called after a lead is inserted to schedule the 5-step sequence
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION schedule_follow_ups()
RETURNS TRIGGER AS $$
BEGIN
  -- Step 1: Immediate email (deliver value)
  INSERT INTO follow_ups (lead_id, type, step, template, scheduled_for)
  VALUES (NEW.id, 'email', 1, 'welcome', NOW());

  -- Step 2: 1 hour SMS (personal touch)
  INSERT INTO follow_ups (lead_id, type, step, template, scheduled_for)
  VALUES (NEW.id, 'sms', 2, 'intro_text', NOW() + INTERVAL '1 hour');

  -- Step 3: Next day email (value + insurance info)
  INSERT INTO follow_ups (lead_id, type, step, template, scheduled_for)
  VALUES (NEW.id, 'email', 3, 'insurance_info', NOW() + INTERVAL '1 day');

  -- Step 4: Day 3 SMS (check-in)
  INSERT INTO follow_ups (lead_id, type, step, template, scheduled_for)
  VALUES (NEW.id, 'sms', 4, 'check_in', NOW() + INTERVAL '3 days');

  -- Step 5: Day 7 email (last chance)
  INSERT INTO follow_ups (lead_id, type, step, template, scheduled_for)
  VALUES (NEW.id, 'email', 5, 'last_chance', NOW() + INTERVAL '7 days');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_lead_follow_ups
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION schedule_follow_ups();

-- ═══════════════════════════════════
-- ROW LEVEL SECURITY (optional but recommended)
-- ═══════════════════════════════════
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (your backend)
CREATE POLICY "Service role full access" ON leads FOR ALL USING (true);
CREATE POLICY "Service role full access" ON storm_alerts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON follow_ups FOR ALL USING (true);
CREATE POLICY "Service role full access" ON blog_posts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON jobs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON activity_log FOR ALL USING (true);

-- Allow anonymous read on published blog posts (for SEO)
CREATE POLICY "Public read blog posts" ON blog_posts
  FOR SELECT USING (published = TRUE);
