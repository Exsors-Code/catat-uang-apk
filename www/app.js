// CatatUang v1.3 - Keuangan Offline Android
const APP_VERSION = '1.3.0';
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

const DEFAULT_CATS = {
  Makan: /makan|resto|cafe|kopi|warung|bakso|nasi|ayam|mie|bakery|coffee|food|minum|geprek|pizza|burger|snack|jajan|kenangan|starbucks|kfc|mcd|chatime|mixue/i,
  Transport: /bensin|pertamina|shell|parkir|tol|grab|gojek|ojek|kereta|transport|kai|mrt|transjakarta|spbu|bluebird|maxim/i,
  Belanja: /indomaret|alfamart|supermarket|mart|toko|market|shop|hypermart|carrefour|shopee|tokopedia|lazada|tiktok|lottemart|transmart/i,
  Tagihan: /listrik|pln|pulsa|internet|wifi|pdam|telkom|token|tagihan|bpjs|asuransi|pajak|pbb/i,
  Kesehatan: /apotek|klinik|dokter|rumah sakit|obat|kimia farma|halodoc|alodokter|rsud|lab/i,
  Hiburan: /bioskop|cinema|xxi|game|netflix|spotify|wisata|steam|playstation|cgv|disney|youtube/i,
  Lainnya: /.*/
};

const ALLOWED_PKGS = /gojek|gopay|ovo|dana|shopee|bca|seabank|jago|mandiri|bri|bni|jenius|blu\.|digibank|neo\.|sakuku|linkaja|doku|midtrans|flip\.id|oy\.id/i;
const DEFAULT_WALLETS = ['Tunai', 'BCA', 'Mandiri', 'BRI', 'BNI', 'SeaBank', 'Bank Jago', 'Jenius', 'GoPay', 'OVO', 'DANA', 'ShopeePay'];

const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now() + Math.random().toString(36).slice(2, 7);

function cmpVer(a, b) {
  const pa = String(a || '').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
  const pb = String(b || '').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] || 0, bi = pb[i] || 0;
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

let S = {
  tx: [],
  inc: [],
  detected: [],
  transfers: [],
  wallets: DEFAULT_WALLETS.map(n => ({ name: n, start: 0 })),
  recurring: [],
  customCats: [],
  catLearn: {},
  set: {
    budget: 0,
    budgets: {},
    remindMidday: true,
    timeMidday: '11:45',
    remindNight: true,
    timeNight: '21:00',
    autoSave: false,
    githubRepo: '',
    lastBackupAt: null,
    pinHash: '',
    onboardingDone: false
  }
};

let tab = 'home';
let draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
let ocrMsg = '';
let viewMonth = today().slice(0, 7);
let notifListenerGranted = false;
let updateInfo = null;
let unlocked = false;
let pinInput = '';
let undoItem = null;
let undoTimer = null;
let filterQ = { q: '', cat: '', wallet: '' };
let incomeDraft = null;

function catMap() {
  const m = { ...DEFAULT_CATS };
  (S.customCats || []).forEach(c => { if (c && !m[c]) m[c] = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); });
  return m;
}
function catList() {
  const base = Object.keys(DEFAULT_CATS).filter(c => c !== 'Lainnya');
  return [...base, ...(S.customCats || []).filter(c => c && !base.includes(c)), 'Lainnya'];
}
function walletNames() {
  const list = (S.wallets && S.wallets.length) ? S.wallets.map(w => w.name) : DEFAULT_WALLETS.slice();
  return list.length ? list : ['Tunai'];
}
function ensureWallets() {
  if (!Array.isArray(S.wallets) || !S.wallets.length) {
    S.wallets = DEFAULT_WALLETS.map(n => ({ name: n, start: 0 }));
  }
}

const save = async () => {
  try {
    ensureWallets();
    await DB.put('state', S);
    scheduleAllReminders();
  } catch (e) {
    alert('Gagal menyimpan ke database. Ekspor cadangan secara berkala.');
  }
};

function sumDay(d) {
  const l = S.tx.filter(t => t.d === d);
  const by = {};
  l.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amt);
  return { total: l.reduce((a, t) => a + t.amt, 0), by, n: l.length };
}
function monthOut(m) {
  return S.tx.filter(t => t.d.startsWith(m)).reduce((a, t) => a + t.amt, 0);
}
function monthIn(m) {
  return S.inc.filter(i => (i.m || (i.d || '').slice(0, 7)) === m).reduce((a, i) => a + i.amt, 0);
}

function walletBalance(name) {
  ensureWallets();
  const w = S.wallets.find(x => x.name === name);
  let bal = w ? (+w.start || 0) : 0;
  S.inc.forEach(i => { if ((i.wallet || 'Tunai') === name) bal += i.amt; });
  S.tx.forEach(t => { if ((t.wallet || 'Tunai') === name) bal -= t.amt; });
  (S.transfers || []).forEach(tr => {
    if (tr.from === name) bal -= tr.amt;
    if (tr.to === name) bal += tr.amt;
  });
  return bal;
}

function summaryText(isMidday = false) {
  const s = sumDay(today());
  if (isMidday) {
    if (!s.n) return 'Belum ada pengeluaran tercatat hari ini. Sudah makan siang? Catat sekarang yuk!';
    return `Pengingat Siang: Sudah keluar ${rp(s.total)} (${s.n} transaksi). Jangan lupa catat makan siang & jajanmu!`;
  }
  if (!s.n) return 'Hari ini belum ada pengeluaran tercatat.';
  return `Ringkasan Malam: Total hari ini ${rp(s.total)} (${s.n} transaksi): ` +
    Object.entries(s.by).sort((a, b) => b[1] - a[1]).map(([c, v]) => c + ' ' + rp(v)).join(', ') + '.';
}

function predictCat(text) {
  const learn = S.catLearn || {};
  const low = (text || '').toLowerCase();
  for (const [key, cat] of Object.entries(learn)) {
    if (key && low.includes(key)) return cat;
  }
  const CATS = catMap();
  for (const [k, re] of Object.entries(CATS)) {
    if (re.test(text || '')) return k;
  }
  return 'Lainnya';
}

function learnCat(note, cat) {
  if (!note || !cat || cat === 'Lainnya') return;
  const key = String(note).toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
  if (key.length < 3) return;
  if (!S.catLearn) S.catLearn = {};
  S.catLearn[key] = cat;
}

