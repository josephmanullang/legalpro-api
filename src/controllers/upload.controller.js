import { handleUpload } from "@vercel/blob/client";
import { env, bytesFromMb } from "../config/env.js";
import {
  createUploadSession,
  verifyUploadSession,
} from "../services/upload-session.service.js";
import {
  blobPrefixForRequest,
  cleanupBlobFiles,
} from "../services/blob-files.service.js";
import {
  validateFileManifestShape,
  validateSubmissionPayload,
} from "../utils/validation.js";
import { HttpError } from "../utils/http-error.js";

const parseClientPayload = (value) => {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new HttpError(
      400,
      "INVALID_UPLOAD_METADATA",
      "Metadata upload tidak valid."
    );
  }
};

const validateUploadDestination = ({ pathname, metadata, claims }) => {
  const prefix = blobPrefixForRequest(claims.requestId);
  if (!pathname.startsWith(prefix) || pathname.length > 1_024) {
    throw new HttpError(
      403,
      "INVALID_UPLOAD_PATH",
      "Tujuan upload tidak diizinkan."
    );
  }

  const relativePath = pathname.slice(prefix.length);
  if (metadata.role === "paymentProof") {
    if (!relativePath.startsWith("payment-proof-")) {
      throw new HttpError(
        403,
        "INVALID_UPLOAD_PATH",
        "Tujuan bukti transfer tidak diizinkan."
      );
    }
    return;
  }

  if (
    metadata.role !== "document" ||
    !Number.isSafeInteger(metadata.index) ||
    metadata.index < 0 ||
    metadata.index >= claims.documentCount ||
    !relativePath.startsWith(`document-${metadata.index}-`)
  ) {
    throw new HttpError(
      403,
      "INVALID_UPLOAD_PATH",
      "Tujuan dokumen tidak diizinkan."
    );
  }
};

export const issueUploadSession = (req, res) => {
  const { payload, fileManifest } = req.body || {};
  const { expectedAmount } = validateSubmissionPayload(payload);
  validateFileManifestShape(fileManifest);

  const session = createUploadSession({ payload, fileManifest });
  res.status(201).json({
    success: true,
    data: {
      uploadSessionToken: session.token,
      expiresAt: session.expiresAt,
      expectedAmount,
      maxFileSizeBytes: bytesFromMb(env.maxFileSizeMb),
      maxTotalUploadBytes: bytesFromMb(env.maxTotalUploadMb),
    },
  });
};

export const authorizeBlobUpload = async (req, res) => {
  if (!env.blobReadWriteToken) {
    throw new HttpError(
      503,
      "BLOB_NOT_CONFIGURED",
      "Vercel Blob belum terhubung ke backend."
    );
  }

  try {
    const response = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const metadata = parseClientPayload(clientPayload);
        const claims = verifyUploadSession(metadata.uploadSessionToken, {
          requestId: metadata.requestId,
        });

        validateUploadDestination({ pathname, metadata, claims });

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "application/pdf",
          ],
          maximumSizeInBytes: bytesFromMb(env.maxFileSizeMb),
          validUntil: claims.expiresAt,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({
            requestId: claims.requestId,
            role: metadata.role,
            index: metadata.index ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(
          JSON.stringify({
            level: "info",
            event: "blob_upload_completed",
            pathname: blob.pathname,
            tokenPayload,
          })
        );
      },
    });

    res.json(response);
  } catch (error) {
    if (error instanceof HttpError) throw error;

    console.error(
      JSON.stringify({
        level: "error",
        event: "blob_upload_authorization_failed",
        requestId: req.requestId,
        error: error.message,
      })
    );

    throw new HttpError(
      400,
      "BLOB_UPLOAD_REJECTED",
      "Upload file ditolak. Silakan ulangi proses pembayaran."
    );
  }
};

export const cleanupClientBlobs = async (req, res) => {
  const { requestId, uploadSessionToken, pathnames } = req.body || {};
  const claims = verifyUploadSession(uploadSessionToken, { requestId });

  if (
    !Array.isArray(pathnames) ||
    pathnames.length > claims.documentCount + 1
  ) {
    throw new HttpError(
      400,
      "INVALID_BLOB_LIST",
      "Daftar file yang akan dibersihkan tidak valid."
    );
  }

  const prefix = blobPrefixForRequest(claims.requestId);
  const normalizedPathnames = pathnames.map((pathname) => {
    if (
      typeof pathname !== "string" ||
      pathname.length > 1_024 ||
      !pathname.startsWith(prefix)
    ) {
      throw new HttpError(
        403,
        "INVALID_BLOB_PATH",
        "Lokasi file tidak diizinkan."
      );
    }
    return pathname;
  });

  await cleanupBlobFiles(normalizedPathnames);
  res.json({ success: true });
};
