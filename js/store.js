// Data layer with two interchangeable backends:
//   LocalStore    – browser localStorage (falls back to memory). Simulates "data lives on the phone".
//   FirebaseStore – Cloud Firestore, live-synced. Simulates the back-of-house record.
// Both expose the same async API so the UI never knows which one it is talking to.

import { firebaseConfig, COLLECTION, FIREBASE_SDK } from "./config.js";

const LS_KEY = "solvera.ccp.visits.v1";
const LS_CFG = "solvera.ccp.firebaseConfig.v1";

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
}
function safeDel(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export class LocalStore {
  constructor() {
    this.mode = "local";
    this.label = "Local (this browser)";
    this.listeners = new Set();
    this.mem = null;
  }
  async init() {
    const raw = safeGet(LS_KEY);
    try { this.mem = raw ? JSON.parse(raw) : []; } catch { this.mem = []; }
    this._emit();
  }
  _persist() {
    if (!safeSet(LS_KEY, JSON.stringify(this.mem))) this.label = "Memory only (storage blocked)";
    this._emit();
  }
  _emit() { this.listeners.forEach((fn) => fn(this.all())); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  all() { return [...this.mem].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); }
  async save(visit) {
    const i = this.mem.findIndex((v) => v.id === visit.id);
    if (i >= 0) this.mem[i] = visit; else this.mem.push(visit);
    this._persist();
  }
  async saveMany(list) { list.forEach((v) => { const i = this.mem.findIndex((x) => x.id === v.id); if (i >= 0) this.mem[i] = v; else this.mem.push(v); }); this._persist(); }
  async remove(id) { this.mem = this.mem.filter((v) => v.id !== id); this._persist(); }
  async clear() { this.mem = []; this._persist(); }
}

export class FirebaseStore {
  constructor(cfg, collectionName = COLLECTION) {
    this.mode = "firebase";
    this.label = `Firebase · ${cfg.projectId}/${collectionName}`;
    this.cfg = cfg;
    this.coll = collectionName;
    this.listeners = new Set();
    this.cache = [];
  }
  async init() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
    const appMod = await import(`${base}/firebase-app.js`);
    this.fs = await import(`${base}/firebase-firestore.js`);
    const app = appMod.initializeApp(this.cfg, "ccp-" + Date.now());
    this.db = this.fs.getFirestore(app);
    const col = this.fs.collection(this.db, this.coll);
    // First read surfaces permission / config errors to the caller.
    const snap = await this.fs.getDocs(col);
    this.cache = snap.docs.map((d) => d.data());
    this._emit();
    this.unsub = this.fs.onSnapshot(col, (s) => {
      this.cache = s.docs.map((d) => d.data());
      this._emit();
    }, (err) => console.warn("Firestore listener error", err));
  }
  _emit() { this.listeners.forEach((fn) => fn(this.all())); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  all() { return [...this.cache].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); }
  async save(visit) {
    // optimistic local update so typing feels instant
    const i = this.cache.findIndex((v) => v.id === visit.id);
    if (i >= 0) this.cache[i] = visit; else this.cache.push(visit);
    this._emit();
    await this.fs.setDoc(this.fs.doc(this.db, this.coll, visit.id), JSON.parse(JSON.stringify(visit)));
  }
  async saveMany(list) { for (const v of list) await this.save(v); }
  async remove(id) { await this.fs.deleteDoc(this.fs.doc(this.db, this.coll, id)); }
  async clear() { for (const v of this.cache) await this.remove(v.id); }
  dispose() { this.unsub && this.unsub(); }
}

export function savedFirebaseConfig() {
  const raw = safeGet(LS_CFG);
  if (raw) { try { return JSON.parse(raw); } catch { /* ignore */ } }
  return firebaseConfig.apiKey ? { ...firebaseConfig, collection: COLLECTION } : null;
}
export function rememberFirebaseConfig(cfg) { safeSet(LS_CFG, JSON.stringify(cfg)); }
export function forgetFirebaseConfig() { safeDel(LS_CFG); }

export async function openStore() {
  const cfg = savedFirebaseConfig();
  if (cfg && cfg.apiKey && cfg.projectId) {
    try {
      const { collection, ...fb } = cfg;
      const s = new FirebaseStore(fb, collection || COLLECTION);
      await s.init();
      return s;
    } catch (e) {
      console.warn("Firebase unavailable, falling back to local", e);
    }
  }
  const s = new LocalStore();
  await s.init();
  return s;
}