// ---------- Parser notifikasi ----------
function parsePaymentNotification(item) {
  const pkg = (item.pkg || '').toLowerCase();
  const title = item.title || '';
  const text = item.text || '';
  const subText = item.subText || '';
  const full = `${title} ${text} ${subText}`;

  if (pkg && !ALLOWED_PKGS.test(pkg) && !pkg.includes('simulate') && !pkg.includes('test')) return null;
  if (/\bsaldo\b|info saldo|cek saldo|sisa saldo|available balance|rekening aktif/i.test(full) &&
      !/transfer|pembayaran|bayar|qris|debit|berhasil bayar/i.test(full)) return null;

  let wallet = 'Lainnya';
  if (pkg.includes('gojek') || pkg.includes('gopay') || /gopay/i.test(full)) wallet = 'GoPay';
  else if (pkg.includes('ovo') || /ovo/i.test(full)) wallet = 'OVO';
  else if (pkg.includes('dana') || /dana/i.test(full)) wallet = 'DANA';
  else if (pkg.includes('shopee') || /shopeepay/i.test(full)) wallet = 'ShopeePay';
  else if (pkg.includes('bca') || /bca/i.test(full)) wallet = 'BCA';
  else if (pkg.includes('seabank') || /seabank/i.test(full)) wallet = 'SeaBank';
  else if (pkg.includes('jago') || /bank jago|kantong jago/i.test(full)) wallet = 'Bank Jago';
  else if (pkg.includes('mandiri') || /mandiri|livin/i.test(full)) wallet = 'Mandiri';
  else if (pkg.includes('bri') || /brimo|bri/i.test(full)) wallet = 'BRI';
  else if (pkg.includes('bni') || /bni/i.test(full)) wallet = 'BNI';
  else if (pkg.includes('jenius') || /jenius/i.test(full)) wallet = 'Jenius';

  const isTopUp = /top\s*up|topup|isi saldo|isi ulang|deposit berhasil/i.test(full) &&
    !/bayar|pembayaran|transfer ke|qris/i.test(full);
  if (isTopUp) return null;

  const isIncome = /transfer masuk|uang masuk|diterima dari|menerima transfer|dikirim ke kamu|kamu menerima|terima transfer/i.test(full) &&
    !/gagal|ditolak|pending/i.test(full);
  const type = isIncome ? 'in' : 'out';

  let amt = 0;
  const matchRp = full.match(/(?:rp\.?|idr)\s*([\d.,]+)/i);
  if (matchRp && matchRp[1]) {
    const rawNum = matchRp[1].replace(/[.,](\d{2})$/, '');
    amt = +rawNum.replace(/[.,]/g, '');
  } else {
    const matchAlt = full.match(/\b\d{1,3}(?:[.,]\d{3})+\b/);
    if (matchAlt) amt = +matchAlt[0].replace(/[.,]/g, '');
  }
  if (amt > 500000000) amt = 0;

  let note = '';
  const matchKe = full.match(/(?:ke|di|merchant|pembayaran(?:\s+ke|\s+di)?)\s+([A-Za-z0-9\s&'.\-]{3,40})(?:\s+(?:berhasil|sukses|telah|sebesar|rp)|\.|$)/i);
  if (matchKe && matchKe[1]) note = matchKe[1].trim();
  else note = title ? `${title} (${wallet})` : `Transaksi ${wallet}`;
  note = note.replace(/^(pembayaran|transfer|qris)\s+/i, '').trim();

  const cat = predictCat(full + ' ' + note);
  const ts = item.time || Date.now();
  const timeStr = new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return {
    id: item.id || (ts + '_' + Math.random().toString(36).substr(2, 4)),
    pkg, wallet, type, amt: amt || 0,
    note: note || `Pembayaran ${wallet}`,
    cat, time: timeStr, timestamp: ts, d: dateFromTs(ts), raw: full
  };
}

function isDuplicateParsed(parsed) {
  if (!parsed) return true;
  if (S.detected.some(d =>
    d.id === parsed.id ||
    (d.amt === parsed.amt && d.wallet === parsed.wallet && Math.abs((d.timestamp || 0) - (parsed.timestamp || 0)) < 120000) ||
    (d.amt === parsed.amt && d.raw === parsed.raw)
  )) return true;
  if (parsed.type === 'in') {
    return S.inc.some(i => i.amt === parsed.amt && (i.wallet || '') === parsed.wallet &&
      (i.note || '') === (parsed.note || '') && ((i.d || i.m || '') === parsed.d || (i.m || '') === parsed.d.slice(0, 7)));
  }
  return S.tx.some(t => t.amt === parsed.amt && t.d === parsed.d &&
    (t.wallet || '') === parsed.wallet && (t.note || '') === (parsed.note || ''));
}

function processCapturedNotification(rawItem) {
  const parsed = parsePaymentNotification(rawItem);
  if (!parsed || !parsed.amt || parsed.amt < 100) return;
  if (isDuplicateParsed(parsed)) return;

  if (S.set.autoSave) {
    if (parsed.type === 'in') {
      S.inc.push({ id: uid(), m: parsed.d.slice(0, 7), d: parsed.d, amt: parsed.amt, note: parsed.note, wallet: parsed.wallet });
    } else {
      S.tx.push({ id: uid(), d: parsed.d, amt: parsed.amt, cat: parsed.cat, note: parsed.note, wallet: parsed.wallet, img: null, auto: true });
    }
    save();
  } else {
    S.detected.unshift(parsed);
    save();
  }
  render();
}

// ---------- Native notif ----------
const NotifPlugin = window.Capacitor?.Plugins?.CatatUangNotification;

async function checkNotifListenerPermission() {
  if (!NATIVE || !NotifPlugin) return false;
  try {
    const res = await NotifPlugin.isPermissionGranted();
    notifListenerGranted = !!res.granted;
    return notifListenerGranted;
  } catch (e) { return false; }
}
async function openNotifListenerSettings() {
  if (!NATIVE || !NotifPlugin) {
    alert('Fitur membaca notifikasi bank khusus untuk aplikasi Android (APK).');
    return;
  }
  try { await NotifPlugin.openPermissionSettings(); }
  catch (e) { alert('Gagal membuka pengaturan: ' + (e.message || e)); }
}
async function fetchCapturedNotifications() {
  if (!NATIVE || !NotifPlugin) return;
  try {
    const res = await NotifPlugin.getPendingNotifications();
    const list = res?.notifications || [];
    if (list.length) {
      list.forEach(processCapturedNotification);
      await NotifPlugin.clearPendingNotifications();
    }
  } catch (e) { console.error('Error fetching notifications:', e); }
}

async function scheduleAllReminders() {
  if (!NATIVE || !window.Capacitor?.Plugins?.LocalNotifications) return;
  const ln = Capacitor.Plugins.LocalNotifications;
  try {
    const p = await ln.checkPermissions();
    if (p.display !== 'granted') return;
    const cancelIds = [];
    for (let i = 1; i <= 30; i++) cancelIds.push({ id: i });
    await ln.cancel({ notifications: cancelIds });
    const list = [];
    const now = new Date();
    if (S.set.remindMidday) {
      const [hM, miM] = (S.set.timeMidday || '11:45').split(':').map(Number);
      for (let i = 0; i < 7; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hM, miM, 0);
        if (at <= now) continue;
        list.push({
          id: i + 1,
          title: 'CatatUang: Pengingat Siang',
          body: at.toDateString() === now.toDateString() ? summaryText(true) : 'Sudah makan siang? Jangan lupa catat pengeluaranmu!',
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_catatuang',
          iconColor: '#0F766E'
        });
      }
    }
    if (S.set.remindNight) {
      const [hN, miN] = (S.set.timeNight || '21:00').split(':').map(Number);
      for (let i = 0; i < 7; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hN, miN, 0);
        if (at <= now) continue;
        list.push({
          id: i + 15,
          title: 'CatatUang: Ringkasan Malam',
          body: at.toDateString() === now.toDateString() ? summaryText(false) : 'Buka CatatUang untuk evaluasi keuangan harianmu.',
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_catatuang',
          iconColor: '#0F766E'
        });
      }
    }
    if (list.length) await ln.schedule({ notifications: list });
  } catch (e) { console.error('Gagal menjadwalkan notifikasi:', e); }
}

async function checkGithubUpdate(manual = false) {
  const repo = S.set.githubRepo || 'hulio/catatuang-android';
  try {
    let data = null;
    let res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (res.ok) data = await res.json();
    else {
      res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5`);
      if (!res.ok) throw new Error('Repo belum dibuat atau belum ada rilis.');
      const list = await res.json();
      data = (list || []).find(r => (r.assets || []).some(a => a.name.endsWith('.apk'))) || list[0];
      if (!data) throw new Error('Belum ada rilis APK di repository.');
    }
    const latestTag = (data.tag_name || '').replace(/^v/, '').replace(/^apk-/, '');
    const verFromBody = ((data.body || '') + ' ' + (data.name || '')).match(/v?(\d+\.\d+\.\d+)/);
    const compareTag = /^\d+\.\d+/.test(latestTag) ? latestTag : (verFromBody ? verFromBody[1] : '');
    const apkAsset = (data.assets || []).find(a => /\.apk$/i.test(a.name));
    const isNewer = compareTag ? cmpVer(compareTag, APP_VERSION) > 0 : !!(apkAsset && data.published_at);
    if (apkAsset && (isNewer || (manual && compareTag && cmpVer(compareTag, APP_VERSION) >= 0))) {
      updateInfo = {
        version: compareTag ? ('v' + compareTag) : (data.tag_name || 'terbaru'),
        name: data.name || data.tag_name,
        body: data.body || 'Pembaruan aplikasi terbaru tersedia.',
        url: apkAsset.browser_download_url
      };
      if (!isNewer && compareTag && cmpVer(compareTag, APP_VERSION) === 0) {
        updateInfo = null;
        if (manual) alert('Aplikasi sudah menggunakan versi terbaru (v' + APP_VERSION + ').');
      } else {
        render();
        if (manual) alert('Pembaruan ditemukan: ' + updateInfo.version + '!');
      }
    } else {
      updateInfo = null;
      if (manual) alert('Aplikasi sudah menggunakan versi terbaru (v' + APP_VERSION + ').');
    }
  } catch (e) {
    if (manual) alert('Pengecekan pembaruan: ' + e.message);
  }
}
function openUpdateLink(url) {
  const u = url || (updateInfo && updateInfo.url);
  if (!u) return;
  if (NATIVE && window.Capacitor?.Plugins?.Browser) {
    Capacitor.Plugins.Browser.open({ url: u }).catch(() => { window.open(u, '_blank'); });
  } else window.open(u, '_blank');
}

// ---------- Recurring ----------
function applyRecurring() {
  const list = S.recurring || [];
  if (!list.length) return;
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const monthKey = today().slice(0, 7);
  let changed = false;
  list.forEach(r => {
    if (!r || !r.amt) return;
    const day = Math.min(+r.dayOfMonth || 1, lastDay);
    const dStr = monthKey + '-' + String(day).padStart(2, '0');
    if (dStr > today()) return;
    if (r.lastApplied === monthKey) return;
    if (r.type === 'in') {
      const exists = S.inc.some(i => i.recurringId === r.id && (i.m === monthKey || (i.d || '').startsWith(monthKey)));
      if (!exists) {
        S.inc.push({ id: uid(), m: monthKey, d: dStr, amt: +r.amt, note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', recurringId: r.id });
        changed = true;
      }
    } else {
      const exists = S.tx.some(t => t.recurringId === r.id && t.d.startsWith(monthKey));
      if (!exists) {
        S.tx.push({ id: uid(), d: dStr, amt: +r.amt, cat: r.cat || 'Tagihan', note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', img: null, recurringId: r.id });
        changed = true;
      }
    }
    r.lastApplied = monthKey;
    changed = true;
  });
  if (changed) save();
}

// ---------- Undo ----------
function pushUndo(kind, data) {
  undoItem = { kind, data, at: Date.now() };
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { undoItem = null; render(); }, 8000);
}
function doUndo() {
  if (!undoItem) return;
  const { kind, data } = undoItem;
  if (kind === 'tx') S.tx.push(data);
  else if (kind === 'inc') S.inc.push(data);
  else if (kind === 'transfer') S.transfers.push(data);
  undoItem = null;
  if (undoTimer) clearTimeout(undoTimer);
  save();
  render();
}
function undoBanner() {
  if (!undoItem) return '';
  return `<div class="undo-toast" onclick="doUndo()"><b>Dihapus.</b> Ketuk untuk batalkan (Undo)</div>`;
}

// ---------- PIN ----------
function needsLock() {
  return !!(S.set.pinHash) && !unlocked;
}
function tryUnlock() {
  if (simpleHash(pinInput) === S.set.pinHash) {
    unlocked = true;
    pinInput = '';
    render();
  } else {
    pinInput = '';
    alert('PIN salah');
    render();
  }
}
function lockScreenHtml() {
  return `
    <div class="lock-screen">
      <div class="lock-card">
        <div style="font-size:40px;margin-bottom:8px">🔒</div>
        <h1 style="margin-bottom:4px">CatatUang</h1>
        <p class="mute">Masukkan PIN untuk membuka</p>
        <div class="pin-dots">${[0,1,2,3,4,5].map(i => `<span class="${i < pinInput.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="pin-pad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => {
            if (k === '') return '<span></span>';
            if (k === '⌫') return `<button type="button" class="pin-key" onclick="pinBack()">⌫</button>`;
            return `<button type="button" class="pin-key" onclick="pinPress('${k}')">${k}</button>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}
function pinPress(n) {
  if (pinInput.length >= 6) return;
  pinInput += n;
  if (pinInput.length >= 4 && pinInput.length === String(S.set.pinHash && 0).length) { /* noop */ }
  render();
  if (pinInput.length >= 4) {
    // auto try when length matches typical 4-6; try on 4,5,6
    if (pinInput.length >= 4) {
      const h = simpleHash(pinInput);
      if (h === S.set.pinHash) tryUnlock();
      else if (pinInput.length >= 6) { pinInput = ''; alert('PIN salah'); render(); }
      else render();
    }
  }
}
function pinBack() {
  pinInput = pinInput.slice(0, -1);
  render();
}
function setPinFlow() {
  const p1 = prompt('PIN baru (4–6 digit angka):');
  if (p1 === null) return;
  if (!/^\d{4,6}$/.test(p1)) return alert('PIN harus 4–6 digit angka.');
  const p2 = prompt('Ulangi PIN:');
  if (p2 !== p1) return alert('PIN tidak sama.');
  S.set.pinHash = simpleHash(p1);
  unlocked = true;
  save();
  alert('PIN berhasil disetel.');
  render();
}
function clearPin() {
  if (!confirm('Hapus PIN keamanan?')) return;
  S.set.pinHash = '';
  unlocked = true;
  save();
  render();
}

// ---------- UI shell ----------
function render() {
  if (needsLock()) {
    document.getElementById('nav').innerHTML = '';
    document.getElementById('app').innerHTML = lockScreenHtml();
    return;
  }
  const unreadCount = S.detected.length;
  const navItems = [
    { id: 'home', label: 'Hari Ini', icon: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>` },
    { id: 'detect', label: 'Deteksi', icon: `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`, badge: unreadCount },
    { id: 'add', label: 'Tambah', icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>` },
    { id: 'month', label: 'Bulanan', icon: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>` },
    { id: 'set', label: 'Atur', icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>` }
  ];
  document.getElementById('nav').innerHTML = navItems.map(item => `
    <button type="button" class="${tab === item.id ? 'on' : ''}" data-tab="${item.id}" aria-label="Buka halaman ${item.label}" aria-current="${tab === item.id ? 'page' : 'false'}">
      ${item.icon}
      ${item.label}
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </button>
  `).join('');
  const pageRenderer = { home, detect, add, month, set }[tab] || home;
  document.getElementById('app').innerHTML = pageRenderer() + undoBanner();
  document.getElementById('app').setAttribute('data-current-page', tab);
}

function go(t) {
  const validTabs = ['home', 'detect', 'add', 'month', 'set'];
  if (!validTabs.includes(t)) return;
  tab = t;
  render();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

document.addEventListener('click', event => {
  const button = event.target.closest('#nav button[data-tab]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  go(button.dataset.tab);
}, true);

// ---------- Pages ----------
function home() {
  const s = sumDay(today());
  const l = S.tx.filter(t => t.d === today()).sort((a, b) => b.id - a.id);
  const late = new Date().toTimeString().slice(0, 5) >= (S.set.timeNight || '21:00');
  const midday = new Date().toTimeString().slice(0, 5) >= '11:30' && new Date().toTimeString().slice(0, 5) <= '14:00';

  const updateBanner = updateInfo ? `
    <div class="banner">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <b>🚀 Pembaruan Tersedia (${esc(updateInfo.version)})</b>
          <div style="font-size:12px;opacity:0.9">${esc(updateInfo.name)}</div>
        </div>
        <button type="button" class="pill" style="background:#fff;color:var(--acc);font-weight:700;border:0;cursor:pointer" onclick="openUpdateLink()">Unduh APK</button>
      </div>
    </div>` : '';

  const detectedBanner = S.detected.length ? `
    <div class="card" style="border:1px solid rgba(var(--acc-rgb),0.5);background:rgba(var(--acc-rgb),0.07);cursor:pointer" onclick="go('detect')">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">🔔</span>
          <div>
            <b>${S.detected.length} Transaksi Terdeteksi</b>
            <div class="mute">Dari notifikasi bank & e-wallet. Ketuk untuk simpan.</div>
          </div>
        </div>
        <span class="pill pill-wallet">Lihat</span>
      </div>
    </div>` : '';

  const onboarding = !S.set.onboardingDone ? `
    <div class="card" style="border-left:4px solid var(--acc)">
      <b>Selamat datang di CatatUang</b>
      <p class="mute" style="margin:6px 0">Aktifkan akses notifikasi agar pembayaran QRIS/e-wallet tercatat otomatis. Di Android, izinkan juga notifikasi & abaikan optimisasi baterai.</p>
      <button class="b sm" onclick="openNotifListenerSettings()">Buka Izin Notifikasi</button>
      <button class="b sm alt" style="margin-top:6px" onclick="S.set.onboardingDone=true;save();render()">Mengerti</button>
    </div>` : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <h1>Hari Ini</h1>
        <div class="mute">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <button class="b sm alt" onclick="go('add')">+ Catat</button>
    </div>
    ${updateBanner}${detectedBanner}${onboarding}
    ${midday ? `<div class="card" style="background:var(--bg-card-subtle);border-left:4px solid var(--acc)">
      <div style="font-size:13px;font-weight:600;color:var(--acc)">☀️ PENGINGAT SIANG</div>
      <div style="font-size:13.5px;margin-top:2px">${summaryText(true)}</div>
    </div>` : ''}
    ${late ? `<div class="banner">${summaryText(false)}</div>` : ''}
    <div class="card card-hero">
      <div class="mute" style="font-weight:600;font-size:13px;letter-spacing:0.04em;text-transform:uppercase">Pengeluaran Hari Ini</div>
      <div class="big out" style="margin:6px 0 10px">${rp(s.total)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill">${s.n} Transaksi</span>
        ${S.set.budget ? `<span class="pill pill-wallet">Sisa Anggaran: ${rp(Math.max(0, S.set.budget - monthOut(today().slice(0, 7))))}</span>` : ''}
      </div>
    </div>
    ${budgetCard()}
    ${weekChart()}
    <h2>Riwayat Hari Ini</h2>
    <div class="card">
      ${l.length ? l.map(txRow).join('') : `
        <div style="text-align:center;padding:24px 12px">
          <div style="font-size:36px;margin-bottom:8px">📝</div>
          <b>Belum ada catatan hari ini</b>
          <div class="mute" style="margin-top:4px">Tap <b>+ Catat</b> untuk foto struk atau mencatat manual.</div>
        </div>
      `}
    </div>
  `;
}

function detect() {
  const permBadge = notifListenerGranted
    ? '<span class="pill" style="background:var(--inn-bg);color:var(--inn)">Aktif</span>'
    : '<span class="pill" style="background:var(--out-bg);color:var(--out)">Belum izin</span>';
  return `
    <h1>Deteksi Transaksi</h1>
    <p class="mute">Membaca notifikasi pembayaran dari GoPay, BCA, SeaBank, Mandiri, DANA, OVO, ShopeePay, dll.</p>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b>Status Android</b>${permBadge}
      </div>
      <p class="mute" style="margin:4px 0 12px">Izinkan "Akses Notifikasi" agar pembayaran otomatis terdeteksi.</p>
      <button class="b alt" onclick="openNotifListenerSettings()">Buka Pengaturan Izin Android</button>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="b sm alt" style="flex:1" onclick="refreshDetected()">Periksa Notifikasi Baru</button>
        <button class="b sm alt" style="flex:1" onclick="testSimulateNotif()">Simulasi Tes</button>
      </div>
    </div>
    <h2>
      <span>Transaksi Terdeteksi (${S.detected.length})</span>
      ${S.detected.length > 1 ? `<button class="b sm" onclick="confirmAllDetected()">Simpan Semua</button>` : ''}
    </h2>
    <div class="card">
      ${S.detected.length ? S.detected.map(item => `
        <div class="notif-item unread">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <span class="pill pill-wallet">${esc(item.wallet)}</span>
              <span class="mute" style="margin-left:6px">${item.time || ''} · ${item.d || ''}</span>
              <div style="font-weight:700;font-size:16px;margin-top:4px">${esc(item.note)}</div>
            </div>
            <div style="text-align:right">
              <div class="big ${item.type === 'in' ? 'inn' : 'out'}" style="font-size:18px">${rp(item.amt)}</div>
              <span class="mute" style="font-size:11px">${item.cat}</span>
            </div>
          </div>
          <div class="mute" style="font-size:12px;margin:8px 0;background:rgba(0,0,0,0.06);padding:6px 8px;border-radius:6px;word-break:break-all">"${esc(item.raw)}"</div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="b sm" style="flex:1" onclick="confirmDetected('${item.id}')">✓ Simpan</button>
            <button class="b sm alt" style="flex:1" onclick="dismissDetected('${item.id}')">✕ Abaikan</button>
          </div>
        </div>
      `).join('') : `
        <div style="text-align:center;padding:24px 12px">
          <div class="empty-icon" aria-hidden="true">●</div>
          <b>Belum ada notifikasi baru</b>
          <div class="mute" style="margin-top:4px">Begitu kamu belanja atau transfer, transaksinya akan muncul di sini.</div>
        </div>
      `}
    </div>
  `;
}

async function refreshDetected() {
  await fetchCapturedNotifications();
  await checkNotifListenerPermission();
  render();
}
function testSimulateNotif() {
  const samples = [
    { pkg: 'com.gojek.app', title: 'GoPay', text: 'Kamu berhasil bayar Rp 24.500 ke Kopi Kenangan', time: Date.now() },
    { pkg: 'com.bca', title: 'BCA Mobile', text: 'm-Transfer BERHASIL Rp 50.000 ke Budi Santoso', time: Date.now() },
    { pkg: 'com.bti.seabank', title: 'SeaBank', text: 'Pembayaran QRIS Rp 18.000 ke Warung Nasi Goreng sukses', time: Date.now() - 86400000 },
    { pkg: 'id.dana', title: 'DANA', text: 'Pembayaran Rp 35.000 di Alfamart berhasil', time: Date.now() }
  ];
  processCapturedNotification(samples[Math.floor(Math.random() * samples.length)]);
  alert('Simulasi notifikasi dibuat! Periksa tab Deteksi.');
}
function confirmDetected(id) {
  const item = S.detected.find(d => d.id === id);
  if (!item) return;
  const d = item.d || today();
  if (item.type === 'in') {
    S.inc.push({ id: uid(), m: d.slice(0, 7), d, amt: item.amt, note: item.note, wallet: item.wallet });
  } else {
    S.tx.push({ id: uid(), d, amt: item.amt, cat: item.cat, note: item.note, wallet: item.wallet, img: null, auto: true });
    learnCat(item.note, item.cat);
  }
  S.detected = S.detected.filter(x => x.id !== id);
  save(); render();
}
function confirmAllDetected() {
  if (!S.detected.length) return;
  if (!confirm(`Simpan seluruh ${S.detected.length} transaksi ini?`)) return;
  S.detected.forEach(item => {
    const d = item.d || today();
    if (item.type === 'in') S.inc.push({ id: uid(), m: d.slice(0, 7), d, amt: item.amt, note: item.note, wallet: item.wallet });
    else {
      S.tx.push({ id: uid(), d, amt: item.amt, cat: item.cat, note: item.note, wallet: item.wallet, img: null, auto: true });
      learnCat(item.note, item.cat);
    }
  });
  S.detected = [];
  save(); render();
}
function dismissDetected(id) {
  S.detected = S.detected.filter(d => d.id !== id);
  save(); render();
}

function add() {
  const cats = catList();
  const wallets = walletNames();
  return `
    <h1>${draft.editId ? 'Ubah' : 'Tambah'} Catatan</h1>
    <p class="mute">Foto struk untuk membaca otomatis atau ketik nominalnya.</p>
    <label class="scan" for="f" onclick="pickPhoto(event)">
      <div class="empty-icon" aria-hidden="true">＋</div>
      <b>Foto Struk Belanja (Kamera / Galeri)</b>
      <div class="mute">OCR offline lokal</div>
    </label>
    <input id="f" type="file" accept="image/*" capture="environment" class="hide" onchange="scan(this.files[0])">
    ${draft.img ? `<img id="prev" src="${draft.img}" alt="Struk">` : ''}
    ${ocrMsg ? `<div class="card" style="background:var(--bg-card-subtle);padding:10px 14px"><span class="mute">${ocrMsg}</span></div>` : ''}
    <div class="card">
      <label>Nominal Pengeluaran (Rp)</label>
      <input id="a" type="number" inputmode="numeric" value="${draft.amt}" placeholder="0" oninput="draft.amt=this.value;document.getElementById('pv').textContent=this.value?rp(this.value):''">
      <div class="mute" id="pv" style="margin:-8px 0 12px;font-weight:700;color:var(--out)">${draft.amt ? rp(draft.amt) : ''}</div>
      <label>Kategori</label>
      <div class="cat-chips">
        ${cats.map(c => `<div class="cat-chip ${draft.cat === c ? 'active' : ''}" onclick="draft.cat='${esc(c)}';render()">${esc(c)}</div>`).join('')}
      </div>
      <label>Sumber / Dompet</label>
      <select id="w" onchange="draft.wallet=this.value">
        ${wallets.map(w => `<option ${w === (draft.wallet || 'Tunai') ? 'selected' : ''}>${esc(w)}</option>`).join('')}
      </select>
      <label>Catatan / Nama Tempat</label>
      <input id="n" value="${esc(draft.note)}" oninput="draft.note=this.value" placeholder="mis. Nasi padang, bensin">
      <label>Tanggal</label>
      <input id="d" type="date" value="${draft.d || today()}" onchange="draft.d=this.value">
      <button class="b" onclick="addTx()">${draft.editId ? 'Simpan Perubahan' : '✓ Simpan Pengeluaran'}</button>
      ${draft.editId ? `<button class="b alt" onclick="cancelEdit()">Batal</button>` : ''}
    </div>
  `;
}

function addTx() {
  const amt = +draft.amt;
  if (!amt || amt <= 0) return alert('Isi jumlah pengeluaran dengan benar.');
  const row = {
    id: draft.editId || uid(),
    d: draft.d || today(),
    amt,
    cat: draft.cat || 'Makan',
    wallet: draft.wallet || 'Tunai',
    note: (draft.note || '').trim(),
    img: draft.img
  };
  if (draft.editId) {
    S.tx = S.tx.map(t => t.id === draft.editId ? row : t);
    learnCat(row.note, row.cat);
  } else {
    S.tx.push(row);
    learnCat(row.note, row.cat);
  }
  save();
  draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
  ocrMsg = '';
  go('home');
}

function txRow(t) {
  return `
    <div class="row">
      ${t.img ? `<img src="${t.img}" alt="Struk">` : `
        <div class="row-icon">
          ${t.cat === 'Makan' ? '🍔' : t.cat === 'Transport' ? '🛵' : t.cat === 'Belanja' ? '🛒' : t.cat === 'Tagihan' ? '⚡' : t.cat === 'Kesehatan' ? '💊' : t.cat === 'Hiburan' ? '🎬' : '💳'}
        </div>
      `}
      <div class="grow" onclick="edit(${JSON.stringify(String(t.id))})" style="cursor:pointer">
        <b>${esc(t.note || t.cat)}</b>
        <div class="sub">
          <span class="pill pill-wallet" style="padding:1px 6px;font-size:10.5px">${esc(t.wallet || 'Tunai')}</span>
          <span>${esc(t.cat)}</span>
          ${t.d !== today() ? `<span>· ${t.d}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right"><b class="out">${rp(t.amt)}</b></div>
      <button class="x" onclick="delTx('${t.id}')" aria-label="Hapus">×</button>
    </div>
  `;
}

function delTx(id) {
  const t = S.tx.find(x => String(x.id) === String(id));
  if (!t) return;
  if (!confirm('Hapus catatan transaksi ini?')) return;
  S.tx = S.tx.filter(x => String(x.id) !== String(id));
  pushUndo('tx', t);
  save(); render();
}
function edit(id) {
  const t = S.tx.find(x => String(x.id) === String(id));
  if (!t) return;
  draft = { ...t, amt: String(t.amt), editId: t.id };
  ocrMsg = '';
  go('add');
}
function cancelEdit() {
  draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
  go('home');
}

// ---------- OCR ----------
function shrink(file) {
  return new Promise(res => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => {
      const k = Math.min(1, 1400 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      res(c);
    };
    im.src = u;
  });
}
async function scan(file) {
  if (!file) return;
  const c = await shrink(file);
  const t = document.createElement('canvas');
  const k = 800 / Math.max(c.width, c.height);
  t.width = c.width * k; t.height = c.height * k;
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  draft.img = t.toDataURL('image/jpeg', 0.7);
  ocrMsg = 'Foto tersimpan. Sedang menganalisis struk...';
  render();
  if (typeof Tesseract === 'undefined') {
    ocrMsg = 'Pembaca struk belum termuat. Isi jumlah manual, foto tetap tersimpan.';
    return render();
  }
  try {
    const r = await Tesseract.recognize(c, 'ind+eng', TESS);
    const p = parseReceipt(r.data.text);
    if (p.amt) draft.amt = p.amt;
    draft.cat = p.cat;
    if (p.note && !draft.note) draft.note = p.note;
    if (p.d) draft.d = p.d;
    ocrMsg = p.amt
      ? `Terbaca: total ${rp(p.amt)}${p.note ? ' · ' + p.note : ''}${p.d ? ' · ' + p.d : ''}. Periksa sebelum simpan.`
      : 'Total nominal tidak terbaca jelas. Ketik manual.';
  } catch (e) {
    ocrMsg = 'Gagal membaca teks struk. Ketik jumlah manual, foto tetap tersimpan.';
  }
  render();
}
function nums(line) {
  return (line.match(/\d[\d.,]*\d|\d/g) || []).map(x => {
    if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return +x.replace(/[.,]/g, '');
    return +x.replace(/[.,]\d{1,2}$/, '').replace(/[.,]/g, '');
  }).filter(n => n >= 500 && n < 1e8);
}
function parseReceipt(text) {
  const L = text.split('\n').map(s => s.trim()).filter(Boolean);
  const mx = re => {
    let b = 0;
    L.forEach(l => { if (re(l)) nums(l).forEach(n => { if (n > b) b = n; }); });
    return b;
  };
  let amt = mx(l => /total|jumlah|tagihan|grand|netto|amount due/i.test(l) && !/item|qty|diskon|hemat|ppn|pajak|kembali|change|barang/i.test(l));
  if (!amt) {
    const pay = mx(l => /bayar|tunai|cash|debit|kartu|qris/i.test(l) && !/kembali|change/i.test(l));
    const ch = mx(l => /kembali|change/i.test(l));
    amt = pay && ch && pay > ch ? pay - ch : pay;
  }
  if (!amt) amt = mx(() => true);

  let cat = predictCat(text);

  // Merchant: baris awal yang mengandung huruf, bukan total
  let note = '';
  for (const l of L.slice(0, 8)) {
    if (/total|jumlah|subtotal|tunai|kembali|ppn|pajak|qty|item|rp\.?\s*\d/i.test(l)) continue;
    if (/[a-zA-Z]{3}/.test(l) && l.length >= 3 && l.length <= 40) { note = l; break; }
  }
  if (!note) note = (L.find(l => /[a-z]{3}/i.test(l)) || '').slice(0, 40);

  // Tanggal struk
  let d = '';
  const dm = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dm) {
    let dd = +dm[1], mm = +dm[2], yy = +dm[3];
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      d = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    }
  }
  return { amt, cat, note, d };
}

function budgetCard() {
  const m = today().slice(0, 7);
  const b = +S.set.budget;
  const o = monthOut(m);
  let html = '';
  if (b) {
    const p = Math.min(100, Math.round((o / b) * 100));
    const over = o > b;
    html += `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mute">Anggaran Total Bulan Ini</span>
          <b>${rp(o)} / ${rp(b)}</b>
        </div>
        <div class="bar"><i style="width:${p}%;background:${over ? 'var(--out)' : p > 80 ? 'var(--warn)' : 'var(--acc)'}"></i></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px">
          <span class="mute">${p}% terpakai</span>
          <span style="font-weight:600;color:${over ? 'var(--out)' : 'var(--acc)'}">${over ? 'Lewat ' + rp(o - b) : 'Sisa ' + rp(b - o)}</span>
        </div>
      </div>`;
  }
  const budgets = S.set.budgets || {};
  const catKeys = Object.keys(budgets).filter(c => +budgets[c] > 0);
  if (catKeys.length) {
    const spent = {};
    S.tx.filter(t => t.d.startsWith(m)).forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + t.amt; });
    html += `<div class="card"><div class="mute" style="margin-bottom:8px">Anggaran per Kategori</div>`;
    catKeys.forEach(c => {
      const limit = +budgets[c];
      const use = spent[c] || 0;
      const pct = Math.min(100, Math.round((use / limit) * 100));
      const over = use > limit;
      html += `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span>${esc(c)}</span>
            <span style="color:${over ? 'var(--out)' : 'inherit'}">${rp(use)} / ${rp(limit)}</span>
          </div>
          <div class="bar" style="height:6px;margin-top:4px">
            <i style="width:${pct}%;background:${over ? 'var(--out)' : pct > 80 ? 'var(--warn)' : 'var(--acc)'}"></i>
          </div>
        </div>`;
    });
    html += `</div>`;
  }
  return html;
}

function weekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push({ dateStr: k, label: d.toLocaleDateString('id-ID', { weekday: 'short' }), total: sumDay(k).total, isToday: k === today() });
  }
  const m = Math.max(...days.map(x => x.total), 1);
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mute">Pengeluaran 7 Hari Terakhir</span>
        <span class="pill">${rp(days.reduce((a, b) => a + b.total, 0))}</span>
      </div>
      <div class="chart-container">
        ${days.map(x => `
          <div class="chart-bar-wrap">
            <div class="chart-bar ${x.isToday ? 'active' : ''}" style="height:${Math.max(6, Math.round((x.total / m) * 75))}px"></div>
            <span class="chart-label">${x.label}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function month() {
  const m = viewMonth;
  let tx = S.tx.filter(t => t.d.startsWith(m));
  const out = tx.reduce((a, t) => a + t.amt, 0);
  const incs = S.inc.filter(i => (i.m || (i.d || '').slice(0, 7)) === m);
  const inn = incs.reduce((a, i) => a + i.amt, 0);
  const by = {};
  tx.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amt);
  const transfers = (S.transfers || []).filter(t => (t.d || '').startsWith(m));

  // filter
  if (filterQ.q) {
    const q = filterQ.q.toLowerCase();
    tx = tx.filter(t => (t.note || '').toLowerCase().includes(q) || String(t.amt).includes(q) || (t.cat || '').toLowerCase().includes(q));
  }
  if (filterQ.cat) tx = tx.filter(t => t.cat === filterQ.cat);
  if (filterQ.wallet) tx = tx.filter(t => (t.wallet || 'Tunai') === filterQ.wallet);

  const wallets = walletNames();
  const cats = catList();

  return `
    <h1>Laporan Bulanan</h1>
    <input type="month" value="${m}" onchange="viewMonth=this.value||viewMonth;render()">
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><span class="mute">Total Pemasukan</span><div class="big inn" style="font-size:22px">${rp(inn)}</div></div>
        <div><span class="mute">Total Pengeluaran</span><div class="big out" style="font-size:22px">${rp(out)}</div></div>
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mute">Sisa Bersih</span>
        <div class="big" style="font-size:24px;color:${inn >= out ? 'var(--inn)' : 'var(--out)'}">${rp(inn - out)}</div>
      </div>
    </div>

    <h2>Cari / Filter</h2>
    <div class="card">
      <input type="search" placeholder="Cari catatan / nominal..." value="${esc(filterQ.q)}" oninput="filterQ.q=this.value;render()">
      <div style="display:flex;gap:8px;margin-top:8px">
        <select style="flex:1" onchange="filterQ.cat=this.value;render()">
          <option value="">Semua kategori</option>
          ${cats.map(c => `<option value="${esc(c)}" ${filterQ.cat===c?'selected':''}>${esc(c)}</option>`).join('')}
        </select>
        <select style="flex:1" onchange="filterQ.wallet=this.value;render()">
          <option value="">Semua dompet</option>
          ${wallets.map(w => `<option value="${esc(w)}" ${filterQ.wallet===w?'selected':''}>${esc(w)}</option>`).join('')}
        </select>
      </div>
    </div>

    <h2>Kategori Pengeluaran</h2>
    <div class="card">
      ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
        <div style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(c)}</span><b>${rp(v)}</b></div>
          <div class="bar"><i style="width:${out ? (v / out * 100) : 0}%;background:var(--acc)"></i></div>
        </div>
      `).join('') || '<div class="mute" style="text-align:center;padding:12px">Belum ada pengeluaran bulan ini.</div>'}
    </div>

    <h2>Saldo Dompet</h2>
    <div class="card">
      ${wallets.map(w => `
        <div class="row" style="padding:8px 0">
          <div class="grow"><b>${esc(w)}</b></div>
          <b style="color:${walletBalance(w)>=0?'var(--inn)':'var(--out)'}">${rp(walletBalance(w))}</b>
        </div>
      `).join('')}
    </div>

    <h2>Transfer Antar Dompet</h2>
    <div class="card">
      ${transfers.map(tr => `
        <div class="row">
          <div class="grow"><b>${esc(tr.from)} → ${esc(tr.to)}</b><div class="sub">${tr.d} · ${esc(tr.note||'')}</div></div>
          <b>${rp(tr.amt)}</b>
          <button class="x" onclick="delTransfer('${tr.id}')">×</button>
        </div>
      `).join('') || '<div class="mute" style="margin-bottom:10px">Belum ada transfer bulan ini.</div>'}
      <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:8px">
        <label>Dari</label>
        <select id="tf-from">${wallets.map(w=>`<option>${esc(w)}</option>`).join('')}</select>
        <label>Ke</label>
        <select id="tf-to">${wallets.map((w,i)=>`<option ${i===1?'selected':''}>${esc(w)}</option>`).join('')}</select>
        <label>Nominal (Rp)</label>
        <input id="tf-amt" type="number" inputmode="numeric" placeholder="0">
        <label>Catatan</label>
        <input id="tf-note" placeholder="opsional">
        <label>Tanggal</label>
        <input id="tf-d" type="date" value="${today()}">
        <button class="b sm" onclick="addTransfer()">+ Catat Transfer</button>
      </div>
    </div>

    <h2>Pemasukan Bulan Ini</h2>
    <div class="card">
      ${incs.map(i => `
        <div class="row">
          <div class="grow" onclick="editInc('${i.id}')" style="cursor:pointer">
            <b>${esc(i.note || 'Pemasukan')}</b>
            <span class="mute">${esc(i.wallet || 'Tunai')} · ${i.d || i.m || ''}</span>
          </div>
          <b class="inn">${rp(i.amt)}</b>
          <button class="x" onclick="delInc('${i.id}')">×</button>
        </div>
      `).join('')}
      <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
        <label>Nominal (Rp)</label>
        <input id="ia" type="number" inputmode="numeric" placeholder="mis. 5000000" value="${incomeDraft&&incomeDraft.amt||''}">
        <label>Keterangan</label>
        <input id="in" placeholder="mis. Gaji, Bonus" value="${esc(incomeDraft&&incomeDraft.note||'')}">
        <label>Dompet</label>
        <select id="iw">${wallets.map(w=>`<option ${incomeDraft&&incomeDraft.wallet===w?'selected':''}>${esc(w)}</option>`).join('')}</select>
        <label>Tanggal</label>
        <input id="id" type="date" value="${(incomeDraft&&incomeDraft.d)||today()}">
        <button class="b sm" onclick="addInc()">${incomeDraft&&incomeDraft.editId?'Simpan Perubahan':'+ Tambah Pemasukan'}</button>
        ${incomeDraft&&incomeDraft.editId?`<button class="b sm alt" onclick="incomeDraft=null;render()">Batal</button>`:''}
      </div>
    </div>

    <h2>Rincian Transaksi</h2>
    <div class="card">
      ${tx.sort((a, b) => b.d.localeCompare(a.d) || (b.id > a.id ? 1 : -1)).map(txRow).join('') || '<div class="mute" style="text-align:center;padding:12px">Kosong.</div>'}
    </div>
  `;
}

function addTransfer() {
  const from = document.getElementById('tf-from').value;
  const to = document.getElementById('tf-to').value;
  const amt = +document.getElementById('tf-amt').value;
  const note = document.getElementById('tf-note').value || '';
  const d = document.getElementById('tf-d').value || today();
  if (!amt || amt <= 0) return alert('Isi nominal transfer.');
  if (from === to) return alert('Dompet sumber dan tujuan harus berbeda.');
  if (!S.transfers) S.transfers = [];
  S.transfers.push({ id: uid(), from, to, amt, note, d });
  save(); render();
}
function delTransfer(id) {
  const t = (S.transfers || []).find(x => String(x.id) === String(id));
  if (!t) return;
  S.transfers = S.transfers.filter(x => String(x.id) !== String(id));
  pushUndo('transfer', t);
  save(); render();
}

function addInc() {
  const a = +document.getElementById('ia').value;
  if (!a) return alert('Isi nominal pemasukan.');
  const note = document.getElementById('in').value || 'Pemasukan';
  const wallet = document.getElementById('iw').value || 'Tunai';
  const d = document.getElementById('id').value || today();
  const m = d.slice(0, 7);
  if (incomeDraft && incomeDraft.editId) {
    S.inc = S.inc.map(i => String(i.id) === String(incomeDraft.editId)
      ? { ...i, amt: a, note, wallet, d, m } : i);
  } else {
    S.inc.push({ id: uid(), m, d, amt: a, note, wallet });
  }
  incomeDraft = null;
  save(); render();
}
function editInc(id) {
  const i = S.inc.find(x => String(x.id) === String(id));
  if (!i) return;
  incomeDraft = { editId: i.id, amt: i.amt, note: i.note, wallet: i.wallet, d: i.d || (i.m + '-01') };
  render();
}
function delInc(id) {
  const i = S.inc.find(x => String(x.id) === String(id));
  if (!i) return;
  if (!confirm('Hapus pemasukan ini?')) return;
  S.inc = S.inc.filter(x => String(x.id) !== String(id));
  pushUndo('inc', i);
  save(); render();
}

function set() {
  ensureWallets();
  const wallets = S.wallets;
  const cats = catList().filter(c => c !== 'Lainnya');
  return `
    <h1>Pengaturan</h1>

    <h2>Keamanan (PIN)</h2>
    <div class="card">
      ${S.set.pinHash
        ? `<p class="mute">PIN aktif. Aplikasi terkunci saat dibuka ulang.</p>
           <button class="b alt" onclick="setPinFlow()">Ganti PIN</button>
           <button class="b sm alt" style="margin-top:6px" onclick="clearPin()">Hapus PIN</button>
           <button class="b sm alt" style="margin-top:6px" onclick="unlocked=false;pinInput='';render()">Kunci Sekarang</button>`
        : `<p class="mute">Lindungi data keuangan dengan PIN 4–6 digit (disimpan di perangkat).</p>
           <button class="b alt" onclick="setPinFlow()">Setel PIN</button>`}
    </div>

    <h2>Anggaran Bulanan</h2>
    <div class="card">
      <label>Batas Pengeluaran Total per Bulan (Rp)</label>
      <input type="number" inputmode="numeric" value="${S.set.budget || ''}" placeholder="mis. 3000000" onchange="S.set.budget=+this.value||0;save()">
      <span class="mute">Isi 0 jika tidak memakai limit total.</span>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <b style="display:block;margin-bottom:8px">Anggaran per Kategori (opsional)</b>
      ${cats.map(c => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="min-width:90px;font-size:13px">${esc(c)}</span>
          <input type="number" inputmode="numeric" style="flex:1;margin:0" value="${(S.set.budgets && S.set.budgets[c]) || ''}" placeholder="0 = off" onchange="if(!S.set.budgets)S.set.budgets={};S.set.budgets['${c}']=+this.value||0;save()">
        </div>
      `).join('')}
    </div>

    <h2>Dompet</h2>
    <div class="card">
      ${wallets.map((w, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input style="flex:1;margin:0" value="${esc(w.name)}" onchange="renameWallet(${idx},this.value)">
          <input type="number" inputmode="numeric" style="width:110px;margin:0" value="${w.start||0}" title="Saldo awal" onchange="S.wallets[${idx}].start=+this.value||0;save();render()" placeholder="Awal">
          <button class="x" onclick="removeWallet(${idx})" aria-label="Hapus">×</button>
        </div>
      `).join('')}
      <button class="b sm alt" onclick="addWallet()">+ Dompet Baru</button>
      <p class="mute" style="font-size:12px;margin-top:8px">Kolom kanan = saldo awal. Transfer antar dompet tidak dihitung pengeluaran.</p>
    </div>

    <h2>Transaksi Berulang</h2>
    <div class="card">
      ${(S.recurring||[]).map(r => `
        <div class="row">
          <div class="grow">
            <b>${esc(r.note||'Rutin')} · ${rp(r.amt)}</b>
            <div class="sub">${r.type==='in'?'Masuk':'Keluar'} · tgl ${r.dayOfMonth} · ${esc(r.wallet||'')} ${r.cat?('· '+esc(r.cat)):''}</div>
          </div>
          <button class="x" onclick="delRecurring('${r.id}')">×</button>
        </div>
      `).join('') || '<div class="mute" style="margin-bottom:8px">Belum ada transaksi berulang.</div>'}
      <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:8px">
        <label>Jenis</label>
        <select id="rc-type"><option value="out">Pengeluaran</option><option value="in">Pemasukan</option></select>
        <label>Nominal</label>
        <input id="rc-amt" type="number" inputmode="numeric" placeholder="0">
        <label>Catatan</label>
        <input id="rc-note" placeholder="mis. Listrik, Gaji">
        <label>Kategori (pengeluaran)</label>
        <select id="rc-cat">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
        <label>Dompet</label>
        <select id="rc-wallet">${walletNames().map(w=>`<option>${esc(w)}</option>`).join('')}</select>
        <label>Tanggal tiap bulan (1–28)</label>
        <input id="rc-day" type="number" min="1" max="28" value="1">
        <button class="b sm" onclick="addRecurring()">+ Tambah Berulang</button>
      </div>
    </div>

    <h2>Kategori Kustom</h2>
    <div class="card">
      <div class="cat-chips">
        ${(S.customCats||[]).map(c => `<span class="cat-chip active" style="cursor:pointer" onclick="removeCustomCat('${esc(c)}')">${esc(c)} ×</span>`).join('') || '<span class="mute">Belum ada</span>'}
      </div>
      <input id="newcat" placeholder="Nama kategori baru">
      <button class="b sm alt" onclick="addCustomCat()">+ Tambah Kategori</button>
      <p class="mute" style="font-size:12px;margin-top:6px">Saat kamu mengoreksi kategori transaksi, aplikasi belajar untuk catatan serupa.</p>
    </div>

    <h2>Jadwal Pengingat Harian</h2>
    <div class="card">
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>Pengingat Siang</b>
          <input type="checkbox" style="width:auto;margin:0" ${S.set.remindMidday ? 'checked' : ''} onchange="S.set.remindMidday=this.checked;save()">
        </div>
        <input type="time" value="${S.set.timeMidday || '11:45'}" onchange="S.set.timeMidday=this.value;save()">
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>Ringkasan Malam</b>
          <input type="checkbox" style="width:auto;margin:0" ${S.set.remindNight ? 'checked' : ''} onchange="S.set.remindNight=this.checked;save()">
        </div>
        <input type="time" value="${S.set.timeNight || '21:00'}" onchange="S.set.timeNight=this.value;save()">
      </div>
      <div style="margin-top:14px">
        <button class="b alt" onclick="askNotifPermission()">Aktifkan Izin Notifikasi Android</button>
        <button class="b sm alt" style="width:100%;margin-top:6px" onclick="testNotificationNow()">Tes Notifikasi Sekarang</button>
      </div>
    </div>

    <h2>Deteksi Notifikasi Bank & E-Wallet</h2>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>Otomatis Simpan Transaksi</b>
        <input type="checkbox" style="width:auto;margin:0" ${S.set.autoSave ? 'checked' : ''} onchange="S.set.autoSave=this.checked;save()">
      </div>
      <p class="mute" style="margin:6px 0">Jika dicentang, transaksi terdeteksi langsung dicatat tanpa konfirmasi.</p>
      <button class="b alt" onclick="openNotifListenerSettings()">Pengaturan Akses Notifikasi Android</button>
    </div>

    <h2>Pembaruan Aplikasi (GitHub)</h2>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>Versi Terpasang</span><b>v${APP_VERSION}</b>
      </div>
      <label style="margin-top:10px">Repositori GitHub (opsional)</label>
      <input value="${esc(S.set.githubRepo || '')}" placeholder="username/nama-repo" onchange="S.set.githubRepo=this.value.trim();save()">
      <button class="b sm alt" onclick="checkGithubUpdate(true)">Periksa Pembaruan di GitHub</button>
    </div>

    <h2>Cadangan & Data</h2>
    <div class="card">
      ${S.set.lastBackupAt ? `<p class="mute" style="margin:0 0 8px">Cadangan terakhir: ${new Date(S.set.lastBackupAt).toLocaleString('id-ID')}</p>` : ''}
      <button class="b alt" onclick="exportJson()">Ekspor Cadangan (JSON)</button>
      <button class="b alt" onclick="exportCsv()">Ekspor CSV untuk Excel</button>
      <label style="margin-top:10px">Pulihkan Cadangan JSON</label>
      <input type="file" accept=".json" onchange="importJson(this.files[0])">
      <p class="mute" style="font-size:12px;margin-top:8px">Pemulihan menimpa data saat ini. Selalu ekspor dulu sebelum restore.</p>
    </div>

    <p class="mute" style="text-align:center;margin-top:20px">
      CatatUang v${APP_VERSION} · 100% Offline & Menjaga Privasi Data Finansialmu.<br>
      <a href="privacy.html" style="color:var(--acc)">Kebijakan Privasi</a>
    </p>
  `;
}

function addWallet() {
  const name = prompt('Nama dompet baru:');
  if (!name || !name.trim()) return;
  ensureWallets();
  if (S.wallets.some(w => w.name.toLowerCase() === name.trim().toLowerCase())) return alert('Dompet sudah ada.');
  S.wallets.push({ name: name.trim(), start: 0 });
  save(); render();
}
function renameWallet(idx, name) {
  if (!name || !name.trim()) return;
  ensureWallets();
  S.wallets[idx].name = name.trim();
  save();
}
function removeWallet(idx) {
  ensureWallets();
  if (S.wallets.length <= 1) return alert('Minimal satu dompet.');
  if (!confirm('Hapus dompet ini? Riwayat transaksi tetap ada.')) return;
  S.wallets.splice(idx, 1);
  save(); render();
}
function addRecurring() {
  const type = document.getElementById('rc-type').value;
  const amt = +document.getElementById('rc-amt').value;
  const note = document.getElementById('rc-note').value || 'Rutin';
  const cat = document.getElementById('rc-cat').value || 'Tagihan';
  const wallet = document.getElementById('rc-wallet').value || 'Tunai';
  const dayOfMonth = Math.min(28, Math.max(1, +document.getElementById('rc-day').value || 1));
  if (!amt) return alert('Isi nominal.');
  if (!S.recurring) S.recurring = [];
  S.recurring.push({ id: uid(), type, amt, note, cat, wallet, dayOfMonth, lastApplied: '' });
  applyRecurring();
  save(); render();
}
function delRecurring(id) {
  S.recurring = (S.recurring || []).filter(r => String(r.id) !== String(id));
  save(); render();
}
function addCustomCat() {
  const el = document.getElementById('newcat');
  const name = (el && el.value || '').trim();
  if (!name) return;
  if (!S.customCats) S.customCats = [];
  if (catList().includes(name)) return alert('Kategori sudah ada.');
  S.customCats.push(name);
  save(); render();
}
function removeCustomCat(name) {
  S.customCats = (S.customCats || []).filter(c => c !== name);
  save(); render();
}

async function askNotifPermission() {
  if (NATIVE && window.Capacitor?.Plugins?.LocalNotifications) {
    try {
      const r = await Capacitor.Plugins.LocalNotifications.requestPermissions();
      alert('Izin notifikasi: ' + r.display);
      scheduleAllReminders();
    } catch (e) { alert('Gagal meminta izin: ' + e.message); }
  } else if ('Notification' in window) {
    const res = await Notification.requestPermission();
    alert('Izin notifikasi browser: ' + res);
  }
}
async function testNotificationNow() {
  if (NATIVE && window.Capacitor?.Plugins?.LocalNotifications) {
    const ln = Capacitor.Plugins.LocalNotifications;
    try {
      await ln.schedule({
        notifications: [{
          id: 999, title: 'CatatUang: Pengingat Tes', body: summaryText(true),
          schedule: { at: new Date(Date.now() + 2500) }, smallIcon: 'ic_stat_catatuang'
        }]
      });
      alert('Notifikasi tes akan muncul dalam 3 detik.');
    } catch (e) { alert('Gagal: ' + e.message); }
  } else alert(summaryText(true));
}

function dl(name, txt, type) {
  if (NATIVE) return dlNative(name, txt);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type }));
  a.download = name;
  a.click();
}
async function dlNative(name, txt) {
  const P = Capacitor.Plugins;
  try {
    await P.Filesystem.writeFile({ path: name, data: txt, directory: 'CACHE', encoding: 'utf8' });
    const u = await P.Filesystem.getUri({ path: name, directory: 'CACHE' });
    await P.Share.share({ title: name, url: u.uri, dialogTitle: 'Simpan atau kirim file cadangan' });
  } catch (e) { alert('Gagal mengekspor: ' + (e.message || e)); }
}
function exportJson() {
  S.set.lastBackupAt = new Date().toISOString();
  save();
  dl('catatuang-cadangan.json', JSON.stringify(S, null, 2), 'application/json');
}
function exportCsv() {
  const header = 'Tanggal,Jenis,Kategori,Sumber,Catatan,Jumlah\n';
  const outRows = S.tx.map(t => [t.d, 'Keluar', t.cat, t.wallet || 'Tunai', '"' + (t.note || '').replace(/"/g, '""') + '"', t.amt].join(','));
  const inRows = S.inc.map(i => [i.d || i.m, 'Masuk', 'Pemasukan', i.wallet || 'Tunai', '"' + (i.note || '').replace(/"/g, '""') + '"', i.amt].join(','));
  const trRows = (S.transfers || []).map(t => [t.d, 'Transfer', t.from + '->' + t.to, t.from, '"' + (t.note || '').replace(/"/g, '""') + '"', t.amt].join(','));
  dl('catatuang.csv', header + outRows.concat(inRows, trRows).join('\n'), 'text/csv');
}
function importJson(f) {
  if (!f) return;
  if (!confirm('Pulihkan cadangan? Data transaksi saat ini akan diganti dengan isi file cadangan.\n\nPastikan kamu sudah mengekspor cadangan terbaru sebelum melanjutkan.')) {
    try { document.querySelector('input[type=file][accept=".json"]').value = ''; } catch (e) {}
    return;
  }
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.tx)) throw new Error('Format tidak valid');
      S = {
        tx: d.tx || [],
        inc: d.inc || [],
        detected: d.detected || [],
        transfers: d.transfers || [],
        wallets: d.wallets || DEFAULT_WALLETS.map(n => ({ name: n, start: 0 })),
        recurring: d.recurring || [],
        customCats: d.customCats || [],
        catLearn: d.catLearn || {},
        set: { ...S.set, ...(d.set || {}), lastBackupAt: new Date().toISOString() }
      };
      ensureWallets();
      unlocked = !S.set.pinHash;
      save(); render();
      alert('Cadangan berhasil dipulihkan!');
    } catch (e) { alert('File cadangan tidak valid.'); }
  };
  r.readAsText(f);
}

const U = p => new URL(p, location.href).href;
const TESS = { workerPath: U('lib/worker.min.js'), corePath: U('lib/'), langPath: U('lib/lang'), gzip: true };

async function pickPhoto(ev) {
  if (!NATIVE || !window.Capacitor?.Plugins?.Camera) return;
  ev.preventDefault();
  try {
    const p = await Capacitor.Plugins.Camera.getPhoto({
      quality: 85, width: 1600, resultType: 'dataUrl', source: 'PROMPT',
      promptLabelHeader: 'Foto Struk', promptLabelPhoto: 'Pilih dari Galeri', promptLabelPicture: 'Ambil Foto Baru'
    });
    scan(await (await fetch(p.dataUrl)).blob());
  } catch (e) {}
}

async function init() {
  try {
    const loaded = await DB.get('state');
    if (loaded) {
      S = {
        tx: loaded.tx || [],
        inc: loaded.inc || [],
        detected: loaded.detected || [],
        transfers: loaded.transfers || [],
        wallets: loaded.wallets || DEFAULT_WALLETS.map(n => ({ name: n, start: 0 })),
        recurring: loaded.recurring || [],
        customCats: loaded.customCats || [],
        catLearn: loaded.catLearn || {},
        set: { ...S.set, ...(loaded.set || {}) }
      };
    }
  } catch (e) { console.error('Database load error:', e); }
  ensureWallets();
  unlocked = !S.set.pinHash;
  applyRecurring();
  await checkNotifListenerPermission();
  await fetchCapturedNotifications();
  if (NATIVE && NotifPlugin) {
    try {
      NotifPlugin.addListener('notificationReceived', data => { if (data) processCapturedNotification(data); });
    } catch (e) {}
  }
  scheduleAllReminders();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (S.set.pinHash) unlocked = false;
      checkNotifListenerPermission();
      fetchCapturedNotifications();
      scheduleAllReminders();
      applyRecurring();
      render();
    }
  });
  render();
  if (navigator.onLine) checkGithubUpdate(false);
}

init();
