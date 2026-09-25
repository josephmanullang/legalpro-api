const COMMON_FIELDS = Object.freeze([
  "jalan",
  "kelurahan",
  "kecamatan",
  "kota",
  "provinsi",
  "kodePos",
  "email",
  "phone",
  "kbli",
  "ktp",
  "npwp",
]);

const COMPANY_FIELDS = Object.freeze({
  PT: Object.freeze([
    "ptType",
    "companyName",
    "companyName2",
    "companyName3",
    "nameChecked",
    "commissionerMain",
    "commissioner1",
    "commissioner2",
    "directorMain",
    "director1",
    "director2",
    "shareholder1",
    "shareholder2",
    "shareholder3",
    "rangeModal",
    "modalDasar",
    "modalDisetor",
    "pembagianSaham",
    "pendiri",
  ]),
  YAYASAN: Object.freeze([
    "foundationName1",
    "foundationName2",
    "foundationName3",
    "foundationFounders",
    "foundationChairman",
    "foundationSecretary",
    "foundationTreasurer",
    "foundationSupervisors",
    "foundationCapital",
    "pembinaYayasan",
    "pengurusYayasan",
    "pengawasYayasan",
  ]),
  KOPERASI: Object.freeze([
    "koperasiType",
    "cooperativeName1",
    "cooperativeName2",
    "cooperativeName3",
    "cooperativeChairman",
    "cooperativeSecretary",
    "cooperativeTreasurer",
    "cooperativeFounders",
    "cooperativeManagers",
    "cooperativeSupervisors",
    "cooperativeCapital",
    "cooperativePrincipal",
    "cooperativeMandatory",
  ]),
  CV: Object.freeze([
    "cvName1",
    "cvName2",
    "cvName3",
    "cvFounders",
    "cvActivePartners",
    "cvPassivePartners",
    "cvCapital",
  ]),
  FIRMA: Object.freeze([
    "firmaName1",
    "firmaName2",
    "firmaName3",
    "firmaFounders",
    "firmaCapital",
  ]),
  PERKUMPULAN: Object.freeze([
    "associateName1",
    "associateName2",
    "associateName3",
    "associateFounders",
    "associateChairman",
    "associateSecretary",
    "associateTreasurer",
    "associatePurpose",
    "associateCapital",
  ]),
});

const pruneEmpty = (value) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined);

    return items.length > 0 ? items : undefined;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, pruneEmpty(item)])
      .filter(([, item]) => item !== undefined);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return value;
};

export const getEmailFormFields = (companyType) =>
  new Set([
    "companyType",
    ...COMMON_FIELDS,
    ...(COMPANY_FIELDS[companyType] || []),
  ]);

export const sanitizeSubmissionFormDataForEmail = (formData) => {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    return {};
  }

  const allowedFields = getEmailFormFields(formData.companyType);

  return Object.fromEntries(
    Object.entries(formData)
      .filter(([key]) => allowedFields.has(key))
      .map(([key, value]) => [key, pruneEmpty(value)])
      .filter(([, value]) => value !== undefined)
  );
};

const getManifestRootField = (path) => {
  if (typeof path !== "string") return null;
  return path.match(/^formData\.([A-Za-z0-9_]+)(?:\.|\[|$)/)?.[1] || null;
};

export const prepareSubmissionEmailData = ({
  payload,
  fileManifest,
  documentFiles,
}) => {
  const sanitizedFormData = sanitizeSubmissionFormDataForEmail(
    payload?.formData
  );
  const allowedFields = getEmailFormFields(sanitizedFormData.companyType);
  const manifestItems = Array.isArray(fileManifest) ? fileManifest : [];
  const files = Array.isArray(documentFiles) ? documentFiles : [];
  const permittedDocuments = manifestItems
    .map((manifest, index) => ({
      manifest,
      file: files[index],
      rootField: getManifestRootField(manifest?.path),
    }))
    .filter(
      ({ file, rootField }) =>
        file && rootField !== null && allowedFields.has(rootField)
    );

  return {
    payload: {
      ...payload,
      formData: sanitizedFormData,
    },
    fileManifest: permittedDocuments.map(({ manifest }) => manifest),
    documentFiles: permittedDocuments.map(({ file }) => file),
  };
};

export { COMMON_FIELDS, COMPANY_FIELDS };
