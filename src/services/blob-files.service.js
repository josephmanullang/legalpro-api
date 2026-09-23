import { del, get, head } from "@vercel/blob";
import { env, bytesFromMb } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import {
  validateTotalUploadSize,
  validateUploadedFileSignatures,
} from "../utils/files.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const normalizeMime = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^image\/jpg$/, "image/jpeg");

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const isNonEmptyString = (value, maximumLength) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= maximumLength;

export const blobPrefixForRequest = (requestId) =>
  `submissions/${requestId}/`;

const normalizeDescriptor = (descriptor, label, expectedPrefix) => {
  if (!isPlainObject(descriptor)) {
    throw new HttpError(
      400,
      "INVALID_BLOB_DESCRIPTOR",
      `Data file ${label} tidak valid.`
    );
  }

  if (
    !isNonEmptyString(descriptor.pathname, 1_024) ||
    !descriptor.pathname.startsWith(expectedPrefix)
  ) {
    throw new HttpError(
      400,
      "INVALID_BLOB_PATH",
      `Lokasi file ${label} tidak cocok dengan pengajuan.`
    );
  }

  if (!isNonEmptyString(descriptor.originalName, 255)) {
    throw new HttpError(
      400,
      "INVALID_FILE_NAME",
      `Nama file ${label} tidak valid.`
    );
  }

  const mimetype = normalizeMime(descriptor.contentType);
  if (!allowedMimeTypes.has(mimetype)) {
    throw new HttpError(
      415,
      "UNSUPPORTED_FILE_TYPE",
      `Format file ${descriptor.originalName} tidak didukung.`
    );
  }

  const size = Number(descriptor.size);
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > bytesFromMb(env.maxFileSizeMb)
  ) {
    throw new HttpError(
      413,
      "FILE_TOO_LARGE",
      `Ukuran setiap file maksimal ${env.maxFileSizeMb} MB.`
    );
  }

  if (!isNonEmptyString(descriptor.etag, 200)) {
    throw new HttpError(
      400,
      "INVALID_BLOB_DESCRIPTOR",
      `Identitas file ${label} tidak valid.`
    );
  }

  return {
    pathname: descriptor.pathname,
    originalname: descriptor.originalName.trim(),
    mimetype,
    size,
    etag: descriptor.etag.trim(),
  };
};

export const validateBlobFileDescriptors = ({
  requestId,
  paymentProof,
  documents,
  fileManifest,
}) => {
  if (!Array.isArray(documents) || documents.length !== fileManifest.length) {
    throw new HttpError(
      400,
      "FILE_MANIFEST_MISMATCH",
      "Jumlah dokumen Blob tidak sama dengan fileManifest."
    );
  }

  const expectedPrefix = blobPrefixForRequest(requestId);
  const normalizedPaymentProof = normalizeDescriptor(
    paymentProof,
    "bukti transfer",
    expectedPrefix
  );
  const normalizedDocuments = documents.map((descriptor, index) =>
    normalizeDescriptor(descriptor, `dokumen ke-${index + 1}`, expectedPrefix)
  );
  const allFiles = [normalizedPaymentProof, ...normalizedDocuments];
  const uniquePathnames = new Set(allFiles.map((file) => file.pathname));

  if (uniquePathnames.size !== allFiles.length) {
    throw new HttpError(
      400,
      "DUPLICATE_BLOB_PATH",
      "Setiap lampiran harus merujuk ke file yang berbeda."
    );
  }

  validateTotalUploadSize(allFiles);

  return {
    paymentProof: normalizedPaymentProof,
    documentFiles: normalizedDocuments,
    pathnames: [...uniquePathnames],
  };
};

const readMetadata = async (descriptor) => {
  try {
    const metadata = await head(descriptor.pathname);
    const metadataMime = normalizeMime(metadata.contentType);

    if (
      metadata.pathname !== descriptor.pathname ||
      metadata.etag !== descriptor.etag ||
      metadata.size !== descriptor.size ||
      metadataMime !== descriptor.mimetype
    ) {
      throw new HttpError(
        400,
        "BLOB_METADATA_MISMATCH",
        `Metadata file ${descriptor.originalname} tidak cocok.`
      );
    }

    if (
      metadata.size > bytesFromMb(env.maxFileSizeMb) ||
      !allowedMimeTypes.has(metadataMime)
    ) {
      throw new HttpError(
        413,
        "FILE_TOO_LARGE",
        `Ukuran setiap file maksimal ${env.maxFileSizeMb} MB.`
      );
    }

    return { ...descriptor, metadata };
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(
      410,
      "BLOB_NOT_AVAILABLE",
      `File ${descriptor.originalname} tidak tersedia. Silakan unggah ulang.`
    );
  }
};

const downloadBlob = async ({ metadata, ...descriptor }) => {
  try {
    const result = await get(metadata.pathname, {
      access: "private",
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Blob tidak ditemukan.");
    }

    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length !== metadata.size) {
      throw new Error("Ukuran Blob berubah saat dibaca.");
    }

    return {
      ...descriptor,
      size: buffer.length,
      buffer,
      blobUrl: result.blob.url,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(
      502,
      "BLOB_READ_FAILED",
      `File ${descriptor.originalname} belum dapat dibaca. Silakan coba kembali.`
    );
  }
};

export const fetchAndValidateBlobFiles = async ({
  paymentProof,
  documentFiles,
}) => {
  const descriptors = [paymentProof, ...documentFiles];
  const filesWithMetadata = await Promise.all(descriptors.map(readMetadata));

  validateTotalUploadSize(
    filesWithMetadata.map(({ metadata }) => ({ size: metadata.size }))
  );

  const downloadedFiles = [];
  for (const file of filesWithMetadata) {
    downloadedFiles.push(await downloadBlob(file));
  }

  await validateUploadedFileSignatures(downloadedFiles);

  return {
    paymentProof: downloadedFiles[0],
    documentFiles: downloadedFiles.slice(1),
  };
};

export const cleanupBlobFiles = async (pathnames) => {
  const uniquePathnames = [
    ...new Set((pathnames || []).filter((pathname) => typeof pathname === "string")),
  ];
  if (uniquePathnames.length === 0) return;

  try {
    await del(uniquePathnames);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "blob_cleanup_failed",
        fileCount: uniquePathnames.length,
        error: error.message,
      })
    );
  }
};
