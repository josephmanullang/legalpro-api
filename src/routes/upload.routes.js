import { Router } from "express";
import {
  authorizeBlobUpload,
  cleanupClientBlobs,
  issueUploadSession,
} from "../controllers/upload.controller.js";

const router = Router();

router.post("/session", issueUploadSession);
router.post("/cleanup", cleanupClientBlobs);
router.post("/", authorizeBlobUpload);

export default router;
