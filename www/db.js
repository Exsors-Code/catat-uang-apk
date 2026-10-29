const DB = {
  _p: null,
  version: 3,
  open() {
    if (!this._p) {
      this._p = new Promise((ok, no) => {
        const r = indexedDB.open('catatuang', this.version);
        r.onupgradeneeded = (e) => {
          const d = r.result;
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
          ['meta', 'tx', 'inc', 'detected', 'transfers', 'goals', 'photos', 'wallets', 'categories', 'budgets', 'recurring', 'targets'].forEach(n => {
            if (!d.objectStoreNames.contains(n)) d.createObjectStore(n);
          });
          try {
            const tx = e.target.transaction;
            tx.objectStore('meta').put({ schemaVersion: 3, migratedAt: Date.now() }, 'schema');
          } catch (_) {}
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => no(r.error);
      });
    }
    return this._p;
  },
  getLegacy(key) {
    return new Promise((ok, no) => {
      const r = indexedDB.open('catatuang', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => {
        const d = r.result;
        const q = d.transaction('kv', 'readonly').objectStore('kv').get(key);
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      };
      r.onerror = () => no(r.error);
    });
  },
  async get(store, key) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const q = d.transaction(store, 'readonly').objectStore(store).get(key);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
  },
  async put(store, key, val) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const t = d.transaction(store, 'readwrite');
      t.objectStore(store).put(val, key);
      t.oncomplete = () => ok();
      t.onerror = () => no(t.error);
    });
  },
  async del(store, key) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const t = d.transaction(store, 'readwrite');
      t.objectStore(store).delete(key);
      t.oncomplete = () => ok();
      t.onerror = () => no(t.error);
    });
  },
  async migrate() {
    try {
      const legacy = await this.getLegacy('state');
      if (legacy) {
        await this.put('meta', 'state', legacy.set || {});
        if (Array.isArray(legacy.tx)) await this.put('tx', 'state', legacy.tx);
        if (Array.isArray(legacy.inc)) await this.put('inc', 'state', legacy.inc);
        if (Array.isArray(legacy.detected)) await this.put('detected', 'state', legacy.detected);
        if (Array.isArray(legacy.transfers)) await this.put('transfers', 'state', legacy.transfers);
        if (Array.isArray(legacy.goals)) await this.put('goals', 'state', legacy.goals);
        const photoMap = {};
        if (Array.isArray(legacy.tx)) {
          legacy.tx.filter(t => t.img).forEach(t => { photoMap[t.id] = t.img; });
        }
        await this.put('photos', 'state', photoMap);
        await this.put('meta', 'schema', { schemaVersion: 3, migratedFrom: 1, migratedAt: Date.now() });
        try {
          const d1 = await new Promise((ok, no) => {
            const r = indexedDB.open('catatuang', 1);
            r.onsuccess = () => ok(r.result);
            r.onerror = () => no(r.error);
          });
          const t1 = d1.transaction('kv', 'readwrite');
          t1.objectStore('kv').delete('state');
          t1.oncomplete = () => {};
        } catch (_) {}
        return { migrated: true, from: 1 };
      }
      const schema = await this.get('meta', 'schema');
      if (!schema) {
        await this.put('meta', 'schema', { schemaVersion: 3, migratedAt: Date.now() });
      }
      return { migrated: false };
    } catch (e) { return { migrated: false, error: e }; }
  }
};
