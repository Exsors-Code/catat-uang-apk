// -------------------------------------------------------------
// SISTEM PARSER NOTIFIKASI BANK & E-WALLET INDONESIA
// CatatUang - Aplikasi Keuangan Android Mandiri & Offline
const APP_VERSION = '1.2.0';
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const GITHUB_DEFAULT_REPO = 'Exsors-Code/catat-uang-apk';

const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const pad2 = n => String(n).padStart(2, '0');
const dateKey = d => {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
};
const today = () => dateKey(new Date());
const esc = s => String(s || '').replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));
const normKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
const dedupeKey = t => `${t.type || 'out'}|${t.d || ''}|${t.amt || 0}|${normKey(t.wallet)}|${normKey(t.note)}|${normKey(t.cat || '')}`;

// State utama aplikasi
let S = {
  tx: [],          // Transaksi pengeluaran
  inc: [],         // Transaksi pemasukan
  detected: [],    // Notifikasi transaksi bank/e-wallet yang terdeteksi
  transfers: [],   // Transfer antar-dompet (bukan pemasukan/pengeluaran)
  goals: [],       // Target tabungan
  wallets: [],     // Dompet tambahan (cash/kas/bank/e-wallet user)
  set: {
    budget: 0,
    budgets: {},   // Anggaran per kategori: { Makan: 0, ... }
    remindMidday: true,
    timeMidday: '11:45',
    remindNight: true,
    timeNight: '21:00',
    autoSave: false,
    githubRepo: '',
    notifOnboarded: false,
    lastBackup: null
  },
  meta: { pinHash: null }
};

let tab = 'home';
let draft = { kind: 'out', img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today(), editId: null };
let ocrMsg = '';
let viewMonth = today().slice(0, 7);
let notifListenerGranted = false;
let updateInfo = null;
let locked = false;

