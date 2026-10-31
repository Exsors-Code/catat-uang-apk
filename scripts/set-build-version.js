// Menetapkan versi unik untuk artefak APK di CI tanpa mengubah versi sumber di Git.
const fs = require('fs');
const path = require('path');

const version = String(process.argv[2] || '').trim();
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(version)) {
  console.error('Versi harus berbentuk major.minor.patch.build, contoh: 1.5.0.42');
  process.exit(1);
}

const target = path.resolve(__dirname, '..', 'www', 'utils.js');
const source = fs.readFileSync(target, 'utf8');
const updated = source.replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${version}';`);
if (updated === source) {
  console.error('APP_VERSION tidak ditemukan di www/utils.js');
  process.exit(1);
}
fs.writeFileSync(target, updated, 'utf8');
console.log('Versi APK CI ditetapkan ke ' + version);
