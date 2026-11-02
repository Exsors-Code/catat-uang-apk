// CatatUang Transactions
function walletNames() {
  return (S.wallets || []).map((w) => w.name);
}

function ensureWallets() {
  const names = walletNames();
  const all = ['Tunai', 'BCA', 'Mandiri', 'BRI', 'BNI', 'SeaBank', 'Bank Jago', 'Jenius', 'GoPay', 'OVO', 'DANA', 'ShopeePay'];
  let changed = false;
  all.forEach((n) => {
    if (!names.includes(n)) {
      S.wallets.push({ name: n, start: 0 });
      changed = true;
    }
  });
  if (changed) save();
}

function catList() {
  const set = new Set(['Semua']);
  (S.tx || []).forEach((t) => set.add(t.cat || 'Lainnya'));
  (S.inc || []).forEach((i) => set.add(i.cat || 'Pemasukan'));
  return [...set];
}

function catMap() {
  const m = { ...DEFAULT_CATS };
  (S.customCats || []).forEach((c) => {
    if (c && !m[c]) m[c] = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  });
  return m;
}

function predictCat(text) {
  const t = String(text || '').toLowerCase();
  // Pembelajaran dari koreksi pengguna: cocokkan kata kunci yang sudah dipakai sebelum
  const learn = S.catLearn || {};
  for (const key of Object.keys(learn)) {
    if (key && t.includes(key)) return learn[key];
  }
  const m = catMap();
  for (const k of Object.keys(m)) {
    if (k === 'Lainnya') continue;
    if (m[k].test(text)) return k;
  }
  return 'Lainnya';
}

function learnCat(text, cat) {
  if (!text || !cat || cat === 'Lainnya') return;
  const key = String(text).toLowerCase().trim();
  if (!key) return;
  S.catLearn = S.catLearn || {};
  S.catLearn[key] = cat;
  save();
}

function monthOut(m) {
  return (S.tx || []).filter((t) => (t.d || '').startsWith(m)).reduce((a, t) => a + (+t.amt || 0), 0);
}

function monthIn(m) {
  return (S.inc || []).filter((i) => (i.m === m || (i.d || '').slice(0, 7) === m)).reduce((a, i) => a + (+i.amt || 0), 0);
}

function sumDay(k) {
  let total = 0;
  (S.tx || []).forEach((t) => {
    if ((t.d || '').startsWith(k)) total += (+t.amt || 0);
  });
  return { total };
}

function addTx(amt, note, cat, wallet, d, img) {
  const item = { id: uid(), d: d || today(), amt: +amt || 0, note: note || '', cat: cat || 'Lainnya', wallet: wallet || 'Tunai', img: img || null };
  S.tx.unshift(item);
  pushUndo('tx', item);
  save();
  render();
}

function addInc(amt, note, cat, wallet, d, m) {
  const item = { id: uid(), d: d || today(), m: m || (d || '').slice(0, 7), amt: +amt || 0, note: note || '', cat: cat || 'Pemasukan', wallet: wallet || 'Tunai' };
  S.inc.unshift(item);
  pushUndo('inc', item);
  save();
  render();
}

function addTransfer(from, to, amt, note, d) {
  const item = { id: uid(), d: d || today(), from, to, amt: +amt || 0, note: note || '' };
  S.transfers.unshift(item);
  pushUndo('transfer', item);
  save();
  render();
}

function removeTx(id) {
  const i = (S.tx || []).findIndex((t) => t.id === id);
  if (i < 0) return;
  const item = S.tx.splice(i, 1)[0];
  pushUndo('tx', item);
  save();
  render();
  if (typeof showUndo === 'function') showUndo('tx', item);
}

function removeInc(id) {
  const i = (S.inc || []).findIndex((t) => t.id === id);
  if (i < 0) return;
  const item = S.inc.splice(i, 1)[0];
  pushUndo('inc', item);
  save();
  render();
  if (typeof showUndo === 'function') showUndo('inc', item);
}

function removeTransfer(id) {
  const i = (S.transfers || []).findIndex((t) => t.id === id);
  if (i < 0) return;
  const item = S.transfers.splice(i, 1)[0];
  pushUndo('transfer', item);
  save();
  render();
  if (typeof showUndo === 'function') showUndo('transfer', item);
}

function editTx(id, fields) {
  const t = (S.tx || []).find((x) => x.id === id);
  if (!t) return false;
  Object.assign(t, fields);
  if (fields.amt !== undefined) t.amt = +t.amt || 0;
  if (fields.d) t.d = fields.d;
  save();
  render();
  return true;
}

function editInc(id, fields) {
  const i = (S.inc || []).find((x) => x.id === id);
  if (!i) return false;
  Object.assign(i, fields);
  if (fields.amt !== undefined) i.amt = +i.amt || 0;
  if (fields.d) i.d = fields.d;
  if (fields.d && !i.m) i.m = fields.d.slice(0, 7);
  save();
  render();
  return true;
}

function editTransfer(id, fields) {
  const t = (S.transfers || []).find((x) => x.id === id);
  if (!t) return false;
  Object.assign(t, fields);
  if (fields.amt !== undefined) t.amt = +t.amt || 0;
  if (fields.d) t.d = fields.d;
  save();
  render();
  return true;
}

function applyRecurring() {
  let changed = false;
  const m = today().slice(0, 7);
  (S.recurring || []).forEach((r) => {
    if (!r) return;
    const lastDay = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
    const day = Math.min(+r.dayOfMonth || 1, lastDay);
    const dStr = m + '-' + String(day).padStart(2, '0');
    if (dStr > today()) return;
    if (r.lastApplied === m) return;
    if (r.type === 'in') {
      const exists = (S.inc || []).some((i) => i.recurringId === r.id && ((i.m === m) || ((i.d || '').startsWith(m))));
      if (!exists) {
        S.inc.push({ id: uid(), m: m, d: dStr, amt: +r.amt || 0, note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', recurringId: r.id });
        changed = true;
      }
    } else {
      const exists = (S.tx || []).some((t) => t.recurringId === r.id && (t.d || '').startsWith(m));
      if (!exists) {
        S.tx.push({ id: uid(), d: dStr, amt: +r.amt || 0, cat: r.cat || 'Tagihan', note: r.note || 'Rutin', wallet: r.wallet || 'Tunai', img: null, recurringId: r.id });
        changed = true;
      }
    }
    r.lastApplied = m;
  });
  if (changed) save();
}

function addGoal(name, target, saved, deadline) {
  const item = {
    id: uid(),
    name: name || '',
    target: +target || 0,
    saved: +saved || 0,
    deadline: deadline || '',
    createdAt: new Date().toISOString(),
  };
  S.goals.unshift(item);
  pushUndo('goal', item);
  save();
  render();
  return item;
}

function removeGoal(id) {
  const i = (S.goals || []).findIndex((g) => g.id === id);
  if (i < 0) return;
  const item = S.goals.splice(i, 1)[0];
  pushUndo('goal', item);
  save();
  render();
  if (typeof showUndo === 'function') showUndo('goal', item);
}

function updateGoal(id, fields) {
  const g = (S.goals || []).find((x) => x.id === id);
  if (!g) return false;
  Object.assign(g, fields);
  if (fields.target !== undefined) g.target = +g.target || 0;
  if (fields.saved !== undefined) g.saved = +g.saved || 0;
  save();
  render();
  return true;
}