const save = async () => {
  try {
    await DB.put('meta', 'state', S.meta || {});
    await DB.put('tx', 'state', S.tx);
    await DB.put('inc', 'state', S.inc);
    await DB.put('detected', 'state', S.detected);
    await DB.put('transfers', 'state', S.transfers);
    await DB.put('goals', 'state', S.goals);
    await DB.put('photos', 'state', S.tx.filter(t => t.img).reduce((m, t) => (m[t.id] = t.img, m), {}));
    if (S.set) S.set.lastBackup = S.set.lastBackup || null;
    scheduleAllReminders();
  } catch (e) {
    alert('Gagal menyimpan ke database. Ekspor cadangan secara berkala.');
  }
};
// -------------------------------------------------------------
function parsePaymentNotification(item) {
  const pkg = (item.pkg || '').toLowerCase();
  const title = item.title || '';
  const text = item.text || '';
  const subText = item.subText || '';
  const full = `${title} ${text} ${subText}`;

  // 1. Deteksi Sumber Bank / E-Wallet
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

  // 2. Deteksi Arah Transaksi: Pengeluaran (out) vs Pemasukan (in)
  const isIncome = /transfer masuk|diterima|menerima|dikirim ke kamu|uang masuk/i.test(full);
  const type = isIncome ? 'in' : 'out';

  // 3. Ekstraksi Nominal (Rp)
  let amt = 0;
  const matchRp = full.match(/(?:rp\.?|idr)\s*([\d.,]+)/i);
  if (matchRp && matchRp[1]) {
    const rawNum = matchRp[1].replace(/[.,](\d{2})$/, ''); // buang ,00
    amt = +rawNum.replace(/[.,]/g, '');
  } else {
    // Cari angka dengan format ribuan
    const matchAlt = full.match(/\b\d{1,3}(?:[.,]\d{3})+\b/);
    if (matchAlt) {
      amt = +matchAlt[0].replace(/[.,]/g, '');
    }
  }

  // 4. Ekstraksi Keterangan / Nama Merchant
  let note = '';
  const matchKe = full.match(/(?:ke|di|merchant|pembayaran)\s+([A-Za-z0-9\s&'-]{3,35})(?:\s+(?:berhasil|sukses|telah)|\.|$)/i);
  if (matchKe && matchKe[1]) {
    note = matchKe[1].trim();
  } else {
    note = title ? `${title} (${wallet})` : `Transaksi ${wallet}`;
  }
  // Bersihkan kata-kata umum
  note = note.replace(/^(pembayaran|transfer|qris)\s+/i, '').trim();

  // 5. Prediksi Kategori Pengeluaran
  let cat = 'Lainnya';
  for (const [k, re] of Object.entries(CATS)) {
    if (re.test(full)) {
      cat = k;
      break;
    }
  }

  const notifDate = item.time ? new Date(item.time) : new Date();
  const timeStr = notifDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return {
    id: item.id || Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    pkg,
    wallet,
    type,
    amt: amt || 0,
    note: note || `Pembayaran ${wallet}`,
    cat,
    time: timeStr,
    timestamp: item.time || Date.now(),
    d: item.time ? dateKey(item.time) : dateKey(notifDate),
    raw: full
  };
}

// Tambah notifikasi baru ke antrean terdeteksi
function processCapturedNotification(rawItem) {
  const parsed = parsePaymentNotification(rawItem);
  if (!parsed.amt || parsed.amt < 100) return; // Abaikan jika nominal tidak valid

  // Cek duplikasi agar tidak tercatat ganda
    const existsDetected = S.detected.some(d => d.id === parsed.id || (d.amt === parsed.amt && d.raw === parsed.raw));
  const existsSaved = [...S.tx, ...S.inc].some(t => (t.amt === parsed.amt) && (t.note || '').toLowerCase() === (parsed.note || '').toLowerCase() && (t.d === parsed.d));
  if (existsDetected || existsSaved) return;

  if (S.set.autoSave) {
    // Mode Auto-Save: langsung simpan tanpa konfirmasi
    if (parsed.type === 'in') {
      S.inc.push({ id: Date.now(), m: (parsed.d || today()).slice(0, 7), amt: parsed.amt, note: parsed.note, wallet: parsed.wallet });
    } else {
      S.tx.push({ id: Date.now(), d: parsed.d || today(), amt: parsed.amt, cat: parsed.cat, note: parsed.note, wallet: parsed.wallet, img: null, auto: true });
    }
    save();
  } else {
    // Mode Konfirmasi: masukkan ke inbox detected
    S.detected.unshift(parsed);
    save();
  }
  render();
}

// -------------------------------------------------------------
// INTEGRASI NATIVE CAPACITOR & LOCAL NOTIFICATIONS
// -------------------------------------------------------------
const NotifPlugin = window.Capacitor?.Plugins?.CatatUangNotification;

async function checkNotifListenerPermission() {
  if (!NATIVE || !NotifPlugin) return false;
  try {
    const res = await NotifPlugin.isPermissionGranted();
    notifListenerGranted = !!res.granted;
    return notifListenerGranted;
  } catch (e) {
    return false;
  }
}

async function openNotifListenerSettings() {
  if (!NATIVE || !NotifPlugin) {
    alert('Fitur membaca notifikasi bank khusus untuk aplikasi Android (APK).');
    return;
  }
  try {
    await NotifPlugin.openPermissionSettings();
  } catch (e) {
    alert('Gagal membuka pengaturan: ' + (e.message || e));
  }
}

async function fetchCapturedNotifications() {
  if (!NATIVE || !NotifPlugin) return;
  try {
    const res = await NotifPlugin.getPendingNotifications();
    const list = res?.notifications || [];
    if (list.length > 0) {
      list.forEach(processCapturedNotification);
      await NotifPlugin.clearPendingNotifications();
    }
  } catch (e) {
    console.error('Error fetching notifications:', e);
  }
}

// Jadwalkan pengingat siang (11:45/12:00) dan pengingat malam (21:00)
async function scheduleAllReminders() {
  if (!NATIVE || !window.Capacitor?.Plugins?.LocalNotifications) return;
  const ln = Capacitor.Plugins.LocalNotifications;
  try {
    const p = await ln.checkPermissions();
    if (p.display !== 'granted') return;

    // Batalkan jadwal notifikasi sebelumnya
    const cancelIds = [];
    for (let i = 1; i <= 30; i++) cancelIds.push({ id: i });
    await ln.cancel({ notifications: cancelIds });

    const list = [];
    const now = new Date();

    // 1. Jadwal Pengingat Siang (~11/12)
    if (S.set.remindMidday) {
      const [hM, miM] = (S.set.timeMidday || '11:45').split(':').map(Number);
      for (let i = 0; i < 7; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hM, miM, 0);
        if (at <= now) continue;
        list.push({
          id: i + 1,
          title: 'CatatUang: Pengingat Siang Ã¢Ëœâ‚¬Ã¯Â¸Â',
          body: at.toDateString() === now.toDateString() ? summaryText(true) : 'Sudah makan siang? Jangan lupa catat pengeluaranmu!',
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_catatuang',
          iconColor: '#0F766E'
        });
      }
    }

    // 2. Jadwal Ringkasan Malam (21:00)
    if (S.set.remindNight) {
      const [hN, miN] = (S.set.timeNight || '21:00').split(':').map(Number);
      for (let i = 0; i < 7; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hN, miN, 0);
        if (at <= now) continue;
        list.push({
          id: i + 15,
          title: 'CatatUang: Ringkasan Malam Ã°Å¸Å’â„¢',
          body: at.toDateString() === now.toDateString() ? summaryText(false) : 'Buka CatatUang untuk evaluasi keuangan harianmu.',
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_catatuang',
          iconColor: '#0F766E'
        });
      }
    }

    if (list.length) {
      await ln.schedule({ notifications: list });
    }
  } catch (e) {
    console.error('Gagal menjadwalkan notifikasi:', e);
  }
}

// -------------------------------------------------------------
// CEK PEMBARUAN GITHUB (IN-APP UPDATER)
// -------------------------------------------------------------
async function checkGithubUpdate(manual = false) {
  const repo = S.set.githubRepo || 'Exsors-Code/catat-uang-apk';
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!res.ok) throw new Error('Repo belum dibuat atau belum ada rilis.');
    const data = await res.json();
    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const apkAsset = (data.assets || []).find(a => a.name.endsWith('.apk'));

    var cmpV=function(a,b){a=(a||'').split('.');b=(b||'').split('.');for(var i=0;i<Math.max(a.length,b.length);i++){var ai=parseInt(a[i])||0,bi=parseInt(b[i])||0;if(ai!==bi)return ai-bi;}return 0;};if(latestTag&&cmpV(latestTag,APP_VERSION)>0&&apkAsset){
      updateInfo = {
        version: data.tag_name,
        name: data.name || data.tag_name,
        body: data.body || 'Pembaruan aplikasi terbaru tersedia.',
        url: apkAsset.browser_download_url
      };
      render();
      if (manual) alert(`Pembaruan ditemukan: ${updateInfo.version}!`);
    } else {
      updateInfo = null;
      if (manual) alert('Aplikasi sudah menggunakan versi terbaru (' + APP_VERSION + ').');
    }
  } catch (e) {
    if (manual) alert('Pengecekan pembaruan: ' + e.message);
  }
}

