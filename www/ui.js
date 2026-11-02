// CatatUang UI: small template functions isolate presentation from financial logic.
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-7h6v7"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg>',
  budget: '<svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1 1.7-2 1.2-1.4-1a8 8 0 0 1-2 .8l-.5 1.7h-2.3l-.5-1.7a8 8 0 0 1-2-.8l-1.4 1-2-1.2.1-1.7a8 8 0 0 1-1-1.7l-1.5-.6V10l1.5-.6a8 8 0 0 1 1-1.7L5.4 6l2-1.2 1.4 1a8 8 0 0 1 2-.8l.5-1.7h2.3l.5 1.7a8 8 0 0 1 2 .8l1.4-1 2 1.2-.1 1.7a8 8 0 0 1 1 1.7l1.5.6v2.4l-1.5.6a8 8 0 0 1-1 1.7Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>', edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"/></svg>', target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
};
const CATEGORY_ICONS = { Makan: '🍽', Transport: '◉', Belanja: '🛍', Tagihan: '▣', Kesehatan: '✚', Hiburan: '✦', Lainnya: '•', Pemasukan: '↓', Transfer: '↔' };
let addStep = 1;
let reportFilters = { q: '', cat: '', wallet: '', start: '', end: '' };
let biometricPromptActive = false;

function monthName(value) { return new Date(value + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); }
function daysLeft() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(); }
function walletBalances() { return (S.wallets || []).map((wallet) => { const name = wallet.name; const sum = (list) => list.filter((x) => x.wallet === name).reduce((n, x) => n + (+x.amt || 0), 0); const received = (S.transfers || []).filter((x) => x.to === name).reduce((n, x) => n + (+x.amt || 0), 0); const sent = (S.transfers || []).filter((x) => x.from === name).reduce((n, x) => n + (+x.amt || 0), 0); return { name, balance: (+wallet.start || 0) + sum(S.inc || []) - sum(S.tx || []) + received - sent }; }); }
function totalBalance() { return walletBalances().reduce((sum, wallet) => sum + wallet.balance, 0); }
function recentItems() {
  const tx = S.set.showArchived ? [...(S.tx || []), ...(S.archivedTx || [])] : (S.tx || []);
  const inc = S.set.showArchived ? [...(S.inc || []), ...(S.archivedInc || [])] : (S.inc || []);
  const transfers = S.set.showArchived ? [...(S.transfers || []), ...(S.archivedTransfers || [])] : (S.transfers || []);
  return [...tx.map((x) => ({ ...x, type: 'out' })), ...inc.map((x) => ({ ...x, type: 'in' })), ...transfers.map((x) => ({ ...x, type: 'transfer' }))].sort((a, b) => String(b.d).localeCompare(String(a.d)));
}
function pageHeader(title, subtitle, action = '') { return `<header class="page-header"><div><p class="eyebrow">${subtitle}</p><h1>${title}</h1></div>${action}</header>`; }
function navItem(id, label, icon) { const active = tab === id; return `<button class="nav-item ${active ? 'active' : ''}" onclick="setTab('${id}')" aria-label="${label}" aria-current="${active ? 'page' : 'false'}">${icon}<span>${label}</span></button>`; }
function navHtml() { return `<nav class="bottom-nav" aria-label="Navigasi utama">${navItem('home', 'Beranda', ICONS.home)}${navItem('history', 'Riwayat', ICONS.history)}<button class="nav-add" onclick="openAddSheet()" aria-label="Tambah transaksi">${ICONS.plus}</button>${navItem('budget', 'Anggaran', ICONS.budget)}${navItem('settings', 'Pengaturan', ICONS.settings)}</nav>`; }
function emptyState(title, text, actionLabel = '') { return `<section class="empty card"><div class="empty-art">✦</div><h2>${title}</h2><p>${text}</p>${actionLabel ? `<button class="primary-button" onclick="openAddSheet()">${actionLabel}</button>` : ''}</section>`; }
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function savePhoto(file) {
  const dataUrl = await readFileAsDataURL(file);
  const photoId = uid();
  await DB.put('photos', photoId, {
    id: photoId,
    dataUrl,
    name: file.name,
    size: file.size,
    createdAt: new Date().toISOString(),
  });
  return photoId;
}

async function getPhoto(photoId) {
  return await DB.get('photos', photoId);
}

async function viewPhoto(photoId) {
  const photo = await getPhoto(photoId);
  if (!photo) return showError('Foto tidak ditemukan');
  const old = document.getElementById('cu-photo-modal');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'cu-photo-modal';
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100vw';
  el.style.height = '100vh';
  el.style.background = 'rgba(0,0,0,0.9)';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.zIndex = '100';
  el.innerHTML = `
    <button onclick="document.getElementById('cu-photo-modal').remove()" style="position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;z-index:101">&times;</button>
    <img src="${photo.dataUrl}" style="max-width:90vw;max-height:75vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5)">
    <div style="margin-top:10px;color:#fff;font-size:13px">${esc(photo.name || '')} (${Math.round((photo.size || 0) / 1024)} KB)</div>
  `;
  document.body.appendChild(el);
}

