// CatatUang build pipeline
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, c) { fs.writeFileSync(p, c, 'utf8'); }

// 1. Baca versi dari utils.js (APP_VERSION)
const utilsJs = read(path.join(WWW, 'utils.js'));
const verMatch = utilsJs.match(/APP_VERSION\s*=\s*'([^']+)'/);
const APP_VERSION = verMatch ? verMatch[1] : '1.4.0';
console.log('Versi aplikasi: ' + APP_VERSION);

// 2. Validasi struktur file www yang diperlukan
const requiredFiles = ['db.js', 'utils.js', 'state.js', 'pin.js', 'transactions.js', 'budget.js', 'notifications.js', 'ocr.js', 'update.js', 'ui.js', 'app.js'];
for (const f of requiredFiles) {
  if (!fs.existsSync(path.join(WWW, f))) {
    console.error('File wajib hilang: ' + f);
    process.exit(1);
  }
}

console.log('Build step selesai. Jalankan npx cap sync android untuk sinkronisasi.');
console.log('Build APK: npx cap build android');
