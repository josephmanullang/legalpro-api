import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { env, bytesFromMb } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    fs.mkdir(env.uploadTmpDir, { recursive: true }, (error) => {
      callback(error, env.uploadTmpDir);
    });
  },
  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "");
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension.slice(0, 10)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: bytesFromMb(env.maxFileSizeMb),
    files: env.maxDocumentFiles + 1,
    fields: 4,
    fieldSize: bytesFromMb(env.maxTextFieldMb),
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(String(file.mimetype).toLowerCase())) {
      callback(
        new HttpError(
          415,
          "UNSUPPORTED_FILE_TYPE",
          `Format file ${file.originalname} tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.`
        )
      );
      return;
    }

    callback(null, true);
  },
});

export const rejectOversizedRequest = (req, _res, next) => {
  const contentLength = Number(req.headers["content-length"] || 0);
  const maximumWithMultipartOverhead = bytesFromMb(env.maxTotalUploadMb + 2);

  if (contentLength > maximumWithMultipartOverhead) {
    next(
      new HttpError(
        413,
        "REQUEST_TOO_LARGE",
        `Total request melebihi batas ${env.maxTotalUploadMb} MB.`
      )
    );
    return;
  }

  next();
};

export const requireMultipart = (req, _res, next) => {
  if (!req.is("multipart/form-data")) {
    next(
      new HttpError(
        415,
        "MULTIPART_REQUIRED",
        "Endpoint ini hanya menerima multipart/form-data."
      )
    );
    return;
  }

  next();
};

export const uploadSubmissionFiles = upload.fields([
  { name: "paymentProof", maxCount: 1 },
  { name: "documents", maxCount: env.maxDocumentFiles },
]);
