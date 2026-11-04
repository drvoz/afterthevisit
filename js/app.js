import { openStore, FirebaseStore, LocalStore, rememberFirebaseConfig, forgetFirebaseConfig, savedFirebaseConfig } from "./store.js";
import { dictate, liveDictationAvailable } from "./dictation.js";
import { demoVisits } from "./samples.js";
import { COLLECTION } from "./config.js";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
let store = null;
let unsubscribe = null;
const ui = {
  tab: "patient",
  screen: "home",          // home | edit | view | message
  cur: null,               // working copy of the visit being edited/viewed
  speaker: "provider",     // who is talking right now
  preferSimulated: !liveDictationAvailable,
  showFinishWarning: false,
  ctSelected: null,
  setupStatus: null
};

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "v-" + Date.now() + Math.random().toString(16).slice(2));
const nowIso = () => new Date().toISOString();
const todayYmd = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

const KIND = {
  "test": "Test",
  "referral": "Referral",
  "med-new": "New med",
  "med-changed": "Changed med",
  "med-stopped": "Stopped med"
};

const MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function blankVisit() {
  return {
    id: uid(), source: "prototype", patientAlias: "Me (this phone)",
    createdAt: nowIso(), updatedAt: nowIso(),
    date: todayYmd(), provider: "", reason: "", contact: "", site: "",
    nextSteps: "",
    items: [],
    resultsWhen: "", whoContacts: "", followUp: "", safetyNet: "",
    notice: "", improveBy: "",
    callSooner: "", emergency: "",
    checklist: { explain: false, results: false, contact: false },
    status: "draft", shared: false,
    attrib: {}, events: [], messages: []
  };
}

/* ------------------------------------------------------------------ */
/* Field helpers: paths are "key" or "item:<id>:<key>"                 */
/* ------------------------------------------------------------------ */
function getVal(v, path) {
  if (path.startsWith("item:")) {
    const [, id, k] = path.split(":");
    const it = v.items.find((i) => i.id === id);
    return it ? it[k] : "";
  }
  return v[path];
}
function setVal(v, path, val) {
  if (path.startsWith("item:")) {
    const [, id, k] = path.split(":");
    const it = v.items.find((i) => i.id === id);
    if (it) it[k] = val;
  } else v[path] = val;
}
const prettyField = (f) => {
  if (!f) return "";
  if (f.startsWith("item:")) { const k = f.split(":")[2]; return "item · " + ({ name: "name", whenWhere: "when/where", todo: "what to do", kind: "type", owner: "owner" }[k] || k); }
  return f;
};
const sampleKeyFor = (path) => path.startsWith("item:") ? "item." + path.split(":")[2] : path;

let saveTimer = null;
function touch({ immediate = false } = {}) {
  if (!ui.cur) return;
  ui.cur.updatedAt = nowIso();
  clearTimeout(saveTimer);
  const doSave = () => store.save(structuredClone(ui.cur)).catch((e) => toast("Save failed: " + e.message));
  if (immediate) doSave(); else saveTimer = setTimeout(doSave, 400);
}
function logEvent(field, method, extra = {}) {
  ui.cur.events.push({ t: nowIso(), field, speaker: ui.speaker, method, ...extra });
}

/* ------------------------------------------------------------------ */
/* Patient app rendering                                               */
/* ------------------------------------------------------------------ */
function attribChip(path) {
  const a = ui.cur.attrib?.[path];
  if (!a) return "";
  const who = a.speaker === "patient" ? "Me" : "Provider";
  const how = a.method === "voice" ? "voice" : a.method === "simulated" ? "simulated voice" : "typed";
  return `<span class="attrib ${a.speaker}">${who} · ${how}</span>`;
}

function fieldInput(path, label, { type = "input", placeholder = "", hint = "", badge = "", inputType = "text" } = {}) {
  const val = getVal(ui.cur, path) ?? "";
  const ctl = type === "textarea"
    ? `<textarea data-field="${path}" rows="2" placeholder="${esc(placeholder)}">${esc(val)}</textarea>`
    : `<input type="${inputType}" data-field="${path}" value="${esc(val)}" placeholder="${esc(placeholder)}" />`;
  const mic = inputType === "date" ? "" : `<button class="mic" data-action="mic" data-path="${path}" aria-label="Dictate ${esc(label)}">${MIC}</button>`;
  return `<div class="field">
    ${label ? `<label>${esc(label)}${badge ? `<span class="new-badge">${badge}</span>` : ""}</label>` : ""}
    <div class="inrow">${ctl}${mic}</div>
    <div data-attrib="${path}">${attribChip(path)}</div>
    ${hint ? `<div class="hint">${hint}</div>` : ""}
  </div>`;
}

