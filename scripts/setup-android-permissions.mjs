import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml');

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_CONNECT',
];

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
      `<!-- Nocty Background Audio, Lockscreen Controls & Bluetooth Headset Permissions -->\n` +
      `${permissionLines}\n\n    ` +
      xml.slice(appOpenIndex);
  } else {
    xml = xml.replace(
      '</manifest>',
      `\n${permissionLines}\n</manifest>`
    );
  }
}

if (!xml.includes('android:usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}

fs.writeFileSync(manifestPath, xml, 'utf8');

console.log('[Nocty Android Setup] Permission berhasil diverifikasi di AndroidManifest.xml:');
for (const perm of REQUIRED_PERMISSIONS) {
  console.log(`  ✓ ${perm}`);
}
