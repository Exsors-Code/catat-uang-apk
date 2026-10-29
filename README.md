# CatatUang untuk Android (v1.3)

Aplikasi pencatat keuangan Android mandiri berbasis Capacitor. **100% Offline, privat, dan tanpa pihak ketiga**. Semua data keuangan dan model OCR tersimpan aman di perangkatmu.

## Fitur Utama

1. **Deteksi Notifikasi Bank & E-Wallet Otomatis (Native Android)**
   - Membaca notifikasi dari: **GoPay, OVO, DANA, ShopeePay, BCA, SeaBank, Bank Jago, Mandiri, BRI, BNI, Jenius**, dll.
   - Mengambil: nominal, merchant, waktu (dari timestamp notifikasi), kategori otomatis.
   - Tab **Deteksi** dengan konfirmasi 1-tap atau mode *Simpan Otomatis*.
   - Filter package ketat, cegah duplikat, top-up tidak dihitung sebagai income.

2. **Pengingat Rutin Harian (Siang & Malam)**
   - Pengingat siang & ringkasan malam (jam bisa diatur).

3. **OCR Struk Offline (Tesseract.js WASM)**
   - Foto struk → baca total & kategori tanpa internet.

4. **Anggaran**
   - Anggaran total bulanan + **anggaran per kategori**.

5. **Pembaruan dari GitHub (In-App Updater)**
   - Cek rilis APK terbaru langsung dari menu Pengaturan.

6. **Desain Modern Fintech**
   - Dark / Light mode, navigasi bawah, kontras tinggi.

7. **Cadangan**
   - Ekspor/impor JSON & CSV. Restore wajib konfirmasi.

---

## Kenapa APK Baru Harus Uninstall? (Dan Cara Agar Tidak Perlu)

Android **hanya** mengizinkan update (timpa) aplikasi jika:

| Syarat | Keterangan |
|--------|------------|
| Package name sama | `app.catatuang.mobile` (sudah sama) |
| **Tanda tangan (signature) sama** | Keystore yang sama harus dipakai di setiap build |
| versionCode naik | Sudah otomatis dari nomor run GitHub Actions |

### Penyebab paling sering harus uninstall

1. **Belum set secret keystore** → GitHub Actions membangun APK **Debug**.
   - Debug key beda tiap mesin/runner → Android menganggap aplikasi **berbeda**.
2. Kamu pernah pasang APK **debug**, lalu unduh APK **release** (atau sebaliknya).
3. Keystore diganti di tengah jalan.

### Solusi permanen (sekali setup)

1. Buat keystore di komputer (sekali saja):

```bash
keytool -genkey -v -keystore catatuang.keystore -alias catatuang -keyalg RSA -keysize 2048 -validity 10000
```

2. Encode ke base64:

```bash
# Linux / macOS
base64 -w0 catatuang.keystore > keystore.b64

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("catatuang.keystore")) | Set-Content keystore.b64
```

3. Di GitHub repo → **Settings → Secrets and variables → Actions**, buat 4 secret:

| Secret | Isi |
|--------|-----|
| `KEYSTORE_BASE64` | isi file `keystore.b64` |
| `KEYSTORE_PASSWORD` | password keystore |
| `KEY_ALIAS` | `catatuang` (atau alias yang kamu pakai) |
| `KEY_PASSWORD` | password alias |

4. Push ke `main` → Actions akan build **Release** yang ditandatangani keystore yang sama.
5. **Sekali** uninstall APK debug lama (kalau masih terpasang), lalu pasang APK release dari Releases.
6. Mulai saat itu, setiap update APK **bisa langsung ditimpa** tanpa hapus data.

> Simpan file `.keystore` dan password-nya di tempat aman. Kalau hilang, update berikutnya akan memaksa uninstall lagi.

---

## Cara Membangun APK Lewat GitHub Actions

1. Buat repositori **publik** di GitHub, upload isi folder ini.
2. (Opsional tapi sangat disarankan) set 4 secret keystore di atas.
3. Tab **Actions** → workflow **Build APK** berjalan otomatis (~5–7 menit).
4. Tab **Releases** → unduh `CatatUang.apk` dari tag `v1.3.0` (atau versi terbaru).

---

## Cara Mengaktifkan Deteksi Notifikasi

1. Buka **CatatUang** → tab **Deteksi** atau **Atur**.
2. Ketuk **Pengaturan Akses Notifikasi Android**.
3. Aktifkan izin untuk **CatatUang**.
4. (Android 13+) izinkan juga notifikasi biasa di pengaturan aplikasi.
5. Disarankan: **Abaikan optimisasi baterai** untuk CatatUang agar listener tidak dimatikan sistem.

---

## Perubahan v1.3

### Dari v1.2 (masih berlaku)
- Tanggal transaksi dari **timestamp notifikasi**
- Filter package bank/e-wallet ketat; top-up bukan income
- Cek duplikat; anggaran per kategori; restore wajib konfirmasi
- Updater semantik; keystore untuk update tanpa uninstall

### Baru di v1.3
- **Dompet**: kelola daftar dompet + saldo awal + saldo berjalan
- **Transfer antar dompet** (tidak dihitung pengeluaran/pemasukan)
- **Transaksi berulang** (tagihan/gaji otomatis tiap tanggal)
- **Cari & filter** di laporan bulanan (teks, kategori, dompet)
- **PIN keamanan** (4–6 digit, kunci saat buka app / dari background)
- **Undo** setelah hapus transaksi/pemasukan/transfer (±8 detik)
- **Kategori kustom** + pembelajaran dari koreksi user
- **Pemasukan lengkap**: tanggal, dompet, bisa diedit
- **OCR** membaca tanggal struk & nama merchant lebih baik
- Onboarding singkat izin notifikasi


---

## Privasi

Semua data (transaksi, foto struk, model OCR) disimpan **hanya di perangkat**. Tidak ada akun, tidak ada server, tidak ada analitik pihak ketiga.