function renderHome(visits) {
  const mine = visits;
  const rows = mine.length ? mine.map((v) => {
    const d = new Date((v.date || v.createdAt.slice(0, 10)) + "T12:00:00");
    return `<button class="visit-row" data-action="open" data-id="${v.id}">
      <div class="date"><small>${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}</small>${d.getDate()}</div>
      <div class="meta"><b>${esc(v.reason || "Visit")}</b><span>${esc(v.provider || "Provider not set")}${v.source === "demo" ? " · demo" : ""}</span></div>
      <span class="status ${v.status}">${v.status === "complete" ? "Plan ready" : "In progress"}</span>
    </button>`;
  }).join("") : `<div class="empty">No visits yet.<br/>Tap <b>Start my visit card</b> when your appointment begins.</div>`;

  return `
    <div class="app-head">
      <h1>My Clear Care Plans</h1>
      <p>Your visit plans stay on this phone. You choose what to share.</p>
    </div>
    <div class="app-body">
      <button class="btn red block" data-action="new">+ Start my visit card</button>
      <div style="height:16px"></div>
      ${rows}
      <div style="height:6px"></div>
      <button class="btn ghost block" data-action="message-general">Send a message to my care team</button>
      <div class="pillars">YOUR HEALTH <b>·</b> YOUR VOICE <b>·</b> YOUR PLAN</div>
      <div class="expert">You are the expert on what is changing in your body and your life.</div>
    </div>`;
}

function renderItems() {
  const items = ui.cur.items.map((it) => `
    <div class="item">
      <button class="rm" data-action="rm-item" data-id="${it.id}" aria-label="Remove">×</button>
      <div class="kind-row">
        ${Object.entries(KIND).map(([k, l]) => `<button class="chip ${it.kind === k ? "on" : ""}" data-action="kind" data-id="${it.id}" data-kind="${k}">${l}</button>`).join("")}
      </div>
      ${fieldInput(`item:${it.id}:name`, "Test / Referral / Medication", { placeholder: "e.g., Chest X-ray" })}
      ${fieldInput(`item:${it.id}:whenWhere`, "When / Where")}
      ${fieldInput(`item:${it.id}:todo`, "What I need to do")}
      <div class="owner-row">Who makes it happen?
        <button class="chip ${it.owner === "clinic" ? "on" : ""}" data-action="owner" data-id="${it.id}" data-owner="clinic">Clinic</button>
        <button class="chip me ${it.owner === "me" ? "on" : ""}" data-action="owner" data-id="${it.id}" data-owner="me">Me</button>
        <span class="new-badge">added</span>
      </div>
    </div>`).join("");
  return items + `<button class="addbtn" data-action="add-item">+ Add a test, referral, or medication change</button>`;
}

