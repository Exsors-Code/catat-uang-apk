// CatatUang UI - Rendering & DOM helpers

function navHtml() {
  return `
<nav id="nav" style="position:fixed;bottom:0;left:0;right:0;height:72px;background:var(--bg-card);border-top:1px solid var(--line);z-index:100;display:flex;justify-content:center;gap:18px;padding:8px 4px">
  <button class="nav-btn ${tab==='home'?'active':''}" onclick="setTab('home')" aria-label="Beranda">🏠 Home</button>
  <button class="nav-btn ${tab==='detect'?'active':''}" onclick="setTab('detect')" aria-label="Deteksi Notifikasi">📥 Deteksi</button>
  <button class="nav-btn ${tab==='add'?'active':''}" onclick="setTab('add')" aria-label="Tambah Transaksi">➕ Tambah</button>
  <button class="nav-btn ${tab==='month'?'active':''}" onclick="setTab('month')" aria-label="Laporan Bulanan">📊 Laporan</button>
  <button class="nav-btn ${tab==='settings'?'active':''}" onclick="setTab('settings')" aria-label="Pengaturan">⚙️ Pengaturan</button>
</nav>`;
}

function detectHtml() {
  const list = (S.detected || []).map((n, i) => `<div class="notif-item"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${esc(n.pkg||'-')}</span><span class="mute">${dateFromTs(n.time)}</span></div><div style="font-weight:600">${esc(n.title||'-')}</div><div style="color:var(--ink-secondary);font-size:13px">${esc(n.text||'')}</div><div style="display:flex;gap:6px;margin-top:8px"><button class="pill" style="background:var(--acc);color:#fff" onclick="confirmDetected(${i})">Konfirm</button><button class="pill" onclick="S.detected.splice(${i},1);save();render()">Hapus</button></div></div>`).join('');
  const autoBtn = S.set.autoSave ? '<button class="pill" style="background:var(--inn);color:#fff" onclick="toggleAutoSave()">Simpan Otomatis: ON</button>' : '<button class="pill" onclick="toggleAutoSave()">Simpan Otomatis: OFF</button>';
  return `<div class="card"><h2 style="font-size:16px;margin-bottom:8px">Deteksi Notifikasi</h2><div style="margin-bottom:12px">${autoBtn}<button class="pill" onclick="fetchCapturedNotifications()">Segarkan</button></div>${notifListenerGranted ? '<span class="mute" style="color:var(--inn)">● Izin notifikasi aktif</span>' : '<span class="mute" style="color:var(--out)">● Izin notifikasi belum aktif</span>'}<div style="margin-top:10px">${list||'<div class="mute">Tidak ada notifikasi terdeteksi</div>'}</div></div>`;
}

function addHtml() {
  const catHtml = Object.keys(DEFAULT_CATS).map(c => `<button class="cat-chip${draft.cat===c?' active':''}" onclick="setDraftCat('${esc(c)}')">${esc(c)}</button>`).join('');
  const walletsHtml = (S.wallets || []).map(w => `<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('');
  return `<div class="card"><h2 style="font-size:16px;margin-bottom:12px">Tambah Pengeluaran</h2><div style="display:flex;gap:8px;margin-bottom:10px;align-items:center"><input type="number" id="add-amt" placeholder="Jumlah" value="${esc(draft.amt)}" oninput="draft.amt=this.value" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink);font-size:16px"><select id="add-wallet" onchange="draft.wallet=this.value" style="padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink);font-size:14px">${walletsHtml}</select></div><input type="text" id="add-note" placeholder="Keterangan" value="${esc(draft.note)}" oninput="draft.note=this.value" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink);font-size:16px;margin-bottom:10px"><input type="date" id="add-date" value="${esc(draft.d||today())}" onchange="draft.d=this.value" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink);font-size:16px;margin-bottom:10px"><div style="margin-bottom:8px"><span class="mute">Kategori</span></div><div class="cat-chips">${catHtml}</div><div style="margin-top:10px"><button class="pill" style="background:var(--acc);color:#fff;width:100%;padding:14px;font-weight:700;font-size:16px" onclick="saveDraft()">Simpan</button></div></div>${ocrMsg?'<div class="card"><div class="mute" style="color:var(--warn)">'+esc(ocrMsg)+'</div></div>':''}`;
}

