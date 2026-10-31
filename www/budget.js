// CatatUang Budget
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
  const catKeys = Object.keys(budgets).filter((c) => +budgets[c] > 0);
  if (catKeys.length) {
    const spent = {};
    (S.tx || []).filter((t) => (t.d || '').startsWith(m)).forEach((t) => { spent[t.cat] = (spent[t.cat] || 0) + (+t.amt || 0); });
    html += `<div class="card"><div class="mute" style="margin-bottom:8px">Anggaran per Kategori</div>`;
    catKeys.forEach((c) => {
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
  const m = Math.max(...days.map((x) => x.total), 1);
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mute">Pengeluaran 7 Hari Terakhir</span>
        <span class="pill">${rp(days.reduce((a, b) => a + b.total, 0))}</span>
      </div>
      <div class="chart-container">
        ${days.map((x) => `
          <div class="chart-bar-wrap">
            <div class="chart-bar ${x.isToday ? 'active' : ''}" style="height:${Math.max(6, Math.round((x.total / m) * 75))}px"></div>
            <span class="chart-label">${x.label}</span>
          </div>`).join('')}
      </div>
    </div>`;
}