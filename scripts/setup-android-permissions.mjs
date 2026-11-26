import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml');

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_CONNECT',
];

const OVERLAY_SERVICE_DECLARATION = `        <service
            android:name=".DynamicIslandOverlayService"
            android:foregroundServiceType="mediaPlayback"
            android:exported="false" />`;

if (!fs.existsSync(manifestPath)) {
  console.error(
    `[Nocty Android Setup] AndroidManifest.xml tidak ditemukan di: ${manifestPath}\n` +
      'Jalankan "npx cap add android" terlebih dahulu sebelum menjalankan skrip ini.'
  );
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');
const missing = REQUIRED_PERMISSIONS.filter((perm) => !xml.includes(`"${perm}"`));

if (missing.length > 0) {
  const permissionLines = missing
    .map((perm) => `    <uses-permission android:name="${perm}" />`)
    .join('\n');

  const appOpenIndex = xml.indexOf('<application');
  if (appOpenIndex !== -1) {
    xml =
      xml.slice(0, appOpenIndex) +
      `<!-- Nocty Background Audio, Dynamic Island Overlay & Lockscreen Controls Permissions -->\n` +
      `${permissionLines}\n\n    ` +
      xml.slice(appOpenIndex);
  } else {
    xml = xml.replace('</manifest>', `\n${permissionLines}\n</manifest>`);
  }
}

if (!xml.includes('android:usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}

if (!xml.includes('.DynamicIslandOverlayService')) {
  const appCloseIndex = xml.lastIndexOf('</application>');
  if (appCloseIndex !== -1) {
    xml =
      xml.slice(0, appCloseIndex) +
      `\n        <!-- Nocty Native Floating Dynamic Island Overlay & Media Foreground Service -->\n` +
      `${OVERLAY_SERVICE_DECLARATION}\n    ` +
      xml.slice(appCloseIndex);
  }
}

fs.writeFileSync(manifestPath, xml, 'utf8');

console.log('[Nocty Android Setup] Permission & Service berhasil diverifikasi di AndroidManifest.xml:');
for (const perm of REQUIRED_PERMISSIONS) {
  console.log(`  ✓ ${perm}`);
}
console.log('  ✓ Service: .DynamicIslandOverlayService (foregroundServiceType="mediaPlayback")');
