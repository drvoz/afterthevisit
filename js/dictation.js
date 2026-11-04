// Voice capture. Uses the browser's Web Speech API when present (Chrome, Edge, Safari).
// When it is missing or blocked, it falls back to a SIMULATED dictation that types a
// fictional sample phrase, so the flow can still be demonstrated anywhere.

import { DICTATION_SAMPLES } from "./samples.js";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const liveDictationAvailable = !!SR;

const counters = {};
function nextSample(speaker, key) {
  const bank = (DICTATION_SAMPLES[speaker] && DICTATION_SAMPLES[speaker][key])
    || DICTATION_SAMPLES.provider[key]
    || ["(sample dictation)"];
  const c = `${speaker}:${key}`;
  counters[c] = (counters[c] || 0) % bank.length;
  return bank[counters[c]++];
}

let active = null;

/**
 * dictate({ sampleKey, speaker, preferSimulated, onText, onStart, onEnd })
 * onText(text, method) where method is "voice" | "simulated"
 */
export function dictate({ sampleKey, speaker, preferSimulated, onText, onStart, onEnd }) {
  if (active) { try { active.stop(); } catch { /* ignore */ } active = null; }

  const simulate = (reason) => {
    onStart && onStart("simulated", reason);
    const text = nextSample(speaker, sampleKey);
    setTimeout(() => { onText(text, "simulated"); onEnd && onEnd(); }, 700);
  };

  if (!SR || preferSimulated) return simulate(!SR ? "unsupported" : "preference");

  let got = false;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    got = true;
    const text = Array.from(e.results).map((res) => res[0].transcript).join(" ").trim();
    if (text) onText(text, "voice");
  };
  r.onerror = (e) => {
    active = null; errored = true;
    if (!got && (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture" || e.error === "network")) {
      simulate(e.error);
    } else { onEnd && onEnd(e.error === "no-speech" ? "no-speech" : null); }
  };
  let errored = false;
  r.onend = () => { active = null; onEnd && onEnd(got || errored ? null : "no-speech"); };
  try {
    r.start();
    active = r;
    onStart && onStart("voice");
  } catch {
    simulate("start-failed");
  }
}

export function stopDictation() {
  if (active) { try { active.stop(); } catch { /* ignore */ } active = null; }
}