function renderEdit() {
  const v = ui.cur;
  const c = v.checklist;
  const allChecked = c.explain && c.results && c.contact;
  return `
    <div class="app-head">
      <button class="back" data-action="home">Done</button>
      <h1>AFTER THE VISIT</h1>
      <p>My Clear Care Plan</p>
    </div>
    <div class="speaker-bar">
      <span class="lbl">Speaking</span>
      <div class="seg">
        <button class="${ui.speaker === "provider" ? "on" : ""}" data-action="speaker" data-who="provider">Provider</button>
        <button class="patient ${ui.speaker === "patient" ? "on" : ""}" data-action="speaker" data-who="patient">Me</button>
      </div>
      <span class="lbl" style="margin-left:auto">${ui.preferSimulated ? "sim voice" : "live voice"}</span>
    </div>
    <div class="app-body">
      <p class="tagline">Leave knowing the next step, who owns it, and when to follow up.</p>

      <div class="card">
        ${fieldInput("date", "Date of visit", { inputType: "date" })}
        ${fieldInput("provider", "Provider")}
        ${fieldInput("reason", "Reason for visit")}
        ${fieldInput("contact", "Best contact / portal")}
      </div>

      <div class="card">
        <h2><span class="num">1.</span> What am I doing next?</h2>
        ${fieldInput("nextSteps", "My next-steps plan / treatment", { type: "textarea" })}
      </div>

      <div class="card">
        <h2><span class="num">2.</span> Tests, referrals, or medication changes</h2>
        ${renderItems()}
      </div>

      <div class="card">
        <h2><span class="num">3.</span> Results and follow-up</h2>
        ${fieldInput("resultsWhen", "When should I expect results?")}
        ${fieldInput("whoContacts", "Who will contact whom?")}
        ${fieldInput("followUp", "My follow-up appointment / timeframe")}
        ${fieldInput("safetyNet", "If I haven't heard by this date, I'll call", { inputType: "date", badge: "added", hint: "A safety net so results never silently fall through." })}
      </div>

      <div class="card">
        <h2><span class="num">4.</span> What should improve, and when?</h2>
        ${fieldInput("notice", "What I should notice")}
        ${fieldInput("improveBy", "Expected timeframe")}
      </div>

      <div class="card">
        <h2><span class="num">5.</span> When should I call sooner?</h2>
        ${fieldInput("callSooner", "Symptoms or changes that mean I should contact the care team", { type: "textarea" })}
        ${fieldInput("emergency", "Call 911 / go to the ER if…", { type: "textarea", badge: "added" })}
      </div>

      <div class="card red">
        <h2>Before I leave</h2>
        <label class="check"><input type="checkbox" data-check="explain" ${c.explain ? "checked" : ""}/> I can explain the plan in my own words.</label>
        <label class="check"><input type="checkbox" data-check="results" ${c.results ? "checked" : ""}/> I know how and when I will receive results.</label>
        <label class="check"><input type="checkbox" data-check="contact" ${c.contact ? "checked" : ""}/> I know who to contact if something changes or I have questions.</label>
        <div class="hint">Tip: switch to <b>Me</b> and dictate the plan back in your own words. That's the teach-back.</div>
      </div>

      <div class="card">
        <div class="share-row">
          <div><b>Share this plan with my care team</b><div class="hint">Off = it stays only on this phone.</div></div>
          <label class="switch"><input type="checkbox" data-share ${v.shared ? "checked" : ""}/><span></span></label>
        </div>
      </div>

      ${ui.showFinishWarning && !allChecked ? `<div class="warnbox">Some boxes in <b>Before I leave</b> aren't checked yet. Ask your provider to go over those parts now. It saves a call later.<div style="margin-top:10px;display:flex;gap:8px"><button class="btn small" data-action="finish-anyway">Finish anyway</button><button class="btn small ghost" data-action="dismiss-warn">Go back</button></div></div>` : ""}
      <button class="btn red block" data-action="finish">Save my plan</button>
      <div style="height:30px"></div>
    </div>`;
}

function summaryHTML(v, { compact = false } = {}) {
  const dd = (x) => x ? `<dd>${esc(x)}</dd>` : `<dd class="blank">not recorded</dd>`;
  const items = v.items?.length ? v.items.map((i) => `
    <div class="sum-item ${i.owner === "me" ? "me" : ""}">
      <b>${esc(KIND[i.kind] || "Item")}: ${esc(i.name || "(unnamed)")}</b>
      <span>${esc(i.whenWhere || "when/where not set")} · ${esc(i.todo || "no action noted")} · <b style="display:inline">${i.owner === "me" ? "I arrange it" : i.owner === "clinic" ? "Clinic arranges it" : "Owner not set"}</b></span>
    </div>`).join("") : `<dd class="blank">None</dd>`;
  return `<div class="summary"><dl>
    ${compact ? "" : `<dt>Visit</dt><dd>${esc(v.date)} · ${esc(v.provider || "Provider not set")}${v.site ? " · " + esc(v.site) : ""}</dd>`}
    <dt>Reason</dt>${dd(v.reason)}
    <dt>1 · What I'm doing next</dt>${dd(v.nextSteps)}
    <dt>2 · Tests, referrals, medications</dt>${items}
    <dt>3 · Results</dt>${dd([v.resultsWhen, v.whoContacts].filter(Boolean).join(" · "))}
    <dt>Follow-up</dt>${dd(v.followUp)}
    <dt>Safety-net date</dt>${dd(v.safetyNet ? "If I haven't heard by " + v.safetyNet + ", I'll call" : "")}
    <dt>4 · What should improve</dt>${dd([v.notice, v.improveBy].filter(Boolean).join(" · "))}
    <dt>5 · Call sooner if</dt>${dd(v.callSooner)}
    <dt>Emergency</dt>${dd(v.emergency)}
    <dt>Best contact</dt>${dd(v.contact)}
  </dl></div>`;
}

function renderView() {
  const v = ui.cur;
  const c = v.checklist;
  const n = [c.explain, c.results, c.contact].filter(Boolean).length;
  return `
    <div class="app-head">
      <button class="back" data-action="home">My plans</button>
      <h1>${esc(v.reason || "My visit")}</h1>
      <p>${esc(v.date)} · ${esc(v.provider || "")}</p>
    </div>
    <div class="app-body">
      ${n === 3 ? `<div class="okbox">✓ You confirmed you understand the plan, the results, and who to contact.</div>` : `<div class="warnbox">${3 - n} of the "Before I leave" checks weren't confirmed. Message your care team if anything is unclear.</div>`}
      <div class="card">${summaryHTML(v)}</div>
      <div class="card">
        <div class="share-row">
          <div><b>Shared with my care team</b><div class="hint">${v.shared ? "Your care team can see this plan." : "Only on this phone."}</div></div>
          <label class="switch"><input type="checkbox" data-share ${v.shared ? "checked" : ""}/><span></span></label>
        </div>
      </div>
      ${v.messages?.length ? `<div class="card"><h2>My messages</h2>${v.messages.map((m) => `<div class="msg">${esc(m.text)}<small>${new Date(m.t).toLocaleString()} · not sent (prototype)</small></div>`).join("")}</div>` : ""}
      <button class="btn block" data-action="message">Send a message to my care team</button>
      <div style="height:10px"></div>
      <button class="btn ghost block" data-action="edit">Edit this plan</button>
      <div style="height:10px"></div>
      <button class="btn ghost block" data-action="delete" style="color:var(--red);border-color:var(--red)">Delete from this phone</button>
      <div style="height:30px"></div>
    </div>`;
}

function renderMessage() {
  const v = ui.cur;
  return `
    <div class="app-head">
      <button class="back" data-action="${v ? "back-view" : "home"}">Cancel</button>
      <h1>Message my care team</h1>
      <p>${v ? "About: " + esc(v.reason || "my visit") : "General question"}</p>
    </div>
    <div class="app-body">
      <div class="warnbox"><b>Prototype:</b> messages are saved for the demo but are <b>not sent</b> to anyone. For emergencies, call 911.</div>
      <div class="card">
        <div class="field"><label>Quick topics</label>
          <div class="kind-row" style="display:flex;gap:6px;flex-wrap:wrap">
            ${["I have a question about my plan", "I haven't received my results", "My symptoms changed", "Medication question"].map((q) => `<button class="chip" data-action="quick" data-q="${esc(q)}">${q}</button>`).join("")}
          </div>
        </div>
        <div class="field"><label>Message</label><div class="inrow"><textarea id="msgText" rows="5" placeholder="Type or dictate…"></textarea><button class="mic" data-action="mic-msg" aria-label="Dictate message">${MIC}</button></div></div>
      </div>
      <button class="btn red block" data-action="send">Save message (not sent)</button>
    </div>`;
}

const NOTES = {
  home: `<div class="note"><h4>What this screen tests</h4>
    <ul><li>The patient owns a <b>list of visit plans</b> on their phone. This replaces the paper card.</li>
    <li>"Start my visit card" is tapped at the <b>start</b> of the visit, not after.</li>
    <li>Messaging is a stub: it shows where the "send a message" path lives.</li></ul></div>`,
  get edit() { return `<div class="note"><h4>What this screen tests</h4>
    <ul><li><b>Speaker toggle:</b> provider and patient each dictate. Every entry is tagged with who said it and how (voice, simulated, typed). That gives the design team real data on co-authorship.</li>
    <li>The five sections and "Before I leave" mirror the printed card exactly.</li>
    <li><span class="new-badge">added</span> marks small safety additions for the design team to judge: an <b>owner</b> for each test/referral, a <b>safety-net date</b> for results, an <b>emergency</b> line, and <b>changed/stopped</b> medications.</li>
    <li>Sharing is <b>off by default</b>. The plan stays on the phone until the patient chooses to share it.</li></ul></div>
    <div class="note"><h4>Dictation</h4>${liveDictationAvailable ? "This browser supports live speech recognition. Tap a mic and speak. If the microphone is blocked, it falls back to simulated dictation." : "Live speech recognition isn't available in this browser, so the mic buttons type a <b>simulated</b> phrase. Chrome or Safari supports live voice."}
    <div style="margin-top:8px"><label class="check" style="font-size:13px"><input type="checkbox" data-action-toggle="simulate" ${ui.preferSimulated ? "checked" : ""} ${liveDictationAvailable ? "" : "disabled"}/> Always use simulated dictation (good for demos)</label></div></div>`; },
  view: `<div class="note"><h4>What this screen tests</h4>
    <ul><li>This is the <b>memorialized plan</b>: what the patient looks at at home instead of calling the clinic.</li>
    <li>Gaps in teach-back show up here, with a nudge to message instead of calling.</li></ul></div>`,
  message: `<div class="note"><h4>What this screen tests</h4>
    <ul><li>Structured quick topics help sort messages before a human reads them.</li>
    <li>Later stage: route these to the care team inbox in the EMR.</li></ul></div>`
};

function renderPatient() {
  const screen = $("#phoneScreen");
  const visits = store.all();
  let html = "";
  if (ui.screen === "home") html = renderHome(visits);
  else if (ui.screen === "edit") html = renderEdit();
  else if (ui.screen === "view") html = renderView();
  else if (ui.screen === "message") html = renderMessage();
  screen.innerHTML = html;
  $("#designNotes").innerHTML = `<h3>Design notes</h3>${NOTES[ui.screen] || ""}`;
}

/* ------------------------------------------------------------------ */
/* Care team (back of house)                                           */
/* ------------------------------------------------------------------ */
function openLoops(v) {
  const loops = [];
  const today = todayYmd();
  const unowned = (v.items || []).filter((i) => !i.owner || !i.whenWhere).length;
  if (unowned) loops.push(`${unowned} item${unowned > 1 ? "s" : ""} missing owner or date`);
  const hasTests = (v.items || []).some((i) => i.kind === "test");
  if (hasTests && (!v.resultsWhen || !v.whoContacts)) loops.push("Results path unclear");
  if (v.safetyNet && v.safetyNet < today) loops.push("Safety-net date passed");
  const c = v.checklist || {};
  const n = [c.explain, c.results, c.contact].filter(Boolean).length;
  if (n < 3) loops.push(`Teach-back ${n}/3`);
  if (!v.callSooner) loops.push("No call-sooner signs");
  if ((v.messages || []).length) loops.push(`${v.messages.length} message${v.messages.length > 1 ? "s" : ""}`);
  return loops;
}

function renderCareTeam() {
  const all = store.all();
  const shared = all.filter((v) => v.shared);
  const hidden = all.length - shared.length;
  const loopsBy = new Map(shared.map((v) => [v.id, openLoops(v)]));
  const teach = shared.filter((v) => v.checklist?.explain && v.checklist?.results && v.checklist?.contact).length;
  const totalLoops = [...loopsBy.values()].reduce((a, l) => a + l.filter((x) => !x.includes("message")).length, 0);
  const msgs = shared.reduce((a, v) => a + (v.messages?.length || 0), 0);
  const sel = shared.find((v) => v.id === ui.ctSelected) || null;

  const rows = shared.length ? shared.map((v) => {
    const loops = loopsBy.get(v.id);
    return `<tr data-action="ct-select" data-id="${v.id}" class="${sel && sel.id === v.id ? "sel" : ""}">
      <td><b>${esc(v.patientAlias || "Patient")}</b><br/><span style="color:var(--muted);font-size:12px">${esc(v.date)}${v.site ? " · " + esc(v.site) : ""}</span></td>
      <td>${esc(v.reason || "")}<br/><span style="color:var(--muted);font-size:12px">${esc(v.provider || "")}</span></td>
      <td>${(v.items || []).length}</td>
      <td><div class="loops">${loops.length ? loops.map((l) => `<span class="loop">${esc(l)}</span>`).join("") : `<span class="loop ok">Closed loop</span>`}</div></td>
      <td><span class="status ${v.status}">${v.status === "complete" ? "Saved" : "Draft"}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="5" class="empty">No shared plans yet. Load demo data or complete a visit in the patient app and turn on sharing.</td></tr>`;

  const log = sel ? (sel.events || []).slice().reverse().map((e) => `<tr><td>${new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td><td><span class="tag ${e.speaker}">${e.speaker}</span></td><td>${esc(prettyField(e.field))}</td><td>${esc(e.method)}${e.note ? " · " + esc(e.note) : ""}</td></tr>`).join("") : "";

  $("#careTeam").innerHTML = `<div class="ct-wrap">
    <div class="ct-head">
      <div><h2>Care team view</h2><p>Plans patients chose to share. Simulates what the clinic sees in the back office. ${hidden ? `<b>${hidden}</b> plan${hidden > 1 ? "s are" : " is"} private on the patient's phone and not shown.` : ""}</p></div>
      <div class="ct-actions">
        <button class="btn small ghost" data-action="load-demo">Load demo data</button>
        <button class="btn small ghost" data-action="export">Export JSON</button>
      </div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="v">${shared.length}</div><div class="k">Shared care plans</div></div>
      <div class="tile"><div class="v">${shared.length ? Math.round((100 * teach) / shared.length) : 0}%</div><div class="k">Full teach-back (3/3)</div></div>
      <div class="tile ${totalLoops ? "alert" : ""}"><div class="v">${totalLoops}</div><div class="k">Open loops to close</div></div>
      <div class="tile ${msgs ? "alert" : ""}"><div class="v">${msgs}</div><div class="k">Patient messages (not live)</div></div>
    </div>
    <div class="ct-grid">
      <div class="panel"><h3>Plans</h3><div style="overflow-x:auto"><table>
        <thead><tr><th>Patient</th><th>Visit</th><th>Items</th><th>Open loops</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>
      <div class="panel"><h3>${sel ? esc(sel.patientAlias) : "Select a plan"}</h3>
        <div class="detail">${sel ? `
          ${summaryHTML(sel)}
          ${(sel.messages || []).length ? `<h4 style="font-family:var(--head);color:var(--navy);margin:16px 0 6px">Messages</h4>${sel.messages.map((m) => `<div class="msg" style="background:var(--paper)">${esc(m.text)}<small>${new Date(m.t).toLocaleString()} · prototype, not delivered</small></div>`).join("")}` : ""}
          <h4 style="font-family:var(--head);color:var(--navy);margin:16px 0 6px">Authorship log</h4>
          ${log ? `<table class="log"><thead><tr><th>Time</th><th>Who</th><th>Field</th><th>How</th></tr></thead><tbody>${log}</tbody></table>` : `<div class="hint">No dictation events recorded.</div>`}
        ` : `<div class="empty">Click a row to see the plan and who said what.</div>`}</div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // PROTOTYPE ONLY: open to anyone with the config, auto-expires.
    // Fictional data only. Replace with authenticated rules before any real use.
    match /carePlans/{planId} {
      allow read, write: if request.time < timestamp.date(2027, 1, 31);
    }
  }
}`;

const SCHEMA = `carePlans/{id}
{
  id, source: "prototype" | "demo",
  patientAlias, date, provider, reason, contact, site,
  nextSteps,                                   // §1
  items: [{ id, kind: test|referral|med-new|med-changed|med-stopped,
            name, whenWhere, todo, owner: clinic|me }],   // §2
  resultsWhen, whoContacts, followUp, safetyNet,           // §3
  notice, improveBy,                                       // §4
  callSooner, emergency,                                   // §5
  checklist: { explain, results, contact },               // Before I leave
  shared: boolean, status: draft|complete,
  attrib: { [field]: { speaker, method } },
  events: [{ t, field, speaker, method }],                // authorship log
  messages: [{ t, text, status: "prototype-not-sent" }],
  createdAt, updatedAt
}`;

function renderSetup() {
  const cfg = savedFirebaseConfig() || {};
  const f = (k, label, ph = "") => `<div><label>${label}</label><input type="text" data-cfg="${k}" value="${esc(cfg[k] || "")}" placeholder="${ph}"/></div>`;
  const st = ui.setupStatus;
  $("#setup").innerHTML = `<div class="setup-wrap">
    <div class="panel"><h3>Where data is saved</h3><div class="inner">
      <div class="statusline ${store.mode === "firebase" ? "ok" : ""}">Now: ${esc(store.label)}</div>
      <p style="color:var(--muted);font-size:14px">Local mode keeps everything in this browser, a stand-in for "the data lives on the patient's phone." Firebase mode syncs to Cloud Firestore so several devices (patient phone, clinic laptop) see the same records in real time during a design session.</p>
    </div></div>

    <div class="panel"><h3>Connect Firebase (Cloud Firestore)</h3><div class="inner">
      <div class="grid2">
        ${f("apiKey", "apiKey")}${f("projectId", "projectId")}
        ${f("authDomain", "authDomain", "your-project.firebaseapp.com")}${f("appId", "appId")}
        ${f("storageBucket", "storageBucket (optional)")}${f("messagingSenderId", "messagingSenderId (optional)")}
        ${f("collection", "Collection", COLLECTION)}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn small" data-action="fb-connect">Connect</button>
        <button class="btn small ghost" data-action="fb-copy">Copy local plans to Firebase</button>
        <button class="btn small ghost" data-action="fb-disconnect">Use local only</button>
      </div>
      ${st ? `<div class="statusline ${st.ok ? "ok" : "err"}">${esc(st.msg)}</div>` : ""}
      <p class="hint">Values come from Firebase console → Project settings → Your apps → Web app. You can also hard-code them in <code>js/config.js</code>.</p>
    </div></div>

    <div class="panel"><h3>Prototype Firestore rules</h3><div class="inner"><pre>${esc(RULES)}</pre></div></div>
    <div class="panel"><h3>Record schema</h3><div class="inner"><pre>${esc(SCHEMA)}</pre></div></div>

    <div class="panel"><h3>Prototype data</h3><div class="inner" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn small ghost" data-action="load-demo">Load demo data</button>
      <button class="btn small ghost" data-action="export">Export JSON</button>
      <button class="btn small ghost" data-action="clear-all" style="color:var(--red);border-color:var(--red)">Delete all records</button>
    </div></div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Render orchestration                                                */
