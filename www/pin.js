// CatatUang PIN - PBKDF2-SHA256 + rate limit + secure migration
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000; // 15 menit kunci
const PBKDF2_ITER = 200000; // 200k iterasi
const PIN_COOLDOWN_MS = 2000; // jeda minimal antar percobaan

let lastPinAttempt = 0;

async function pbkdf2Hash(pin, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(String(pin || '')), { name: 'PBKDF2' }, false, ['deriveBits']);
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, keyMaterial, 256);
  const hashHex = bufToHex(bits);
  const saltOut = bufToHex(salt);
  return { hash: hashHex, salt: saltOut };
}

function bufToHex(buf) {
  const arr = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
  return s;
}

function hexToBuf(hex) {
  const h = String(hex || '').replace(/[^0-9a-f]/gi, '');
  const arr = new Uint8Array(Math.ceil(h.length / 2));
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.substr(i * 2, 2), 16) || 0;
  return arr;
}

function isPinLocked() {
  ensureStateDefaults();
  if (S.set.pinLockedUntil && Date.now() < S.set.pinLockedUntil) return true;
  return false;
}

function getPinLockRemaining() {
  if (!S.set.pinLockedUntil) return 0;
  const r = S.set.pinLockedUntil - Date.now();
  return r > 0 ? Math.ceil(r / 1000) : 0;
}

async function verifyPin(pin) {
  ensureStateDefaults();
  if (isPinLocked()) return { ok: false, locked: true, remaining: getPinLockRemaining() };
  const p = String(pin || '');
  if (!p) return { ok: false };

  // Cooldown between attempts
  const now = Date.now();
  if (now - lastPinAttempt < PIN_COOLDOWN_MS) {
    return { ok: false, cooldown: true };
  }
  lastPinAttempt = now;

  try {
    // PBKDF2 path
    if (S.set.pinSalt && S.set.pinAlgo === 'pbkdf2' && S.set.pinHash) {
      const res = await pbkdf2Hash(p, S.set.pinSalt);
      if (res.hash === S.set.pinHash) {
        S.set.pinAttempts = 0;
        S.set.pinLockedUntil = 0;
        save();
        return { ok: true };
      }
    }
    // Legacy migration: simpleHash -> PBKDF2
    else if (S.set.pinHash && S.set.pinAlgo !== 'pbkdf2') {
      // simpleHash format: 'p' + hex. Compare safely.
      const legacy = String(S.set.pinHash);
      const computed = simpleHashLegacy(p);
      if (legacy === computed) {
        const m = await pbkdf2Hash(p, null);
        S.set.pinHash = m.hash;
        S.set.pinSalt = m.salt;
        S.set.pinAlgo = 'pbkdf2';
        S.set.pinAttempts = 0;
        S.set.pinLockedUntil = 0;
        save();
        return { ok: true };
      }
    }
    // Failed attempt
    S.set.pinAttempts = (+S.set.pinAttempts || 0) + 1;
    if (S.set.pinAttempts >= PIN_MAX_ATTEMPTS) {
      S.set.pinLockedUntil = Date.now() + PIN_LOCK_MS;
      S.set.pinAttempts = 0;
    }
    save();
    return { ok: false, attempts: S.set.pinAttempts };
  } catch (e) {
    ErrorLog.add('verifyPin error', e);
    return { ok: false };
  }
}

// Legacy DJB2 hash (only for migration, never for new PINs)
function simpleHashLegacy(s) {
  let h = 5381;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return 'p' + (h >>> 0).toString(16);
}

async function setPin(pin) {
  const p = String(pin || '').replace(/[^0-9]/g, '');
  if (p.length < 4 || p.length > 6) throw new Error('PIN harus 4–6 digit angka');
  const m = await pbkdf2Hash(p, null);
  S.set.pinHash = m.hash;
  S.set.pinSalt = m.salt;
  S.set.pinAlgo = 'pbkdf2';
  S.set.pinAttempts = 0;
  S.set.pinLockedUntil = 0;
  save();
  return true;
}

function removePin() {
  S.set.pinHash = '';
  S.set.pinSalt = '';
  S.set.pinAlgo = '';
  S.set.pinAttempts = 0;
  S.set.pinLockedUntil = 0;
  save();
}

function needsLock() {
  ensureStateDefaults();
  if (isPinLocked()) return true;
  return !!(S.set.pinHash) && !unlocked;
}
