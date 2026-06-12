import { useState, useEffect, useRef, useCallback } from "react";

const ANNA_PROMPT = `You are Anna, a friendly customer service specialist for Faraday Construction, serving Colorado's Front Range. You help homeowners with roofing, hail/storm damage repair, replacement windows, and solar panel installation.

PERSONALITY: Warm, knowledgeable, not pushy. Like a helpful neighbor. Casual but professional. Keep responses to 2-3 sentences max.

GOAL: Qualify the homeowner through natural conversation. Learn:
1. What service they need (roof repair, hail damage, new roof, windows, solar, or multiple)
2. If they own the home
3. Approximate roof age (if roofing related)
4. If there's visible damage (leaks, missing shingles, dents)
5. If they've filed or plan to file insurance (for storm/hail)
6. Timeline: emergency, immediate, this month, or exploring
7. Name, phone, email, zip code or city

RULES:
- Ask ONE question at a time
- If they mention hail/storm damage, show empathy first
- Mention Faraday helps navigate insurance claims
- Never ask for SSN/credit card info
- If emergency (active leak, tree on roof), tell them to call 911 if dangerous
- Don't make up pricing - say a specialist provides free estimates
- If not a homeowner or outside Colorado, politely let them know

Respond ONLY with JSON (no markdown, no backticks):
{"message":"your response","data":{"name":null,"phone":null,"email":null,"zip":null,"city":null,"service":null,"homeowner":null,"roof_age":null,"damage_visible":null,"damage_description":null,"insurance_filed":null,"urgency":null,"notes":null},"complete":false}

service values: "roofing","hail_damage","windows","solar","multiple"
urgency values: "emergency","immediate","this_month","exploring"
insurance_filed: true, false, "planning_to"
Set complete:true when you have service + name + (phone or email).`;

function scoreLead(d) {
  if (!d) return 0;
  let s = 0;
  if (d.service === "hail_damage") s += 30;
  else if (d.service === "roofing") s += 22;
  else if (d.service === "solar") s += 20;
  else if (d.service === "windows") s += 18;
  else if (d.service === "multiple") s += 35;
  if (d.homeowner === true) s += 12;
  if (d.damage_visible === true) s += 12;
  if (d.insurance_filed === true) s += 8;
  else if (d.insurance_filed === "planning_to") s += 10;
  if (d.urgency === "emergency") s += 25;
  else if (d.urgency === "immediate") s += 18;
  else if (d.urgency === "this_month") s += 10;
  else if (d.urgency === "exploring") s += 3;
  if (d.phone) s += 5;
  if (d.email) s += 3;
  if (d.zip || d.city) s += 3;
  return Math.min(s, 100);
}

function gradeOf(s) {
  if (s >= 75) return { g: "A", l: "HOT", c: "#ef4444", bg: "#fef2f2" };
  if (s >= 55) return { g: "B", l: "WARM", c: "#f59e0b", bg: "#fffbeb" };
  if (s >= 35) return { g: "C", l: "COOL", c: "#3b82f6", bg: "#eff6ff" };
  return { g: "D", l: "COLD", c: "#6b7280", bg: "#f9fafb" };
}

const SVC = { roofing: "Roofing", hail_damage: "Hail Damage", windows: "Windows", solar: "Solar", multiple: "Multiple" };
const URG = { emergency: "EMERGENCY", immediate: "ASAP", this_month: "This Month", exploring: "Exploring" };

async function askAnna(messages) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: ANNA_PROMPT, messages }),
    });
    const data = await res.json();
    const raw = (data.content || []).map(b => b.text || "").join("");
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    return { message: "Sorry, quick tech hiccup! Try again in a moment?", data: {}, complete: false };
  }
}

async function getAlerts() {
  try {
    const r = await fetch("https://api.weather.gov/alerts/active?area=CO&severity=Severe,Extreme", { headers: { "User-Agent": "FaradayConstruction/1.0" } });
    const d = await r.json();
    return (d.features || []).filter(f => {
      const e = (f.properties?.event || "").toLowerCase();
      return e.includes("hail") || e.includes("thunderstorm") || e.includes("tornado") || e.includes("wind") || e.includes("storm");
    }).map(f => ({ event: f.properties?.event, headline: f.properties?.headline, severity: f.properties?.severity, areas: f.properties?.areaDesc, description: (f.properties?.description || "").slice(0, 400) }));
  } catch { return []; }
}

