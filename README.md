# CatatUang untuk Android (v1.1)

Aplikasi pencatat keuangan Android mandiri berbasis Capacitor. **100% Offline, privat, dan tanpa pihak ketiga**. Semua data keuangan dan model OCR tersimpan aman di perangkatmu.

## Fitur Utama Baru

1. **⚡ Deteksi Notifikasi Bank & E-Wallet Otomatis (Native Android)**
   - Membaca notifikasi transaksi dari aplikasi pembayaran: **GoPay, OVO, DANA, ShopeePay, BCA (myBCA), SeaBank, Bank Jago, Mandiri (Livin'), BRI (BRImo), BNI, Jenius**, dan pembayaran QRIS lainnya.
   - Mengambil data otomatis: **Nominal pengeluaran (Rp)**, **Nama Merchant/Keterangan**, **Waktu kejadian**, dan **Kategori otomatis**.
   - Dilengkapi tab **Deteksi** dengan opsi konfirmasi 1-tap (*Simpan / Abaikan*) atau mode *Simpan Otomatis* tanpa tanya.
   - Berjalan sebagai satu aplikasi mandiri tanpa perlu Tasker atau aplikasi pembantu lainnya.

2. **⏰ Pengingat Rutin Harian (Siang & Malam)**
   - **☀️ Pengingat Siang (Jam 11/12)**: Menampilkan jumlah pengeluaran yang sudah keluar hari ini dan mengingatkanmu untuk mencatat makan siang/jajan.
   - **🌙 Ringkasan Malam (Jam 21:00)**: Evaluasi total pengeluaran seharian beserta rincian per kategori.
   - Jadwal dan jam pengingat dapat diatur atau dimatikan di menu Pengaturan.

3. **📷 OCR Struk Offline (Tesseract.js WASM)**
   - Foto struk belanja (kamera / galeri), aplikasi akan membaca total dan mengelompokkan kategori tanpa perlu koneksi internet.

4. **🚀 Pembaruan Langsung dari GitHub (In-App Updater)**
   - Periksa pembaruan rilis APK terbaru langsung dari menu Pengaturan tanpa harus membuka browser secara manual.

5. **🎨 Desain Modern Fintech**
   - Tampilan bersih, responsif, kontras tinggi, navigasi bawah yang halus, serta dukungan Dark Mode & Light Mode otomatis.

---

## Cara Membangun APK Lewat GitHub Actions

1. Buat repositori **publik** baru di [github.com](https://github.com).
2. Upload semua isi folder ini ke repositori tersebut (pastikan folder `.github`, `resources`, `scripts`, dan `www` terunggah).
3. Buka tab **Actions** di repositori GitHub kamu.
4. Workflow **Build APK** akan berjalan otomatis (membutuhkan waktu sekitar 5–7 menit).
5. Setelah selesai (tanda centang hijau), buka tab **Releases** di repositori, lalu unduh `CatatUang.apk`.
6. Pasang APK tersebut di HP Android kamu.

---

## Cara Mengaktifkan Deteksi Notifikasi di HP

1. Buka aplikasi **CatatUang**.
2. Masuk ke tab **Deteksi** atau **Atur**.
3. Ketuk tombol **⚙️ Buka Pengaturan Izin Android** (Akses Notifikasi).
4. Aktifkan izin untuk **CatatUang**.
5. Selesai! Setiap kali kamu melakukan pembayaran QRIS atau transfer, CatatUang akan menangkap data pembayarannya.

---

## Agar APK Bisa Di-update Tanpa Uninstall (Keystore)

Secara default, jika secret belum diatur, GitHub Actions akan membuat APK Debug. Agar bisa memperbarui aplikasi tanpa perlu menghapus (uninstall) versi lama:
1. Masuk ke GitHub Repo > **Settings** > **Secrets and variables** > **Actions**.
2. Buat 4 Secret:
   - `KEYSTORE_BASE64`: isi file `signing.keystore` yang di-encode ke base64.
   - `KEYSTORE_PASSWORD`: password keystore.
   - `KEY_ALIAS`: alias key.
   - `KEY_PASSWORD`: password alias key.
