# CatatUang untuk Android (v1.2)

Aplikasi pencatat keuangan Android mandiri berbasis Capacitor 6. 100% Offline dan Privat. Semua data disimpan di perangkat.

## Fitur Utama
- Catatan pengeluaran/pemasukan/transfer antar-dompet
- Deteksi notifikasi bank dan e-wallet (daftar putih, fingerprint duplikasi)
- OCR struk offline (Tesseract.js)
- Anggaran per kategori dan total
- Banyak dompet, kategori fleksibel
- Transaksi berulang, target tabungan, laporan lengkap
- Backup/restore dengan validasi dan skema versi
- Kunci aplikasi (PIN/biometrik)
- Pembaruan dari GitHub Releases (numerik, buka lewat browser eksternal)

## Build
Folder android/ tidak disertakan. Workflow GitHub Actions akan membuatnya via npx cap add android, menyalin resources/ dan menjalankan scripts/patch-android.js.