function transactionCard(item) { const transfer = item.type === 'transfer'; const income = item.type === 'in'; const typ = transfer ? 'transfer' : income ? 'in' : 'out'; const cat = transfer ? 'Transfer' : (item.cat || (income ? 'Pemasukan' : 'Lainnya')); const title = transfer ? (item.note || `${item.from} ke ${item.to}`) : (item.note || cat); const typeClass = transfer ? 'transfer' : income ? 'income' : ''; const sign = income ? '+' : transfer ? '' : '−'; const photoBtn = item.img ? `<button class="icon-button" onclick="viewPhoto('${esc(item.img)}')" aria-label="Lihat foto struk">📷</button>` : ''; return `<article class="transaction card"><span class="category-icon ${typeClass}">${CATEGORY_ICONS[cat] || '•'}</span><div><div class="transaction-title">${esc(title)}</div><div class="transaction-meta">${esc(item.d || today())} · ${esc(transfer ? `${item.from} → ${item.to}` : item.wallet || 'Tunai')}</div></div><span class="transaction-amount ${income ? 'inn' : transfer ? '' : 'out'}">${sign}${rp(item.amt)}</span><button class="icon-button" onclick="editTransaction('${esc(item.id)}', '${esc(typ)}')" aria-label="Edit">${ICONS.edit}</button>${photoBtn}</article>`; }
function heroHtml() { const month = today().slice(0, 7); return `<section class="hero card"><div class="hero-top"><span>Total saldo</span><span>${monthName(month)}</span></div><div class="hero-amount" data-count="${totalBalance()}">${rp(totalBalance())}</div><div class="summary-row"><div class="summary-item"><span>Pemasukan bulan ini</span><strong class="inn">+${rp(monthIn(month))}</strong></div><div class="summary-item"><span>Pengeluaran bulan ini</span><strong class="out">−${rp(monthOut(month))}</strong></div></div></section>`; }
function budgetOverview() { const limit = +S.set.budget || 0; const spent = monthOut(today().slice(0, 7)); if (!limit) return `<section class="budget-card card"><h3>Belum ada anggaran bulanan</h3><p class="mute">Atur batas pengeluaran agar aplikasi dapat memberi peringatan.</p><button class="secondary-button" onclick="setTab('budget')">Atur anggaran</button></section>`; const percentage = Math.round((spent / limit) * 100); const over = spent > limit; const status = over ? 'over' : percentage >= 80 ? 'warn' : ''; return `<section class="budget-card card"><div class="budget-meta"><h3>Anggaran bulan ini</h3><span>${daysLeft()} hari tersisa</span></div><div class="progress"><i style="width:${Math.min(percentage, 100)}%;background:${over ? 'var(--out)' : percentage >= 80 ? 'var(--gold)' : 'var(--acc)'}"></i></div><div class="budget-meta"><span>${Math.min(percentage, 100)}% terpakai</span><strong class="budget-status ${status}">${over ? `Melebihi ${rp(spent - limit)}` : `Sisa ${rp(limit - spent)}`}</strong></div></section>`; }
function homeHtml() { const items = recentItems().slice(0, 5); return `<div class="screen">${pageHeader('Halo, mari atur uangmu', 'Ringkasan keuangan')}${heroHtml()}<section class="section">${budgetOverview()}</section><section class="section"><div class="section-head"><h2>Transaksi terbaru</h2><button class="text-button" onclick="setTab('history')">Lihat semua</button></div>${items.length ? `<div class="transaction-list">${items.map(transactionCard).join('')}</div>` : emptyState('Belum ada transaksi', 'Mulai catat pemasukan atau pengeluaran pertamamu.', 'Tambah transaksi')}</section></div>`; }
function historyHtml() { const cats = catList().filter((x) => x !== 'Semua'); let list = recentItems(); const q = reportFilters.q.toLowerCase(); if (q) list = list.filter((x) => `${x.note} ${x.cat} ${x.wallet} ${x.from} ${x.to}`.toLowerCase().includes(q)); if (reportFilters.cat) list = list.filter((x) => x.cat === reportFilters.cat); if (reportFilters.wallet) list = list.filter((x) => x.wallet === reportFilters.wallet || x.from === reportFilters.wallet || x.to === reportFilters.wallet); if (reportFilters.start) list = list.filter((x) => (x.d || '') >= reportFilters.start); if (reportFilters.end) list = list.filter((x) => (x.d || '') <= reportFilters.end); return `<div class="screen">${pageHeader('Riwayat transaksi', 'Cari dan pantau aktivitas', '<button class="text-button" onclick="exportCsv()">Ekspor CSV</button><button class="text-button" onclick="cetakPDF()">Cetak / Simpan PDF</button>')}<section class="filter-card card"><input class="search-input" value="${esc(reportFilters.q)}" oninput="setReportFilter('q',this.value)" placeholder="Cari transaksi…" aria-label="Cari transaksi"><div class="filter-row"><select onchange="setReportFilter('cat',this.value)"><option value="">Semua kategori</option>${cats.map((x) => `<option ${reportFilters.cat === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><select onchange="setReportFilter('wallet',this.value)"><option value="">Semua dompet</option>${walletNames().map((x) => `<option ${reportFilters.wallet === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><input type="date" value="${esc(reportFilters.start)}" onchange="setReportFilter('start',this.value)" aria-label="Tanggal mulai"><input type="date" value="${esc(reportFilters.end)}" onchange="setReportFilter('end',this.value)" aria-label="Tanggal akhir"></div></section><div class="report-summary"><section class="metric card"><span>Pemasukan</span><strong class="inn">+${rp(monthIn(viewMonth))}</strong></section><section class="metric card"><span>Pengeluaran</span><strong class="out">−${rp(monthOut(viewMonth))}</strong></section></div>${list.length ? `<div class="transaction-list">${list.slice(0, 100).map(transactionCard).join('')}</div>` : emptyState('Tidak ada hasil', 'Coba ubah pencarian atau filter yang digunakan.')}</div>`; }
function chartHtml() { const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - (6 - i)); const key = date.toISOString().slice(0, 10); return { label: date.toLocaleDateString('id-ID', { weekday: 'narrow' }), total: sumDay(key).total }; }); const max = Math.max(...days.map((x) => x.total), 1); return `<div class="bar-chart">${days.map((x) => `<div class="bar-wrap"><i class="bar" style="height:${Math.max(5, Math.round((x.total / max) * 100))}%"></i><span>${x.label}</span></div>`).join('')}</div>`; }
function monthlyChartHtml() { const now = new Date(); const months = []; for (let i = 11; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7)); const data = months.map((m) => ({ m, in: monthIn(m), out: monthOut(m) })); const max = Math.max(1, ...data.map((x) => Math.max(x.in, x.out))); const rows = data.map((x) => { const inW = Math.round((x.in / max) * 100); const outW = Math.round((x.out / max) * 100); return `<div style="margin:10px 0"><div style="font-size:12px;margin-bottom:2px">${monthName(x.m)}</div><div style="height:8px;background:#eee;border-radius:4px;overflow:hidden;margin-bottom:2px"><div class="bar" style="width:${inW}%;background:var(--acc);height:100%"></div></div><div style="font-size:10px;color:var(--acc)">+${rp(x.in)}</div><div style="height:8px;background:#eee;border-radius:4px;overflow:hidden;margin-bottom:8px"><div class="bar" style="width:${outW}%;background:var(--out);height:100%"></div></div><div style="font-size:10px;color:var(--out)">−${rp(x.out)}</div></div>`; }).join(''); return `<section class="section"><div class="section-head"><h2>Grafik 12 Bulan</h2></div><div class="card budget-card" style="padding:12px">${rows}</div></section>`; }
function budgetHtml() { return `<div class="screen">${pageHeader('Anggaran & dompet', 'Kendalikan kebiasaan belanja')}${budgetOverview()}<section class="section"><div class="section-head"><h2>Aktivitas 7 hari</h2></div><div class="card budget-card">${chartHtml()}</div></section>${monthlyChartHtml()}<section class="section"><div class="section-head"><h2>Saldo per dompet</h2></div><div class="card setting-list">${walletBalances().map((x) => `<div class="setting-row"><div><strong>${esc(x.name)}</strong><p>Saldo saat ini</p></div><strong>${rp(x.balance)}</strong></div>`).join('')}</div></section><section class="section"><div class="card budget-card"><div class="field"><label for="budget-limit">Batas anggaran bulanan</label><input id="budget-limit" type="number" inputmode="numeric" value="${+S.set.budget || ''}" placeholder="Contoh: 5000000"></div><button class="primary-button button-wide" onclick="saveBudgetFromInput()">Simpan anggaran</button></div></section></div>`; }
function goalHtml() { const list = S.goals || []; return `<div class="screen">${pageHeader('Target Tabungan', 'Atur dan pantau target menabung', `<button class="icon-button" onclick="setTab('settings')" aria-label="Tutup">${ICONS.close}</button>`)}<section class="card setting-list">${list.length ? `<div class="section-head"><span class="mute">${list.length} target aktif</span><button class="primary-button button-wide" onclick="addGoalPrompt()">Tambah target</button></div>${list.map((g) => { const pct = Math.min(100, Math.round((g.saved / g.target) * 100)); const done = g.saved >= g.target; return `<article class="transaction card"><div><div class="transaction-title">${esc(g.name)}</div><div class="transaction-meta">${rp(g.saved)} / ${rp(g.target)} · ${pct}% ${done ? '✓ Tercapai' : ''}</div></div><div class="bar" style="height:8px;margin-top:6px"><i style="width:${pct}%;background:${done ? 'var(--acc)' : 'var(--gold)'}"></i></div><div style="display:flex;justify-content:space-between;margin-top:6px"><button class="text-button" onclick="editGoalPrompt('${esc(g.id)}')">Ubah</button><button class="text-button" onclick="removeGoalUI('${esc(g.id)}')">Hapus</button></div></article>`; }).join('')}` : `<div class="empty card"><div class="empty-art">✦</div><h2>Belum ada target</h2><p class="mute">Buat target tabungan pertama untuk memantau kemenangan menabungmu.</p><button class="primary-button button-wide" onclick="addGoalPrompt()">Buat target</button></div>`}</section></div>`; }
function addGoalPrompt() { const name = prompt('Nama target (contoh: Liburan Bali)'); if (!name) return; const target = prompt('Target nominal (Rp)'); if (target === null) return; const saved = prompt('Terjadi sekarang (Rp, kosongkan bila 0)'); if (saved === null) return; addGoal(name, target, saved || 0); showToast('Target dibuat', 'success'); }
function editGoalPrompt(id) { const g = (S.goals || []).find((x) => x.id === id); if (!g) return; const name = prompt('Nama target', g.name); if (name === null) return; const target = prompt('Target nominal (Rp)', g.target); if (target === null) return; const saved = prompt('Terjadi sekarang (Rp)', g.saved); if (saved === null) return; updateGoal(id, { name, target: +target || 0, saved: +saved || 0 }); showToast('Target diperbarui', 'success'); }
function removeGoalUI(id) { if (!confirm('Hapus target ini?')) return; removeGoal(id); showToast('Target dihapus', 'success'); }
function settingsHtml() { const updateAction = updateInfo && updateInfo.compatible ? `<button class="primary-button button-wide" onclick="openUpdateLink()">Unduh update v${esc(updateInfo.tag)}</button>` : '<button class="secondary-button" onclick="checkGithubUpdate()">Periksa pembaruan</button>'; const updateText = updateInfo && updateInfo.compatible ? `Update v${esc(updateInfo.tag)} siap diunduh` : 'Aplikasi akan memeriksa GitHub saat dibuka'; return `<div class="screen">${pageHeader('Pengaturan', 'Privasi dan data')}<section class="card setting-list"><div class="setting-row"><div><strong>PIN keamanan</strong><p>${S.set.pinHash ? 'PIN aktif untuk membuka aplikasi' : 'Belum ada PIN'}</p></div><button class="text-button" onclick="openPinSetup()">${S.set.pinHash ? 'Kelola' : 'Atur'}</button></div><div class="setting-row"><div><strong>Buka dengan biometrik</strong><p>${S.set.biometricEnabled ? 'Sidik jari atau wajah dapat digunakan' : 'Memerlukan PIN aktif'}</p></div><button class="switch ${S.set.biometricEnabled ? 'on' : ''}" onclick="toggleBiometric()" aria-label="Toggle biometrik"><i></i></button></div><div class="setting-row"><div><strong>Lindungi tangkapan layar</strong><p>Blokir screenshot dan pratinjau aplikasi</p></div><button class="switch ${S.set.screenProtection !== false ? 'on' : ''}" onclick="toggleScreenProtection()" aria-label="Toggle perlindungan layar"><i></i></button></div><div class="setting-row"><div><strong>Simpan otomatis</strong><p>Catat hasil notifikasi secara otomatis</p></div><button class="switch ${S.set.autoSave ? 'on' : ''}" onclick="toggleAutoSave()" aria-label="Toggle simpan otomatis"><i></i></button></div><div class="setting-row"><div><strong>Cadangan otomatis</strong><p>Cadang data saat buka aplikasi (harian/mingguan).</p></div><button class="switch ${S.set.autoBackup ? 'on' : ''}" onclick="toggleAutoBackup()" aria-label="Toggle cadangan otomatis"><i></i></button></div><div class="setting-row"><div><strong>Arsip transaksi lama</strong><p>Pindahkan transaksi lebih dari ${S.set.archiveAfterMonths || 12} bulan ke arsip.</p></div><button class="primary-button" onclick="archiveNow()">Arsipkan sekarang</button></div><div class="setting-row"><div><strong>Tampilkan arsip</strong><p>Sertakan transaksi arsip di riwayat.</p></div><button class="switch ${S.set.showArchived ? 'on' : ''}" onclick="toggleArchiveView()" aria-label="Toggle tampilkan arsip"><i></i></button></div><div class="setting-row"><div><strong>Deteksi notifikasi</strong><p>${notifListenerGranted ? 'Izin notifikasi aktif' : 'Belum diberi izin'}</p></div><button class="text-button" onclick="openNotifications()">Buka</button></div><div class="setting-row"><div><strong>Cadangan terakhir</strong><p>${S.set.lastBackupAt ? new Date(S.set.lastBackupAt).toLocaleString('id-ID') : 'Belum pernah cadang'}<br class="mute">Cadangan menyimpan semua transaksi, dompet, anggaran, dan pengaturan ke file JSON di perangkat.</p></div></div><div class="setting-row"><div><strong>Cadangan terenkripsi</strong><p>Amankan file cadangan dengan sandi yang Anda tentukan.</p></div><button class="switch ${S.set.encryptBackup ? 'on' : ''}" onclick="toggleEncryptBackup()" aria-label="Toggle cadangan terenkripsi"><i></i></button></div><div class="setting-row"><div><strong>Target Tabungan</strong><p>Kelola target dan tabungan mu.</p></div><button class="text-button" onclick="setTab('goal')">Buka target</button></div></section><section class="section"><button class="primary-button button-wide" onclick="setTab('goal')">Lola ke halaman Target Tabungan</button></section></section><section class="section"><div class="button-row"><button class="secondary-button" onclick="exportData()">Ekspor JSON</button><button class="secondary-button" onclick="importData()">Impor JSON</button></div></section><section class="section"><div class="card budget-card"><p class="section-label">Versi aplikasi</p><h2>CatatUang ${APP_VERSION}</h2><p class="mute">${updateText}</p><p class="mute">Cadangan terakhir: ${S.set.lastBackupAt ? new Date(S.set.lastBackupAt).toLocaleDateString('id-ID') : 'belum pernah'}</p>${updateAction}</div></section></div>`; }
function notificationHtml() { const list = S.detected || []; const permission = notifListenerGranted ? `<button class="secondary-button" onclick="refreshNotifications()">Segarkan daftar</button>` : `<button class="primary-button" onclick="openNotificationPermission()">Aktifkan akses notifikasi</button>`; return `<div class="screen">${pageHeader('Deteksi notifikasi', 'Tinjau sebelum disimpan', `<button class="icon-button" onclick="setTab('settings')" aria-label="Tutup">${ICONS.close}</button>`)}<section class="card budget-card"><h3>${notifListenerGranted ? 'Akses notifikasi aktif' : 'Akses notifikasi belum aktif'}</h3><p class="mute">Izinkan akses agar transaksi dari bank dan e-wallet dapat terdeteksi otomatis.</p>${permission}</section><section class="section">${list.length ? `<div class="section-head"><span class="mute">${list.length} transaksi terdeteksi</span><button class="text-button" onclick="confirmAllDetected()">Konfirmasi semua</button></div>${list.map((n, index) => `<article class="notification card"><div class="notification-top"><div><div class="notification-title">${esc(n.title || 'Transaksi')}</div><div class="mute">${esc(n.pkg || 'Aplikasi bank')} · ${esc(n.d || dateFromTs(n.time))}</div></div><strong class="out">−${rp(n.amt)}</strong></div><p class="notification-body">${esc(n.text || 'Transaksi terdeteksi dari notifikasi')}</p><div class="notification-actions"><button class="secondary-button" onclick="dismissDetected(${index})">Abaikan</button><button class="primary-button" onclick="confirmDetected(${index})">Konfirmasi</button></div></article>`).join('')}` : emptyState('Belum ada notifikasi', 'Setelah akses aktif, transaksi baru dari aplikasi bank atau e-wallet akan muncul di sini.')}</section></div>`; }
function addSheetHtml() { const cats = Object.keys(DEFAULT_CATS); const scanStatus = ocrMsg ? `<p class="mute" role="status">${esc(ocrMsg)}</p>` : ''; return `<div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Tambah transaksi"><section class="sheet"><div class="sheet-handle"></div><div class="sheet-head"><div><h2>Tambah pengeluaran</h2><span class="step">Langkah ${addStep} dari 2</span></div><button class="icon-button" onclick="closeAddSheet()" aria-label="Tutup">${ICONS.close}</button></div>${addStep === 1 ? `<button class="secondary-button button-wide" onclick="selectReceiptScreenshot()">Scan screenshot / foto struk</button>${scanStatus}<div class="field"><label for="add-amt">Nominal</label><input class="amount-input" id="add-amt" type="number" inputmode="numeric" placeholder="Rp 0" value="${esc(draft.amt)}" oninput="draft.amt=this.value" autofocus></div><div class="quick-amounts"><button class="quick-button" onclick="addQuickAmount(10000)">+10k</button><button class="quick-button" onclick="addQuickAmount(20000)">+20k</button><button class="quick-button" onclick="addQuickAmount(50000)">+50k</button></div><div class="wizard-footer"><button class="secondary-button" onclick="closeAddSheet()">Batal</button><button class="primary-button" onclick="nextAddStep()">Lanjut</button></div>` : `<div class="field"><label for="add-note">Keterangan</label><input id="add-note" type="text" placeholder="Contoh: Makan siang" value="${esc(draft.note)}" oninput="draft.note=this.value"></div><div class="field"><label>Kategori</label><div class="category-chips">${cats.map((cat) => `<button class="chip ${draft.cat === cat ? 'active' : ''}" onclick="setDraftCat('${esc(cat)}')">${CATEGORY_ICONS[cat] || '•'} ${esc(cat)}</button>`).join('')}</div></div><div class="field"><label for="add-wallet">Dompet</label><select id="add-wallet" onchange="draft.wallet=this.value">${walletNames().map((w) => `<option ${draft.wallet === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></div><div class="field"><label for="add-date">Tanggal</label><input id="add-date" type="date" value="${esc(draft.d || today())}" onchange="draft.d=this.value"></div><div class="wizard-footer"><button class="secondary-button" onclick="previousAddStep()">Kembali</button><button class="primary-button" onclick="saveDraft()">Simpan transaksi</button></div>`}</section></div>`; }
function render() { const app = document.getElementById('app'); if (!app) return; if (!unlocked && needsLock()) { app.innerHTML = lockScreenHtml(); requestAnimationFrame(() => { if (S.set.biometricEnabled && !isPinLocked()) unlockWithBiometric(); else document.getElementById('pin-input')?.focus(); }); return; } if (!S.set.onboardingDone) { app.innerHTML = onboardingHtml() + navHtml(); requestAnimationFrame(animateBalances); return; } const content = tab === 'home' ? homeHtml() : tab === 'history' ? historyHtml() : tab === 'budget' ? budgetHtml() : tab === 'settings' ? settingsHtml() : tab === 'goal' ? goalHtml() : notificationHtml(); app.innerHTML = content + navHtml() + (tab === 'add' ? addSheetHtml() : ''); requestAnimationFrame(animateBalances); }
function setTab(next) { tab = next; render(); }
function openAddSheet() { addStep = 1; tab = 'add'; render(); } function closeAddSheet() { tab = 'home'; render(); } function nextAddStep() { if (!(+draft.amt > 0)) return showError('Masukkan nominal transaksi'); addStep = 2; render(); } function previousAddStep() { addStep = 1; render(); }
function addQuickAmount(amount) { draft.amt = String((+draft.amt || 0) + amount); const input = document.getElementById('add-amt'); if (input) input.value = draft.amt; } function saveDraft() { const amt = +draft.amt || 0; if (!amt) return showError('Masukkan nominal'); addTx(amt, draft.note, draft.cat, draft.wallet, draft.d, draft.img); draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() }; tab = 'home'; } function setDraftCat(cat) { draft.cat = cat; render(); } function setReportFilter(key, value) { reportFilters[key] = value; render(); }
function editTransaction(id, type) {
  let item;
  if (type === 'in') item = (S.inc || []).find((x) => x.id === id);
  else if (type === 'transfer') item = (S.transfers || []).find((x) => x.id === id);
  else item = (S.tx || []).find((x) => x.id === id);
  if (!item) return;
  const amt = prompt('Nominal', item.amt);
  if (amt === null) return;
  const note = prompt('Keterangan', item.note || '');
  if (note === null) return;
  const d = prompt('Tanggal (YYYY-MM-DD)', item.d || today());
  if (d === null) return;
  let wallet;
  if (type === 'transfer') wallet = prompt('Dompet asal', item.from || '');
  else wallet = prompt('Dompet', item.wallet || '');
  if (wallet === null) return;
  const fields = { amt: +amt || 0, note: note || '', d: d || today(), wallet: wallet || 'Tunai' };
  let ok = false;
  if (type === 'in') ok = editInc(id, { ...fields, m: fields.d.slice(0, 7) });
  else if (type === 'transfer') ok = editTransfer(id, { from: wallet, to: item.to, ...fields });
  else ok = editTx(id, fields);
  if (!ok) showError('Gagal mengedit transaksi');
}
function showUndo(type, item) {
  const old = document.getElementById('cu-undo');
  if (old) old.remove();
  const label = type === 'inc' ? 'Pemasukan' : type === 'transfer' ? 'Transfer' : 'Transaksi';
  const el = document.createElement('div');
  el.id = 'cu-undo';
  el.className = 'cu-toast cu-toast-info';
  el.style.position = 'fixed';
  el.style.bottom = '20px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '60';
  el.setAttribute('role', 'alert');
  el.innerHTML = `${label} dihapus. <button onclick="undoLast()">Undo</button>`;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
}
function undoLast() {
  const el = document.getElementById('cu-undo');
  if (el) el.remove();
  const u = popUndo();
  if (!u) return showError('Tidak ada yang dapat diubah');
  if (u.type === 'tx') (S.tx || []).unshift(u.item);
  else if (u.type === 'inc') (S.inc || []).unshift(u.item);
  else if (u.type === 'transfer') (S.transfers || []).unshift(u.item);
  else if (u.type === 'detected') (S.detected || []).unshift(u.item);
  save();
  render();
  showToast('Diubah', 'success');
}
function saveBudgetFromInput() { const input = document.getElementById('budget-limit'); S.set.budget = +(input ? input.value : S.set.budget) || 0; save(); showToast('Anggaran disimpan', 'success'); render(); } function toggleAutoSave() { S.set.autoSave = !S.set.autoSave; save(); render(); } function openNotifications() { tab = 'notifications'; render(); } async function dismissDetected(index) {
  if (!(await confirmWithBiometric())) return;
  const n = (S.detected || [])[index];
  if (!n) return;
  S.detected.splice(index, 1);
  pushUndo('detected', n);
  save();
  render();
  if (typeof showUndo === 'function') showUndo('detected', n);
}
async function openNotificationPermission() { const plugin = window.Capacitor?.Plugins?.CatatUangNotification; if (!plugin) return showError('Fitur ini hanya tersedia pada aplikasi Android'); try { await plugin.openPermissionSettings(); showToast('Aktifkan CatatUang pada halaman akses notifikasi Android'); } catch (error) { showError('Tidak dapat membuka pengaturan notifikasi'); } }
async function refreshNotifications() { await checkNotifListenerPermission(); await fetchCapturedNotifications(); render(); }
async function selectReceiptScreenshot() { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async () => { const file = input.files && input.files[0]; if (!file) return; try { const photoId = await savePhoto(file); draft.img = photoId; showToast('Foto struk tersimpan', 'success'); } catch (e) { showError('Gagal menyimpan foto: ' + e.message); return; } scan(file); }; input.click(); }
async function toggleBiometric() { if (!S.set.pinHash) return showError('Atur PIN terlebih dahulu sebelum mengaktifkan biometrik'); const plugin = window.Capacitor?.Plugins?.CatatUangSecurity; if (!plugin) return showError('Biometrik hanya tersedia pada aplikasi Android'); try { const state = await plugin.isBiometricAvailable(); if (!state.available) return showError('Biometrik tidak didukung perangkat ini'); if (!S.set.biometricEnabled) await plugin.authenticate(); S.set.biometricEnabled = !S.set.biometricEnabled; save(); render(); showToast(S.set.biometricEnabled ? 'Biometrik diaktifkan' : 'Biometrik dimatikan', 'success'); } catch (error) { showError('Biometrik belum dapat digunakan'); } }
async function toggleScreenProtection() { S.set.screenProtection = !S.set.screenProtection; save(); try { await window.Capacitor?.Plugins?.CatatUangSecurity?.setScreenProtection({ enabled: S.set.screenProtection }); } catch (error) { ErrorLog.add('Screen protection toggle failed', error); } render(); }
function confirmAllDetected() { const pending = [...(S.detected || [])]; pending.forEach((n) => addTx(n.amt, (n.title || '').slice(0, 40), predictCat(`${n.title || ''} ${n.text || ''}`), 'Tunai', n.d || dateFromTs(n.time))); S.detected = []; save(); render(); showToast('Semua transaksi disimpan', 'success'); }
function onboardingHtml() { return `<div class="screen"><section class="card setting-list"><h2>Selamat datang di CatatUang</h2><p class="mute">CatatUang 100% offline dan privat. Semua data hanya ada di perangkat Anda.</p><div class="setting-row"><div><strong>Izin Notifikasi (Android 13+)</strong><p>Izinkan CatatUang membaca notifikasi bank/e-wallet agar transaksi terdeteksi otomatis. Buka Pengaturan → Aplikasi → CatatUang → Notifikasi, lalu nyalakan.</p></div><button class="text-button" onclick="openNotificationPermission()">Buka pengaturan notifikasi</button></div><div class="setting-row"><div><strong>Pengecualian Baterai</strong><p>Agar deteksi notifikasi tetap aktif di latar belakang, abaikan optimisasi baterai untuk CatatUang di Pengaturan → Baterai → Pengecualian baterai.</p></div></div><div class="button-row"><button class="primary-button button-wide" onclick="selesaiOnboarding()">Saya mengerti</button></div></section></div>`; }
function selesaiOnboarding() { S.set.onboardingDone = true; save(); render(); }
function animateBalances() { document.querySelectorAll('[data-count]').forEach((element) => { const target = +element.dataset.count || 0; const start = performance.now(); const paint = (now) => { const p = Math.min(1, (now - start) / 420); element.textContent = rp(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(paint); }; requestAnimationFrame(paint); }); }
function openPinSetup() { const action = prompt('Pilih: 1=Atur PIN baru, 2=Ubah PIN, 3=Hapus PIN'); if (action === '1' || action === '2') { const pin = prompt('Masukkan PIN baru (4-6 digit)'); if (pin) setPin(pin).then(() => { showToast('PIN disimpan', 'success'); render(); }).catch((error) => showError(error.message)); } else if (action === '3') { removePin(); showToast('PIN dihapus'); render(); } }
async function exportData() { if (!(await confirmWithBiometric())) return; const data = { tx:S.tx, inc:S.inc, transfers:S.transfers, wallets:S.wallets, recurring:S.recurring, customCats:S.customCats, set:S.set, version:APP_VERSION, exportedAt:new Date().toISOString() }; const json = JSON.stringify(data, null, 2); async function run() { let out = json; let ext = 'json'; let name = `catatuang-backup-${today()}.json`; if (S.set.encryptBackup) { const pw = prompt('Masukkan sandi untuk mengamankan cadangan (ingat sandi ini, tidak dapat direset):'); if (!pw) return showError('Cadangan dibatalkan (sandi diperlukan)'); try { out = await backupEncrypt(json, pw); } catch (e) { return showError('Gagal mengenkripsi cadangan: ' + e.message); } name = `catatuang-backup-${today()}.enc.json`; ext = 'enc.json'; } try { const blob = new Blob([out], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); S.set.lastBackupAt = new Date().toISOString(); save(); showToast('Cadangan berhasil diekspor', 'success'); } catch (error) { showError('Gagal mengekspor data'); } } run(); }
function toggleEncryptBackup() { S.set.encryptBackup = !S.set.encryptBackup; save(); render(); showToast(S.set.encryptBackup ? 'Cadangan terenkripsi diaktifkan' : 'Cadangan terenkripsi dimatikan', 'success'); }
function toggleAutoBackup() { S.set.autoBackup = !S.set.autoBackup; save(); render(); showToast(S.set.autoBackup ? 'Cadangan otomatis diaktifkan' : 'Cadangan otomatis dimatikan', 'success'); }

function toggleArchiveView() { S.set.showArchived = !S.set.showArchived; save(); render(); showToast(S.set.showArchived ? 'Menampilkan transaksi arsip' : 'Menyembunyikan transaksi arsip', 'success'); }

function archiveNow() { const result = archiveOldTransactions(); save(); render(); const total = result.tx + result.inc + result.transfers; showToast(total ? `${total} transaksi dipindahkan ke arsip` : 'Tidak ada transaksi yang diarsipkan', 'success'); }

async function confirmWithBiometric() {
  if (!S.set.biometricEnabled) return true;
  const plugin = window.Capacitor?.Plugins?.CatatUangSecurity;
  if (!plugin) return true;
  try {
    await plugin.authenticate();
    return true;
  } catch (e) {
    showError('Verifikasi biometrik dibatalkan');
    return false;
  }
}

async function checkAutoBackup() {
  if (!S.set.autoBackup) return;
  const now = Date.now();
  const last = +S.set.lastAutoBackupAt || 0;
  const freq = S.set.autoBackupFrequency || 'daily';
  const interval = freq === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  if (now - last < interval) return;
  try {
    const snapshot = {
      tx: S.tx, inc: S.inc, transfers: S.transfers, detected: S.detected,
      goals: S.goals, wallets: S.wallets, recurring: S.recurring,
      customCats: S.customCats, catLearn: S.catLearn, set: S.set,
      version: APP_VERSION,
    };
    await performAutoBackup(snapshot);
    S.set.lastAutoBackupAt = now;
    save();
    showToast('Cadangan otomatis tersimpan', 'success');
  } catch (e) {
    ErrorLog.add('autoBackup failed', e);
  }
}
function exportCsv() { const quote = (value) => `"${String(value || '').replaceAll('"', '""')}"`; const rows = recentItems().map((x) => [x.d, x.type === 'in' ? 'Pemasukan' : x.type === 'transfer' ? 'Transfer' : 'Pengeluaran', x.note || '', x.cat || '', x.wallet || `${x.from || ''} → ${x.to || ''}`, x.amt]); const csv = ['Tanggal,Jenis,Keterangan,Kategori,Dompet,Jumlah', ...rows.map((row) => row.map(quote).join(','))].join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `catatuang-laporan-${today()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast('Laporan CSV berhasil diekspor', 'success'); }

function cetakPDF() { const month = viewMonth; const tx = (S.tx || []).filter((t) => (t.d || '').slice(0, 7) === month); const inc = (S.inc || []).filter((i) => (i.m || (i.d || '').slice(0, 7)) === month); const tr = (S.transfers || []).filter((t) => (t.d || '').slice(0, 7) === month); const out = tx.reduce((a, t) => a + (+t.amt || 0), 0); const inn = inc.reduce((a, i) => a + (+i.amt || 0), 0); const rows = [...tx.map((t) => `<tr><td>${esc(t.d)}</td><td>Pengeluaran</td><td>${esc(t.note)}</td><td>${esc(t.cat)}</td><td class="num">−${rp(t.amt)}</td></tr>`), ...inc.map((i) => `<tr><td>${esc(i.d)}</td><td>Pemasukan</td><td>${esc(i.note)}</td><td>${esc(i.cat)}</td><td class="num">+${rp(i.amt)}</td></tr>`), ...tr.map((t) => `<tr><td>${esc(t.d)}</td><td>Transfer</td><td>${esc(t.note || `${t.from} → ${t.to}`)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td class="num">${rp(t.amt)}</td></tr>`)].join(''); const html = `<html><head><meta charset="utf-8"><title>Laporan ${monthName(month)}</title><style>body{font-family:sans-serif;padding:16px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}td.num{text-align:right}footer{margin-top:16px;font-size:12px;color:#666}@media print{body{padding:0}}</style></head><body><h2>Laporan Keuangan Bulan ${monthName(month)}</h2><p>CatatUang — Dicetak ${new Date().toLocaleString('id-ID')}</p><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Kategori/Dompet</th><th class="num">Jumlah</th></tr></thead><tbody>${rows}</tbody></table><footer><strong>Total Pemasukan:</strong> +${rp(inn)} &nbsp;|&nbsp; <strong>Total Pengeluaran:</strong> −${rp(out)} &nbsp;|&nbsp; <strong>Saldo:</strong> ${rp(inn - out)}</footer><script>window.print();</script></body></html>`; const w = window.open('', '_blank'); w.document.write(html); w.document.close(); showToast('Buka dialog cetak (pilih "Simpan sebagai PDF")', 'info'); }
function importData() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = async (event) => { if (!(await confirmWithBiometric())) return; const file = event.target.files[0]; if (!file) return; if (!confirm('Impor data akan menimpa data saat ini. Pastikan Anda telah mengekspor cadangan. Lanjutkan?')) return; try { const text = await file.text(); let data = null; if (isEncryptedBackup(text)) { const pw = prompt('File cadangan terenkripsi. Masukkan sandi untuk membuka:'); if (!pw) return showError('Impor dibatalkan'); try { const decrypted = await backupDecrypt(text, pw); data = JSON.parse(decrypted); } catch (e) { throw new Error('Sandi salah atau file rusak: ' + e.message); } } else { data = JSON.parse(text); } if (!data || typeof data !== 'object') throw new Error('File tidak valid'); ['tx','inc','transfers','wallets','recurring','customCats'].forEach((key) => { if (Array.isArray(data[key])) S[key] = data[key]; }); if (data.set && typeof data.set === 'object') S.set = { ...S.set, ...data.set }; ensureStateDefaults(); save(); render(); showToast('Data berhasil diimpor', 'success'); } catch (error) { showError(`Gagal mengimpor: ${error.message}`); } }; input.click(); }
function lockScreenHtml() { return `<div class="screen"><section class="empty card"><div class="empty-art">⌁</div><p class="eyebrow">CatatUang terlindungi</p><h1>Masukkan PIN</h1><p class="mute">Gunakan PIN bila biometrik tidak tersedia.</p><p id="lock-error" class="out"></p><form onsubmit="submitPin();return false"><div class="field"><label for="pin-input">PIN</label><input id="pin-input" type="tel" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="6" value="${esc(pinInput)}" oninput="handlePinInput(this.value)" autofocus></div><button class="primary-button button-wide" type="submit">Masuk</button></form></section></div>`; }
function handlePinInput(value) { pinInput = String(value || '').replace(/[^0-9]/g, '').slice(0, 6); const input = document.getElementById('pin-input'); if (input && input.value !== pinInput) input.value = pinInput; }
function submitPin() { if (pinInput.length < 4) return showError('PIN harus 4–6 angka'); verifyPin(pinInput).then((result) => { if (result.ok) { unlocked = true; pinInput = ''; biometricPromptActive = false; render(); } else { pinInput = ''; const input = document.getElementById('pin-input'); if (input) { input.value = ''; input.focus(); } const error = document.getElementById('lock-error'); if (error) error.textContent = result.locked ? `Coba lagi dalam ${result.remaining} detik` : 'PIN salah'; } }); }
async function unlockWithBiometric() { if (biometricPromptActive || !S.set.biometricEnabled) return; const plugin = window.Capacitor?.Plugins?.CatatUangSecurity; if (!plugin) return document.getElementById('pin-input')?.focus(); biometricPromptActive = true; try { await plugin.authenticate(); unlocked = true; pinInput = ''; render(); } catch (error) { document.getElementById('pin-input')?.focus(); } finally { biometricPromptActive = false; } }
