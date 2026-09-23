import fs from "node:fs/promises";
import path from "node:path";
import { env, bytesFromMb } from "../config/env.js";
import { HttpError } from "./http-error.js";

const normalizeMime = (mime) =>
  mime === "image/jpg" ? "image/jpeg" : String(mime || "").toLowerCase();

const detectMimeFromHeader = (buffer) => {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  const pdfPosition = buffer.indexOf(Buffer.from("%PDF-"));
  if (pdfPosition >= 0 && pdfPosition <= 1024) {
    return "application/pdf";
  }

  return null;
};

export const flattenUploadedFiles = (files = {}) =>
  Object.values(files).flatMap((value) => (Array.isArray(value) ? value : []));

export const validateUploadedFileSignatures = async (files) => {
  for (const file of files) {
    let header;

    if (Buffer.isBuffer(file.buffer)) {
      header = file.buffer.subarray(0, 2048);
    } else {
      const handle = await fs.open(file.path, "r");
      const diskHeader = Buffer.alloc(2048);

      try {
        const { bytesRead } = await handle.read(
          diskHeader,
          0,
          diskHeader.length,
          0
        );
        header = diskHeader.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    }

    const detectedMime = detectMimeFromHeader(header);
    const reportedMime = normalizeMime(file.mimetype);

    if (!detectedMime || detectedMime !== reportedMime) {
      throw new HttpError(
        415,
        "FILE_SIGNATURE_MISMATCH",
        `Isi file ${file.originalname} tidak sesuai dengan format yang dilaporkan.`
      );
    }
  }
};

export const validateTotalUploadSize = (files) => {
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const maximum = bytesFromMb(env.maxTotalUploadMb);

  if (totalBytes > maximum) {
    throw new HttpError(
      413,
      "TOTAL_UPLOAD_TOO_LARGE",
      `Total seluruh file maksimal ${env.maxTotalUploadMb} MB.`
    );
  }

  return totalBytes;
};

export const cleanupUploadedFiles = async (files) => {
  const results = await Promise.allSettled(
    files.filter((file) => file?.path).map((file) => fs.unlink(file.path))
  );

  const failed = results.filter(
    (result) =>
      result.status === "rejected" && result.reason?.code !== "ENOENT"
  );

  if (failed.length > 0) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "temporary_file_cleanup_failed",
        failedCount: failed.length,
      })
    );
  }
};

export const ensureUploadDirectory = async () => {
  await fs.mkdir(env.uploadTmpDir, { recursive: true });
};

export const cleanupStaleUploads = async (maxAgeHours = 24) => {
  await ensureUploadDirectory();

  const entries = await fs.readdir(env.uploadTmpDir, { withFileTypes: true });
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  await Promise.allSettled(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(env.uploadTmpDir, entry.name);
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) await fs.unlink(filePath);
      })
  );
};

export const safeAttachmentName = (value, fallback = "dokumen") => {
  const extension = path.extname(String(value || "")).slice(0, 10);
  const base = path
    .basename(String(value || fallback), extension)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
  return `${base || fallback}${safeExtension}`;
};
