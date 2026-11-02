// CatatUang Notifications
const NOTIF_DEDUP_KEYS = new Set();

function isBlockedPkg(pkg) {
  return !ALLOWED_PKGS.test(String(pkg || ''));
}

function isIncomeKeyword(full) {
  return /gaji|salary|pemasukan|bonus|insentif/i.test(full);
}

function isTopUpKeyword(full) {
  return /top.?up|topup|isi.?ulang|tambah saldo/i.test(full);
}

function isDuplicateSaved(item) {
  const d = String(item.d || dateFromTs(item.time)).slice(0, 10);
  const amt = +item.amt || 0;
  const note = String(item.title || '').toLowerCase();
  return (
    (S.tx || []).some(
      (t) => (+t.amt || 0) === amt && String(t.d || '').slice(0, 10) === d && String(t.note || '').toLowerCase() === note
    ) ||
    (S.inc || []).some(
      (i) => (+i.amt || 0) === amt && String(i.d || '').slice(0, 10) === d && String(i.note || '').toLowerCase() === note
    )
  );
}

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
  // Hanya terima paket bank / e-wallet terdaftar
  if (isBlockedPkg(pkg)) return;
  const full = ((data.title || '') + ' ' + (data.text || '') + ' ' + (data.subText || '')).toLowerCase();
  if (/saldo|sisa saldo/.test(full)) return;
  const m = full.match(/rp\s*([0-9][0-9.,]*)/i);
  if (!m) return;
  const amt = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
  if (!amt) return;
  const id = data.id || uid();
  // Deduplicate by id
  const exists = (S.detected || []).some((n) => n.id === id);
  if (exists) return;
  const d = dateFromTs(data.time);
  // Hindari duplikat terhadap transaksi / pemasukan yang sudah disimpan
  if (isDuplicateSaved({ amt, title: data.title, d })) return;
  // Gaji = pemasukan; top-up bukan pemasukan (dianggap pengeluaran)
  const type = isIncomeKeyword(full) ? 'in' : 'out';
  const item = {
    id,
    pkg,
    title: data.title,
    text: data.text,
    subText: data.subText,
    time: data.time,
    amt,
    type,
    d,
  };
  S.detected.unshift(item);
  if (S.set.autoSave) {
    const cat = predictCat(full);
    if (type === 'in') {
      addInc(amt, (data.title || '').slice(0, 40), 'Pemasukan', 'Tunai', d);
    } else {
      addTx(amt, (data.title || '').slice(0, 40), cat, 'Tunai', d);
    }
  }
  save();
  render();
}

function confirmDetected(idx) {
  const n = (S.detected || [])[idx];
  if (!n) return;
  const full = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
  const cat = predictCat(full);
  learnCat(full, cat);
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
