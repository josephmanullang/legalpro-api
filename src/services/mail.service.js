import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { buildSubmissionEmail } from "../templates/submission-email.js";
import { safeAttachmentName } from "../utils/files.js";
import { HttpError } from "../utils/http-error.js";

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (env.mailTransport === "json") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    ...(env.isVercel
      ? {}
      : {
          pool: true,
          maxConnections: 3,
          maxMessages: 100,
        }),
  });

  return transporter;
};

const safeSubjectPart = (value) =>
  String(value || "-")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 80);

export const verifyMailTransport = async () => {
  if (env.mailTransport === "json") return true;
  return getTransporter().verify();
};

export const closeMailTransport = () => {
  if (transporter && typeof transporter.close === "function") {
    transporter.close();
  }
  transporter = undefined;
};

export const sendSubmissionEmail = async ({
  payload,
  paymentProof,
  documentFiles,
  fileManifest,
  serverReference,
  acceptedAt,
  applicantEmail,
}) => {
  const attachmentContent = (file) =>
    Buffer.isBuffer(file.buffer)
      ? { content: file.buffer }
      : { path: file.path };

  const visibleAttachments = [
    {
      label: "Bukti Transfer",
      fileName: paymentProof.originalname,
    },
    ...documentFiles.map((file, index) => ({
      label: fileManifest[index]?.label || fileManifest[index]?.path || `Dokumen ${index + 1}`,
      fileName: file.originalname,
    })),
    {
      label: "Salinan Data JSON",
      fileName: `data-pengajuan-${serverReference}.json`,
    },
  ];

  const email = buildSubmissionEmail({
    payload,
    serverReference,
    acceptedAt,
    attachments: visibleAttachments,
  });

  const attachments = [
    {
      filename: `00-bukti-transfer-${safeAttachmentName(paymentProof.originalname)}`,
      ...attachmentContent(paymentProof),
      contentType: paymentProof.mimetype,
    },
    ...documentFiles.map((file, index) => ({
      filename: `${String(index + 1).padStart(2, "0")}-${safeAttachmentName(
        fileManifest[index]?.label || `dokumen-${index + 1}`
      )}-${safeAttachmentName(file.originalname)}`,
      ...attachmentContent(file),
      contentType: file.mimetype,
    })),
    {
      filename: `data-pengajuan-${serverReference}.json`,
      content: Buffer.from(
        JSON.stringify(
          {
            serverReference,
            acceptedAt: acceptedAt.toISOString(),
            ...payload,
            fileManifest,
          },
          null,
          2
        ),
        "utf8"
      ),
      contentType: "application/json; charset=utf-8",
    },
  ];

  try {
    return await getTransporter().sendMail({
      from: {
        name: env.mailFromName,
        address: env.smtpUser || "no-reply@legalpro.local",
      },
      to: env.mailTo,
      cc: env.mailCc.length > 0 ? env.mailCc : undefined,
      replyTo: applicantEmail,
      subject: `[${serverReference}] ${safeSubjectPart(email.companyLabel)} - Konfirmasi Pembayaran`,
      html: email.html,
      text: email.text,
      attachments,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "submission_email_failed",
        serverReference,
        error: error.message,
      })
    );

    throw new HttpError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "Data belum berhasil dikirim ke email admin. Silakan coba kembali."
    );
  }
};
