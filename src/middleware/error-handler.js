import multer from "multer";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const multerMessage = (error) => {
  const messages = {
    LIMIT_FILE_SIZE: `Ukuran setiap file maksimal ${env.maxFileSizeMb} MB.`,
    LIMIT_FILE_COUNT: "Jumlah file yang diunggah terlalu banyak.",
    LIMIT_UNEXPECTED_FILE: "Nama field atau jumlah file upload tidak sesuai.",
    LIMIT_FIELD_VALUE: `Ukuran data teks maksimal ${env.maxTextFieldMb} MB.`,
    LIMIT_FIELD_COUNT: "Jumlah field multipart terlalu banyak.",
  };

  return messages[error.code] || "Data upload tidak dapat diproses.";
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`,
    },
  });
};

export const errorHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      requestId: req.requestId,
      error: {
        code: error.code,
        message: multerMessage(error),
      },
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      success: false,
      requestId: req.requestId,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_request_error",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: error.message,
      ...(env.nodeEnv === "development" ? { stack: error.stack } : {}),
    })
  );

  res.status(500).json({
    success: false,
    requestId: req.requestId,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan pada server.",
    },
  });
};
