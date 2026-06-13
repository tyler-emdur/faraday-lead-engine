-- Lead Intelligence Engine v1 — Additional Schema
-- Run in Supabase SQL Editor AFTER schema.sql

-- Add referral tracking to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS referral_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS referral_requested_at TIMESTAMPTZ;


-- ═══════════════════════════════════
-- OPPORTUNITIES — Central intelligence table
-- One row per discovered opportunity from any source
-- ═══════════════════════════════════
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('reddit', 'storm', 'community_import', 'property_scan')),
  source_id TEXT, -- external ID (reddit post id, storm alert id, etc.)

  -- Classification
  type TEXT NOT NULL CHECK (type IN ('community_post', 'storm_victim_area', 'property_target', 'referral_request')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Content
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  author TEXT,
  location TEXT,
  zip TEXT,

  -- Scoring
  urgency_score INTEGER DEFAULT 0 CHECK (urgency_score BETWEEN 0 AND 100),
  opportunity_score INTEGER DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),

  -- AI analysis
  why_it_matters TEXT,
  close_probability INTEGER CHECK (close_probability BETWEEN 0 AND 100),
  outreach_message TEXT,
  follow_up_schedule TEXT,

  -- Conversion tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'inspection_booked', 'won', 'lost')),
  contacted_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Link to converted lead
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opp_priority ON opportunities(priority, opportunity_score DESC);
CREATE INDEX idx_opp_status ON opportunities(status);
CREATE INDEX idx_opp_source ON opportunities(source);
CREATE INDEX idx_opp_created ON opportunities(created_at DESC);
CREATE INDEX idx_opp_source_id ON opportunities(source_id) WHERE source_id IS NOT NULL;

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON opportunities FOR ALL USING (true);


-- ═══════════════════════════════════
-- STORM AFFECTED AREAS — Neighborhood-level storm impact
-- Created when a storm alert is processed
-- ═══════════════════════════════════
CREATE TABLE storm_affected_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storm_alert_id UUID REFERENCES storm_alerts(id) ON DELETE CASCADE,

  city TEXT NOT NULL,
  neighborhood TEXT,
  zip TEXT,

  hail_size_inches DECIMAL(4,2),
  severity_score INTEGER CHECK (severity_score BETWEEN 0 AND 100),
  impact_radius_miles DECIMAL(4,2),
  estimated_homes INTEGER,

  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storm_areas_alert ON storm_affected_areas(storm_alert_id);
CREATE INDEX idx_storm_areas_city ON storm_affected_areas(city);
CREATE INDEX idx_storm_areas_created ON storm_affected_areas(created_at DESC);

ALTER TABLE storm_affected_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON storm_affected_areas FOR ALL USING (true);


-- ═══════════════════════════════════
-- COMMUNITY POSTS — Manual import queue
-- For Facebook groups, Nextdoor posts Tyler pastes in
-- ═══════════════════════════════════
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  source TEXT NOT NULL CHECK (source IN ('facebook', 'nextdoor', 'other')),
  url TEXT,
  author TEXT,
  text TEXT NOT NULL,
  location TEXT,
  posted_at TIMESTAMPTZ,

  urgency_score INTEGER DEFAULT 0,
  matched_keywords TEXT[],

  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_source ON community_posts(source);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON community_posts FOR ALL USING (true);
