function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getTemplateBindingId(config, index) {
  return config?.templateBindingId
    ?? config?.bindingId
    ?? config?.id
    ?? `binding-${index + 1}`;
}

function remapVisualizationBindings(visualization, sourceConfigs = [], createdConfigs = []) {
  if (!visualization?.layers || createdConfigs.length === 0) return visualization;

  const next = clone(visualization);
  const mapping = new Map();
  sourceConfigs.forEach((config, index) => {
    const created = createdConfigs[index];
    if (!created?.id) return;
    mapping.set(`${getTemplateBindingId(config, index)}`, created.id);
  });

  const unresolvedBindings = [];
  const resolvedCreatedIds = new Set();
  next.layers.forEach((layer) => {
    if (layer.bindingId === null || layer.bindingId === undefined) return;
    const bindingId = `${layer.bindingId}`;
    if (mapping.has(bindingId)) {
      resolvedCreatedIds.add(`${mapping.get(bindingId)}`);
    } else if (!unresolvedBindings.includes(bindingId)) {
      unresolvedBindings.push(bindingId);
    }
  });
  const availableCreatedIds = createdConfigs
    .map((config) => config?.id)
    .filter((id) => id && !resolvedCreatedIds.has(`${id}`));
  unresolvedBindings.forEach((bindingId, index) => {
    if (availableCreatedIds[index]) mapping.set(bindingId, availableCreatedIds[index]);
  });

  next.layers = next.layers.map((layer) => {
    if (layer.bindingId === null || layer.bindingId === undefined) return layer;
    const bindingId = mapping.get(`${layer.bindingId}`);
    return bindingId ? { ...layer, bindingId } : layer;
  });
  return next;
}

module.exports = {
  getTemplateBindingId,
  remapVisualizationBindings,
};
