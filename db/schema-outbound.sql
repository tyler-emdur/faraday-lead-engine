-- Outbound prospects table to track who Anna is emailing
CREATE TABLE IF NOT EXISTS outbound_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    company TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'unqualified', 'qualified', 'do_not_contact')),
    thread_id TEXT,
    source TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_contacted_at TIMESTAMP WITH TIME ZONE
);

-- Email threads table to store conversational history so Anna remembers context
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES outbound_prospects(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at on outbound_prospects
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON outbound_prospects;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON outbound_prospects
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE outbound_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access outbound_prospects" ON outbound_prospects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access email_threads" ON email_threads FOR ALL USING (auth.role() = 'service_role');

-- ── Contact Form Queue ────────────────────────────────────────────────────────
-- Businesses that have a website but no guessable email.
-- Anna pre-drafts a message; Tyler submits it via the contact form manually.
ALTER TABLE outbound_prospects
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS city_hint TEXT,
  ADD COLUMN IF NOT EXISTS contact_form_queued BOOLEAN NOT NULL DEFAULT FALSE;

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
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE contact_form_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access contact_form_queue"
  ON contact_form_queue FOR ALL USING (auth.role() = 'service_role');