function monthHtml() {
  const m = viewMonth;
  const txs = (S.tx || []).filter(t => (t.d||'').startsWith(m));
  const incs = (S.inc || []).filter(i => (i.m||(i.d||'')).startsWith(m));
  const trans = (S.transfers || []).filter(t => (t.d||'').startsWith(m));
  let rows = '';
  txs.forEach(t => { rows += `<tr><td>${esc(t.d)}</td><td>${esc(t.note||'-')}</td><td>${esc(t.cat)}</td><td class="out" style="text-align:right">-${rp(t.amt)}</td><td>${esc(t.wallet||'Tunai')}</td><td><button class="pill" style="background:var(--out);color:#fff;font-size:11px;padding:2px 6px" onclick="removeTx('${esc(t.id)}')">Hapus</button></td></tr>`; });
  incs.forEach(i => { rows += `<tr><td>${esc(i.d)}</td><td>${esc(i.note||'-')}</td><td>${esc(i.cat||'Pemasukan')}</td><td class="inn" style="text-align:right">+${rp(i.amt)}</td><td>${esc(i.wallet||'Tunai')}</td><td><button class="pill" style="background:var(--out);color:#fff;font-size:11px;padding:2px 6px" onclick="removeInc('${esc(i.id)}')">Hapus</button></td></tr>`; });
  trans.forEach(t => { rows += `<tr><td>${esc(t.d)}</td><td>${esc(t.note||'-')}</td><td>Transfer</td><td class="mute" style="text-align:right">↔ ${rp(t.amt)}</td><td>${esc(t.from)}→${esc(t.to)}</td><td><button class="pill" style="background:var(--out);color:#fff;font-size:11px;padding:2px 6px" onclick="removeTransfer('${esc(t.id)}')">Hapus</button></td></tr>`; });
  const totalOut = txs.reduce((a,t)=>a+(+t.amt||0),0);
  const totalIn = incs.reduce((a,i)=>a+(+i.amt||0),0);
  return `<div class="card"><h2 style="font-size:16px;margin-bottom:8px">Laporan ${m}</h2><div style="margin-bottom:12px"><input type="month" id="view-month" value="${m}" onchange="viewMonth=this.value;render()" style="padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink)"></div><div style="display:flex;gap:12px;margin-bottom:10px"><div style="flex:1;background:var(--bg-card-subtle);padding:12px;border-radius:12px;text-align:center"><span class="mute" style="display:block">Pemasukan</span><span style="color:var(--inn);font-size:18px;font-weight:700">${rp(totalIn)}</span></div><div style="flex:1;background:var(--bg-card-subtle);padding:12px;border-radius:12px;text-align:center"><span class="mute" style="display:block">Pengeluaran</span><span style="color:var(--out);font-size:18px;font-weight:700">${rp(totalOut)}</span></div></div><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="border-bottom:1px solid var(--line)"><th style="text-align:left;padding:8px">Tanggal</th><th style="text-align:left;padding:8px">Keterangan</th><th style="text-align:left;padding:8px">Kategori</th><th style="text-align:right;padding:8px">Jumlah</th><th style="text-align:left;padding:8px">Dompet</th><th style="text-align:right;padding:8px"></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="mute" style="text-align:center;padding:16px">Tidak ada data</td></tr>'}</tbody></table></div>`;
}

function settingsHtml() {
  const pinState = S.set.pinHash ? 'PIN terpasang' : 'Belum ada PIN';
  const autoBtn = S.set.autoSave ? 'ON' : 'OFF';
  return `<div class="card"><h2 style="font-size:16px;margin-bottom:8px">Pengaturan</h2><div style="margin-bottom:10px"><span class="mute">PIN Keamanan</span>: ${esc(pinState)}</div><button class="pill" style="margin-bottom:8px" onclick="openPinSetup()">${S.set.pinHash ? 'Ubah/Hapus PIN' : 'Atur PIN'}</button><div style="margin-bottom:10px"><span class="mute">Simpan Otomatis Deteksi</span>: ${autoBtn}</div><button class="pill" style="margin-bottom:8px" onclick="toggleAutoSave()">${S.set.autoSave ? 'Matikan' : 'Aktifkan'} Simpan Otomatis</button><div style="margin-bottom:10px"><span class="mute">Anggaran Bulanan</span>: ${rp(+S.set.budget||0)}</div><input type="number" id="set-budget" value="${esc(+S.set.budget||0)}" onchange="S.set.budget=+this.value;save();render()" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-card);color:var(--ink);margin-bottom:10px"><div style="margin-bottom:10px"><span class="mute">Backup Terakhir</span>: ${S.set.lastBackupAt||'Belum'}</div><button class="pill" style="margin-bottom:8px" onclick="exportData()">Ekspor JSON</button><button class="pill" style="margin-bottom:8px" onclick="importData()">Impor JSON</button><div style="margin-bottom:10px"><span class="mute">Versi</span>: ${APP_VERSION}</div><button class="pill" style="margin-bottom:8px" onclick="checkGithubUpdate()">Cek Update</button>${updateInfo?'<div style="margin-top:8px"><span class="mute">Update tersedia:</span> '+esc(updateInfo.tag)+'<br><button class="pill" style="background:var(--acc);color:#fff" onclick="openUpdateLink()">Unduh APK</button></div>':''}</div>`;
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!unlocked && needsLock()) { app.innerHTML = lockScreenHtml(); return; }
  let body = '';
  if (tab === 'home') body = homeHtml();
  else if (tab === 'detect') body = detectHtml();
  else if (tab === 'add') body = addHtml();
  else if (tab === 'month') body = monthHtml();
  else if (tab === 'settings') body = settingsHtml();
  app.innerHTML = navHtml() + body;
}

