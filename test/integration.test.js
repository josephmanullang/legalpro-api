import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

test("endpoint menerima data, bukti transfer, dan dokumen", async (context) => {
  const uploadDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "notaris-email-test-")
  );

  process.env.NODE_ENV = "test";
  process.env.MAIL_TRANSPORT = "json";
  process.env.MAIL_TO = "admin@example.com";
  process.env.VERIFY_SMTP_ON_STARTUP = "false";
  process.env.FRONTEND_ORIGINS = "http://localhost:5173";
  process.env.UPLOAD_TMP_DIR = uploadDirectory;

  const { createApp } = await import(`../src/app.js?test=${Date.now()}`);
  const { closeMailTransport } = await import("../src/services/mail.service.js");
  const { clearSubmissionStore } = await import(
    "../src/services/idempotency.service.js"
  );

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeMailTransport();
    clearSubmissionStore();
    await fs.rm(uploadDirectory, { recursive: true, force: true });
  });

  const address = server.address();
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
  ]);

  const createBody = () => {
    const body = new FormData();

    body.append(
      "payload",
      JSON.stringify({
        requestId: "test-request-12345678",
        formData: {
          companyType: "PT",
          companyName: "PT Uji Legal",
          modalDasar: 25_000_000,
          email: "pemohon@example.com",
          phone: "081234567890",
          pendiri: [
            {
              ktp: {
                fileName: "ktp.png",
                mimeType: "image/png",
                size: pngHeader.length,
              },
              npwp: "123456",
              phone: "081234567890",
              email: "pendiri@example.com",
              pekerjaan: "Wiraswasta",
              alamat: "Jakarta",
            },
          ],
        },
        payment: {
          referenceCode: "ABCDEF260923",
          amount: 3_000_000,
          submittedAt: "2026-09-23T10:00:00.000Z",
        },
      })
    );
    body.append(
      "fileManifest",
      JSON.stringify([
        { path: "formData.pendiri[0].ktp", label: "KTP Pendiri 1" },
      ])
    );
    body.append(
      "paymentProof",
      new Blob([pngHeader], { type: "image/png" }),
      "bukti-transfer.png"
    );
    body.append(
      "documents",
      new Blob([pngHeader], { type: "image/png" }),
      "ktp-pendiri.png"
    );

    return body;
  };

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/v1/submissions/payment-confirmation`,
    {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
      body: createBody(),
    }
  );
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.success, true);
  assert.equal(result.data.amount, 3_000_000);
  assert.equal(result.data.duplicate, false);
  assert.match(result.data.referenceCode, /^MAIL-\d{8}-[A-F0-9]{6}$/);

  const duplicateResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/v1/submissions/payment-confirmation`,
    {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
      body: createBody(),
    }
  );
  const duplicateResult = await duplicateResponse.json();

  assert.equal(duplicateResponse.status, 200);
  assert.equal(duplicateResult.success, true);
  assert.equal(duplicateResult.data.duplicate, true);
  assert.equal(
    duplicateResult.data.referenceCode,
    result.data.referenceCode
  );

  const remainingFiles = await fs.readdir(uploadDirectory);
  assert.deepEqual(remainingFiles, []);
});
