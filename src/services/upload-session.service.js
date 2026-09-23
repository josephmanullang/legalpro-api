import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import { createPayloadFingerprint } from "../utils/reference.js";

const SESSION_VERSION = 1;

const createSignature = (encodedClaims) =>
  crypto
    .createHmac("sha256", env.uploadSessionSecret)
    .update(encodedClaims)
    .digest("base64url");

const assertSessionSecret = () => {
  if (Buffer.byteLength(env.uploadSessionSecret, "utf8") < 32) {
    throw new HttpError(
      503,
      "UPLOAD_NOT_CONFIGURED",
      "Layanan upload belum dikonfigurasi pada server."
    );
  }
};

const sessionFingerprint = (payload, fileManifest) =>
  createPayloadFingerprint({ payload, fileManifest });

export const createUploadSession = ({ payload, fileManifest }) => {
  assertSessionSecret();

  const expiresAt = Date.now() + env.uploadSessionTtlMinutes * 60 * 1000;
  const claims = {
    version: SESSION_VERSION,
    requestId: payload.requestId,
    fingerprint: sessionFingerprint(payload, fileManifest),
    documentCount: fileManifest.length,
    expiresAt,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url"
  );
  const signature = createSignature(encodedClaims);

  return {
    token: `${encodedClaims}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
};

export const verifyUploadSession = (
  token,
  { requestId, payload, fileManifest } = {}
) => {
  assertSessionSecret();

  if (typeof token !== "string" || token.length > 2_500) {
    throw new HttpError(
      401,
      "INVALID_UPLOAD_SESSION",
      "Sesi upload tidak valid. Silakan ulangi konfirmasi pembayaran."
    );
  }

  const [encodedClaims, suppliedSignature, extra] = token.split(".");
  if (!encodedClaims || !suppliedSignature || extra !== undefined) {
    throw new HttpError(
      401,
      "INVALID_UPLOAD_SESSION",
      "Sesi upload tidak valid. Silakan ulangi konfirmasi pembayaran."
    );
  }

  const expectedSignature = createSignature(encodedClaims);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new HttpError(
      401,
      "INVALID_UPLOAD_SESSION",
      "Sesi upload tidak valid. Silakan ulangi konfirmasi pembayaran."
    );
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(
      401,
      "INVALID_UPLOAD_SESSION",
      "Sesi upload tidak valid. Silakan ulangi konfirmasi pembayaran."
    );
  }

  if (
    claims.version !== SESSION_VERSION ||
    typeof claims.requestId !== "string" ||
    !Number.isSafeInteger(claims.documentCount) ||
    !Number.isFinite(claims.expiresAt) ||
    claims.expiresAt <= Date.now()
  ) {
    throw new HttpError(
      401,
      "UPLOAD_SESSION_EXPIRED",
      "Sesi upload telah berakhir. Silakan ulangi konfirmasi pembayaran."
    );
  }

  if (requestId && claims.requestId !== requestId) {
    throw new HttpError(
      401,
      "UPLOAD_SESSION_MISMATCH",
      "Sesi upload tidak cocok dengan pengajuan ini."
    );
  }

  if (payload && fileManifest) {
    const fingerprint = sessionFingerprint(payload, fileManifest);
    if (claims.fingerprint !== fingerprint) {
      throw new HttpError(
        401,
        "UPLOAD_SESSION_MISMATCH",
        "Isi pengajuan berubah setelah sesi upload dibuat. Silakan ulangi."
      );
    }
  }

  return claims;
};
