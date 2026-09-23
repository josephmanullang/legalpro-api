import {
  cleanupUploadedFiles,
  flattenUploadedFiles,
  validateTotalUploadSize,
  validateUploadedFileSignatures,
} from "../utils/files.js";
import {
  parseJsonField,
  validateFileManifest,
  validateSubmissionPayload,
} from "../utils/validation.js";
import {
  completeSubmission,
  claimSubmission,
  releaseSubmission,
} from "../services/idempotency.service.js";
import {
  createPayloadFingerprint,
  createServerReference,
} from "../utils/reference.js";
import { sendSubmissionEmail } from "../services/mail.service.js";
import { HttpError } from "../utils/http-error.js";

export const submitPaymentConfirmation = async (req, res) => {
  const uploadedFiles = flattenUploadedFiles(req.files);
  let claimedRequestId = null;
  let responseStatus = 201;
  let responseData;

  try {
    const payload = parseJsonField(req.body?.payload, "payload");
    const fileManifest = parseJsonField(req.body?.fileManifest, "fileManifest");
    const { expectedAmount, applicantEmail } = validateSubmissionPayload(payload);

    const paymentProof = req.files?.paymentProof?.[0];
    const documentFiles = req.files?.documents || [];

    if (!paymentProof) {
      throw new HttpError(
        400,
        "PAYMENT_PROOF_REQUIRED",
        "Bukti transfer wajib diunggah."
      );
    }

    if (documentFiles.length === 0) {
      throw new HttpError(
        400,
        "DOCUMENTS_REQUIRED",
        "Minimal satu dokumen KTP wajib dikirim."
      );
    }

    validateFileManifest(fileManifest, documentFiles);
    validateTotalUploadSize(uploadedFiles);
    await validateUploadedFileSignatures(uploadedFiles);

    const fingerprint = createPayloadFingerprint(payload);
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
      const serverReference = createServerReference();
      const acceptedAt = new Date();

      await sendSubmissionEmail({
        payload,
        paymentProof,
        documentFiles,
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
    await cleanupUploadedFiles(uploadedFiles);
  }

  res.status(responseStatus).json({
    success: true,
    message: responseData.duplicate
      ? "Pengajuan ini sudah diterima sebelumnya. Email tidak dikirim ulang."
      : "Pengajuan berhasil diterima dan dikirim ke email admin.",
    data: responseData,
  });
};
