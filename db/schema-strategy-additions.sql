-- Schema additions for the 8-strategy upgrade
-- Run in Supabase SQL editor after existing schema migrations.

-- ── storm_facebook_ads ───────────────────────────────────────────────────────
-- Tracks Facebook ad campaigns created by storm-check so meta-ad-cleanup
-- can pause them after the target duration (default 7 days).

CREATE TABLE IF NOT EXISTS storm_facebook_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nws_alert_id TEXT,
    campaign_id TEXT NOT NULL,
    ad_set_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    city TEXT NOT NULL,
    daily_budget_cents INTEGER NOT NULL DEFAULT 1000,
    pause_at TIMESTAMP WITH TIME ZONE NOT NULL,
    paused_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE storm_facebook_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access storm_facebook_ads"
    ON storm_facebook_ads FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS storm_facebook_ads_status_pause_at
    ON storm_facebook_ads (status, pause_at)
    WHERE status = 'active';

-- ── contact_form_queue additions ─────────────────────────────────────────────
-- sent_at already exists if you ran schema-outbound.sql.
-- Add auto-submit tracking columns.

ALTER TABLE contact_form_queue
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS submit_method TEXT,
    ADD COLUMN IF NOT EXISTS submit_error TEXT;

-- ── outbound_prospects: HOA email placeholder dedup fix ──────────────────────
-- HOA prospects without known emails get a placeholder — don't try to email them.
-- Ensure the placeholder pattern is filterable.

ALTER TABLE outbound_prospects
    ADD COLUMN IF NOT EXISTS is_placeholder_email BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing placeholders (added by hoa-violations cron)
UPDATE outbound_prospects
SET is_placeholder_email = TRUE
WHERE email LIKE '%@placeholder.local';