const bg0 = "#0b0e14", bg1 = "#111827", bg2 = "#0f172a", bdr = "#1e293b", amber = "#f59e0b", txtP = "#e2e8f0", txtM = "#94a3b8", txtD = "#64748b";

function Badge({ bg, color, children, style }) {
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color, ...style }}>{children}</span>;
}

function Btn({ primary, children, ...props }) {
  return <button {...props} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: props.disabled ? "default" : "pointer", fontWeight: 600, fontSize: 13, background: primary ? `linear-gradient(135deg,${amber},#d97706)` : bdr, color: primary ? bg0 : txtP, opacity: props.disabled ? 0.5 : 1, transition: "all .15s", ...props.style }}>{children}</button>;
}

function Tab({ active, children, onClick }) {
  return <button onClick={onClick} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: active ? amber : "transparent", color: active ? bg0 : txtD, transition: "all .2s" }}>{children}</button>;
}

// ═══════ CHAT AGENT ═══════
function ChatAgent({ onSave }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [ext, setExt] = useState({});
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  useEffect(() => {
    setBusy(true);
    askAnna([{ role: "user", content: "Hi" }]).then(r => {
      setMsgs([{ role: "assistant", content: r.message }]);
      setBusy(false);
    });
  }, []);

  const send = async () => {
    if (!inp.trim() || busy) return;
    const txt = inp.trim();
    setInp("");
    const next = [...msgs, { role: "user", content: txt }];
    setMsgs(next);
    setBusy(true);
    const api = [{ role: "user", content: "Hi" }, ...next.map(m => ({ role: m.role, content: m.content }))];
    const r = await askAnna(api);
    const merged = { ...ext };
    if (r.data) Object.entries(r.data).forEach(([k, v]) => { if (v != null) merged[k] = v; });
    setExt(merged);
    if (r.complete) setDone(true);
    setMsgs([...next, { role: "assistant", content: r.message }]);
    setBusy(false);
  };

  const save = async () => {
    const lead = { ...ext, score: scoreLead(ext), captured_at: new Date().toISOString(), conversation: msgs.map(m => `${m.role === "user" ? "Homeowner" : "Anna"}: ${m.content}`).join("\n"), id: `lead_${Date.now()}` };
    try {
      const ex = await window.storage.get("faraday:leads");
      const arr = ex ? JSON.parse(ex.value) : [];
      arr.unshift(lead);
      await window.storage.set("faraday:leads", JSON.stringify(arr));
    } catch { await window.storage.set("faraday:leads", JSON.stringify([lead])); }
    setSaved(true);
    onSave?.();
  };

  const reset = () => {
    setMsgs([]); setInp(""); setExt({}); setDone(false); setSaved(false);
    setBusy(true);
    askAnna([{ role: "user", content: "Hi" }]).then(r => { setMsgs([{ role: "assistant", content: r.message }]); setBusy(false); });
  };

  const score = scoreLead(ext);
  const gr = gradeOf(score);

  const fields = [
    ["Name", ext.name], ["Phone", ext.phone], ["Email", ext.email],
    ["Location", [ext.city, ext.zip].filter(Boolean).join(", ") || null],
    ["Service", ext.service ? SVC[ext.service] || ext.service : null],
    ["Homeowner", ext.homeowner === true ? "Yes" : ext.homeowner === false ? "No" : null],
    ["Roof Age", ext.roof_age ? `~${ext.roof_age} yrs` : null],
    ["Damage", ext.damage_visible === true ? "Yes" : ext.damage_visible === false ? "No" : null],
    ["Insurance", ext.insurance_filed === true ? "Filed" : ext.insurance_filed === "planning_to" ? "Planning to" : ext.insurance_filed === false ? "Not filed" : null],
    ["Urgency", ext.urgency ? URG[ext.urgency] || ext.urgency : null],
  ];

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 140px)", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, overflow: "hidden", minHeight: 400 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${bdr}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e88" }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: txtP }}>Anna</span>
          <span style={{ fontSize: 12, color: txtD }}>AI Qualification Agent</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "78%", padding: "10px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? `linear-gradient(135deg,${amber},#d97706)` : bdr, color: m.role === "user" ? bg0 : txtP, fontSize: 14, lineHeight: 1.55 }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div style={{ display: "flex", gap: 6, padding: 10 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: amber, animation: `bp 1s ${i * .2}s infinite` }} />)}
            <style>{`@keyframes bp{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
          </div>}
          <div ref={bottom} />
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${bdr}`, display: "flex", gap: 8 }}>
          <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message..." disabled={busy || saved} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid #334155`, background: bg2, color: txtP, fontSize: 14, outline: "none" }} />
          <Btn primary onClick={send} disabled={busy || saved}>Send</Btn>
        </div>
      </div>
      <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: txtP }}>Lead Intelligence</span>
            <Badge bg={gr.bg} color={gr.c} style={{ fontSize: 13, padding: "4px 12px" }}>{gr.g} — {gr.l}</Badge>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: txtD, marginBottom: 4 }}><span>Score</span><span>{score}/100</span></div>
            <div style={{ height: 6, background: bdr, borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, background: gr.c, width: `${score}%`, transition: "width .5s" }} />
            </div>
          </div>
          {fields.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
              <span style={{ color: txtD }}>{k}</span>
              <span style={{ color: v ? txtP : "#334155", fontWeight: v ? 600 : 400 }}>{v || "—"}</span>
            </div>
          ))}
        </div>
        {done && !saved && <Btn primary onClick={save} style={{ width: "100%", padding: 14, fontSize: 15 }}>Save Lead to Pipeline</Btn>}
        {saved && <div style={{ textAlign: "center" }}>
          <Badge bg="#065f46" color="#34d399" style={{ fontSize: 14, padding: "10px 20px", display: "block", marginBottom: 10 }}>Lead Captured!</Badge>
          <Btn onClick={reset} style={{ width: "100%" }}>New Conversation</Btn>
        </div>}
      </div>
    </div>
  );
}

