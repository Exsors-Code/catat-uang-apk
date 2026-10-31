// CatatUang Utils
const APP_VERSION = '1.4.0';
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

const rp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

function cmpVer(a, b) {
  const pa = String(a || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] || 0,
      bi = pb[i] || 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

function dateFromTs(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (isNaN(d.getTime())) return today();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function simpleHash(s) {
  let h = 5381;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return 'p' + (h >>> 0).toString(16);
}

// Centralized error logging
const ErrorLog = {
  _max: 50,
  _logs: [],
  add(msg, err, fatal = false) {
    const entry = {
      time: new Date().toISOString(),
      msg: String(msg || ''),
      err: err ? (err.message || String(err)) : '',
      fatal,
    };
    this._logs.unshift(entry);
    if (this._logs.length > this._max) this._logs.pop();
    try { console.error('[CatatUang Error]', msg, err); } catch (e) {}
  },
  get() {
    return [...this._logs];
  },
  clear() {
    this._logs = [];
  },
};

// Debounce helper
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Toast / Error UI
function showToast(msg, type = 'info') {
  try {
    const old = document.getElementById('cu-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'cu-toast';
    el.className = 'cu-toast cu-toast-' + type;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    el.textContent = String(msg || '');
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add('show');
    }, 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }, 2200);
  } catch (e) {
    ErrorLog.add('showToast failed', e);
  }
}

function showError(msg) {
  ErrorLog.add('UI error: ' + msg, null, true);
  showToast(msg, 'error');
}

window.addEventListener('error', (ev) => {
  try {
    ErrorLog.add('Global error:', ev.error || new Error(ev.message), true);
  } catch (e) {}
});

window.addEventListener('unhandledrejection', (ev) => {
  try {
    ErrorLog.add('Unhandled rejection:', ev.reason || new Error(String(ev.reason)), true);
  } catch (e) {}
});