/* ------------------------------------------------------------------ */
function renderAll() {
  const pill = $("#storePill");
  pill.textContent = store.mode === "firebase" ? "Firebase" : "Local";
  pill.className = "store-pill" + (store.mode === "firebase" ? " firebase" : "");
  pill.title = store.label;
  renderPatient();
  renderCareTeam();
  renderSetup();
}

function attachStore(s) {
  if (unsubscribe) unsubscribe();
  if (store && store.dispose) store.dispose();
  store = s;
  unsubscribe = store.onChange(() => {
    // Don't re-render the patient editor while typing; refresh the other views.
    renderCareTeam();
    if (ui.screen === "home") renderPatient();
  });
  renderAll();
}

function go(screen) {
  ui.screen = screen;
  ui.showFinishWarning = false;
  renderPatient();
  $("#phoneScreen").scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */
document.addEventListener("click", async (e) => {
  const tab = e.target.closest(".tab");
  if (tab) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tabpanel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + tab.dataset.tab));
    ui.tab = tab.dataset.tab;
    if (ui.tab === "careteam") renderCareTeam();
    if (ui.tab === "setup") renderSetup();
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  const id = el.dataset.id;

  switch (a) {
    case "new":
      ui.cur = blankVisit(); ui.speaker = "provider";
      ui.cur.events.push({ t: nowIso(), field: "visit", speaker: "patient", method: "tap", note: "started card" });
      touch({ immediate: true });
      go("edit"); break;
    case "open": {
      const v = store.all().find((x) => x.id === id);
      if (!v) return;
      ui.cur = structuredClone(v);
      ui.cur.attrib ||= {}; ui.cur.events ||= []; ui.cur.messages ||= []; ui.cur.items ||= [];
      go(v.status === "complete" ? "view" : "edit"); break;
    }
    case "home": touch({ immediate: true }); ui.cur = null; go("home"); break;
    case "edit": go("edit"); break;
    case "back-view": go("view"); break;
    case "speaker": ui.speaker = el.dataset.who; renderPatient(); break;
    case "add-item":
      ui.cur.items.push({ id: "i" + Date.now(), kind: "test", name: "", whenWhere: "", todo: "", owner: "" });
      touch(); { const st = $("#phoneScreen").scrollTop; renderPatient(); $("#phoneScreen").scrollTop = st; } break;
    case "rm-item":
      ui.cur.items = ui.cur.items.filter((i) => i.id !== id); touch();
      { const st = $("#phoneScreen").scrollTop; renderPatient(); $("#phoneScreen").scrollTop = st; } break;
    case "kind": case "owner": {
      const it = ui.cur.items.find((i) => i.id === id);
      if (a === "kind") it.kind = el.dataset.kind; else it.owner = it.owner === el.dataset.owner ? "" : el.dataset.owner;
      logEvent(`item:${id}:${a}`, "tap"); touch();
      const st = $("#phoneScreen").scrollTop; renderPatient(); $("#phoneScreen").scrollTop = st; break;
    }
    case "mic": {
      const path = el.dataset.path;
      dictate({
        sampleKey: sampleKeyFor(path), speaker: ui.speaker, preferSimulated: ui.preferSimulated,
        onStart: (mode, reason) => { el.classList.add("rec"); if (mode === "simulated" && reason && reason !== "unsupported" && reason !== "preference") toast("Mic unavailable, using simulated dictation"); },
        onEnd: (why) => { el.classList.remove("rec"); if (why === "no-speech") toast("Didn't catch that. Tap the mic again, or turn on simulated dictation."); },
        onText: (text, method) => {
          const prev = getVal(ui.cur, path) || "";
          const val = prev ? prev.replace(/\s*$/, "") + " " + text : text;
          setVal(ui.cur, path, val);
          ui.cur.attrib[path] = { speaker: ui.speaker, method };
          logEvent(path, method);
          const input = document.querySelector(`[data-field="${CSS.escape(path)}"]`);
          if (input) input.value = val;
          const at = document.querySelector(`[data-attrib="${CSS.escape(path)}"]`);
          if (at) at.innerHTML = attribChip(path);
          touch();
        }
      });
      break;
    }
    case "finish": {
      const c = ui.cur.checklist;
      if (!(c.explain && c.results && c.contact) && !ui.showFinishWarning) { ui.showFinishWarning = true; const st = $("#phoneScreen").scrollTop; renderPatient(); $("#phoneScreen").scrollTop = st + 200; break; }
    }
    // falls through
    case "finish-anyway":
      ui.cur.status = "complete"; logEvent("visit", "tap", { note: "saved plan" }); touch({ immediate: true });
      toast("Plan saved on this phone" + (ui.cur.shared ? " and shared with care team" : ""));
      go("view"); break;
    case "dismiss-warn": ui.showFinishWarning = false; renderPatient(); break;
    case "delete":
      if (ui.cur) { await store.remove(ui.cur.id); ui.cur = null; toast("Deleted from this phone"); go("home"); }
      break;
    case "message": go("message"); break;
    case "message-general": ui.cur = null; go("message"); break;
    case "quick": { const t = $("#msgText"); t.value = (t.value ? t.value + " " : "") + el.dataset.q + ". "; t.focus(); break; }
    case "mic-msg":
      dictate({ sampleKey: "callSooner", speaker: "patient", preferSimulated: ui.preferSimulated,
        onStart: () => el.classList.add("rec"), onEnd: () => el.classList.remove("rec"),
        onText: (text) => { const t = $("#msgText"); t.value = (t.value ? t.value + " " : "") + text; } });
      break;
    case "send": {
      const text = $("#msgText").value.trim();
      if (!text) { toast("Type or dictate a message first"); break; }
      if (!ui.cur) {
        // general message: attach to most recent plan or create a holder
        const latest = store.all()[0];
        ui.cur = latest ? structuredClone(latest) : { ...blankVisit(), reason: "General question", status: "complete" };
        ui.cur.messages ||= [];
      }
      ui.cur.messages.push({ t: nowIso(), text, status: "prototype-not-sent" });
      touch({ immediate: true });
      toast("Saved. In a live version, this would go to your care team.");
      go("view"); break;
    }
    case "ct-select": ui.ctSelected = id; renderCareTeam(); break;
    case "load-demo": await store.saveMany(demoVisits()); toast("Demo plans loaded"); renderAll(); break;
    case "export": {
      const blob = new Blob([JSON.stringify(store.all(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: "clear-care-plans.json" });
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); break;
    }
    case "clear-all":
      if (confirmInline(el)) { await store.clear(); ui.cur = null; ui.screen = "home"; toast("All records deleted"); renderAll(); }
      break;
    case "fb-connect": {
      const cfg = {};
      document.querySelectorAll("[data-cfg]").forEach((i) => { if (i.value.trim()) cfg[i.dataset.cfg] = i.value.trim(); });
      if (!cfg.apiKey || !cfg.projectId) { ui.setupStatus = { ok: false, msg: "apiKey and projectId are required." }; renderSetup(); break; }
      ui.setupStatus = { ok: true, msg: "Connecting…" }; renderSetup();
      try {
        const { collection, ...fb } = cfg;
        const s = new FirebaseStore(fb, collection || COLLECTION);
        await s.init();
        rememberFirebaseConfig(cfg);
        ui.setupStatus = { ok: true, msg: `Connected. ${s.all().length} record(s) in Firestore.` };
        attachStore(s);
      } catch (err) {
        ui.setupStatus = { ok: false, msg: "Could not connect: " + (err.code || err.message) };
        renderSetup();
      }
      break;
    }
    case "fb-copy": {
      if (store.mode !== "firebase") { ui.setupStatus = { ok: false, msg: "Connect Firebase first." }; renderSetup(); break; }
      const local = new LocalStore(); await local.init();
      await store.saveMany(local.all());
      ui.setupStatus = { ok: true, msg: `Copied ${local.all().length} local plan(s) to Firebase.` }; renderSetup(); break;
    }
    case "fb-disconnect": {
      forgetFirebaseConfig();
      const s = new LocalStore(); await s.init();
      ui.setupStatus = { ok: true, msg: "Using local storage." };
      attachStore(s); break;
    }
  }
});

