// CatatUang IndexedDB wrapper
const DB = {
  _p: null,
  _conn: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((ok, no) => {
      const r = indexedDB.open('catatuang', 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = () => { this._conn = r.result; ok(r.result); };
      r.onerror = () => no(r.error);
    });
    return this._p;
  },
  async get(k) {
    try {
      const d = await this.open();
      return new Promise((ok, no) => {
        const tx = d.transaction('kv', 'readonly');
        const q = tx.objectStore('kv').get(k);
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      });
    } catch (e) { return null; }
  },
  async put(k, v) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => ok();
      tx.onerror = () => no(tx.error);
    });
  },
  async putAll(obj) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const tx = d.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      Object.keys(obj || {}).forEach((k) => store.put(obj[k], k));
      tx.oncomplete = () => ok();
      tx.onerror = () => no(tx.error);
    });
  },
  async delete(k) {
    const d = await this.open();
    return new Promise((ok, no) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(k);
      tx.oncomplete = () => ok();
      tx.onerror = () => no(tx.error);
    });
  },
  async clear() {
    const d = await this.open();
    return new Promise((ok, no) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').clear();
      tx.oncomplete = () => ok();
      tx.onerror = () => no(tx.error);
    });
  },
};