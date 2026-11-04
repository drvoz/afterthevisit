// Fictional content only. Used for simulated dictation and demo records.

export const DICTATION_SAMPLES = {
  provider: {
    provider: ["Dr. Maya Ellis, family medicine"],
    reason: ["Follow-up for blood pressure and a cough that has lasted three weeks"],
    contact: ["Patient portal, or text to the cell number on file"],
    nextSteps: [
      "Start lisinopril 10 milligrams once each morning. Check your blood pressure at home three times a week and write the numbers down.",
      "Rest your voice, drink plenty of fluids, and use the inhaler before bed for the next two weeks."
    ],
    "item.name": ["Chest X-ray", "Referral to pulmonology", "Lisinopril 10 mg, once daily", "Basic metabolic panel (blood test)"],
    "item.whenWhere": ["This week, Solvera Peoria radiology, walk-in until 4 pm", "Their office will call within 5 business days", "Pharmacy on file, ready today", "In 2 weeks, lab here at the clinic"],
    "item.todo": ["No preparation needed, bring your ID", "Answer the call from the specialist office and book the first opening", "Pick it up today and take one each morning", "Do not eat after midnight the night before"],
    resultsWhen: ["X-ray results in 2 to 3 business days"],
    whoContacts: ["Our nurse will message you in the portal with every result, normal or not"],
    followUp: ["Return visit in 4 weeks to recheck blood pressure"],
    safetyNet: ["Friday"],
    notice: ["The cough should loosen up and you should sleep better"],
    improveBy: ["Within 7 to 10 days"],
    callSooner: ["Fever over 101, coughing up blood, or home blood pressure over 180 on the top number"],
    emergency: ["Chest pain, trouble breathing, or face or arm weakness: call 911"]
  },
  patient: {
    reason: ["My cough and my blood pressure"],
    contact: ["Text me, I don't check email much"],
    nextSteps: ["So I take the new pill every morning and write down my blood pressure three times a week."],
    "item.todo": ["I'll go Thursday after work", "I need a ride, I'll ask my sister"],
    notice: ["I should be able to sleep through the night without coughing"],
    callSooner: ["If I get a fever or see blood, I call right away"],
    whoContacts: ["The nurse messages me. If I don't hear by Friday, I call"]
  }
};

const iso = (d) => d.toISOString();
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysAhead = (n) => daysAgo(-n);

export function demoVisits() {
  const mk = (o) => ({
    id: "demo-" + Math.random().toString(36).slice(2, 9),
    source: "demo",
    shared: true,
    messages: [],
    events: [],
    attrib: {},
    ...o
  });
  return [
    mk({
      patientAlias: "Demo patient · A. Rivera",
      createdAt: iso(daysAgo(6)), updatedAt: iso(daysAgo(6)),
      date: ymd(daysAgo(6)), provider: "Dr. Maya Ellis, FM", reason: "Blood pressure follow-up, 3-week cough",
      contact: "Portal + text", site: "Peoria",
      nextSteps: "Start lisinopril 10 mg each morning. Home BP 3x/week, write it down.",
      items: [
        { id: "i1", kind: "test", name: "Chest X-ray", whenWhere: "This week, Peoria radiology", todo: "Walk in, bring ID", owner: "me" },
        { id: "i2", kind: "referral", name: "Pulmonology referral", whenWhere: "Office calls within 5 days", todo: "Answer & book", owner: "clinic" },
        { id: "i3", kind: "med-new", name: "Lisinopril 10 mg daily", whenWhere: "Pharmacy on file, today", todo: "Pick up, 1 each AM", owner: "me" }
      ],
      resultsWhen: "2–3 business days", whoContacts: "Nurse messages via portal", followUp: "4 weeks",
      safetyNet: ymd(daysAgo(1)),
      notice: "Cough loosens, sleep improves", improveBy: "7–10 days",
      callSooner: "Fever >101, blood in cough, BP >180", emergency: "Chest pain or trouble breathing: 911",
      checklist: { explain: true, results: true, contact: true }, status: "complete",
      events: [
        { t: iso(daysAgo(6)), field: "nextSteps", speaker: "provider", method: "voice" },
        { t: iso(daysAgo(6)), field: "items", speaker: "provider", method: "voice" },
        { t: iso(daysAgo(6)), field: "nextSteps", speaker: "patient", method: "voice", note: "teach-back" }
      ],
      messages: [{ t: iso(daysAgo(2)), text: "Haven't heard about my X-ray yet. Is it back?", status: "prototype-not-sent" }]
    }),
    mk({
      patientAlias: "Demo patient · J. Okafor",
      createdAt: iso(daysAgo(2)), updatedAt: iso(daysAgo(2)),
      date: ymd(daysAgo(2)), provider: "N. Patel, APRN", reason: "Diabetes check, A1c",
      contact: "Phone call", site: "Galesburg",
      nextSteps: "Increase metformin to twice daily with meals. Walk 20 minutes after dinner.",
      items: [
        { id: "i1", kind: "med-changed", name: "Metformin 500 mg → twice daily", whenWhere: "Use current supply", todo: "Take with breakfast & dinner", owner: "me" },
        { id: "i2", kind: "referral", name: "Diabetic eye exam", whenWhere: "", todo: "", owner: "" },
        { id: "i3", kind: "test", name: "A1c recheck", whenWhere: "3 months, clinic lab", todo: "", owner: "clinic" }
      ],
      resultsWhen: "", whoContacts: "", followUp: "3 months",
      safetyNet: "",
      notice: "Fewer high readings", improveBy: "2–4 weeks",
      callSooner: "", emergency: "",
      checklist: { explain: true, results: false, contact: false }, status: "complete"
    }),
    mk({
      patientAlias: "Demo patient · L. Chen",
      createdAt: iso(daysAgo(0)), updatedAt: iso(daysAgo(0)),
      date: ymd(daysAgo(0)), provider: "Dr. Maya Ellis, FM", reason: "Knee pain after fall",
      contact: "Portal", site: "Peoria",
      nextSteps: "Ice 20 minutes 3x/day, ibuprofen with food as needed.",
      items: [
        { id: "i1", kind: "test", name: "Knee X-ray", whenWhere: "Tomorrow, Peoria", todo: "Walk in", owner: "me" },
        { id: "i2", kind: "med-stopped", name: "Stop naproxen (duplicate with ibuprofen)", whenWhere: "Now", todo: "Don't take both", owner: "me" }
      ],
      resultsWhen: "1–2 days", whoContacts: "Clinic calls if abnormal; portal either way", followUp: "2 weeks if not better",
      safetyNet: ymd(daysAhead(3)),
      notice: "Swelling goes down", improveBy: "1 week",
      callSooner: "Can't bear weight, numbness", emergency: "",
      checklist: { explain: true, results: true, contact: false }, status: "draft"
    })
  ];
}
