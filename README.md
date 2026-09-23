# Notaris Email Backend

Backend Express tanpa database untuk menerima seluruh data pengajuan legalitas,
bukti transfer, serta dokumen KTP dari frontend Legal Company. Setelah lolos
validasi, data dikirim ke email admin dalam bentuk HTML terstruktur dan seluruh
file dilampirkan.

## Fitur

- Tidak menggunakan database.
- Satu endpoint multipart untuk data pengajuan dan semua file.
- Perhitungan ulang harga di backend, termasuk range modal PT.
- Email HTML terstruktur dan lampiran JSON sebagai salinan data mentah.
- Lampiran bukti transfer dan seluruh KTP/dokumen.
- Validasi MIME dan magic bytes untuk JPG, PNG, WEBP, dan PDF.
- Batas ukuran per file dan total upload.
- CORS allowlist, Helmet, rate limit, dan error response konsisten.
- Pencegahan double-submit sementara berdasarkan `requestId`.
- File hanya disimpan sementara, lalu dihapus setelah email selesai dikirim.

## Persyaratan

- Node.js 20 atau lebih baru. Node.js 22 LTS direkomendasikan.
- Satu akun Gmail khusus sebagai pengirim.
- App Password Gmail, bukan password login Gmail biasa.
- Email penerima/admin dapat memakai akun yang sudah ada.

## Setup Gmail

1. Login ke akun Gmail khusus pengirim.
2. Aktifkan Verifikasi 2 Langkah.
3. Buka pengaturan App Password pada akun Google.
4. Buat App Password untuk aplikasi backend.
5. Salin 16 karakter yang diberikan Google ke `SMTP_PASS` tanpa spasi.
6. Jangan memasukkan `.env` ke Git dan jangan menyimpan kredensial di frontend.

Jadi, akun Gmail baru yang perlu disiapkan cukup **satu akun pengirim**. Nilai
`MAIL_TO` boleh memakai email admin/notaris yang sudah ada.

## Instalasi

```bash
unzip notaris-email-backend.zip
cd notaris-email-backend
npm install
cp .env.example .env
```

Untuk Windows PowerShell, salin environment dengan:

```powershell
Copy-Item .env.example .env
```

Isi minimal bagian berikut di `.env`:

```env
FRONTEND_ORIGINS=http://localhost:5173
SMTP_USER=akun-pengirim@gmail.com
SMTP_PASS=app_password_16_karakter_tanpa_spasi
MAIL_TO=email-admin-atau-notaris@gmail.com
```

Jalankan backend:

```bash
npm run dev
```

Backend aktif pada `http://localhost:5000`.

Periksa health endpoint:

```bash
curl http://localhost:5000/health
```

## Endpoint utama

```http
POST /api/v1/submissions/payment-confirmation
Content-Type: multipart/form-data
```

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `payload` | JSON string | `requestId`, seluruh `formData`, dan data pembayaran |
| `fileManifest` | JSON string | Pemetaan setiap file pada field `documents` |
| `paymentProof` | File | Satu bukti transfer |
| `documents` | File[] | Seluruh dokumen/KTP pengguna |

Jangan memasang header `Content-Type` secara manual dari browser karena boundary
multipart akan dibuat otomatis oleh `FormData`.

## Integrasi frontend

Contoh service siap pakai tersedia pada:

```text
examples/paymentSubmission.js
```

Panduan perubahan `PaymentPage.jsx` tersedia pada:

```text
docs/frontend-integration.md
```

## Pengujian

```bash
npm test
npm run check
```

Pengujian email memakai transport JSON sehingga tidak mengirim email sungguhan.

Untuk mencoba server tanpa Gmail:

```env
MAIL_TRANSPORT=json
MAIL_TO=admin@example.com
VERIFY_SMTP_ON_STARTUP=false
```

## Batas upload bawaan

- Maksimal 5 MB per file.
- Maksimal 15 MB untuk seluruh lampiran.
- Maksimal 25 dokumen ditambah satu bukti transfer.

Batas total 15 MB dipilih agar ukuran email tetap lebih aman setelah attachment
di-encode oleh layanan email.

## Menjalankan dengan Docker

Pastikan `package-lock.json` tersedia, lalu jalankan:

```bash
docker build -t notaris-email-backend .
docker run --env-file .env -p 5000:5000 notaris-email-backend
```

## Catatan penting tanpa database

- Email menjadi arsip utama pengajuan.
- Pencegahan duplikasi hanya tersimpan di memori dan hilang ketika server restart.
- Jika proses server berhenti sebelum email berhasil dikirim, pengajuan perlu
  dikirim ulang.
- File upload tidak disimpan permanen di server.
- Untuk volume tinggi atau kebutuhan tracking status, tambahkan database dan
  object storage pada tahap berikutnya.
