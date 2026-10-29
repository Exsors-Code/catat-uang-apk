const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');

  const permissions = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.INTERNET',
    'android.permission.VIBRATE',
    'android.permission.USE_BIOMETRIC',
    'android.permission.USE_FINGERPRINT'
  ];

  const permsSnippet = permissions
    .filter(p => !xml.includes(p))
    .map(p => '    <uses-permission android:name="' + p + '" />')
    .join('\n');

  if (permsSnippet) {
    xml = xml.replace('<application', permsSnippet + '\n    <application');
  }

  if (!xml.includes('NotificationService')) {
    const serviceSnippet = '\n        <service\n            android:name=".NotificationService"\n            android:label="CatatUang Notification Listener"\n            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.service.notification.NotificationListenerService" />\n            </intent-filter>\n        </service>';
    xml = xml.replace('</application>', serviceSnippet + '\n    </application>');
  }

  xml = xml.replace('<application', '<application android:allowBackup="false" android:fullBackupContent="false" android:usesCleartextTraffic="false"');

  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log('Berhasil memperbarui AndroidManifest.xml');
} else {
  console.log('AndroidManifest.xml belum dibuat, akan diperbarui saat cap add android');
}

const xmlDir = path.join(__dirname, '../android/app/src/main/res/xml');
try {
  if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
  const backupRules = '<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n    <exclude domain="sharedpref" path="catatuang_captured_notifs.xml"/>\n    <exclude domain="database" path="."/>\n    <exclude domain="file" path="."/>\n</full-backup-content>';
  fs.writeFileSync(path.join(xmlDir, 'backup_rules.xml'), backupRules);
} catch (e) {}
