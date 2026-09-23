import {
  completeSubmission,
  claimSubmission,
  releaseSubmission,
} from "../services/idempotency.service.js";
import {
  cleanupBlobFiles,
  fetchAndValidateBlobFiles,
  validateBlobFileDescriptors,
} from "../services/blob-files.service.js";
import { sendSubmissionEmail } from "../services/mail.service.js";
import { verifyUploadSession } from "../services/upload-session.service.js";
import { HttpError } from "../utils/http-error.js";
import {
  createPayloadFingerprint,
  createServerReference,
} from "../utils/reference.js";
import {
  validateFileManifestShape,
  validateSubmissionPayload,
} from "../utils/validation.js";

export const submitBlobPaymentConfirmation = async (req, res) => {
  let claimedRequestId = null;
  let cleanupPathnames = [];
  let shouldCleanup = false;
  let responseStatus = 201;
  let responseData;

  try {
    const { payload, fileManifest, uploadSessionToken, files } = req.body || {};
    const { expectedAmount, applicantEmail } =
      validateSubmissionPayload(payload);
    validateFileManifestShape(fileManifest);
    verifyUploadSession(uploadSessionToken, {
      requestId: payload.requestId,
      payload,
      fileManifest,
    });

    const descriptors = validateBlobFileDescriptors({
      requestId: payload.requestId,
      paymentProof: files?.paymentProof,
      documents: files?.documents,
      fileManifest,
    });
    cleanupPathnames = descriptors.pathnames;

    const fingerprint = createPayloadFingerprint({ payload, fileManifest });
    const claim = claimSubmission(payload.requestId, fingerprint);

    if (claim.type === "conflict") {
      throw new HttpError(
        409,
        "REQUEST_ID_CONFLICT",
        "requestId sudah pernah digunakan untuk data yang berbeda."
      );
    }

    if (claim.type === "processing") {
      throw new HttpError(
        409,
        "SUBMISSION_IN_PROGRESS",
        "Pengajuan yang sama sedang diproses. Jangan menekan tombol konfirmasi berulang kali."
      );
    }

    shouldCleanup = true;

    if (claim.type === "succeeded") {
      responseStatus = 200;
      responseData = {
        referenceCode: claim.record.serverReference,
        acceptedAt: claim.record.acceptedAt,
        amount: expectedAmount,
        duplicate: true,
      };
    } else {
      claimedRequestId = payload.requestId;
      const fetchedFiles = await fetchAndValidateBlobFiles(descriptors);
      const serverReference = createServerReference();
      const acceptedAt = new Date();

      await sendSubmissionEmail({
        payload,
        paymentProof: fetchedFiles.paymentProof,
        documentFiles: fetchedFiles.documentFiles,
        fileManifest,
        serverReference,
        acceptedAt,
        applicantEmail,
      });

      responseData = {
        referenceCode: serverReference,
        acceptedAt: acceptedAt.toISOString(),
        amount: expectedAmount,
        duplicate: false,
      };

      completeSubmission(payload.requestId, {
        serverReference,
        acceptedAt: responseData.acceptedAt,
      });
      claimedRequestId = null;
    }
  } catch (error) {
    if (claimedRequestId) releaseSubmission(claimedRequestId);
    throw error;
  } finally {
    if (shouldCleanup) await cleanupBlobFiles(cleanupPathnames);
  }

  res.status(responseStatus).json({
    success: true,
    message: responseData.duplicate
      ? "Pengajuan ini sudah diterima sebelumnya. Email tidak dikirim ulang."
      : "Pengajuan berhasil diterima dan dikirim ke email admin.",
    data: responseData,
  });
};
