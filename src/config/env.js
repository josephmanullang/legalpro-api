import "dotenv/config";
import os from "node:os";
import path from "node:path";

const toPositiveNumber = (value, fallback, name) => {
  if (value === undefined || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} harus berupa angka lebih dari 0.`);
  }

  return parsed;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const toList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const mailTransport = String(process.env.MAIL_TRANSPORT || "smtp").toLowerCase();

if (!["smtp", "json"].includes(mailTransport)) {
  throw new Error('MAIL_TRANSPORT hanya boleh bernilai "smtp" atau "json".');
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port: toPositiveNumber(process.env.PORT, 5000, "PORT"),
  trustProxy: toBoolean(process.env.TRUST_PROXY, false),
  frontendOrigins: toList(
    process.env.FRONTEND_ORIGINS || "http://localhost:5173"
  ),

  mailTransport,
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: toPositiveNumber(process.env.SMTP_PORT, 465, "SMTP_PORT"),
  smtpSecure: toBoolean(process.env.SMTP_SECURE, true),
  smtpUser: String(process.env.SMTP_USER || "").trim(),
  smtpPass: String(process.env.SMTP_PASS || ""),
  verifySmtpOnStartup: toBoolean(process.env.VERIFY_SMTP_ON_STARTUP, true),
  mailFromName: String(process.env.MAIL_FROM_NAME || "LegalPro Notifikasi").trim(),
  mailTo: toList(process.env.MAIL_TO),
  mailCc: toList(process.env.MAIL_CC),

  maxFileSizeMb: toPositiveNumber(
    process.env.MAX_FILE_SIZE_MB,
    5,
    "MAX_FILE_SIZE_MB"
  ),
  maxTotalUploadMb: toPositiveNumber(
    process.env.MAX_TOTAL_UPLOAD_MB,
    15,
    "MAX_TOTAL_UPLOAD_MB"
  ),
  maxDocumentFiles: toPositiveNumber(
    process.env.MAX_DOCUMENT_FILES,
    25,
    "MAX_DOCUMENT_FILES"
  ),
  maxTextFieldMb: toPositiveNumber(
    process.env.MAX_TEXT_FIELD_MB,
    1,
    "MAX_TEXT_FIELD_MB"
  ),
  rateLimitWindowMinutes: toPositiveNumber(
    process.env.RATE_LIMIT_WINDOW_MINUTES,
    15,
    "RATE_LIMIT_WINDOW_MINUTES"
  ),
  rateLimitMaxRequests: toPositiveNumber(
    process.env.RATE_LIMIT_MAX_REQUESTS,
    10,
    "RATE_LIMIT_MAX_REQUESTS"
  ),
  idempotencyTtlMinutes: toPositiveNumber(
    process.env.IDEMPOTENCY_TTL_MINUTES,
    30,
    "IDEMPOTENCY_TTL_MINUTES"
  ),
  uploadTmpDir:
    String(process.env.UPLOAD_TMP_DIR || "").trim() ||
    path.join(os.tmpdir(), "notaris-email-backend"),
});

export const assertRuntimeEnv = () => {
  const missing = [];

  if (env.mailTo.length === 0) missing.push("MAIL_TO");

  if (env.mailTransport === "smtp") {
    if (!env.smtpUser) missing.push("SMTP_USER");
    if (!env.smtpPass) missing.push("SMTP_PASS");
  }

  if (missing.length > 0) {
    throw new Error(`Environment wajib belum diisi: ${missing.join(", ")}.`);
  }
};

export const bytesFromMb = (value) => Math.floor(value * 1024 * 1024);
