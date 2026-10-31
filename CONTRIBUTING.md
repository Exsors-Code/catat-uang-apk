# CONTRIBUTING - CatatUang Android

Panduan untuk berkontribusi pada proyek CatatUang Android.

## Struktur Folder

```
catatuang-android/
├── www/                 # Kode sumber aplikasi (web)
│   ├── app.js           # Titik masuk (entry point)
│   ├── state.js         # Manajemen state dan migrasi
│   ├── transactions.js  # Transaksi, pemasukan, transfer
│   ├── budget.js        # Anggaran dan grafik
│   ├── notifications.js # Deteksi notifikasi bank
│   ├── ocr.js           # OCR struk offline
│   ├── pin.js           # Keamanan PIN
│   ├── ui.js            # Rendering dan DOM
│   ├── utils.js         # Utilitas, error logging, debounce
│   ├── db.js            # IndexedDB wrapper
│   ├── update.js        # Pembaruan APK
│   ├── style.css        # Styling
│   ├── index.html       # HTML utama
│   └── lib/             # Library Tesseract.js (OCR)
├── resources/android/   # Kode native Android
│   ├── MainActivity.java
│   ├── NotificationPlugin.java
│   └── NotificationService.java
├── scripts/             # Skrip build dan patching
│   ├── build.js
│   └── patch-android.js
├── tests/               # Pengujian
│   └── run-tests.js
├── capacitor.config.json
├── package.json
├── .eslintrc.json
├── .prettierrc
├── README.md
├── CHANGELOG.md
└── CONTRIBUTING.md
```

## Cara Mengembangkan

### Prasyarat
- Node.js >= 20
- npm
- Android Studio (untuk build APK)

### Instalasi
```bash
npm install
```

### Menjalankan Pengujian
```bash
npm test
```

### Lint
```bash
npm run lint
```

### Format Kode
```bash
npm run format
```

### Build APK
```bash
npx cap add android       # Jika belum ada platform android
npx cap build android
```

### Patching Android Manifest
```bash
node scripts/patch-android.js
```

## Aturan Kontribusi

1. **Jangan hapus fitur yang sudah berjalan** tanpa alasan teknis yang kuat.
2. **Pertahankan konsep offline-first** - semua data tersimpan secara lokal.
3. **Jangan tambahkan layanan pihak ketiga** yang mengirim data keuangan tanpa persetujuan pengguna.
4. **Jangan membuat kode dummy atau fitur hanya tampilan** tanpa fungsi.
5. **Semua perubahan keamanan PIN harus melalui migrasi yang aman** untuk data pengguna lama.
6. **Tambahkan pengujian** untuk setiap fitur baru.
7. **Jalankan `npm test` dan `npm run lint`** sebelum mengajukan pull request.
8. **Gunakan bahasa Indonesia** untuk komentar dan pesan error di aplikasi.

## Keamanan

- Data keuangan pengguna **tidak boleh** dikirim ke server apapun.
- PIN disimpan dengan PBKDF2-SHA256 + salt acak.
- Jangan menambahkan keystore production ke repositori publik.

## Pelaporan Bug

Buat issue dengan deskripsi:
1. Langkah untuk mereproduksi bug
2. Hasil yang diharapkan
3. Hasil yang sebenarnya
4. Versi aplikasi dan Android