// ═══════ LEADS DASHBOARD ═══════
function Leads({ leads, refresh }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const fl = filter === "all" ? leads : leads.filter(l => l.service === filter);
  const hot = leads.filter(l => scoreLead(l) >= 75).length;
  const warm = leads.filter(l => { const s = scoreLead(l); return s >= 55 && s < 75; }).length;

  const del = async (id) => {
    const u = leads.filter(l => l.id !== id);
    await window.storage.set("faraday:leads", JSON.stringify(u));
    refresh();
  };

  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
      {[["Total", leads.length, "#3b82f6"], ["Hot", hot, "#ef4444"], ["Warm", warm, amber]].map(([l, v, c]) => (
        <div key={l} style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: c }}>{v}</div>
          <div style={{ fontSize: 12, color: txtD, marginTop: 4 }}>{l} Leads</div>
        </div>
      ))}
    </div>
    <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: txtP }}>Pipeline</span>
        <div style={{ display: "flex", gap: 4, background: bg0, borderRadius: 10, padding: 4 }}>
          {[["all", "All"], ["hail_damage", "Hail"], ["roofing", "Roof"], ["solar", "Solar"], ["windows", "Win"]].map(([k, l]) => <Tab key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Tab>)}
        </div>
      </div>
      {fl.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: txtD }}><div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>No leads yet — chat with Anna to qualify your first lead</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fl.map(ld => {
            const s = scoreLead(ld), gr = gradeOf(s), isO = open === ld.id;
            return <div key={ld.id} style={{ background: bg2, borderRadius: 10, border: `1px solid ${isO ? amber + "44" : bdr}`, overflow: "hidden" }}>
              <div onClick={() => setOpen(isO ? null : ld.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
                <Badge bg={gr.bg} color={gr.c} style={{ minWidth: 28, textAlign: "center" }}>{gr.g}</Badge>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: txtP }}>{ld.name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: txtD }}>{ld.phone || ld.email || "No contact"}</div>
                </div>
                <Badge bg={bdr} color={txtM}>{SVC[ld.service] || "?"}</Badge>
                {ld.urgency && <Badge bg={ld.urgency === "emergency" ? "#7f1d1d" : bdr} color={ld.urgency === "emergency" ? "#fca5a5" : txtM}>{URG[ld.urgency]}</Badge>}
                <span style={{ fontSize: 12, color: txtD }}>{ld.captured_at ? new Date(ld.captured_at).toLocaleDateString() : ""}</span>
                <span style={{ color: txtD }}>{isO ? "▲" : "▼"}</span>
              </div>
              {isO && <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${bdr}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "12px 0", fontSize: 13 }}>
                  {[["Phone", ld.phone], ["Email", ld.email], ["Location", [ld.city, ld.zip].filter(Boolean).join(", ")], ["Owner", ld.homeowner === true ? "Yes" : "—"], ["Roof Age", ld.roof_age ? `${ld.roof_age}y` : "—"], ["Damage", ld.damage_visible ? "Yes" : "—"], ["Insurance", ld.insurance_filed === true ? "Filed" : ld.insurance_filed === "planning_to" ? "Planning" : "—"], ["Score", `${s}/100`]].map(([k, v]) => (
                    <div key={k} style={{ color: txtM }}><span style={{ color: txtD }}>{k}: </span><span style={{ fontWeight: 600, color: txtP }}>{v || "—"}</span></div>
                  ))}
                </div>
                {ld.conversation && <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: amber, cursor: "pointer" }}>View Conversation</summary>
                  <pre style={{ fontSize: 11, color: txtM, whiteSpace: "pre-wrap", marginTop: 8, padding: 12, background: bg0, borderRadius: 8, maxHeight: 200, overflow: "auto" }}>{ld.conversation}</pre>
                </details>}
                <Btn onClick={() => del(ld.id)} style={{ fontSize: 12, marginTop: 8, color: "#ef4444" }}>Remove</Btn>
              </div>}
            </div>;
          })}
        </div>
      )}
    </div>
  </div>;
}

