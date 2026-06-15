// Shared types for the Faraday Anna lead engine

export interface Lead {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null;
  city?: string | null;
  address?: string | null;
  service?: string | null;
  homeowner?: boolean | null;
  roof_age?: number | null;
  damage_visible?: boolean | null;
  damage_description?: string | null;
  insurance_filed?: string | null;
  has_insurance?: boolean | null;
  urgency?: string | null;
  electric_bill?: string | null;
  notes?: string | null;
  score?: number | null;
  lead_score?: number | null;
  grade?: string | null;
  conversation?: string | null;
  status?: string | null;
  source?: string | null;
  source_detail?: string | null;
  team_notified?: boolean | null;
  opted_out?: boolean | null;
  opted_out_at?: string | null;
  submitted_to_faraday?: boolean | null;
  submitted_at?: string | null;
  appointment_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Conversation {
  id: string;
  lead_id: string;
  channel: "sms" | "email" | "widget" | "manychat" | "admin";
  role: "user" | "assistant" | "system";
  content: string;
  thread_id?: string | null;
  subject?: string | null;
  external_id?: string | null;
  created_at: string;
}

export interface IntelItem {
  id: string;
  source: string;
  source_id?: string | null;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  body?: string | null;
  url?: string | null;
  author?: string | null;
  location?: string | null;
  zip?: string | null;
  urgency_score: number;
  opportunity_score: number;
  why_it_matters?: string | null;
  close_probability?: number | null;
  outreach_message?: string | null;
  follow_up_schedule?: string | null;
  status: string;
  contacted_at?: string | null;
  lead_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Prospect {
  id: string;
  email?: string | null;
  name?: string | null;
  company?: string | null;
  city?: string | null;
  city_hint?: string | null;
  website?: string | null;
  status: string;
  thread_id?: string | null;
  source?: string | null;
  segment_type?: string | null;
  contact_form_queued?: boolean | null;
  follow_up_count?: number | null;
  next_follow_up_date?: string | null;
  last_message_sent?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  last_contacted_at?: string | null;
}

export interface Appointment {
  id: string;
  lead_id: string;
  requested_date?: string | null;
  requested_time_slot?: "morning" | "afternoon" | "anytime" | null;
  address?: string | null;
  confirmed: boolean;
  confirmed_at?: string | null;
  cancelled: boolean;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Joined
  lead?: Lead | null;
}

export interface StormEvent {
  id: string;
  nws_alert_id: string;
  zip_codes: string[];
  affected_cities: string[];
  hail_size?: string | null;
  hail_size_inches?: number | null;
  detected_at: string;
  actions_triggered?: Record<string, unknown> | null;
  sms_blasts_sent?: number;
  leads_reengaged?: number;
  blog_published?: boolean;
  ads_created?: boolean;
  geofence_created?: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_description?: string | null;
  target_keyword?: string | null;
  target_city?: string | null;
  published: boolean;
  published_at?: string | null;
  view_count?: number;
  created_at: string;
  updated_at?: string | null;
}

export interface Subscriber {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  city?: string | null;
  zip?: string | null;
  status: "active" | "unsubscribed" | "bounced";
  source?: string | null;
  opted_in_at: string;
  unsubscribed_at?: string | null;
  blast_count?: number;
  last_blast_at?: string | null;
}

export interface CronLog {
  id: string;
  cron_name: string;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  result?: "success" | "error" | "skipped" | null;
  error?: string | null;
  leads_generated?: number;
  actions_taken?: number;
  metadata?: Record<string, unknown> | null;
}

export interface PartnerClick {
  id: string;
  partner_slug: string;
  clicked_at: string;
  user_agent?: string | null;
  ip_hash?: string | null;
  referrer?: string | null;
  lead_id?: string | null;
}

export interface Job {
  id: string;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  service_type?: string | null;
  address?: string | null;
  status: "active" | "complete" | "cancelled";
  completed_at?: string | null;
  review_requested?: boolean;
  review_requested_at?: string | null;
  referral_requested?: boolean;
  referral_requested_at?: string | null;
  notes?: string | null;
  created_at: string;
}
