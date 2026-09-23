import test from "node:test";
import assert from "node:assert/strict";
import { calculateSubmissionPrice, getPtPrice } from "../src/utils/pricing.js";

test("harga PT mengikuti seluruh batas modal", () => {
  assert.equal(getPtPrice(24_999_999), 2_500_000);
  assert.equal(getPtPrice(25_000_000), 3_000_000);
  assert.equal(getPtPrice(1_000_000_000), 3_000_000);
  assert.equal(getPtPrice(1_000_000_001), 5_000_000);
  assert.equal(getPtPrice(5_000_000_000), 5_000_000);
  assert.equal(getPtPrice(5_000_000_001), 7_500_000);
});

test("harga badan usaha selain PT sesuai frontend", () => {
  assert.equal(calculateSubmissionPrice({ companyType: "YAYASAN" }), 3_500_000);
  assert.equal(calculateSubmissionPrice({ companyType: "KOPERASI" }), 4_250_000);
  assert.equal(calculateSubmissionPrice({ companyType: "CV" }), 2_500_000);
  assert.equal(calculateSubmissionPrice({ companyType: "FIRMA" }), 2_500_000);
  assert.equal(calculateSubmissionPrice({ companyType: "PERKUMPULAN" }), 3_500_000);
});
