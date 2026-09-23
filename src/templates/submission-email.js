const LABELS = Object.freeze({
  companyType: "Jenis Badan Usaha",
  ptType: "Jenis PT",
  koperasiType: "Jenis Koperasi",
  companyName: "Pilihan Nama PT 1",
  companyName2: "Pilihan Nama PT 2",
  companyName3: "Pilihan Nama PT 3",
  nameChecked: "Nama Sudah Dicek",
  foundationName1: "Pilihan Nama Yayasan 1",
  foundationName2: "Pilihan Nama Yayasan 2",
  foundationName3: "Pilihan Nama Yayasan 3",
  cooperativeName1: "Pilihan Nama Koperasi 1",
  cooperativeName2: "Pilihan Nama Koperasi 2",
  cooperativeName3: "Pilihan Nama Koperasi 3",
  cvName1: "Pilihan Nama CV 1",
  cvName2: "Pilihan Nama CV 2",
  cvName3: "Pilihan Nama CV 3",
  firmaName1: "Pilihan Nama Firma 1",
  firmaName2: "Pilihan Nama Firma 2",
  firmaName3: "Pilihan Nama Firma 3",
  associateName1: "Pilihan Nama Perkumpulan 1",
  associateName2: "Pilihan Nama Perkumpulan 2",
  associateName3: "Pilihan Nama Perkumpulan 3",
  commissionerMain: "Komisaris Utama",
  commissioner1: "Komisaris 1",
  commissioner2: "Komisaris 2",
  directorMain: "Direktur Utama",
  director1: "Direktur 1",
  director2: "Direktur 2",
  shareholder1: "Pemegang Saham 1",
  shareholder2: "Pemegang Saham 2",
  shareholder3: "Pemegang Saham 3",
  foundationFounders: "Pendiri Yayasan",
  foundationChairman: "Ketua Yayasan",
  foundationSecretary: "Sekretaris Yayasan",
  foundationTreasurer: "Bendahara Yayasan",
  foundationSupervisors: "Pengawas Yayasan",
  cooperativeChairman: "Ketua Koperasi",
  cooperativeSecretary: "Sekretaris Koperasi",
  cooperativeTreasurer: "Bendahara Koperasi",
  associateChairman: "Ketua Perkumpulan",
  associateSecretary: "Sekretaris Perkumpulan",
  associateTreasurer: "Bendahara Perkumpulan",
  associatePurpose: "Tujuan Perkumpulan",
  modalDasar: "Modal Dasar",
  foundationCapital: "Modal Yayasan",
  cooperativeCapital: "Modal Koperasi",
  cooperativePrincipal: "Simpanan Pokok",
  cooperativeMandatory: "Simpanan Wajib",
  cvCapital: "Modal CV",
  firmaCapital: "Modal Firma",
  associateCapital: "Modal Perkumpulan",
  jalan: "Jalan / Alamat",
  kelurahan: "Kelurahan",
  kecamatan: "Kecamatan",
  kota: "Kota / Kabupaten",
  provinsi: "Provinsi",
  kodePos: "Kode Pos",
  email: "Email",
  phone: "Nomor Telepon",
  kbli: "KBLI",
  pendiri: "Data Pendiri PT",
  pembinaYayasan: "Data Pembina Yayasan",
  pengurusYayasan: "Data Pengurus Yayasan",
  pengawasYayasan: "Data Pengawas Yayasan",
  cvFounders: "Data Pendiri CV",
  cvActivePartners: "Data Sekutu Aktif",
  cvPassivePartners: "Data Sekutu Pasif",
  cooperativeFounders: "Data Pendiri Koperasi",
  cooperativeManagers: "Data Pengurus Koperasi",
  cooperativeSupervisors: "Data Pengawas Koperasi",
  firmaFounders: "Data Pendiri Firma",
  associateFounders: "Data Pendiri Perkumpulan",
  ktp: "Dokumen KTP",
  npwp: "NPWP",
  pekerjaan: "Pekerjaan",
  alamat: "Alamat",
  fileName: "Nama File",
  mimeType: "Format File",
  size: "Ukuran File",
});

const COMPANY_LABELS = Object.freeze({
  PT: "Perseroan Terbatas (PT)",
  YAYASAN: "Yayasan",
  KOPERASI: "Koperasi",
  CV: "Commanditaire Vennootschap (CV)",
  FIRMA: "Firma",
  PERKUMPULAN: "Perkumpulan",
});

const MONEY_KEYS = /modal|capital|principal|mandatory|amount|harga|biaya/i;
const HIDDEN_KEYS = new Set(["password", "token", "secret", "smtpPass"]);

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatKey = (key) => {
  if (LABELS[key]) return LABELS[key];

  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
};

const formatRupiah = (value) =>
  `Rp ${Number(value).toLocaleString("id-ID")}`;

const formatScalar = (value, key) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";

  if (typeof value === "number" && MONEY_KEYS.test(String(key))) {
    return formatRupiah(value);
  }

  if (key === "size" && Number.isFinite(Number(value))) {
    return `${(Number(value) / 1024).toFixed(1)} KB`;
  }

  if (key === "companyType" && COMPANY_LABELS[value]) {
    return COMPANY_LABELS[value];
  }

  return String(value);
};

