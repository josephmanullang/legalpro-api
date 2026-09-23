# Integrasi dengan frontend Legal Company

Backend tidak dapat menerima object `File` melalui `JSON.stringify`. Karena itu,
semua data dikirim memakai `FormData` (`multipart/form-data`).

## 1. Salin service

Salin `examples/paymentSubmission.js` ke frontend sebagai:

```text
src/services/paymentSubmission.js
```

Tambahkan file `.env` pada frontend:

```env
VITE_API_URL=http://localhost:5000
```

Restart Vite setelah mengubah `.env`.

## 2. Import pada PaymentPage.jsx

```js
import { submitPaymentConfirmation } from "../services/paymentSubmission";
```

Tambahkan state:

```js
const [isSubmitting, setIsSubmitting] = useState(false);
```

Ganti `handleConfirmPayment` menjadi asynchronous:

```js
const handleConfirmPayment = async () => {
  if (!file || isSubmitting) return;

  setError("");
  setIsSubmitting(true);

  try {
    const result = await submitPaymentConfirmation({
      formData,
      paymentProof: file,
      paymentAmount,
      referenceCode,
    });

    localStorage.setItem("legalpro_payment_status", "submitted");
    localStorage.setItem("legalpro_payment_proof_name", file.name);
    localStorage.setItem(
      "legalpro_payment_reference_code",
      referenceCode
    );
    localStorage.setItem(
      "legalpro_server_reference_code",
      result.data.referenceCode
    );
    localStorage.setItem(
      "legalpro_payment_amount",
      String(paymentAmount)
    );
    localStorage.setItem(
      "legalpro_payment_submitted_at",
      result.data.acceptedAt
    );

    setSubmitted(true);
    setShowConfirmModal(false);
    setShowSuccessModal(true);
  } catch (submitError) {
    setShowConfirmModal(false);
    setError(submitError.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

Disable tombol konfirmasi ketika request sedang berjalan:

```jsx
<button
  type="button"
  onClick={handleConfirmPayment}
  disabled={isSubmitting}
  className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSubmitting ? "Sedang Mengirim..." : "Ya, Saya Sudah Transfer"}
</button>
```

Jangan menambahkan header `Content-Type` secara manual. Browser akan membuat
boundary multipart secara otomatis.

## Catatan file setelah refresh

Object `File` tidak dapat disimpan secara utuh di `localStorage`. Jika halaman
pembayaran di-refresh, file KTP yang sebelumnya dipilih tidak tersedia lagi.
Service akan menghentikan pengiriman dan meminta pengguna kembali ke form untuk
mengunggah ulang dokumen. Alternatif berikutnya adalah memakai IndexedDB, tetapi
itu tidak diperlukan untuk versi awal.
