const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml tidak ditemukan di:', manifestPath);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

// Permissions
const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.INTERNET',
  'android.permission.VIBRATE'
];

const permsSnippet = permissions
  .filter(p => !xml.includes(p))
  .map(p => `    <uses-permission android:name="${p}" />`)
  .join('\n');

if (permsSnippet) {
  xml = xml.replace('<application', `${permsSnippet}\n    <application`);
}

// Matikan auto-backup Google agar data keuangan tidak naik ke cloud
if (xml.includes('android:allowBackup="true"')) {
  xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"');
} else if (!xml.includes('android:allowBackup=')) {
  xml = xml.replace('<application', '<application\n        android:allowBackup="false"');
}

// NotificationService
if (!xml.includes('NotificationService')) {
  const serviceSnippet = `
        <service
            android:name=".NotificationService"
            android:label="CatatUang Notification Listener"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>`;

  xml = xml.replace('</application>', serviceSnippet);
}

fs.writeFileSync(manifestPath, xml, 'utf8');
console.log('Berhasil memperbarui AndroidManifest.xml (izin, NotificationService, allowBackup=false)');

// Naikkan versionCode & versionName di build.gradle jika ada
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  const runNumber = process.env.GITHUB_RUN_NUMBER || String(Math.floor(Date.now() / 1000) % 100000);
  const versionName = process.env.APP_VERSION_NAME || '1.2.0';

  if (/versionCode\s+\d+/.test(gradle)) {
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${runNumber}`);
  }
  if (/versionName\s+"[^"]*"/.test(gradle)) {
    gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  }
  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log(`versionCode=${runNumber}, versionName=${versionName}`);
}
