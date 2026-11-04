# Roadmap: prototype → proof of concept → integration

## Stage 1 · Functional prototype (this repo)
- Simulated function, fictional data only.
- Local storage (patient's phone) or open Firestore (shared demo database).
- Goal: give the UCD team something real to click, react to, and redesign.

**Questions for the UCD sessions**
1. Who starts the card: the patient at check-in, the MA, or the provider?
2. Does a speaker toggle work in a real exam room, or should voice be split automatically (diarization)?
3. Does the provider dictate while the patient watches, or does the patient do teach-back by voice at the end?
4. Which sections are filled in most often? (The authorship log in the care team view answers this.)
5. Do patients actually reopen the plan at home? What do they look for first?
6. Are the "added" fields (owner, safety-net date, 911 line, changed/stopped meds) worth the extra taps?

**What to measure, even in simulation**
- Time to complete the card; fields left blank.
- Share of entries by provider vs. patient; voice vs. typed.
- Teach-back completion (3/3 checks).

## Stage 2 · Proof of concept (after UCD redesign)
- Real authentication (Firebase Auth / Identity Platform) and per-patient security rules.
- Installable PWA with offline-first storage on the device; encryption at rest.
- Explicit patient consent flow for sharing.
- Live "message my care team" routed to a staffed inbox (still outside the EMR).
- Pilot metrics: post-visit clarification calls and walk-backs per 100 visits, referral completion, results communicated within the promised window.

## Stage 3 · Integration with Meditab (IMS)
- Pull visit context (provider, reason, orders, prescriptions) from the EMR so the card is pre-filled, not re-dictated.
- Push the finalized plan back as a patient-education / after-visit document.
- Route messages into the EMR's patient-communication workflow.
- Likely paths: Meditab's FHIR/API offerings or HL7 interfaces. Confirm with Meditab what's available for Solvera's setup.
- Pharmacy: reconcile new, changed, and stopped meds against e-prescribing records.

## Privacy note (to resolve before Stage 2)
Data a patient keeps on their own phone, by their own choice, is generally outside HIPAA. Once the clinic or its vendor collects, stores, or syncs that data on the clinic's behalf, HIPAA applies, and the cloud database needs a Business Associate Agreement. Google offers a BAA that covers some Firebase and Google Cloud services but not all of them, so check service by service. Device-only storage reduces exposure but doesn't remove it once provider dictation, sharing, or messaging is involved. Get compliance/legal review before any real patient data is used.
