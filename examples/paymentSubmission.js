const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const isFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

const humanizePath = (path) =>
  path
    .replace(/^formData\./, "")
    .replace(/\[(\d+)\]/g, (_match, index) => ` ${Number(index) + 1}`)
    .replaceAll(".", " - ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");

const extractFiles = (value, path, documents, manifest) => {
  if (isFile(value)) {
    documents.push(value);
    manifest.push({
      path,
      label: humanizePath(path),
    });

    return {
      fileName: value.name,
      mimeType: value.type,
      size: value.size,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      extractFiles(item, `${path}[${index}]`, documents, manifest)
    );
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        extractFiles(item, `${path}.${key}`, documents, manifest),
      ])
    );
  }

  return value;
};

const getRequestId = (referenceCode) => {
  const storageKey = `legalpro_submission_request_${referenceCode}`;
  const saved = sessionStorage.getItem(storageKey);
  if (saved) return saved;

  const generated = crypto.randomUUID();
  sessionStorage.setItem(storageKey, generated);
  return generated;
};

export async function submitPaymentConfirmation({
  formData,
  paymentProof,
  paymentAmount,
  referenceCode,
}) {
  if (!(paymentProof instanceof File)) {
    throw new Error("Bukti transfer belum dipilih.");
  }

  const documents = [];
  const fileManifest = [];
  const sanitizedFormData = extractFiles(
    formData,
    "formData",
    documents,
    fileManifest
  );

  if (documents.length === 0) {
    throw new Error(
      "Dokumen KTP tidak ditemukan. Kembali ke form dan unggah ulang dokumen sebelum melakukan pembayaran."
    );
  }

  const body = new FormData();
  body.append(
    "payload",
    JSON.stringify({
      requestId: getRequestId(referenceCode),
      formData: sanitizedFormData,
      payment: {
        referenceCode,
        amount: paymentAmount,
        submittedAt: new Date().toISOString(),
      },
    })
  );
  body.append("fileManifest", JSON.stringify(fileManifest));
  body.append("paymentProof", paymentProof, paymentProof.name);

  documents.forEach((document) => {
    body.append("documents", document, document.name);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/submissions/payment-confirmation`,
    {
      method: "POST",
      body,
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Pengajuan belum berhasil dikirim ke server."
    );
  }

  return result;
}
