import { env } from "../config/env.js";

const submissions = new Map();

const removeExpired = () => {
  const now = Date.now();
  for (const [key, record] of submissions.entries()) {
    if (record.expiresAt <= now) submissions.delete(key);
  }
};

export const claimSubmission = (requestId, fingerprint) => {
  removeExpired();

  const existing = submissions.get(requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return { type: "conflict" };
    }

    return { type: existing.status, record: existing };
  }

  const record = {
    status: "processing",
    fingerprint,
    expiresAt: Date.now() + env.idempotencyTtlMinutes * 60 * 1000,
  };

  submissions.set(requestId, record);
  return { type: "claimed", record };
};

export const completeSubmission = (requestId, data) => {
  const record = submissions.get(requestId);
  if (!record) return;

  submissions.set(requestId, {
    ...record,
    ...data,
    status: "succeeded",
  });
};

export const releaseSubmission = (requestId) => {
  submissions.delete(requestId);
};

export const clearSubmissionStore = () => submissions.clear();
