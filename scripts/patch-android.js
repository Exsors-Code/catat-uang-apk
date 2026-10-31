const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const buildGradlePath = path.join(ROOT, 'android', 'app', 'build.gradle');
const packageJsonPath = path.join(ROOT, 'package.json');

let appVersion = '1.4.0';
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  appVersion = pkg.version;
} catch (e) {
  console.warn('Tidak dapat membaca versi dari package.json, gunakan default: ' + appVersion);
}

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml tidak ditemukan di:', manifestPath);
  console.error('Jalankan terlebih dahulu: npx cap add android');
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
  'android.permission.USE_BIOMETRIC'
];

const permsSnippet = permissions
  .filter(p => !xml.includes(p))
  .map(p => '    <uses-permission android:name="' + p + '" />')
  .join('\n');

if (permsSnippet) {
  xml = xml.replace('<application', permsSnippet + '\n    <application');
}

if (xml.includes('android:allowBackup="true"')) {
  xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"');
} else if (!xml.includes('android:allowBackup=')) {
  xml = xml.replace('<application', '<application\n        android:allowBackup="false"');
}

if (!xml.includes('NotificationService')) {
  const serviceSnippet = '\n        <service\n            android:name=".NotificationService"\n            android:label="CatatUang Notification Listener"\n            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.service.notification.NotificationListenerService" />\n            </intent-filter>\n        </service>\n    </application>';
  xml = xml.replace('</application>', serviceSnippet);
}

fs.writeFileSync(manifestPath, xml, 'utf8');
console.log('Berhasil memperbarui AndroidManifest.xml (izin, NotificationService, allowBackup=false)');

if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  const runNumber = process.env.GITHUB_RUN_NUMBER || String(Math.floor(Date.now() / 1000) % 100000);
  const versionName = process.env.APP_VERSION_NAME || appVersion;

  if (/versionCode\s+\d+/.test(gradle)) {
    gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + runNumber);
  }
  if (/versionName\s+"[^"]*"/.test(gradle)) {
    gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "' + versionName + '"');
  }
  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log('versionCode=' + runNumber + ', versionName=' + versionName);
}
