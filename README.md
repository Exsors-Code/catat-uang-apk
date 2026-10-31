# CatatUang untuk Android (v1.4.0)

Aplikasi pencatat keuangan Android mandiri berbasis Capacitor. **100% Offline, privat, dan tanpa pihak ketiga**. Semua data keuangan dan model OCR tersimpan aman di perangkatmu.

## Fitur Utama

1. **Deteksi Notifikasi Bank & E-Wallet Otomatis (Native Android)**
   - Membaca notifikasi dari: **GoPay, OVO, DANA, ShopeePay, BCA, SeaBank, Bank Jago, Mandiri, BRI, BNI, Jenius**, dll.
   - Mengambil: nominal, merchant, waktu (dari timestamp notifikasi), kategori otomatis.
   - Tab **Deteksi** dengan konfirmasi 1-tap atau mode *Simpan Otomatis*.
   - Filter package ketat, cegah duplikat, top-up tidak dihitung sebagai income.

2. **Pengamanan PIN (PBKDF2-SHA256)**
   - PIN 4–6 digit dengan hashing PBKDF2-SHA256 (200.000 iterasi)
   - Salt acak untuk setiap PIN
   - Pembatasan percobaan: maksimal 5 percobaan, kunci 15 menit
   - Migrasi otomatis dari PIN lama ke sistem baru

3. **Pengingat Rutin Harian (Siang & Malam)**
   - Pengingat siang & ringkasan malam (jam bisa diatur).

4. **OCR Struk Offline (Tesseract.js WASM)**
   - Foto struk → baca total & kategori tanpa internet.

5. **Anggaran**
   - Anggaran total bulanan + **anggaran per kategori**.

6. **Pembaruan dari GitHub (In-App Updater)**
   - Cek rilis APK terbaru langsung dari menu Pengaturan.
   - Pemeriksaan kompatibilitas versi dan peringatan cadangan data.

7. **Desain Modern Fintech**
   - Dark / Light mode, navigasi bawah, kontras tinggi.
   - Aksesibilitas: aria-label, navigasi keyboard, kontras warna.

8. **Cadangan**
   - Ekspor/impor JSON. Restore wajib konfirmasi.

---

## Cara Instalasi dan Build

### Prasyarat
- Node.js >= 20
- npm
- Android Studio (untuk build APK)

### Langkah Instalasi
```bash
# 1. Clone atau download repositori ini
# 2. Masuk ke folder proyek
cd catatuang-android

# 3. Install dependensi
npm install

# 4. Jalankan pengujian
npm test

# 5. Jalankan lint
npm run lint

# 6. Tambah platform Android (jika belum ada)
npx cap add android

# 7. Patch Android Manifest (izin, NotificationService, dll.)
npm run patch:android

# 8. Build APK
npx cap build android
```

### Build APK untuk Release (dengan tanda tangan)
Untuk agar update APK bisa ditimpa tanpa uninstall, gunakan keystore yang sama:

1. Buat keystore (sekali saja):
```bash
keytool -genkey -v -keystore catatuang.keystore -alias catatuang -keyalg RSA -keysize 2048 -validity 10000
```

2. Encode ke base64 dan set sebagai GitHub Secrets:
   - `KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

3. Push ke `main` → GitHub Actions akan build Release yang ditandatangani.

---

## Cara Mengaktifkan Deteksi Notifikasi

1. Buka **CatatUang** → tab **Deteksi**.
2. Ketuk tombol untuk membuka pengaturan akses notifikasi Android.
3. Aktifkan izin untuk **CatatUang**.
4. (Android 13+) izinkan notifikasi biasa di pengaturan aplikasi.
5. Disarankan: abaikan optimisasi baterai untuk CatatUang.

---

## Privasi

Semua data (transaksi, foto struk, model OCR) disimpan **hanya di perangkat**. Tidak ada akun, tidak ada server, tidak ada analitik pihak ketiga.

---

## Perubahan v1.4.0

Lihat [CHANGELOG.md](CHANGELOG.md) untuk daftar lengkap perubahan.

### Highlight
- **Keamanan PIN**: PBKDF2-SHA256 + salt acak + rate limiting
- **Update APK**: kompatibilitas versi + peringatan cadangan data
- **Notifikasi**: perbaikan race condition, UUID, deduplikasi
- **Kode**: pemisahan modul, error handling terpusat, ESLint/Prettier
- **Pengujian**: 23 test case (`npm test`)
- **Dokumentasi**: CHANGELOG.md, CONTRIBUTING.md, README.md diperbarui

---

## Lisensi

MIT License