function setTab(t) { tab = t; render(); }

function saveDraft() {
  const amt = +draft.amt || 0;
  if (!amt) { showError('Masukkan jumlah'); return; }
  addTx(amt, draft.note, draft.cat, draft.wallet, draft.d, draft.img);
  draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
  setTab('home');
}

function setDraftCat(c) { draft.cat = c; render(); }

function updatePinDots() {
  const dots = document.getElementById('pin-dots');
  if (!dots) return;
  dots.innerHTML = '<span></span>'.repeat(pinInput.length);
  const err = document.getElementById('lock-error');
  if (err) err.textContent = '';
}

function appendPin(d) {
  if (isPinLocked()) return;
  pinInput += d;
  if (pinInput.length >= 4) submitPin();
  updatePinDots();
}

function clearPin() { pinInput = pinInput.slice(0, -1); updatePinDots(); }

function submitPin() {
  const btnErr = document.getElementById('lock-error');
  const btnTimer = document.getElementById('lock-timer');
  if (isPinLocked()) {
    const rem = getPinLockRemaining();
    if (btnTimer) btnTimer.textContent = 'Kunci '+rem+' detik lagi';
    if (btnErr) btnErr.textContent = rem>0 ? 'Terlalu banyak percobaan' : '';
    return;
  }
  verifyPin(pinInput).then(r => {
    if (r.ok) { unlocked = true; pinInput = ''; render(); }
    else { pinInput = ''; updatePinDots(); if (btnErr) btnErr.textContent = 'PIN salah'; setTimeout(() => { if (btnErr) btnErr.textContent = ''; }, 2000); }
  });
}

function openPinSetup() {
  const action = prompt('Pilih: 1=Atur PIN baru, 2=Ubah PIN, 3=Hapus PIN');
  if (action === '1' || action === '2') {
    const p = prompt('Masukkan PIN baru (4-6 digit)');
    if (p) setPin(p).then(() => { showToast('PIN disimpan'); render(); }).catch(e => showError(e.message));
  } else if (action === '3') { removePin(); showToast('PIN dihapus'); render(); }
}

function toggleAutoSave() { S.set.autoSave = !S.set.autoSave; save(); render(); }

function exportData() {
  const data = { tx: S.tx, inc: S.inc, transfers: S.transfers, wallets: S.wallets, recurring: S.recurring, customCats: S.customCats, set: S.set, version: APP_VERSION, exportedAt: new Date().toISOString() };
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'catatuang-backup-'+today()+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    S.set.lastBackupAt = new Date().toISOString(); save(); showToast('Diekspor');
  } catch (e) { showError('Gagal ekspor'); }
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    try {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object') throw new Error('File tidak valid');
      if (Array.isArray(d.tx)) S.tx = d.tx;
      if (Array.isArray(d.inc)) S.inc = d.inc;
      if (Array.isArray(d.transfers)) S.transfers = d.transfers;
      if (Array.isArray(d.wallets)) S.wallets = d.wallets;
      if (Array.isArray(d.recurring)) S.recurring = d.recurring;
      if (Array.isArray(d.customCats)) S.customCats = d.customCats;
      if (d.set && typeof d.set === 'object') S.set = { ...S.set, ...d.set };
      ensureStateDefaults();
      save(); render(); showToast('Diimpor');
    } catch (err) { showError('Gagal mengimpor: '+err.message); }
  };
  input.click();
}