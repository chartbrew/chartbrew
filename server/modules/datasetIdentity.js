function getDatasetDisplayName(dataset = {}) {
  return dataset?.name || dataset?.legend || "";
}

function normalizeDatasetIdentityPayload(data = {}) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const normalizedData = { ...data };
  const preferredName = normalizedData.name || normalizedData.legend;

  if (!preferredName) {
    return normalizedData;
  }

  normalizedData.name = preferredName;
  normalizedData.legend = preferredName;

  return normalizedData;
}

module.exports = {
  getDatasetDisplayName,
  normalizeDatasetIdentityPayload,
};
