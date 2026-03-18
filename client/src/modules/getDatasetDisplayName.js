export function getDatasetDisplayName(dataset = {}) {
  return dataset?.name || dataset?.legend || "";
}
