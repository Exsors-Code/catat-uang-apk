// Database lokal: IndexedDB. Dipakai halaman dan service worker.
const DB={
 _p:null,
 open(){return this._p||(this._p=new Promise((ok,no)=>{const r=indexedDB.open('catatuang',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}))},
 async get(k){const d=await this.open();return new Promise((ok,no)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})},
 async put(k,v){const d=await this.open();return new Promise((ok,no)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>ok();t.onerror=()=>no(t.error)})}
};
