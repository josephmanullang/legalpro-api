import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import submissionRoutes from "./routes/submission.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { HttpError } from "./utils/http-error.js";

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new HttpError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "Origin frontend tidak diizinkan oleh server."
      )
    );
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
  credentials: false,
  maxAge: 86400,
};

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      service: "notaris-email-backend",
      timestamp: new Date().toISOString(),
    });
  });

  const submissionLimiter = rateLimit({
    windowMs: env.rateLimitWindowMinutes * 60 * 1000,
    limit: env.rateLimitMaxRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Terlalu banyak percobaan. Silakan tunggu beberapa saat.",
      },
    },
  });

  const uploadLimiter = rateLimit({
    windowMs: env.rateLimitWindowMinutes * 60 * 1000,
    limit: Math.max(env.rateLimitMaxRequests * 10, 100),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "TOO_MANY_UPLOAD_REQUESTS",
        message: "Terlalu banyak permintaan upload. Silakan tunggu beberapa saat.",
      },
    },
  });

  app.use("/api/v1/uploads", uploadLimiter, uploadRoutes);
  app.use("/api/v1/submissions", submissionLimiter, submissionRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
