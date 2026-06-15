-- Anna Activation SQL — paste this entire block into Supabase SQL Editor
-- Run this ONCE before running seed-prospects.js and trigger-crons.sh
-- Safe to run on a fresh DB or an existing one (all statements are idempotent)

-- ── 1. Cron execution log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result TEXT CHECK (result IN ('success', 'error')),
  error TEXT,
  leads_generated INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_cron_logs_name ON cron_logs(cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started ON cron_logs(started_at DESC);
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access cron_logs" ON cron_logs;
CREATE POLICY "Service role full access cron_logs" ON cron_logs FOR ALL USING (auth.role() = 'service_role');

-- ── 2. Outbound prospects ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  company TEXT,
  city TEXT,
  website TEXT,
  city_hint TEXT,
  contact_form_queued BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'unqualified', 'qualified', 'do_not_contact')),
  thread_id TEXT,
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  next_follow_up_date TIMESTAMPTZ,
  last_message_sent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_contacted_at TIMESTAMPTZ
);

-- Fix email nullability if table already existed with NOT NULL constraint
ALTER TABLE outbound_prospects ALTER COLUMN email DROP NOT NULL;

-- Add any columns that might be missing from an older version of the table
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS city_hint TEXT;
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS contact_form_queued BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS next_follow_up_date TIMESTAMPTZ;
ALTER TABLE outbound_prospects ADD COLUMN IF NOT EXISTS last_message_sent TEXT;

CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_prospects(status);
CREATE INDEX IF NOT EXISTS idx_outbound_source ON outbound_prospects(source);
CREATE INDEX IF NOT EXISTS idx_outbound_created ON outbound_prospects(created_at DESC);
ALTER TABLE outbound_prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access outbound_prospects" ON outbound_prospects;
CREATE POLICY "Service role full access outbound_prospects" ON outbound_prospects FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON outbound_prospects;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON outbound_prospects
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ── 3. Email threads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES outbound_prospects(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access email_threads" ON email_threads;
CREATE POLICY "Service role full access email_threads" ON email_threads FOR ALL USING (auth.role() = 'service_role');

-- ── 4. Contact form queue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_form_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES outbound_prospects(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  website TEXT NOT NULL,
  source TEXT,
  city TEXT,
  drafted_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_send'
    CHECK (status IN ('pending_send', 'sent', 'skipped')),
  queued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cfq_status ON contact_form_queue(status);
ALTER TABLE contact_form_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access contact_form_queue" ON contact_form_queue;
CREATE POLICY "Service role full access contact_form_queue" ON contact_form_queue FOR ALL USING (auth.role() = 'service_role');
