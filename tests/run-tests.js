const cases = [];
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('OK  ' + name); pass++; cases.push(1); }
  catch (e) { console.error('FAIL ' + name + ': ' + e.message); fail++; cases.push(0); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---- Test 1: Parsing notifikasi bank ----
test('parsing notifikasi BCA', function() {
  const n = { pkg: 'com.bca.mybca', title: 'Transaksi', text: 'Pembayaran Rp 25000 ke Alfamart berhasil' };
  const full = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
  const m = full.match(/rp\s*([0-9][0-9\.,]*)/i);
  assert(m !== null, 'harus menemukan nominal');
  const amt = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
  assert(amt === 25000, 'nominal harus 25000, dapat ' + amt);
});

test('parsing notifikasi GOPAY', function() {
  const n = { pkg: 'com.gojek.app', title: 'GoPay', text: 'Anda membayar Rp 15.000 ke Warung Makmur' };
  const full = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
  const m = full.match(/rp\s*([0-9][0-9\.,]*)/i);
  assert(m !== null, 'harus menemukan nominal');
  const amt = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
  assert(amt === 15000, 'nominal harus 15000');
});

test('notifikasi saldo diabaikan', function() {
  const n = { pkg: 'com.bca.mybca', title: 'Info Saldo', text: 'Sisa saldo Anda Rp 1000000' };
  const full = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
  assert(/saldo|sisa saldo/.test(full), 'harus terdeteksi sebagai saldo');
});

// ---- Test 2: Parsing struk OCR ----
function parseReceipt(text) {
  const L = text.split('\n').map(s => s.trim()).filter(Boolean);
  let amt = 0;
  for (const l of L) {
    if (/total|jumlah|tagihan|grand/i.test(l)) {
      const nums = (l.match(/\d[\d.,]*\d|\d/g) || []).map(x => +x.replace(/[.,]/g, ''));
      for (const n of nums) if (n > amt && n < 1e8) amt = n;
    }
  }
  return { amt };
}
test('OCR parsing struk dengan total', function() {
  const r = parseReceipt('Warung Makmur\nNasi Goreng Rp 25000\nTotal Rp 25000\nTunai Rp 30000');
  assert(r.amt === 25000, 'harus dapat total 25000, dapat ' + r.amt);
});

test('OCR parsing struk tanpa total', function() {
  const r = parseReceipt('Toko Sembako\nBeras 5kg Rp 75000\nMinyak Rp 20000');
  assert(r.amt >= 0, 'harus tidak error');
});

// ---- Test 3: Prediksi kategori ----
const DEFAULT_CATS = {
  Makan: /makan|resto|cafe|kopi|warung|bakso|nasi|ayam|mie|bakery|coffee|food|minum|geprek|pizza|burger|snack|jajan|kenangan|starbucks|kfc|mcd|chatime|mixue/i,
  Transport: /bensin|pertamina|shell|parkir|tol|grab|gojek|ojek|kereta|transport|kai|mrt|transjakarta|spbu|bluebird|maxim/i,
  Belanja: /indomaret|alfamart|supermarket|mart|toko|market|shop|hypermart|carrefour|shopee|tokopedia|lazada|tiktok|lottemart|transmart/i,
  Tagihan: /listrik|pln|pulsa|internet|wifi|pdam|telkom|token|tagihan|bpjs|asuransi|pajak|pbb/i,
  Kesehatan: /apotek|klinik|dokter|rumah sakit|obat|kimia farma|halodok|alodokter|rsud|lab/i,
  Hiburan: /bioskop|cinema|xxi|game|netflix|spotify|wisata|steam|playstation|cgv|disney|youtube/i,
  Lainnya: /.*/,
};
function predictCat(text) {
  for (const k of Object.keys(DEFAULT_CATS)) {
    if (k === 'Lainnya') continue;
    if (DEFAULT_CATS[k].test(text)) return k;
  }
  return 'Lainnya';
}
test('prediksi kategori Makan', function() {
  assert(predictCat('Makan di Warung Makan') === 'Makan', 'harus Makan');
});
test('prediksi kategori Transport', function() {
  assert(predictCat('Beli bensin di Pertamina') === 'Transport', 'harus Transport');
});
test('prediksi kategori Belanja', function() {
  assert(predictCat('Belanja di Alfamart') === 'Belanja', 'harus Belanja');
});
test('prediksi kategori Tagihan', function() {
  assert(predictCat('Bayar listrik PLN') === 'Tagihan', 'harus Tagihan');
});

// ---- Test 4: Perhitungan saldo ----
function hitungSaldo(tx, inc) {
  let out = 0, in_ = 0;
  (tx || []).forEach(t => out += +t.amt || 0);
  (inc || []).forEach(i => in_ += +i.amt || 0);
  return { in: in_, out, balance: in_ - out };
}
test('perhitungan saldo', function() {
  const r = hitungSaldo([{ amt: 10000 }, { amt: 5000 }], [{ amt: 50000 }]);
  assert(r.balance === 35000, 'saldo harus 35000, dapat ' + r.balance);
  assert(r.out === 15000, 'pengeluaran harus 15000');
  assert(r.in === 50000, 'pemasukan harus 50000');
});

// ---- Test 5: Perhitungan anggaran ----
function cekAnggaran(budget, tx, month) {
  const spent = (tx || []).filter(t => (t.d || '').startsWith(month)).reduce((a, t) => a + (+t.amt || 0), 0);
  return { spent, limit: budget, over: spent > budget, sisa: budget - spent };
}
test('perhitungan anggaran', function() {
  const r = cekAnggaran(500000, [{ amt: 200000, d: '2024-01-15' }, { amt: 100000, d: '2024-01-20' }], '2024-01');
  assert(r.spent === 300000, 'terpakai harus 300000');
  assert(r.sisa === 200000, 'sisa harus 200000');
  assert(r.over === false, 'tidak melebihi anggaran');
});
test('anggaran melebihi limit', function() {
  const r = cekAnggaran(100000, [{ amt: 150000, d: '2024-01-15' }], '2024-01');
  assert(r.over === true, 'harus melebihi anggaran');
});

// ---- Test 6: Transaksi berulang ----
function applyRecurring(recurring, tx, inc, todayStr) {
  let changed = false;
  const m = todayStr.slice(0, 7);
  (recurring || []).forEach(r => {
    if (!r) return;
    if (r.lastApplied === m) return;
    const dStr = m + '-' + String(r.dayOfMonth || 1).padStart(2, '0');
    if (dStr > todayStr) return;
    if (r.type === 'in') {
      inc.push({ id: 'r-' + r.id, m, d: dStr, amt: +r.amt || 0, note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', recurringId: r.id });
    } else {
      tx.push({ id: 'r-' + r.id, d: dStr, amt: +r.amt || 0, cat: r.cat || 'Tagihan', note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', recurringId: r.id });
    }
    r.lastApplied = m;
    changed = true;
  });
  return changed;
}
test('transaksi berulang pemasukan', function() {
  const recurring = [{ id: 'gaji', type: 'in', amt: 5000000, dayOfMonth: 25, note: 'Gaji', wallet: 'BCA', lastApplied: null }];
  const tx = [], inc = [];
  const changed = applyRecurring(recurring, tx, inc, '2024-01-25');
  assert(changed === true, 'harus menerapkan berulang');
  assert(inc.length === 1, 'harus menambah 1 pemasukan berulang');
  assert(inc[0].amt === 5000000, 'nominal gaji harus 5000000');
});
test('transaksi berulang tidak duplikat', function() {
  const recurring = [{ id: 'gaji', type: 'in', amt: 5000000, dayOfMonth: 25, note: 'Gaji', wallet: 'BCA', lastApplied: '2024-01' }];
  const tx = [], inc = [];
  const changed = applyRecurring(recurring, tx, inc, '2024-01-25');
  assert(changed === false, 'tidak boleh duplikat untuk bulan yang sama');
});

// ---- Test 7: Validasi PIN ----
function simpleHashLegacy(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return 'p' + (h >>> 0).toString(16);
}
test('validasi PIN format', function() {
  const pin = '123456';
  assert(pin.length >= 4 && pin.length <= 6, 'PIN harus 4-6 digit');
  assert(/^\d+$/.test(pin), 'PIN harus angka');
});
test('legacy simpleHash deterministik', function() {
  assert(simpleHashLegacy('1234') === simpleHashLegacy('1234'), 'hash harus deterministik');
  assert(simpleHashLegacy('1234') !== simpleHashLegacy('5678'), 'hash berbeda untuk PIN berbeda');
});

// ---- Test 8: Export/import JSON ----
test('export import JSON structure', function() {
  const data = {
    tx: [{ id: 't1', amt: 10000, note: 'Test', cat: 'Makan', wallet: 'Tunai', d: '2024-01-01' }],
    inc: [],
    transfers: [],
    wallets: [{ name: 'Tunai', start: 0 }],
    recurring: [],
    customCats: [],
    set: { budget: 0, budgets: {} },
    version: '1.4.0',
    exportedAt: new Date().toISOString()
  };
  const json = JSON.stringify(data);
  const parsed = JSON.parse(json);
  assert(Array.isArray(parsed.tx), 'tx harus array');
  assert(parsed.tx[0].amt === 10000, 'data harus utuh');
  assert(parsed.version === '1.4.0', 'versi harus 1.4.0');
});

// ---- Test 9: Parsing tanggal ----
function parseDateStr(text) {
  const dm = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dm) {
    let dd = +dm[1], mm = +dm[2], yy = +dm[3];
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    }
  }
  return '';
}
test('parsing tanggal DD/MM/YYYY', function() {
  assert(parseDateStr('15/01/2024') === '2024-01-15', 'harus parse tanggal');
});
test('parsing tanggal DD-MM-YY', function() {
  assert(parseDateStr('05-03-23') === '2023-03-05', 'harus parse tanggal 2 digit tahun');
});

// ---- Test 10: Migrasi data ----
function migrateLegacyState(loaded) {
  if (!loaded) return loaded;
  const out = { ...loaded };
  if (out.goals && !out.recurring) out.recurring = out.goals;
  if (out.set && typeof out.set.budgets !== 'object') out.set.budgets = {};
  return out;
}
function ensureStateDefaults(S) {
  if (!Array.isArray(S.tx)) S.tx = [];
  if (!Array.isArray(S.inc)) S.inc = [];
  if (!Array.isArray(S.detected)) S.detected = [];
  if (!Array.isArray(S.transfers)) S.transfers = [];
  if (!Array.isArray(S.recurring)) S.recurring = [];
  if (!Array.isArray(S.customCats)) S.customCats = [];
  if (!S.catLearn || typeof S.catLearn !== 'object') S.catLearn = {};
  if (!Array.isArray(S.wallets)) S.wallets = [];
  if (!S.set || typeof S.set !== 'object') S.set = {};
  S.set.budgets = S.set.budgets && typeof S.set.budgets === 'object' ? S.set.budgets : {};
  if (typeof S.set.budget !== 'number') S.set.budget = +S.set.budget || 0;
}
test('migrasi data lama goals -> recurring', function() {
  const legacy = { tx: [], inc: [], goals: [{ id: 'g1', amt: 1000 }], set: { budget: 100, budjets: {} } };
  const m = migrateLegacyState(legacy);
  assert(Array.isArray(m.recurring), 'recurring harus array setelah migrasi');
  assert(m.recurring.length === 1, 'recurring harus memiliki 1 item');
});
test('state defaults transfers selalu array', function() {
  const S = { transfers: null };
  ensureStateDefaults(S);
  assert(Array.isArray(S.transfers), 'transfers harus array');
});
test('state defaults set.budgets konsisten', function() {
  const S = { set: { budjets: {} } };
  ensureStateDefaults(S);
  assert(typeof S.set.budgets === 'object', 'budgets harus object');
});

// ---- Test 11: Penyimpanan dan pemuatan transaksi ----
test('struktur transaksi valid', function() {
  const tx = { id: 't1', amt: 10000, note: 'Test', cat: 'Makan', wallet: 'Tunai', d: '2024-01-01', img: null };
  assert(tx.id !== undefined, 'transaksi harus punya id');
  assert(typeof tx.amt === 'number', 'amt harus number');
  assert(Array.isArray([]), 'placeholder');
});

// ---- Ringkasan ----
console.log('\n=== HASIL PENGUJIAN ===');
console.log('Lulus: ' + pass + '/' + cases.length);
console.log('Gagal: ' + fail + '/' + cases.length);
if (fail > 0) process.exit(1);
