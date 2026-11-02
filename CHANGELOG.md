# CHANGELOG - CatatUang Android

## v1.5.0 (2026-11-02)

### Perbaikan Bug
- Regex parsing notifikasi bank (nominal tidak tertangkap karena escape spasi yang ganda)
- Transaksi berulang tidak lagi memicu penyimpanan berulang saat tidak ada item baru

### Deteksi Notifikasi
- Batasi paket aplikasi ke bank/e-wallet terdaftar (GoPay, OVO, DANA, ShopeePay, BCA, SeaBank, Bank Jago, Mandiri, BRI, BNI, Jenius, dll.)
- Abaikan notifikasi saldo/sisa saldo
- Gaji terdeteksi sebagai pemasukan; top-up bukan pemasukan
- Cek duplikasi terhadap transaksi/pemasukan yang sudah disimpan

### Data & Cadangan
- Restore/impor wajib konfirmasi sebelum menimpa data
- Tampilkan waktu cadangan terakhir di pengaturan
- Opsi cadangan terenkripsi (AES-GCM + PBKDF2, sandi tidak disimpan)
- Nonaktifkan Android auto backup (AndroidManifest `allowBackup="false"`)
- Pisah IndexedDB per store: meta, tx, inc, detected, transfers, goals, photos + migrasi legacy

### Transaksi & Kategori
- Edit pemasukan dan pengeluaran (nominal, tanggal, dompet, catatan)
- Undo setelah hapus transaksi/pemasukan/transfer/deteksi notifikasi
- Kategori kustom + pembelajaran dari koreksi (catLearn)
- Deteksi notifikasi cek duplikasi vs tx/inc tersimpan

### UX
- Onboarding pertama kali: izin notifikasi Android 13+, panduan pengecualian baterai
- PIN: PBKDF2-SHA256 200.000 iterasi, salt, rate limit 5 percobaan/15 menit, biometrik, perlindungan layar

## v1.4.0 (2026-10-30)

### Keamanan PIN
- Ganti hashing PIN dari DJB2 (simpleHash) ke PBKDF2-SHA256 dengan 200.000 iterasi
- Setiap PIN menggunakan salt acak unik
- Pembatasan percobaan PIN: maksimal 5 percobaan, kunci 15 menit
- Jeda minimal 2 detik antar percobaan PIN
- Migrasi otomatis PIN lama (simpleHash) ke PBKDF2 saat verifikasi berhasil
- simpleHash hanya digunakan untuk migrasi, tidak untuk PIN baru

### Perlindungan Data dan Update APK
- Pemeriksaan kompatibilitas versi sebelum mengunduh APK baru
- Peringatan kehilangan data sebelum pembaruan APK
- Sistem migrasi data otomatis saat struktur penyimpanan berubah
- Data pengguna tetap terlokal di perangkat (offline-first)

### NotificationService
- Race condition diperbaiki dengan sinkronisasi blok (synchronized block) di Java
- UUID untuk identifikasi notifikasi, mencegah ID duplikat
- Mekanisme deduplikasi notifikasi di sisi Java dan JavaScript
- Sinkronisasi antara NotificationService dan NotificationPlugin diperbaiki

### Pemisahan Struktur Kode
- app.js yang tadinya monolitik sudah dipecah menjadi modul terpisah:
  - state.js - manajemen state dan migrasi
  - transactions.js - transaksi, pemasukan, transfer, prediksi kategori
  - budget.js - perhitungan anggaran dan grafik
  - notifications.js - deteksi notifikasi bank
  - ocr.js - OCR struk offline
  - pin.js - keamanan PIN
  - ui.js - rendering dan DOM
  - utils.js - utilitas, error logging, debounce
  - db.js - IndexedDB wrapper
  - update.js - pembaruan APK dari GitHub
  - app.js - titik masuk (entry point)

### Konsistensi Data
- S.transfers selalu memiliki default array
- S.set.budgets selalu objek konsisten
- Penanganan null/undefined di semua perhitungan
- Validasi tipe data pada saldo, transaksi, anggaran, laporan

### Error Handling
- Tidak ada catch kosong (catch {}) yang tersisa
- Sistem pencatatan error terpusat (ErrorLog)
- Notifikasi ke pengguna saat terjadi kesalahan
- Fallback saat inisialisasi aplikasi gagal
- Global error handler untuk error dan unhandled rejection

### Build Configuration
- package.json diperlengkapi dengan scripts test, lint, format, build, patch:android
- ESLint dan Prettier dikonfigurasi
- Node.js >=20 ditentukan sebagai engines
- Dependensi tidak bersentuhan

### Capacitor Configuration
- capacitor.config.json lengkap dengan konfigurasi Android dan plugin
- Kamera dan Local Notifications terkonfigurasi
- Tidak ada server development di build production
- Aplikasi dapat berjalan offline

### Build Pipeline
- cmp.js dan fixupdate2.js dihapus (logika sudah diintegrasi ke build.js)
- patch-android.js diperbaiki dengan path yang benar
- Setiap build menghasilkan APK yang konsisten

### Testing
- 23 pengujian mencakup: parsing notifikasi bank, OCR, prediksi kategori,
  saldo, anggaran, transaksi berulang, PIN, export/import JSON, tanggal,
  migrasi data, dan struktur transaksi
- Jalankan: `npm test`

### UI dan Aksesibilitas
- aria-label pada tombol dan elemen interaktif
- Navigasi keyboard dengan focus-visible
- Teks penting (nomor rekening) dapat disalin
- Kontras warna diperbaiki untuk light mode
- Dark mode dan light mode dipertahankan
- Responsif pada berbagai ukuran layar Android

### Dokumentasi
- CHANGELOG.md (berkas ini)
- CONTRIBUTING.md - panduan pengembangan
- README.md - diperbarui untuk v1.4.0
- Konfigurasi ESLint dan Prettier

## v1.3.0 (sebelumnya)
- Dompet: kelola daftar dompet + saldo awal
- Transfer antar dompet
- Transaksi berulang (tagihan/gaji otomatis)
- PIN keamanan (4-6 digit)
- Undo setelah hapus transaksi
- Kategori kustom + pembelajaran
- OCR membaca tanggal struk

## v1.2.0 (sebelumnya)
- Deteksi notifikasi bank & e-wallet
- Anggaran per kategori
- Pembaruan dari GitHub (In-App Updater)
- Ekspor/impor JSON & CSV