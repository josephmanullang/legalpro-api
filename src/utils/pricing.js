const FIXED_PRICES = Object.freeze({
  YAYASAN: 3_500_000,
  KOPERASI: 4_250_000,
  CV: 2_500_000,
  FIRMA: 2_500_000,
  PERKUMPULAN: 3_500_000,
});

export const COMPANY_TYPES = Object.freeze([
  "PT",
  "YAYASAN",
  "KOPERASI",
  "CV",
  "FIRMA",
  "PERKUMPULAN",
]);

export const getPtPrice = (modalDasar) => {
  const modal = Number(modalDasar);

  if (!Number.isFinite(modal) || modal <= 0) return 0;
  if (modal < 25_000_000) return 2_500_000;
  if (modal <= 1_000_000_000) return 3_000_000;
  if (modal <= 5_000_000_000) return 5_000_000;
  return 7_500_000;
};

export const calculateSubmissionPrice = (formData) => {
  if (!formData || typeof formData !== "object") return 0;

  if (formData.companyType === "PT") {
    return getPtPrice(formData.modalDasar);
  }

  return FIXED_PRICES[formData.companyType] || 0;
};
