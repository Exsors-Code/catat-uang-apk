// CatatUang IndexedDB wrapper (multiple object stores)
// Stores: meta, tx, inc, detected, transfers, goals, photos
// Backward compatible: legacy single 'state' record in store 'kv' is migrated on load.
const DB = {
  _p: null,
  _conn: null,
  STORES: ['meta', 'tx', 'inc', 'detected', 'transfers', 'goals', 'photos'],
  LEGACY: 'kv',
  open() {
    if (this._p) return this._p;
    this._p = new Promise((ok, no) => {
      const r = indexedDB.open('catatuang', 3);
      r.onupgradeneeded = (ev) => {
        const db = r.result;
        if (ev.oldVersion < 1 && !db.objectStoreNames.contains(this.LEGACY)) db.createObjectStore(this.LEGACY);
        this.STORES.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        });
      };
      r.onsuccess = () => { this._conn = r.result; ok(r.result); };
      r.onerror = () => no(r.error);
    });
    return this._p;
  },
  _tx(store, mode, fn) {
    return new Promise((ok, no) => {
      this.open().then((d) => {
        const t = d.transaction(store, mode);
        const res = fn(t.objectStore(store));
        t.oncomplete = () => ok(res);
        t.onerror = () => no(t.error);
      }).catch(no);
    });
  },
  async get(store, k) {
    try {
      return await this._tx(store, 'readonly', (s) => new Promise((ok, no) => {
        const q = s.get(k);
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return undefined; }
  },
  async put(store, k, v) {
    try {
      return await this._tx(store, 'readwrite', (s) => new Promise((ok, no) => {
        const q = s.put(v, k);
        q.onsuccess = () => ok();
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return undefined; }
  },
  async putAll(store, obj) {
    try {
      return await this._tx(store, 'readwrite', (s) => {
        Object.keys(obj || {}).forEach((k) => s.put(obj[k], k));
        return Promise.resolve();
      });
    } catch (e) { return undefined; }
  },
  async delete(store, k) {
    try {
      return await this._tx(store, 'readwrite', (s) => new Promise((ok, no) => {
        const q = s.delete(k);
        q.onsuccess = () => ok();
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return undefined; }
  },
  async clear(store) {
    try {
      return await this._tx(store, 'readwrite', (s) => new Promise((ok, no) => {
        const q = s.clear();
        q.onsuccess = () => ok();
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return undefined; }
  },
  async allKeys(store) {
    try {
      return await this._tx(store, 'readonly', (s) => new Promise((ok, no) => {
        const q = s.getAllKeys();
        q.onsuccess = () => ok(q.result || []);
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return []; }
  },
  async all(store) {
    try {
      return await this._tx(store, 'readonly', (s) => new Promise((ok, no) => {
        const q = s.getAll();
        q.onsuccess = () => ok(q.result || []);
        q.onerror = () => no(q.error);
      }));
    } catch (e) { return []; }
  },
  // Migrate legacy single 'state' record into per-store records. Idempotent.
  async migrateLegacy() {
    try {
      const d = await this.open();
      if (!d.objectStoreNames.contains(this.LEGACY)) return false;
      const st = await this.get(this.LEGACY, 'state');
      if (!st) return false;
      const meta = { ...st };
      const arrays = { tx: [], inc: [], detected: [], transfers: [], goals: [], photos: [] };
      Object.keys(arrays).forEach((k) => {
        if (Array.isArray(st[k])) { arrays[k] = st[k]; delete meta[k]; }
      });
      await this.put('meta', 'app', meta);
      await Promise.all([
        ...(arrays.tx || []).map((x) => x && x.id ? this.put('tx', x.id, x) : null),
        ...(arrays.inc || []).map((x) => x && x.id ? this.put('inc', x.id, x) : null),
        ...(arrays.detected || []).map((x) => x && x.id ? this.put('detected', x.id, x) : null),
        ...(arrays.transfers || []).map((x) => x && x.id ? this.put('transfers', x.id, x) : null),
        ...(arrays.goals || []).map((x) => x && x.id ? this.put('goals', x.id, x) : null),
        ...(arrays.photos || []).map((x) => x && x.id ? this.put('photos', x.id, x) : null),
      ].filter(Boolean));
      await this.delete(this.LEGACY, 'state');
      return true;
    } catch (e) {
      ErrorLog.add('DB migrateLegacy failed', e);
      return false;
    }
  },
  async hasAnyStoreData() {
    for (const s of this.STORES) {
      if ((await this.allKeys(s)).length > 0) return true;
    }
    return false;
  },
};

// High-level state split across stores.
// meta: set, wallets, recurring, customCats, catLearn, version, lastBackupAt
// tx, inc, detected, transfers: keyed by id
async function loadState() {
  ensureStateDefaults();
  await DB.migrateLegacy();
  const has = await DB.hasAnyStoreData();
  if (!has) return; // fresh DB or legacy not yet migrated; keep defaults
  const meta = await DB.get('meta', 'app');
  if (meta) {
    if (meta.set) S.set = { ...S.set, ...meta.set };
    if (Array.isArray(meta.wallets)) S.wallets = meta.wallets;
    if (Array.isArray(meta.recurring)) S.recurring = meta.recurring;
    if (Array.isArray(meta.customCats)) S.customCats = meta.customCats;
    if (meta.catLearn && typeof meta.catLearn === 'object') S.catLearn = meta.catLearn;
    if (typeof meta.version === 'string') { /* version tracked */ }
    if (meta.lastBackupAt) S.set.lastBackupAt = meta.lastBackupAt;
  }
  S.tx = await DB.all('tx');
  S.inc = await DB.all('inc');
  S.detected = await DB.all('detected');
  S.transfers = await DB.all('transfers');
  ensureStateDefaults();
}

async function saveState() {
  ensureStateDefaults();
  const meta = {
    set: S.set,
    wallets: S.wallets,
    recurring: S.recurring,
    customCats: S.customCats,
    catLearn: S.catLearn,
    version: APP_VERSION,
    lastBackupAt: S.set.lastBackupAt,
  };
  await DB.put('meta', 'app', meta);
  await saveStore('tx', S.tx);
  await saveStore('inc', S.inc);
  await saveStore('detected', S.detected);
  await saveStore('transfers', S.transfers);
}

async function saveStore(store, arr) {
  const keys = new Set((arr || []).map((x) => x && x.id).filter(Boolean));
  const existing = new Set(await DB.allKeys(store));
  const ops = [];
  existing.forEach((k) => { if (!keys.has(k)) ops.push(DB.delete(store, k)); });
  (arr || []).forEach((x) => { if (x && x.id) ops.push(DB.put(store, x.id, x)); });
  await Promise.all(ops);
}

window.DB = DB;
window.loadState = loadState;
window.saveState = saveState;
