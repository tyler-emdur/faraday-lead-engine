// diagnose.js — dumps real system state to console
// Run: node scripts/diagnose.js
//
// Shows: lead count, outbound_prospects status breakdown,
// cron_logs (last 20 runs), email_threads count, contact_form_queue count

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

function loadEnv() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  FARADAY SYSTEM DIAGNOSTIC');
  console.log('  ' + new Date().toLocaleString());
  console.log('══════════════════════════════════════════\n');

  // ── Leads ──────────────────────────────────────────────────────────────────
  const { data: leads, count: leadCount } = await db
    .from('leads')
    .select('id, name, phone, source, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  console.log(`LEADS: ${leadCount ?? 0} total`);
  if (leads?.length) {
    for (const l of leads) {
      console.log(`  [${l.created_at?.slice(0, 10)}] ${l.name || 'Unknown'} — ${l.phone || 'no phone'} — source: ${l.source || 'unknown'}`);
    }
  } else {
    console.log('  (none)');
  }

  // ── Outbound prospects status breakdown ────────────────────────────────────
  console.log('\nOUTBOUND PROSPECTS:');
  const { data: prospects } = await db
    .from('outbound_prospects')
    .select('id, status, source, follow_up_count, last_contacted_at');

  if (prospects) {
    const byStatus = {};
    const bySource = {};
    let totalContacted = 0;
    for (const p of prospects) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      bySource[p.source] = (bySource[p.source] || 0) + 1;
      if (p.status === 'contacted') totalContacted++;
    }
    console.log(`  Total: ${prospects.length}`);
    console.log(`  By status:`, byStatus);
    console.log(`  By source:`, bySource);
    console.log(`  Ever contacted: ${totalContacted}`);

    // Most recent contact
    const contacted = prospects
      .filter(p => p.last_contacted_at)
      .sort((a, b) => new Date(b.last_contacted_at) - new Date(a.last_contacted_at));
    if (contacted.length) {
      console.log(`  Last contact sent: ${contacted[0].last_contacted_at?.slice(0, 16)}`);
    } else {
      console.log(`  Last contact sent: NEVER`);
    }
  }

  // ── Email threads ──────────────────────────────────────────────────────────
  console.log('\nEMAIL THREADS (outreach sent):');
  const { count: threadCount } = await db
    .from('email_threads')
    .select('id', { count: 'exact', head: true });
  console.log(`  Total email thread rows: ${threadCount ?? 0}`);

  // ── Cron logs ──────────────────────────────────────────────────────────────
  console.log('\nCRON LOGS (last 20 runs):');
  const { data: cronLogs } = await db
    .from('cron_logs')
    .select('cron_name, started_at, result, error, duration_ms, actions_taken')
    .order('started_at', { ascending: false })
    .limit(20);

  if (cronLogs?.length) {
    for (const log of cronLogs) {
      const dur = log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '?';
      const actions = log.actions_taken ? ` | actions: ${log.actions_taken}` : '';
      const err = log.error ? ` | ERROR: ${log.error.slice(0, 60)}` : '';
      console.log(`  [${log.started_at?.slice(0, 16)}] ${log.cron_name} → ${log.result} (${dur})${actions}${err}`);
    }
  } else {
    console.log('  (no cron logs — crons may never have run successfully)');
  }

  // ── Storm alerts ───────────────────────────────────────────────────────────
  console.log('\nSTORM ALERTS (last 5):');
  const { data: storms } = await db
    .from('storm_alerts')
    .select('event, headline, affected_cities, onset')
    .order('onset', { ascending: false })
    .limit(5);

  if (storms?.length) {
    for (const s of storms) {
      const cities = (s.affected_cities || []).slice(0, 3).join(', ');
      console.log(`  [${s.onset?.slice(0, 10)}] ${s.event} — ${cities}`);
    }
  } else {
    console.log('  (none recorded)');
  }

  // ── Contact form queue ─────────────────────────────────────────────────────
  console.log('\nCONTACT FORM QUEUE:');
  const { data: queue } = await db
    .from('contact_form_queue')
    .select('status, source')

  if (queue?.length) {
    const byStatus = {};
    for (const q of queue) byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    console.log(`  Total: ${queue.length} | By status:`, byStatus);
  } else {
    console.log('  (empty)');
  }

  // ── Intel / opportunities ──────────────────────────────────────────────────
  console.log('\nINTEL OPPORTUNITIES:');
  const { count: intelCount } = await db
    .from('intel_opportunities')
    .select('id', { count: 'exact', head: true })
    .catch(() => ({ count: 0 }));
  console.log(`  Total: ${intelCount ?? 0}`);

  console.log('\n══════════════════════════════════════════\n');
}

run().catch(console.error);