// -------------------------------------------------------------
// UI RENDERING & ROUTING
// -------------------------------------------------------------
function render() {
  const unreadCount = S.detected.length;

  const navItems = [
    { id: 'home', label: 'Hari Ini', icon: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>` },
    { id: 'detect', label: 'Deteksi', icon: `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`, badge: unreadCount },
    { id: 'add', label: 'Tambah', icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>` },
    { id: 'month', label: 'Bulanan', icon: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>` },
    { id: 'set', label: 'Atur', icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>` }
  ];

  document.getElementById('nav').innerHTML = navItems.map(item => `
    <button class="${tab === item.id ? 'on' : ''}" onclick="go('${item.id}')">
      ${item.icon}
      ${item.label}
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </button>
  `).join('');

  document.getElementById('app').innerHTML = { home, detect, add, month, set }[tab]();
}

function go(t) {
  tab = t;
  render();
  window.scrollTo(0, 0);
}

// -------------------------------------------------------------
// HALAMAN 1: HARI INI (DASHBOARD UTAMA)
// -------------------------------------------------------------
function home() {
  const s = sumDay(today());
  const l = S.tx.filter(t => t.d === today()).sort((a, b) => b.id - a.id);
  const late = new Date().toTimeString().slice(0, 5) >= (S.set.timeNight || '21:00');
  const midday = new Date().toTimeString().slice(0, 5) >= '11:30' && new Date().toTimeString().slice(0, 5) <= '14:00';

  const updateBanner = updateInfo ? `
    <div class="banner">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <b>Ã°Å¸Å¡â‚¬ Pembaruan Tersedia (${esc(updateInfo.version)})</b>
          <div style="font-size:12px;opacity:0.9">${esc(updateInfo.name)}</div>
        </div>
        <button class="pill" style="background:#fff;color:var(--acc);font-weight:700" onclick="openUpdateLink('${updateInfo.url}')">Unduh APK</button>
      </div>
    </div>` : '';

  const detectedBanner = S.detected.length ? `
    <div class="card" style="border:1px solid rgba(var(--acc-rgb),0.5);background:rgba(var(--acc-rgb),0.07);cursor:pointer" onclick="go('detect')">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">Ã°Å¸â€â€</span>
          <div>
            <b>${S.detected.length} Transaksi Terdeteksi</b>
            <div class="mute">Dari notifikasi bank & e-wallet. Ketuk untuk simpan.</div>
          </div>
        </div>
        <span class="pill pill-wallet">Lihat</span>
      </div>
    </div>` : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <h1>Hari Ini</h1>
        <div class="mute">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <button class="b sm alt" onclick="go('add')">+ Catat</button>
    </div>

    ${updateBanner}
    ${detectedBanner}

    ${midday ? `<div class="card" style="background:var(--bg-card-subtle);border-left:4px solid var(--acc)">
      <div style="font-size:13px;font-weight:600;color:var(--acc)">Ã¢Ëœâ‚¬Ã¯Â¸Â PENGINGAT SIANG</div>
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
          <div style="font-size:36px;margin-bottom:8px">Ã°Å¸â€œÂ</div>
          <b>Belum ada catatan hari ini</b>
          <div class="mute" style="margin-top:4px">Tap <b>+ Catat</b> untuk foto struk atau mencatat manual.</div>
        </div>
      `}
    </div>
  `;
}

// -------------------------------------------------------------
// HALAMAN 2: DETEKSI OTOMATIS (INBOX NOTIFIKASI BANK & E-WALLET)
// -------------------------------------------------------------
function detect() {
  const permBadge = notifListenerGranted
    ? `<span class="pill pill-inn">Ã¢â€”Â Akses Notifikasi Aktif</span>`
    : `<span class="pill pill-warn">Ã¢â€”Â Akses Notifikasi Belum Aktif</span>`;

  return `
    <h1>Deteksi Transaksi</h1>
    <p class="mute">Membaca notifikasi pembayaran dari GoPay, BCA, SeaBank, Mandiri, DANA, OVO, ShopeePay, dll.</p>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b>Status Android</b>
        ${permBadge}
      </div>
      <p class="mute" style="margin:4px 0 12px">
        Agar CatatUang bisa mendeteksi otomatis saat kamu membayar QRIS atau transfer, izinkan "Akses Notifikasi" di pengaturan Android.
      </p>
      <button class="b alt" onclick="openNotifListenerSettings()">Ã¢Å¡â„¢Ã¯Â¸Â Buka Pengaturan Izin Android</button>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="b sm alt" style="flex:1" onclick="refreshDetected()">Periksa Notifikasi Baru</button>
        <button class="b sm alt" style="flex:1" onclick="testSimulateNotif()">Ã¢Å¡Â¡ Simulasi Tes</button>
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
              <span class="mute" style="margin-left:6px">${item.time || ''}</span>
              <div style="font-weight:700;font-size:16px;margin-top:4px">${esc(item.note)}</div>
            </div>
            <div style="text-align:right">
              <div class="big ${item.type === 'in' ? 'inn' : 'out'}" style="font-size:18px">${rp(item.amt)}</div>
              <span class="mute" style="font-size:11px">${item.cat}</span>
            </div>
          </div>
          <div class="mute" style="font-size:12px;margin:8px 0;background:rgba(0,0,0,0.06);padding:6px 8px;border-radius:6px;word-break:break-all">
            "${esc(item.raw)}"
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="b sm" style="flex:1" onclick="confirmDetected('${item.id}')">Ã¢Å“â€œ Simpan</button>
            <button class="b sm alt" style="flex:1" onclick="dismissDetected('${item.id}')">Ã¢Å“â€¢ Abaikan</button>
          </div>
        </div>
      `).join('') : `
        <div style="text-align:center;padding:24px 12px">
          <div style="font-size:36px;margin-bottom:8px">Ã°Å¸â€â€</div>
          <b>Belum ada notifikasi baru</b>
          <div class="mute" style="margin-top:4px">Begitu kamu belanja atau transfer lewat e-wallet/bank, transaksinya akan otomatis muncul di sini.</div>
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
    { pkg: 'com.bti.seabank', title: 'SeaBank', text: 'Pembayaran QRIS Rp 18.000 ke Warung Nasi Goreng sukses', time: Date.now() },
    { pkg: 'id.dana', title: 'DANA', text: 'Pembayaran Rp 35.000 di Alfamart berhasil', time: Date.now() }
  ];
  const chosen = samples[Math.floor(Math.random() * samples.length)];
  processCapturedNotification(chosen);
  alert('Simulasi notifikasi berhasil dibuat! Periksa tab Deteksi.');
}

