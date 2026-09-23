import test from "node:test";
import assert from "node:assert/strict";
import { buildSubmissionEmail } from "../src/templates/submission-email.js";

test("template email menampilkan data dan mengamankan HTML pengguna", () => {
  const result = buildSubmissionEmail({
    payload: {
      formData: {
        companyType: "PT",
        companyName: "PT Aman <script>alert(1)</script>",
        modalDasar: 25_000_000,
      },
      payment: {
        referenceCode: "ABCDEF260923",
        amount: 3_000_000,
      },
    },
    serverReference: "MAIL-20260923-ABC123",
    acceptedAt: new Date("2026-09-23T10:00:00.000Z"),
    attachments: [{ label: "Bukti Transfer", fileName: "bukti.png" }],
  });

  assert.match(result.html, /PT Aman &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.html, /<script>alert\(1\)<\/script>/);
  assert.match(result.html, /Rp 3\.000\.000/);
  assert.match(result.text, /ABCDEF260923/);
});
