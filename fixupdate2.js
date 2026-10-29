const fs = require('fs');
const p = 'www/app.js';
let s = fs.readFileSync(p, 'utf8');
const old = "<a href=\"\" class=\"pill\" style=\"background:#fff;color:var(--acc);text-decoration:none;font-weight:700\">Unduh APK</a>";
const neu = "<button class=\"pill\" style=\"background:#fff;color:var(--acc);font-weight:700\" onclick=\"openUpdateLink('')\">Unduh APK</button>";
if (s.indexOf(old) >= 0) {
  s = s.split(old).join(neu);
  fs.writeFileSync(p, s, 'utf8');
  console.log('replaced');
} else {
  console.log('notfound');
}