// ═══════ STORM INTEL ═══════
function Storms() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(null);

  const load = async () => { setLoading(true); setAlerts(await getAlerts()); setChecked(new Date()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const cities = ["Denver", "Boulder", "Fort Collins", "Colorado Springs", "Longmont", "Loveland", "Broomfield", "Thornton", "Arvada", "Westminster", "Aurora", "Castle Rock", "Parker", "Golden", "Brighton", "Greeley"];

  return <div>
    <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: txtP }}>Colorado Storm Radar</div>
        <div style={{ fontSize: 12, color: txtD }}>{checked ? `Checked ${checked.toLocaleTimeString()}` : "Loading..."}</div>
      </div>
      <Btn primary onClick={load} disabled={loading}>{loading ? "Checking..." : "Refresh"}</Btn>
    </div>
    <div style={{ background: `linear-gradient(135deg,#1a0a00,${bg1})`, border: `1px solid ${amber}22`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: amber, marginBottom: 8 }}>HOW TO USE STORM ALERTS</div>
      <div style={{ fontSize: 13, color: txtM, lineHeight: 1.7 }}>
        When you see severe storm or hail warnings here, that is your activation signal. Immediately post in local Facebook groups and Nextdoor offering free inspections, share your landing page link with the AI chat agent, and make sure your Google Business Profile mentions storm damage services for the affected cities.
      </div>
    </div>
    {alerts.length === 0 ? (
      <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>☀️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>All Clear</div>
        <div style={{ fontSize: 13, color: txtD, marginTop: 4 }}>No active severe weather alerts for Colorado</div>
      </div>
    ) : alerts.map((a, i) => (
      <div key={i} style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, marginBottom: 12, borderLeft: `4px solid ${a.severity === "Extreme" ? "#ef4444" : amber}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 }}>
          <div><div style={{ fontWeight: 700, fontSize: 15, color: txtP }}>{a.event}</div><div style={{ fontSize: 12, color: txtD, marginTop: 2 }}>{(a.areas || "").slice(0, 120)}</div></div>
          <Badge bg={a.severity === "Extreme" ? "#7f1d1d" : "#78350f"} color={a.severity === "Extreme" ? "#fca5a5" : "#fbbf24"}>{a.severity}</Badge>
        </div>
        {a.headline && <div style={{ fontSize: 13, color: txtM, marginTop: 8 }}>{a.headline}</div>}
        {a.description && <div style={{ fontSize: 12, color: txtD, marginTop: 8, lineHeight: 1.5 }}>{a.description}</div>}
      </div>
    ))}
    <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: txtP, marginBottom: 12 }}>Monitored Cities</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{cities.map(c => <Badge key={c} bg={bdr} color={txtM}>{c}</Badge>)}</div>
    </div>
  </div>;
}

// ═══════ DEPLOY ═══════
function Deploy() {
  const [cp, setCp] = useState(null);
  const copy = (t, id) => { navigator.clipboard?.writeText(t); setCp(id); setTimeout(() => setCp(null), 2000); };

  const embed = `<!-- Faraday Lead Chat Widget -->
<!-- Deploy this app to Vercel (free), then embed: -->

<!-- OPTION A: Full-page iframe -->
<iframe src="https://YOUR-APP.vercel.app"
  style="width:100%;height:650px;border:none;border-radius:12px"
  title="Chat with Faraday Construction">
</iframe>

<!-- OPTION B: Floating chat button -->
<script>
(function(){
  var b=document.createElement('div');
  b.innerHTML='\\u{1F4AC} Free Roof Estimate';
  b.style.cssText='position:fixed;bottom:24px;right:24px;'
    +'background:#f59e0b;color:#000;padding:14px 24px;'
    +'border-radius:50px;cursor:pointer;font-weight:700;'
    +'font-size:15px;box-shadow:0 4px 20px rgba(0,0,0,.3);'
    +'z-index:9999';
  b.onclick=function(){
    window.open('https://YOUR-APP.vercel.app',
      'faraday','width=420,height=700');
  };
  document.body.appendChild(b);
})();
</script>`;

  const webhook = `// Node.js email notification (or use Zapier/Make.com)
const nodemailer = require('nodemailer');

async function notifyTeam(lead) {
  const grade = lead.score >= 75 ? 'HOT'
    : lead.score >= 55 ? 'WARM' : 'COOL';

  await transporter.sendMail({
    from: 'leads@faradayconstruction.com',
    to: 'sales@faradayconstruction.com',
    subject: \`[\${grade}] New Lead: \${lead.name} - \${lead.service}\`,
    html: \`
      <h2>\${grade} Lead</h2>
      <p><b>Name:</b> \${lead.name}</p>
      <p><b>Phone:</b> \${lead.phone}</p>
      <p><b>Service:</b> \${lead.service}</p>
      <p><b>Urgency:</b> \${lead.urgency}</p>
      <p><b>Score:</b> \${lead.score}/100</p>
    \`
  });
}`;

  const tips = [
    ["Google Business Profile", "Your #1 free lead source. Add photos of completed jobs weekly, respond to every review within 24hrs, post updates after every storm. Optimize for 'roofing contractor [city]' and 'hail damage repair [city]'."],
    ["Storm Response Playbook", "When Storm Radar fires an alert: (1) Post in local Facebook groups and Nextdoor offering free inspections, (2) Share your landing page URL with the chat agent, (3) Door-knock the affected zip codes with flyers pointing to your chat URL."],
    ["SEO Landing Pages", "Create separate pages on your WordPress site for each service + city combo: 'hail damage roof repair Broomfield CO', 'solar installation Fort Collins', etc. Embed the chat widget on every page."],
    ["Review Engine", "After every job, send an automated text asking for a Google review. More reviews = higher local search ranking = more free organic leads."],
    ["Nextdoor Gold", "Monitor Nextdoor after storms. Homeowners post asking for roofer recommendations constantly. Be first to respond with your free inspection offer + chat link."],
  ];

  return <div>
    <div style={{ background: `linear-gradient(135deg,#1a0a00,${bg1})`, border: `1px solid ${amber}22`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: txtP, marginBottom: 8 }}>Deployment Playbook</div>
      <div style={{ fontSize: 14, color: txtM, lineHeight: 1.7 }}>
        Three layers: the AI chat agent (Anna) qualifies visitors into scored leads, the CRM dashboard tracks your pipeline, and the storm trigger tells you when to activate your outreach. Here's how to deploy everything on your WordPress site.
      </div>
    </div>
    {[["1. Embed on WordPress", embed, "embed"], ["2. Email Notifications", webhook, "hook"]].map(([title, code, id]) => (
      <div key={id} style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: txtP }}>{title}</span>
          <Btn onClick={() => copy(code, id)}>{cp === id ? "Copied!" : "Copy"}</Btn>
        </div>
        <pre style={{ background: bg0, padding: 16, borderRadius: 8, fontSize: 12, color: txtM, overflow: "auto", whiteSpace: "pre-wrap", maxHeight: 220 }}>{code}</pre>
      </div>
    ))}
    <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: txtP, marginBottom: 16 }}>3. Free Traffic Playbook (No Ad Spend)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tips.map(([t, d], i) => (
          <div key={i} style={{ padding: 16, background: bg2, borderRadius: 10, borderLeft: `3px solid ${amber}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: txtP, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 13, color: txtM, lineHeight: 1.6 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ background: bg1, border: `1px solid ${bdr}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: txtP, marginBottom: 12 }}>4. Cost Breakdown</div>
      <div style={{ fontSize: 13, color: txtM, lineHeight: 2.2 }}>
        <div><span style={{ color: amber, fontWeight: 600 }}>AI Agent (Claude API):</span> ~$5-20/mo depending on volume</div>
        <div><span style={{ color: amber, fontWeight: 600 }}>Storm Data (NWS):</span> Free, no API key</div>
        <div><span style={{ color: amber, fontWeight: 600 }}>Hosting (Vercel):</span> Free tier</div>
        <div><span style={{ color: amber, fontWeight: 600 }}>Email Alerts (Zapier):</span> Free tier (100 tasks/mo)</div>
        <div><span style={{ color: amber, fontWeight: 600 }}>Total:</span> $5-20/mo vs $50/lead × dozens of leads = massive savings</div>
      </div>
    </div>
  </div>;
}

// ═══════ MAIN APP ═══════
export default function App() {
  const [tab, setTab] = useState("chat");
  const [leads, setLeads] = useState([]);
  const [ac, setAc] = useState(0);

  const loadLeads = useCallback(async () => {
    try { const r = await window.storage.get("faraday:leads"); if (r) setLeads(JSON.parse(r.value)); } catch { setLeads([]); }
  }, []);

  useEffect(() => { loadLeads(); getAlerts().then(a => setAc(a.length)); }, [loadLeads]);

  const tabs = [
    { id: "chat", icon: "💬", label: "Anna AI" },
    { id: "leads", icon: "📋", label: `Leads (${leads.length})` },
    { id: "storms", icon: "⛈️", label: `Storms${ac ? ` (${ac})` : ""}` },
    { id: "deploy", icon: "🚀", label: "Deploy" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: bg0, color: txtP, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg,${bg1},#1a1425)`, borderBottom: `1px solid ${amber}33`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${amber},#d97706)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: bg0 }}>F</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>FARADAY CONSTRUCTION</div>
            <div style={{ fontSize: 10, color: amber, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Lead Command Center</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: bg0, borderRadius: 10, padding: 4 }}>
          {tabs.map(t => <Tab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.icon} {t.label}</Tab>)}
        </div>
      </div>
      <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
        {tab === "chat" && <ChatAgent onSave={loadLeads} />}
        {tab === "leads" && <Leads leads={leads} refresh={loadLeads} />}
        {tab === "storms" && <Storms />}
        {tab === "deploy" && <Deploy />}
      </div>
    </div>
  );
}
