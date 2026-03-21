export default function getDatasetDisplayName(dataset) {
  if (!dataset) return "";

  return dataset.name || dataset.legend || "";
}