// Two-tap confirm without browser dialogs
function confirmInline(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = "1";
  const orig = el.textContent;
  el.textContent = "Tap again to confirm";
  setTimeout(() => { delete el.dataset.armed; el.textContent = orig; }, 3000);
  return false;
}

document.addEventListener("input", (e) => {
  const path = e.target.dataset?.field;
  if (!path || !ui.cur) return;
  setVal(ui.cur, path, e.target.value);
  // typed edits: attribute to current speaker as "typed" (once per burst)
  const prev = ui.cur.attrib[path];
  if (!prev || prev.method !== "typed" || prev.speaker !== ui.speaker) {
    ui.cur.attrib[path] = { speaker: ui.speaker, method: "typed" };
    logEvent(path, "typed");
    const at = document.querySelector(`[data-attrib="${CSS.escape(path)}"]`);
    if (at) at.innerHTML = attribChip(path);
  }
  touch();
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset?.check && ui.cur) {
    ui.cur.checklist[t.dataset.check] = t.checked;
    logEvent("checklist." + t.dataset.check, "tap", { note: t.checked ? "checked" : "unchecked" });
    touch();
    if (ui.showFinishWarning) { const st = $("#phoneScreen").scrollTop; renderPatient(); $("#phoneScreen").scrollTop = st; }
  } else if (t.hasAttribute?.("data-share") && ui.cur) {
    ui.cur.shared = t.checked;
    logEvent("shared", "tap", { note: t.checked ? "shared" : "private" });
    touch({ immediate: true });
    toast(t.checked ? "Shared with your care team" : "Now private to this phone");
    if (ui.screen === "view") renderPatient();
  } else if (t.dataset?.actionToggle === "simulate") {
    ui.preferSimulated = t.checked;
    renderPatient();
  } else if (t.type === "date" && t.dataset?.field) {
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
(async function boot() {
  const s = await openStore();
  attachStore(s);
  if (!s.all().length) {
    await s.saveMany(demoVisits());
    renderAll();
  }
})();
