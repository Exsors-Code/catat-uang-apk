// CatatUang Notifications
const NOTIF_DEDUP_KEYS = new Set();

async function checkNotifListenerPermission() {
  if (!NATIVE || !window.Capacitor?.Plugins?.CatatUangNotification) {
    notifListenerGranted = false;
    return;
  }
  try {
    const ret = await Capacitor.Plugins.CatatUangNotification.isPermissionGranted();
    notifListenerGranted = !!(ret && ret.granted);
  } catch (e) {
    ErrorLog.add('checkNotifListenerPermission failed', e);
    notifListenerGranted = false;
  }
}

async function fetchCapturedNotifications() {
  if (!NATIVE || !window.Capacitor?.Plugins?.CatatUangNotification) return;
  try {
    const ret = await Capacitor.Plugins.CatatUangNotification.getPendingNotifications();
    const arr = (ret && ret.notifications) || [];
    const merged = {};
    (arr || []).forEach((n) => {
      const key = (n.pkg || '') + '|' + (n.title || '') + '|' + (n.text || '') + '|' + (n.time || '');
      if (!NOTIF_DEDUP_KEYS.has(key)) {
        NOTIF_DEDUP_KEYS.add(key);
        merged[key] = n;
      }
    });
    S.detected = Object.values(merged);
    render();
  } catch (e) {
    ErrorLog.add('fetchCapturedNotifications failed', e);
  }
}

function processCapturedNotification(data) {
  if (!data) return;
  const pkg = (data.pkg || '').toLowerCase();
  const full = ((data.title || '') + ' ' + (data.text || '') + ' ' + (data.subText || '')).toLowerCase();
  if (/saldo|sisa saldo/.test(full)) return;
  const m = full.match(/rp\\s*([0-9][0-9\\.,]*)/i);
  if (!m) return;
  const amt = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
  if (!amt) return;
  const id = data.id || uid();
  // Deduplicate by id
  const exists = (S.detected || []).some((n) => n.id === id);
  if (exists) return;
  const item = {
    id,
    pkg,
    title: data.title,
    text: data.text,
    subText: data.subText,
    time: data.time,
    amt,
    type: 'out',
    d: dateFromTs(data.time),
  };
  S.detected.unshift(item);
  if (S.set.autoSave) {
    const cat = predictCat(full);
    addTx(amt, (data.title || '').slice(0, 40), cat, 'Tunai', dateFromTs(data.time));
  }
  save();
  render();
}

function confirmDetected(idx) {
  const n = (S.detected || [])[idx];
  if (!n) return;
  const cat = predictCat(((n.title || '') + ' ' + (n.text || '')).toLowerCase());
  addTx(n.amt, (n.title || '').slice(0, 40), cat, 'Tunai', n.d || dateFromTs(n.time));
  S.detected.splice(idx, 1);
  save();
  render();
}

function clearDetected() {
  if (!confirm('Hapus semua notifikasi terdeteksi?')) return;
  S.detected = [];
  NOTIF_DEDUP_KEYS.clear();
  save();
  render();
}
