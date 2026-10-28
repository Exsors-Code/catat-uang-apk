const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml tidak ditemukan di:', manifestPath);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

// Tambahkan permissions jika belum ada
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

// Tambahkan NotificationService ke dalam tag <application>
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
console.log('Berhasil memperbarui AndroidManifest.xml dengan izin dan NotificationService!');
