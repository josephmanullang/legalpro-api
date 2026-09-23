import { COMPANY_TYPES, calculateSubmissionPrice } from "./pricing.js";
import { HttpError } from "./http-error.js";
import { env } from "../config/env.js";

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const isNonEmptyString = (value, maxLength = 500) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= maxLength;

export const isValidRequestId = (value) =>
  isNonEmptyString(value, 100) && /^[a-zA-Z0-9_-]{8,100}$/.test(value);

export const parseJsonField = (value, fieldName) => {
  if (!isNonEmptyString(value, 1_500_000)) {
    throw new HttpError(
      400,
      "INVALID_MULTIPART_FIELD",
      `Field ${fieldName} wajib dikirim.`
    );
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      `Field ${fieldName} bukan JSON yang valid.`
    );
  }
};

export const validateSubmissionPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new HttpError(400, "INVALID_PAYLOAD", "Payload pengajuan tidak valid.");
  }

  if (!isNonEmptyString(payload.requestId, 100)) {
    throw new HttpError(400, "INVALID_REQUEST_ID", "requestId wajib diisi.");
  }

  if (!isValidRequestId(payload.requestId)) {
    throw new HttpError(
      400,
      "INVALID_REQUEST_ID",
      "Format requestId tidak valid."
    );
  }

  if (!isPlainObject(payload.formData)) {
    throw new HttpError(400, "INVALID_FORM_DATA", "formData wajib berupa object.");
  }

  if (!COMPANY_TYPES.includes(payload.formData.companyType)) {
    throw new HttpError(
      400,
      "INVALID_COMPANY_TYPE",
      "Jenis badan usaha tidak dikenali."
    );
  }

  if (!isNonEmptyString(payload.formData.email, 254)) {
    throw new HttpError(400, "INVALID_EMAIL", "Email badan usaha wajib diisi.");
  }

  if (!/^\S+@\S+\.\S+$/.test(payload.formData.email.trim())) {
    throw new HttpError(400, "INVALID_EMAIL", "Format email badan usaha tidak valid.");
  }

  if (!isNonEmptyString(payload.formData.phone, 30)) {
    throw new HttpError(400, "INVALID_PHONE", "Nomor telepon badan usaha wajib diisi.");
  }

  if (!isPlainObject(payload.payment)) {
    throw new HttpError(400, "INVALID_PAYMENT", "Data pembayaran wajib diisi.");
  }

  if (!isNonEmptyString(payload.payment.referenceCode, 40)) {
    throw new HttpError(
      400,
      "INVALID_REFERENCE_CODE",
      "Reference code pembayaran wajib diisi."
    );
  }

  if (!/^[A-Za-z0-9-]{6,40}$/.test(payload.payment.referenceCode)) {
    throw new HttpError(
      400,
      "INVALID_REFERENCE_CODE",
      "Format reference code pembayaran tidak valid."
    );
  }

  const submittedAmount = Number(payload.payment.amount);
  const expectedAmount = calculateSubmissionPrice(payload.formData);

  if (!Number.isSafeInteger(submittedAmount) || submittedAmount <= 0) {
    throw new HttpError(
      400,
      "INVALID_PAYMENT_AMOUNT",
      "Nominal pembayaran tidak valid."
    );
  }

  if (expectedAmount <= 0 || submittedAmount !== expectedAmount) {
    throw new HttpError(
      400,
      "PAYMENT_AMOUNT_MISMATCH",
      "Nominal pembayaran tidak sesuai dengan jenis badan usaha atau modal dasar.",
      { expectedAmount }
    );
  }

  return {
    expectedAmount,
    applicantEmail: payload.formData.email.trim(),
  };
};

export const validateFileManifestShape = (manifest) => {
  if (!Array.isArray(manifest)) {
    throw new HttpError(
      400,
      "INVALID_FILE_MANIFEST",
      "fileManifest wajib berupa array."
    );
  }

  if (manifest.length === 0) {
    throw new HttpError(
      400,
      "DOCUMENTS_REQUIRED",
      "Minimal satu dokumen KTP wajib dikirim."
    );
  }

  if (manifest.length > env.maxDocumentFiles) {
    throw new HttpError(
      400,
      "TOO_MANY_DOCUMENTS",
      `Maksimal ${env.maxDocumentFiles} dokumen dapat dikirim.`
    );
  }

  manifest.forEach((item, index) => {
    if (!isPlainObject(item) || !isNonEmptyString(item.path, 250)) {
      throw new HttpError(
        400,
        "INVALID_FILE_MANIFEST",
        `Data fileManifest ke-${index + 1} tidak valid.`
      );
    }

    if (item.label !== undefined && !isNonEmptyString(item.label, 150)) {
      throw new HttpError(
        400,
        "INVALID_FILE_MANIFEST",
        `Label fileManifest ke-${index + 1} tidak valid.`
      );
    }
  });

  const uniquePaths = new Set(manifest.map((item) => item.path));
  if (uniquePaths.size !== manifest.length) {
    throw new HttpError(
      400,
      "DUPLICATE_FILE_MANIFEST_PATH",
      "Setiap dokumen pada fileManifest harus memiliki path yang berbeda."
    );
  }

  return manifest;
};

export const validateFileManifest = (manifest, documentFiles) => {
  validateFileManifestShape(manifest);

  if (manifest.length !== documentFiles.length) {
    throw new HttpError(
      400,
      "FILE_MANIFEST_MISMATCH",
      "Jumlah data pada fileManifest tidak sama dengan jumlah dokumen."
    );
  }

  return manifest;
};
