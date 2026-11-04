# After the Visit · My Clear Care Plan (prototype)

A clickable, database-backed prototype of Solvera Health's printed **"After the Visit · My Clear Care Plan"** card, rebuilt as a phone web app. It's meant for a **user-centered design (UCD) review**, not clinical use.

> **Simulation only.** Use fictional information. No real patient data should ever be entered.

## The problem it explores

After a visit, patients often call or come back to the clinic to clarify instructions that could have been settled in the room. The paper card helps the patient leave knowing **the next step, who owns it, and when to follow up**. This prototype tests whether the same card works better as an app that:

- the **provider and patient fill in together by voice** during the visit,
- **stays on the patient's phone**, so the patient owns the record and chooses whether to share it,
- gives the clinic a **back-of-house view** of shared plans, open loops, and incomplete teach-back,
- shows where **"send a message to my care team"** will go (a stub for now).

## What's in the prototype

| View | What it shows |
|---|---|
| **Patient app** (phone frame) | Visit list → card editor (sections 1–5 + "Before I leave") → saved plan → message stub. A **speaker toggle** (Provider / Me) tags every dictated entry with who said it and how. |
| **Care team view** | Plans patients chose to share, open-loop flags (no owner, no results path, safety-net date passed, teach-back < 3/3), the patient's messages, and an authorship log for each plan. |
| **Data & setup** | Switch between local storage and Firebase, Firestore rules, record schema, demo data, JSON export. |

Items marked **added** are small safety suggestions on top of the printed card, for the design team to keep or cut: an owner (Clinic / Me) for each test or referral, a "haven't heard by" safety-net date, a 911/ER line, and changed/stopped medications alongside new ones.

### Dictation
Uses the browser's Web Speech API (Chrome, Edge, Safari). If it isn't available or the mic is blocked, the mic buttons type a **simulated** fictional phrase so the flow can still be demonstrated. You can force simulated mode from the design notes panel.

## Run it

It's a static site using ES modules, so it must be served over http(s), not opened as a `file://`.

```bash
# any static server works
npx serve .
# or
python3 -m http.server 8000
```

**GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root. The app will be at `https://<user>.github.io/afterthevisit/`.

## Firebase (back of house)

By default, data is saved in the browser (localStorage), which stands in for "data lives on the patient's phone." To sync across devices during a design session:

1. Create a Firebase project and add a **Web app**.
2. Enable **Cloud Firestore** (any region).
3. Publish the prototype rules in [`firestore.rules`](firestore.rules). They're open and set to auto-expire; fine for fictional data only.
4. Paste the web config on the **Data & setup** tab, or hard-code it in [`js/config.js`](js/config.js).

Optional: host on Firebase Hosting with `firebase deploy` (see [`firebase.json`](firebase.json)).

## Structure

```
index.html          app shell
css/styles.css      Solvera-styled UI (palette approximated from the printed card)
js/app.js           screens, care-team view, setup, event handling
js/store.js         data layer: LocalStore + FirebaseStore behind one API
js/dictation.js     Web Speech API with simulated fallback
js/samples.js       fictional dictation phrases + demo records
js/config.js        Firebase config placeholder
firestore.rules     prototype-only Firestore rules
docs/ROADMAP.md     path from prototype → proof of concept → Meditab integration
```

## Branding

Uses Solvera's name, tagline, and an approximated color palette with a text wordmark. Swap in the official logo file and brand colors (`:root` in `css/styles.css`) before showing it outside the core team.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for next stages and the open privacy questions.
