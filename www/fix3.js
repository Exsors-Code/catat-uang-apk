const fs = require('fs');
let s = fs.readFileSync('www/app.js','utf8');
s = s.replace('<a href=\"\" class=\"pill\" style=\"background:#fff;color:var(--acc);text-decoration:none;font-weight:700\">Unduh APK</a>', 
              '<button class=\"pill\" style=\"background:#fff;color:var(--acc);font-weight:700\" onclick=\"openUpdateLink(\\'\\')\">Unduh APK</button>');
fs.writeFileSync('www/app.js',s,'utf8');
console.log('done');