const renderValue = (value, key, depth = 0) => {
  if (depth > 8) return "<em>Data terlalu dalam untuk ditampilkan.</em>";

  if (Array.isArray(value)) {
    if (value.length === 0) return "-";

    if (value.every((item) => item === null || typeof item !== "object")) {
      return `<ol style="margin:0;padding-left:20px;">${value
        .map((item) => `<li>${escapeHtml(formatScalar(item, key))}</li>`)
        .join("")}</ol>`;
    }

    return value
      .map(
        (item, index) =>
          `<div style="margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
            <strong>${escapeHtml(formatKey(key))} ${index + 1}</strong>
            <div style="margin-top:8px;">${renderValue(item, key, depth + 1)}</div>
          </div>`
      )
      .join("");
  }

  if (value && typeof value === "object") {
    const rows = Object.entries(value)
      .filter(([childKey]) => !HIDDEN_KEYS.has(childKey))
      .map(
        ([childKey, childValue]) => `
          <tr>
            <td style="width:34%;padding:9px;border-bottom:1px solid #e2e8f0;color:#475569;vertical-align:top;">
              ${escapeHtml(formatKey(childKey))}
            </td>
            <td style="padding:9px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top;">
              ${renderValue(childValue, childKey, depth + 1)}
            </td>
          </tr>`
      )
      .join("");

    return `<table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>`;
  }

  return escapeHtml(formatScalar(value, key));
};

const attachmentRows = (attachments) =>
  attachments
    .map(
      (attachment, index) => `
        <tr>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0;">${index + 1}</td>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
            attachment.label
          )}</td>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
            attachment.fileName
          )}</td>
        </tr>`
    )
    .join("");

export const buildSubmissionEmail = ({
  payload,
  serverReference,
  acceptedAt,
  attachments,
}) => {
  const companyLabel =
    COMPANY_LABELS[payload.formData.companyType] || payload.formData.companyType;
  const paymentAmount = formatRupiah(payload.payment.amount);
  const acceptedLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(acceptedAt);

  const html = `<!doctype html>
  <html lang="id">
    <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:860px;margin:0 auto;padding:24px;">
        <div style="background:#0f172a;color:#fff;padding:24px;border-radius:14px 14px 0 0;">
          <p style="margin:0;color:#facc15;font-weight:bold;">LEGALPRO</p>
          <h1 style="margin:8px 0 0;font-size:24px;">Pengajuan dan Pembayaran Baru</h1>
        </div>

        <div style="background:#fff;padding:24px;border-radius:0 0 14px 14px;">
          <h2 style="margin-top:0;font-size:18px;">Informasi Utama</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
            <tr><td style="padding:10px;color:#64748b;">Referensi Server</td><td style="padding:10px;font-weight:bold;">${escapeHtml(
              serverReference
            )}</td></tr>
            <tr><td style="padding:10px;color:#64748b;">Reference Code Transfer</td><td style="padding:10px;font-weight:bold;">${escapeHtml(
              payload.payment.referenceCode
            )}</td></tr>
            <tr><td style="padding:10px;color:#64748b;">Waktu Diterima</td><td style="padding:10px;">${escapeHtml(
              acceptedLabel
            )}</td></tr>
            <tr><td style="padding:10px;color:#64748b;">Jenis Badan Usaha</td><td style="padding:10px;">${escapeHtml(
              companyLabel
            )}</td></tr>
            <tr><td style="padding:10px;color:#64748b;">Nominal Pembayaran</td><td style="padding:10px;font-weight:bold;color:#166534;">${escapeHtml(
              paymentAmount
            )}</td></tr>
          </table>

          <h2 style="margin:28px 0 10px;font-size:18px;">Data Lengkap Pengajuan</h2>
          <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            ${renderValue(payload.formData, "formData")}
          </div>

          <h2 style="margin:28px 0 10px;font-size:18px;">Daftar Lampiran</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px;text-align:left;">No.</th>
                <th style="padding:9px;text-align:left;">Jenis</th>
                <th style="padding:9px;text-align:left;">Nama File</th>
              </tr>
            </thead>
            <tbody>${attachmentRows(attachments)}</tbody>
          </table>

          <p style="margin:24px 0 0;padding:14px;background:#fef9c3;border-radius:8px;color:#713f12;">
            Email ini dikirim otomatis. Seluruh file asli juga dilampirkan pada email.
          </p>
        </div>
      </div>
    </body>
  </html>`;

  const text = [
    "LEGALPRO - PENGAJUAN DAN PEMBAYARAN BARU",
    `Referensi server: ${serverReference}`,
    `Reference code transfer: ${payload.payment.referenceCode}`,
    `Waktu diterima: ${acceptedLabel}`,
    `Jenis badan usaha: ${companyLabel}`,
    `Nominal pembayaran: ${paymentAmount}`,
    "",
    "DATA LENGKAP PENGAJUAN",
    JSON.stringify(payload.formData, null, 2),
    "",
    "DAFTAR LAMPIRAN",
    ...attachments.map(
      (attachment, index) =>
        `${index + 1}. ${attachment.label} - ${attachment.fileName}`
    ),
  ].join("\n");

  return { html, text, companyLabel };
};
