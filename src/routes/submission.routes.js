import { Router } from "express";
import { submitPaymentConfirmation } from "../controllers/submission.controller.js";
import { submitBlobPaymentConfirmation } from "../controllers/blob-submission.controller.js";
import {
  rejectOversizedRequest,
  requireMultipart,
  uploadSubmissionFiles,
} from "../middleware/upload.js";

const router = Router();

router.post("/payment-confirmation/blob", submitBlobPaymentConfirmation);

router.post(
  "/payment-confirmation",
  rejectOversizedRequest,
  requireMultipart,
  uploadSubmissionFiles,
  submitPaymentConfirmation
);

export default router;
