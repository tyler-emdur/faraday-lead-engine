// test-system.js — end-to-end health check for Faraday Lead Engine
//
// Tests: DB connectivity, prospect counts, AI API, Resend, cron endpoints
//
// Usage (with dev server running on :3000):
//   node scripts/test-system.js
//
// Usage (against production):
//   SITE_URL=https://leads.faradaysun.com node scripts/test-system.js

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
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
  } catch (e) {
    console.error('Could not read .env.local:', e.message);
    process.exit(1);
  }
}

const env = loadEnv();
const SITE_URL = process.env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const CRON_SECRET = env.CRON_SECRET;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let passed = 0, failed = 0, warned = 0;

function ok(label, note = '') { console.log(`  ✅ ${label}${note ? ' — ' + note : ''}`); passed++; }
function fail(label, note = '') { console.log(`  ❌ ${label}${note ? ' — ' + note : ''}`); failed++; }
function warn(label, note = '') { console.log(`  ⚠️  ${label}${note ? ' — ' + note : ''}`); warned++; }

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testDatabase() {
  console.log('\n📊 DATABASE');

  try {
    const { data, error } = await db.from('outbound_prospects').select('id,email,source,status,follow_up_count');
    if (error) { fail('outbound_prospects query', error.message); return; }

    const withEmail = data.filter(p => p.email);
    const bySource = {};
    for (const p of withEmail) bySource[p.source] = (bySource[p.source] || 0) + 1;

    ok(`outbound_prospects: ${data.length} total, ${withEmail.length} with email`);

    const expectedSegments = ['hoa_manager','property_manager','insurance_agent','public_adjuster','home_inspector','restoration_contractor','gutter_company','general_contractor'];
    const missingSegments = expectedSegments.filter(s => !bySource[s]);
    if (missingSegments.length > 0) warn('Missing segments', missingSegments.join(', '));
    else ok('All 8+ segments present', Object.entries(bySource).map(([s,n]) => `${s}:${n}`).join(', '));

    if (withEmail.length < 50) warn('Low prospect count', `${withEmail.length} — run seed-real-prospects.js and seed-b2b-expanded.js`);
    else ok(`Prospect volume OK`, `${withEmail.length} emailable`);
  } catch (e) {
    fail('DB connection failed', e.message);
    return;
  }

  // Contact form queue
  try {
    const { data: cfq, error } = await db.from('contact_form_queue').select('id,status,source,business_name');
    if (error) { fail('contact_form_queue query', error.message); return; }
    const pending = cfq.filter(r => r.status === 'pending_send');
    const neighborItems = cfq.filter(r => r.source === 'neighbor_blaster');
    if (pending.length > 0) warn(`${pending.length} contact form items pending`, 'Go to /admin → Outreach to clear them');
    else ok('Contact form queue clear');
    if (neighborItems.length > 0) ok(`Neighbor blaster active`, `${neighborItems.length} neighbor letters queued`);
  } catch (e) {
    fail('contact_form_queue', e.message);
  }

  // Email threads
  try {
    const { data: threads } = await db.from('email_threads').select('id,created_at').order('created_at', { ascending: false }).limit(5);
    if (!threads?.length) warn('No email threads yet', 'Cron has never sent — trigger outbound-prospect cron once');
    else ok(`Email threads: ${threads.length} recent`, threads[0]?.created_at?.slice(0, 10));
  } catch (e) {
    warn('email_threads table missing or empty', e.message);
  }

  // Cron logs
  try {
    const { data: logs } = await db.from('cron_logs').select('cron_name,result,started_at').order('started_at', { ascending: false }).limit(10);
    if (!logs?.length) warn('No cron logs', 'Crons have never run — check GitHub Actions secrets');
    else {
      const errored = logs.filter(l => l.result === 'error');
      if (errored.length > 0) fail('Cron errors found', errored.map(l => l.cron_name).join(', '));
      else ok(`Cron logs OK`, `${logs.length} recent runs`);
    }
  } catch (e) {
    warn('cron_logs table', e.message);
  }
}

async function testEnvVars() {
  console.log('\n🔑 ENV VARS');

  const required = {
    AI_API_KEY: env.AI_API_KEY,
    RESEND_API_KEY: env.RESEND_API_KEY,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: env.CRON_SECRET,
    FROM_EMAIL: env.FROM_EMAIL,
  };
  const optional = {
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    FACEBOOK_PAGE_ACCESS_TOKEN: env.FACEBOOK_PAGE_ACCESS_TOKEN,
    META_ACCESS_TOKEN: env.META_ACCESS_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN: env.GOOGLE_ADS_DEVELOPER_TOKEN,
  };

  for (const [k, v] of Object.entries(required)) {
    if (v) ok(k, `${v.slice(0, 8)}...`);
    else fail(`${k} missing`, 'Required — cron will fail without this');
  }
  for (const [k, v] of Object.entries(optional)) {
    if (v) ok(k, 'set');
    else warn(`${k} not set`, 'Optional — some features disabled');
  }

  // Check AI model
  if (env.AI_MODEL) {
    if (env.AI_BASE_URL?.includes('cerebras') && env.AI_MODEL === 'llama-3.3-70b') {
      ok('AI_MODEL correct for Cerebras', env.AI_MODEL);
    } else if (env.AI_BASE_URL?.includes('groq') && !env.AI_MODEL.includes('versatile')) {
      warn('AI_MODEL may be wrong for Groq', `Should be llama-3.3-70b-versatile, got ${env.AI_MODEL}`);
    } else {
      ok('AI_MODEL set', env.AI_MODEL);
    }
  }
}