function confirmDetected(id) {
  const item = S.detected.find(d => d.id === id);
  if (!item) return;
  if (item.type === 'in') {
    S.inc.push({ id: Date.now(), m: today().slice(0, 7), amt: item.amt, note: item.note, wallet: item.wallet });
  } else {
    S.tx.push({ id: Date.now(), d: today(), amt: item.amt, cat: item.cat, note: item.note, wallet: item.wallet, img: null, auto: true });
  }
  S.detected = S.detected.filter(d => d.id !== id);
  save();
  render();
}

function confirmAllDetected() {
  if (!confirm(`Simpan seluruh ${S.detected.length} transaksi ini?`)) return;
  S.detected.forEach(item => {
    if (item.type === 'in') {
      S.inc.push({ id: Date.now() + Math.random(), m: today().slice(0, 7), amt: item.amt, note: item.note, wallet: item.wallet });
    } else {
      S.tx.push({ id: Date.now() + Math.random(), d: today(), amt: item.amt, cat: item.cat, note: item.note, wallet: item.wallet, img: null, auto: true });
    }
  });
  S.detected = [];
  save();
  render();
}

function dismissDetected(id) {
  S.detected = S.detected.filter(d => d.id !== id);
  save();
  render();
}

// -------------------------------------------------------------
// HALAMAN 3: TAMBAH / SCAN TRANSAKSI MANUAL
// -------------------------------------------------------------
function add() {
  return `
    <h1>${draft.editId ? 'Ubah' : 'Tambah'} Catatan</h1>
    <p class="mute">Foto struk untuk membaca otomatis atau ketik nominalnya.</p>

    <label class="scan" for="f" onclick="pickPhoto(event)">
      <div style="font-size:28px;margin-bottom:4px">Ã°Å¸â€œÂ·</div>
      <b>Foto Struk Belanja (Kamera / Galeri)</b>
      <div class="mute">Didukung oleh OCR offline lokal</div>
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
        ${Object.keys(CATS).filter(c => c !== 'Lainnya').map(c => `
          <div class="cat-chip ${draft.cat === c ? 'active' : ''}" onclick="draft.cat='${c}';render()">${c}</div>
        `).join('')}
        <div class="cat-chip ${draft.cat === 'Lainnya' ? 'active' : ''}" onclick="draft.cat='Lainnya';render()">Lainnya</div>
      </div>

      <label>Sumber / Dompet</label>
      <select id="w" onchange="draft.wallet=this.value">
        ${WALLETS.map(w => `<option ${w === (draft.wallet || 'Tunai') ? 'selected' : ''}>${w}</option>`).join('')}
      </select>

      <label>Catatan / Nama Tempat</label>
      <input id="n" value="${esc(draft.note)}" oninput="draft.note=this.value" placeholder="mis. Nasi padang, bensin, belanja bulanan">

      <label>Tanggal</label>
      <input id="d" type="date" value="${draft.d || today()}" onchange="draft.d=this.value">

      <button class="b" onclick="addTx()">${draft.editId ? 'Simpan Perubahan' : 'Ã¢Å“â€œ Simpan Pengeluaran'}</button>
      ${draft.editId ? `<button class="b alt" onclick="cancelEdit()">Batal</button>` : ''}
    </div>
  `;
}

