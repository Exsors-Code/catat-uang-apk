// CatatUang OCR
const TESS = { workerPath: 'lib/worker.min.js', corePath: 'lib/', langPath: 'lib/lang', gzip: true };

async function scan(blob) {
  if (!blob) return;
  ocrMsg = '';
  render();
  try {
    const worker = await Tesseract.createWorker(['eng', 'ind']);
    const { data } = await worker.recognize(blob);
    await worker.terminate();
    const parsed = parseReceipt(data.text || '');
    if (parsed.amt) {
      draft.amt = String(parsed.amt);
      draft.note = parsed.note;
      draft.cat = parsed.cat;
      draft.d = parsed.d || today();
      ocrMsg = 'OCR: ' + rp(parsed.amt) + ' (' + parsed.cat + ')';
    } else {
      ocrMsg = 'Gagal membaca nominal. Masukkan manual.';
    }
  } catch (e) {
    ocrMsg = 'Gagal membaca teks struk. Ketik jumlah manual, foto tetap tersimpan.';
  }
  render();
}

function nums(line) {
  return (line.match(/\d[\d.,]*\d|\d/g) || []).map((x) => {
    if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return +x.replace(/[.,]/g, '');
    return +x.replace(/[.,]\d{1,2}$/, '').replace(/[.,]/g, '');
  }).filter((n) => n >= 500 && n < 1e8);
}

function parseReceipt(text) {
  const L = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const mx = (re) => {
    let b = 0;
    L.forEach((l) => { if (re(l)) nums(l).forEach((n) => { if (n > b) b = n; }); });
    return b;
  };
  let amt = mx((l) => /total|jumlah|tagihan|grand|netto|amount due/i.test(l) && !/item|qty|diskon|hemat|ppn|pajak|kembali|change|barang/i.test(l));
  if (!amt) {
    const pay = mx((l) => /bayar|tunai|cash|debit|kartu|qris/i.test(l) && !/kembali|change/i.test(l));
    const ch = mx((l) => /kembali|change/i.test(l));
    amt = pay && ch && pay > ch ? pay - ch : pay;
  }
  if (!amt) amt = mx(() => true);

  let cat = predictCat(text);

  let note = '';
  for (const l of L.slice(0, 8)) {
    if (/total|subtotal|tunai|kembali|ppn|pajak|qty|item|rp\.?\s*\d/i.test(l)) continue;
    if (/[a-zA-Z]{3}/.test(l) && l.length >= 3 && l.length <= 40) { note = l; break; }
  }
  if (!note) note = (L.find((l) => /[a-z]{3}/i.test(l)) || '').slice(0, 40);

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