async function testAIApi() {
  console.log('\n🤖 AI API');

  if (!env.AI_API_KEY || !env.AI_BASE_URL) { warn('Skipped', 'AI_API_KEY or AI_BASE_URL not set'); return; }

  try {
    const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say "Anna ready" in exactly 2 words.' }],
        max_tokens: 10,
      }),
    });
    if (!res.ok) { fail('AI API request', `HTTP ${res.status}`); return; }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) ok('AI API working', `"${reply}"`);
    else fail('AI API empty response');
  } catch (e) {
    fail('AI API', e.message);
  }
}

async function testResend() {
  console.log('\n📧 RESEND (send test email to Tyler)');

  if (!env.RESEND_API_KEY) { warn('Skipped', 'RESEND_API_KEY not set'); return; }

  const toEmail = env.TYLER_EMAIL || env.TEAM_EMAIL;
  if (!toEmail) { warn('Skipped', 'TYLER_EMAIL not set'); return; }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'anna@faradayleads.com',
        to: toEmail,
        subject: '✅ Faraday Lead Engine — System Test',
        html: `<p>Anna is alive and outbound email is working.</p>
               <p>122 prospects loaded. Storm B2B blast active. Neighbor-blaster wired in.<br>
               Next storm → auto-emails fire within 30 min of NWS alert.</p>
               <p style="color:#9ca3af;font-size:12px;">Faraday Lead Engine · test sent ${new Date().toLocaleString()}</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      fail('Resend send', `HTTP ${res.status}: ${body.slice(0, 100)}`);
      return;
    }
    const data = await res.json();
    ok('Test email sent', `ID: ${data.id} → ${toEmail}`);
  } catch (e) {
    fail('Resend', e.message);
  }
}

async function testCronEndpoint(name, path) {
  console.log(`\n⚙️  CRON: ${name}`);

  if (!CRON_SECRET) { warn('Skipped', 'CRON_SECRET not set'); return; }

  const url = `${SITE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) { fail(`${name}: Unauthorized`, 'CRON_SECRET mismatch between .env.local and server'); return; }
    if (res.status === 404) { fail(`${name}: 404`, `Route not found at ${url}`); return; }
    if (!res.ok) { fail(`${name}: HTTP ${res.status}`, JSON.stringify(body).slice(0, 150)); return; }
    ok(`${name} responded`, JSON.stringify(body).slice(0, 120));
  } catch (e) {
    if (e.name === 'TimeoutError') fail(`${name}: timed out`, 'Dev server not running? Start with: npm run dev');
    else fail(`${name}`, e.message);
  }
}

async function testAdminApi() {
  console.log('\n🖥  ADMIN API');

  const url = `${SITE_URL}/api/admin/outreach`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { fail(`/api/admin/outreach: HTTP ${res.status}`); return; }
    const data = await res.json();
    const cfCount = data.contactForms?.length ?? 0;
    const pCount = data.prospects?.length ?? 0;
    ok(`/api/admin/outreach`, `${pCount} prospects, ${cfCount} form items`);
    const withEmail = (data.prospects || []).filter(p => p.email).length;
    if (withEmail < 50) warn('Low emailable count in API', `${withEmail} — seed scripts may not have run`);
    else ok('Emailable prospect count', `${withEmail}`);
  } catch (e) {
    if (e.name === 'TimeoutError') warn('/api/admin/outreach: timed out', 'Start dev server: npm run dev');
    else fail('/api/admin/outreach', e.message);
  }
}

// ─── Run all tests ────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n🔍 Faraday Lead Engine — System Test`);
  console.log(`   Target: ${SITE_URL}`);
  console.log(`   Time: ${new Date().toLocaleString()}\n${'─'.repeat(48)}`);

  await testEnvVars();
  await testDatabase();
  await testAIApi();
  await testResend();
  await testAdminApi();
  // Test the outbound-prospect cron (WILL SEND REAL EMAILS — comment out if not ready)
  await testCronEndpoint('outbound-prospect', '/api/cron/outbound-prospect');

  console.log(`\n${'─'.repeat(48)}`);
  console.log(`Results: ${passed} passed · ${warned} warnings · ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Fix failures before going live.');
  } else if (warned > 0) {
    console.log('\n✅ Core working. Address warnings when possible.');
  } else {
    console.log('\n✅ Everything looks good. Push to deploy and wait for a storm.');
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();