function addTx() {
  const amt = +draft.amt;
  if (!amt || amt <= 0) return alert('Isi jumlah pengeluaran dengan benar.');
  const row = {
    id: draft.editId || Date.now(),
    d: draft.d || today(),
    amt,
    cat: draft.cat || 'Makan',
    wallet: draft.wallet || 'Tunai',
    note: (draft.note || '').trim(),
    img: draft.img
  };
  if (draft.editId) S.tx = S.tx.map(t => t.id === draft.editId ? row : t);
  else S.tx.push(row);

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
          ${t.cat === 'Makan' ? 'Ã°Å¸Ââ€' : t.cat === 'Transport' ? 'Ã°Å¸â€ºÂµ' : t.cat === 'Belanja' ? 'Ã°Å¸â€ºâ€™' : t.cat === 'Tagihan' ? 'Ã¢Å¡Â¡' : t.cat === 'Kesehatan' ? 'Ã°Å¸â€™Å ' : t.cat === 'Hiburan' ? 'Ã°Å¸Å½Â¬' : 'Ã°Å¸â€™Â³'}
        </div>
      `}
      <div class="grow" onclick="edit(${t.id})" style="cursor:pointer">
        <b>${esc(t.note || t.cat)}</b>
        <div class="sub">
          <span class="pill pill-wallet" style="padding:1px 6px;font-size:10.5px">${esc(t.wallet || 'Tunai')}</span>
          <span>${t.cat}</span>
          ${t.d !== today() ? `<span>Ã‚Â· ${t.d}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <b class="out">${rp(t.amt)}</b>
      </div>
      <button class="x" onclick="del(${t.id})" aria-label="Hapus">Ãƒâ€”</button>
    </div>
  `;
}

function del(id) {
  if (!confirm('Hapus catatan transaksi ini?')) return;
  S.tx = S.tx.filter(t => t.id !== id);
  save();
  render();
}

function edit(id) {
  const t = S.tx.find(x => x.id === id);
  if (!t) return;
  draft = { ...t, amt: String(t.amt), editId: id };
  ocrMsg = '';
  go('add');
}

function cancelEdit() {
  draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
  go('home');
}

// -------------------------------------------------------------
// OCR STRUK BELANJA OFFLINE (TESSERACT.JS)
// -------------------------------------------------------------
function shrink(file) {
  return new Promise(res => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => {
      const k = Math.min(1, 1400 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = im.width * k;
      c.height = im.height * k;
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
  t.width = c.width * k;
  t.height = c.height * k;
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
    ocrMsg = p.amt ? `Terbaca: total ${rp(p.amt)}. Silakan periksa sebelum disimpan.` : 'Total nominal tidak terbaca jelas. Silakan ketik manual.';
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
    L.forEach(l => {
      if (re(l)) nums(l).forEach(n => { if (n > b) b = n; });
    });
    return b;
  };
  let amt = mx(l => /total|jumlah|tagihan|grand|netto/i.test(l) && !/item|qty|diskon|hemat|ppn|pajak|kembali|change|barang/i.test(l));
  if (!amt) {
    const pay = mx(l => /bayar|tunai|cash|debit|kartu|qris/i.test(l) && !/kembali|change/i.test(l));
    const ch = mx(l => /kembali|change/i.test(l));
    amt = pay && ch && pay > ch ? pay - ch : pay;
  }
  if (!amt) amt = mx(() => true);
  let cat = 'Lainnya';
  for (const [k, re] of Object.entries(CATS)) {
    if (re.test(text)) { cat = k; break; }
  }
  const note = (L.find(l => /[a-z]{3}/i.test(l)) || '').slice(0, 40);
  return { amt, cat, note };
}

// -------------------------------------------------------------
// HALAMAN 4: ANALISIS BULANAN
// -------------------------------------------------------------
function monthOut(m) {
  return S.tx.filter(t => t.d.startsWith(m)).reduce((a, t) => a + t.amt, 0);
}

function budgetCard() {
  const b = +S.set.budget;
  if (!b) return '';
  const o = monthOut(today().slice(0, 7));
  const p = Math.min(100, Math.round((o / b) * 100));
  const over = o > b;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mute">Anggaran Bulan Ini</span>
        <b>${rp(o)} / ${rp(b)}</b>
      </div>
      <div class="bar">
        <i style="width:${p}%;background:${over ? 'var(--out)' : p > 80 ? 'var(--warn)' : 'var(--acc)'}"></i>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px">
        <span class="mute">${p}% terpakai</span>
        <span style="font-weight:600;color:${over ? 'var(--out)' : 'var(--acc)'}">${over ? 'Lewat ' + rp(o - b) : 'Sisa ' + rp(b - o)}</span>
      </div>
    </div>
  `;
}

function weekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push({
      dateStr: k,
      label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      total: sumDay(k).total,
      isToday: k === today()
    });
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
            <div class="mute" style="font-size:11px;font-weight:${x.isToday ? '700' : '500'};color:${x.isToday ? 'var(--acc)' : ''}">${x.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function month() {
  const m = viewMonth;
  const tx = S.tx.filter(t => t.d.startsWith(m));
  const out = tx.reduce((a, t) => a + t.amt, 0);
  const incs = S.inc.filter(i => i.m === m);
  const inn = incs.reduce((a, i) => a + i.amt, 0);
  const by = {};
  tx.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amt);

  return `
    <h1>Laporan Bulanan</h1>
    <input type="month" value="${m}" onchange="viewMonth=this.value||viewMonth;render()">

    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <span class="mute">Total Pemasukan</span>
          <div class="big inn" style="font-size:22px">${rp(inn)}</div>
        </div>
        <div>
          <span class="mute">Total Pengeluaran</span>
          <div class="big out" style="font-size:22px">${rp(out)}</div>
        </div>
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mute">Sisa Bersih</span>
        <div class="big" style="font-size:24px;color:${inn >= out ? 'var(--inn)' : 'var(--out)'}">${rp(inn - out)}</div>
      </div>
    </div>

    <h2>Kategori Pengeluaran</h2>
    <div class="card">
      ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
        <div style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;font-size:14px">
            <span>${c}</span>
            <b>${rp(v)}</b>
          </div>
          <div class="bar">
            <i style="width:${out ? (v / out * 100) : 0}%;background:var(--acc)"></i>
          </div>
        </div>
      `).join('') || '<div class="mute" style="text-align:center;padding:12px">Belum ada pengeluaran bulan ini.</div>'}
    </div>

    <h2>Pemasukan Bulan Ini</h2>
    <div class="card">
      ${incs.map(i => `
        <div class="row">
          <div class="grow">
            <b>${esc(i.note || 'Pemasukan')}</b>
            <span class="mute">${i.wallet || 'Tunai'}</span>
          </div>
          <b class="inn">${rp(i.amt)}</b>
          <button class="x" onclick="delInc(${i.id})">Ãƒâ€”</button>
        </div>
      `).join('')}

      <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
        <label>Tambah Pemasukan Baru (Rp)</label>
        <input id="ia" type="number" inputmode="numeric" placeholder="mis. 5000000">
        <label>Sumber / Keterangan</label>
        <input id="in" placeholder="mis. Gaji, Bonus, Usaha">
        <button class="b sm" onclick="addInc()">+ Tambah Pemasukan</button>
      </div>
    </div>

    <h2>Rincian Seluruh Transaksi</h2>
    <div class="card">
      ${tx.sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id).map(txRow).join('') || '<div class="mute" style="text-align:center;padding:12px">Kosong.</div>'}
    </div>
  `;
}

function addInc() {
  const a = +document.getElementById('ia').value;
  if (!a) return alert('Isi nominal pemasukan.');
  S.inc.push({ id: Date.now(), m: viewMonth, amt: a, note: document.getElementById('in').value || 'Pemasukan', wallet: 'Tunai' });
  save();
  render();
}

function delInc(id) {
  S.inc = S.inc.filter(i => i.id !== id);
  save();
  render();
}

// -------------------------------------------------------------
// HALAMAN 5: PENGATURAN & SINKRONISASI GITHUB
// -------------------------------------------------------------
function set() {
  return `
    <h1>Pengaturan</h1>

    <h2>Anggaran Bulanan</h2>
    <div class="card">
      <label>Target Batas Pengeluaran per Bulan (Rp)</label>
      <input type="number" inputmode="numeric" value="${S.set.budget || ''}" placeholder="mis. 3000000" onchange="S.set.budget=+this.value||0;save()">
      <span class="mute">Beri batas 0 jika tidak ingin menggunakan limit anggaran.</span>
    </div>

    <h2>Jadwal Pengingat Harian</h2>
    <div class="card">
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>Ã¢Ëœâ‚¬Ã¯Â¸Â Pengingat Siang (Jam 11 / 12)</b>
          <input type="checkbox" style="width:auto;margin:0" ${S.set.remindMidday ? 'checked' : ''} onchange="S.set.remindMidday=this.checked;save()">
        </div>
        <p class="mute" style="margin:4px 0 8px">Mengingatkan total pengeluaran sampai siang dan mencatat makan siang.</p>
        <input type="time" value="${S.set.timeMidday || '11:45'}" onchange="S.set.timeMidday=this.value;save()">
      </div>

      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>Ã°Å¸Å’â„¢ Ringkasan Malam (Jam 21:00)</b>
          <input type="checkbox" style="width:auto;margin:0" ${S.set.remindNight ? 'checked' : ''} onchange="S.set.remindNight=this.checked;save()">
        </div>
        <p class="mute" style="margin:4px 0 8px">Rekapitulasi total pengeluaran seharian untuk evaluasi malam.</p>
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
      <p class="mute" style="margin:6px 0">
        Jika dicentang, pembayaran GoPay/BCA/dll yang terdeteksi akan langsung dicatat tanpa meminta konfirmasi manual.
      </p>
      <button class="b alt" onclick="openNotifListenerSettings()">Pengaturan Akses Notifikasi Android</button>
    </div>

    <h2>Pembaruan Aplikasi (GitHub)</h2>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>Versi Terpasang</span>
        <b>v${APP_VERSION}</b>
      </div>
      <label style="margin-top:10px">Repositori GitHub (opsional)</label>
      <input value="${esc(S.set.githubRepo || '')}" placeholder="username/nama-repo" onchange="S.set.githubRepo=this.value.trim();save()">
      <button class="b sm alt" onclick="checkGithubUpdate(true)">Periksa Pembaruan di GitHub</button>
      <p class="mute" style="font-size:12px;margin-top:6px">Karena dipasang lewat GitHub, pembaruan APK dapat langsung diunduh dari tab Releases repo kamu.</p>
    </div>

    <h2>Cadangan & Data</h2>
    <div class="card">
      <button class="b alt" onclick="exportJson()">Ekspor Cadangan (JSON)</button>
      <button class="b alt" onclick="exportCsv()">Ekspor CSV untuk Excel</button>
      <label style="margin-top:10px">Pulihkan Cadangan JSON</label>
      <input type="file" accept=".json" onchange="importJson(this.files[0])">
    </div>

    <p class="mute" style="text-align:center;margin-top:20px">
      CatatUang v${APP_VERSION} Ã‚Â· 100% Offline & Menjaga Privasi Data Finansialmu.<br>
      <a href="privacy.html" style="color:var(--acc)">Kebijakan Privasi</a>
    </p>
  `;
}

async function askNotifPermission() {
  if (NATIVE && window.Capacitor?.Plugins?.LocalNotifications) {
    try {
      const r = await Capacitor.Plugins.LocalNotifications.requestPermissions();
      alert('Izin notifikasi: ' + r.display);
      scheduleAllReminders();
    } catch (e) {
      alert('Gagal meminta izin: ' + e.message);
    }
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
          id: 999,
          title: 'CatatUang: Pengingat Tes Ã¢Ëœâ‚¬Ã¯Â¸Â',
          body: summaryText(true),
          schedule: { at: new Date(Date.now() + 2500) },
          smallIcon: 'ic_stat_catatuang'
        }]
      });
      alert('Notifikasi tes akan muncul dalam 3 detik.');
    } catch (e) {
      alert('Gagal: ' + e.message);
    }
  } else {
    alert(summaryText(true));
  }
}

// -------------------------------------------------------------
// EKSPOR & IMPOR DATA
// -------------------------------------------------------------
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
  } catch (e) {
    alert('Gagal mengekspor: ' + (e.message || e));
  }
}

function exportJson() {
  dl('catatuang-cadangan.json', JSON.stringify(S, null, 2), 'application/json');
}

function exportCsv() {
  const header = 'Tanggal,Jenis,Kategori,Sumber,Catatan,Jumlah\n';
  const outRows = S.tx.map(t => [t.d, 'Keluar', t.cat, t.wallet || 'Tunai', '"' + (t.note || '').replace(/"/g, '""') + '"', t.amt].join(','));
  const inRows = S.inc.map(i => [i.m, 'Masuk', 'Pemasukan', i.wallet || 'Tunai', '"' + (i.note || '').replace(/"/g, '""') + '"', i.amt].join(','));
  dl('catatuang.csv', header + outRows.concat(inRows).join('\n'), 'text/csv');
}

function importJson(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.tx && !Array.isArray(d.tx)) throw 0;
      S = { ...S, ...d };
      if (!S.set) S.set = {};
      if (!S.detected) S.detected = [];
      save();
      render();
      alert('Cadangan berhasil dipulihkan!');
    } catch (e) {
      alert('File cadangan tidak valid.');
    }
  };
  r.readAsText(f);
}

// -------------------------------------------------------------
// INISIALISASI APLIKASI
// -------------------------------------------------------------
const U = p => new URL(p, location.href).href;
const TESS = { workerPath: U('lib/worker.min.js'), corePath: U('lib/'), langPath: U('lib/lang'), gzip: true };

async function pickPhoto(ev) {
  if (!NATIVE || !window.Capacitor?.Plugins?.Camera) return;
  ev.preventDefault();
  try {
    const p = await Capacitor.Plugins.Camera.getPhoto({
      quality: 85,
      width: 1600,
      resultType: 'dataUrl',
      source: 'PROMPT',
      promptLabelHeader: 'Foto Struk',
      promptLabelPhoto: 'Pilih dari Galeri',
      promptLabelPicture: 'Ambil Foto Baru'
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
        set: { ...S.set, ...(loaded.set || {}) }
      };
    }
  } catch (e) {
    console.error('Database load error:', e);
  }

  // Cek izin notifikasi listener Android
  await checkNotifListenerPermission();
  await fetchCapturedNotifications();

  // Daftarkan listener notifikasi realtime jika ada
  if (NATIVE && NotifPlugin) {
    try {
      NotifPlugin.addListener('notificationReceived', data => {
        if (data) processCapturedNotification(data);
      });
    } catch (e) {}
  }

  // Jadwalkan pengingat siang dan malam
  scheduleAllReminders();

  // Pasang listener saat aplikasi dibuka kembali dari background
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkNotifListenerPermission();
      fetchCapturedNotifications();
      scheduleAllReminders();
    }
  });

  render();

  // Otomatis cek update jika terhubung ke internet
  if (navigator.onLine) {
    checkGithubUpdate(false);
  }
}

init();






function openUpdateLink(url){ try{ if(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()){ if(window.Capacitor.Plugins && window.Capacitor.Plugins.Browser){ window.Capacitor.Plugins.Browser.open({url:url}).catch(function(){}); return; } } }catch(e){} try{ window.open(url,'_system'); return; }catch(e){} window.location.href=url; }


function showSnack(msg, actionLabel, actionFn){ var sb=document.getElementById('snackbar'); if(!sb)return; sb.innerHTML='<span>'+esc(msg)+'</span>'+(actionLabel?'<button>'+esc(actionLabel)+'</button>':''); if(actionLabel && typeof actionFn==='function'){ var btn=sb.querySelector('button'); if(btn){ btn.onclick=function(){ try{actionFn();}catch(e){} sb.classList.remove('show'); }; } } sb.classList.add('show'); setTimeout(function(){ sb.classList.remove('show'); }, 4000); }


