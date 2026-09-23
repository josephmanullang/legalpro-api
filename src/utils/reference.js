import crypto from "node:crypto";

export const createServerReference = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `MAIL-${date}-${random}`;
};

export const createPayloadFingerprint = (payload) =>
  crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
