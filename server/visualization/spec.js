const { getMarkDefinition } = require("./registry");

const VISUALIZATION_SPEC_VERSION = 2;
const AGGREGATIONS = new Set([
  "none",
  "sum",
  "avg",
  "min",
  "max",
  "count",
  "count_unique",
]);
const FIELD_TYPES = new Set([
  "nominal",
  "ordinal",
  "quantitative",
  "temporal",
  "boolean",
  "record",
]);
const NULL_POLICIES = new Set(["exclude", "preserve", "label"]);
const TRANSFORM_TYPES = new Set(["filter", "sort", "limit", "window"]);
const WINDOW_OPERATIONS = new Set(["cumulativeSum"]);

class VisualizationSpecError extends Error {
  constructor(errors) {
    super(`Invalid visualization specification: ${errors.join("; ")}`);
    this.name = "VisualizationSpecError";
    this.errors = errors;
  }
}

function normalizeEncoding(encoding = {}) {
  return Object.entries(encoding).reduce((normalized, [role, definition]) => {
    if (Array.isArray(definition)) {
      normalized[role] = definition.map((item) => normalizeFieldEncoding(item));
    } else if (typeof definition === "string") {
      normalized[role] = normalizeFieldEncoding({ field: definition });
    } else if (definition && typeof definition === "object") {
      normalized[role] = normalizeFieldEncoding(definition);
    }

    return normalized;
  }, {});
}

function normalizeFieldEncoding(encoding = {}) {
  const normalized = { ...encoding };

  if (normalized.aggregate) {
    normalized.aggregate = `${normalized.aggregate}`.toLowerCase();
  }

  if (normalized.nullPolicy) {
    normalized.nullPolicy = `${normalized.nullPolicy}`.toLowerCase();
  }

  return normalized;
}

function normalizeVisualizationSpec(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const layers = Array.isArray(source.layers) ? source.layers : [];

  return {
    version: VISUALIZATION_SPEC_VERSION,
    status: source.status || "ready",
    layers: layers.map((layer, index) => ({
      ...layer,
      id: layer?.id ? `${layer.id}` : `layer-${index + 1}`,
      bindingId: layer?.bindingId ?? null,
      mark: layer?.mark ? `${layer.mark}`.toLowerCase() : "line",
      encoding: normalizeEncoding(layer?.encoding),
      transforms: Array.isArray(layer?.transforms) ? layer.transforms.map((item) => ({ ...item })) : [],
      style: layer?.style && typeof layer.style === "object" ? { ...layer.style } : {},
      stack: layer?.stack || "none",
      orientation: layer?.orientation || "vertical",
    })),
    settings: source.settings && typeof source.settings === "object" ? { ...source.settings } : {},
    metadata: source.metadata && typeof source.metadata === "object" ? { ...source.metadata } : {},
  };
}

function validateFieldEncoding(encoding, path, errors) {
  if (!encoding || typeof encoding !== "object" || Array.isArray(encoding)) {
    errors.push(`${path} must be a field encoding object`);
    return;
  }

  if (typeof encoding.field !== "string" || encoding.field.length === 0) {
    errors.push(`${path}.field is required`);
  }

  if (encoding.type && !FIELD_TYPES.has(encoding.type)) {
    errors.push(`${path}.type is not supported`);
  }

  if (encoding.aggregate && !AGGREGATIONS.has(encoding.aggregate)) {
    errors.push(`${path}.aggregate is not supported`);
  }

  if (encoding.nullPolicy && !NULL_POLICIES.has(encoding.nullPolicy)) {
    errors.push(`${path}.nullPolicy is not supported`);
  }
}

function validateVisualizationSpec(input, options = {}) {
  const spec = normalizeVisualizationSpec(input);
  const errors = [];
  const allowIncomplete = Boolean(options.allowIncomplete || spec.status !== "ready");
  const layerIds = new Set();

  if (input?.version !== undefined && input.version !== VISUALIZATION_SPEC_VERSION) {
    errors.push(`version must be ${VISUALIZATION_SPEC_VERSION}`);
  }

  if (!Array.isArray(input?.layers)) {
    errors.push("layers must be an array");
  }

  spec.layers.forEach((layer, layerIndex) => {
    const layerPath = `layers[${layerIndex}]`;
    const markDefinition = getMarkDefinition(layer.mark);

    if (layerIds.has(layer.id)) {
      errors.push(`${layerPath}.id must be unique`);
    }
    layerIds.add(layer.id);

    if (!markDefinition) {
      errors.push(`${layerPath}.mark is not supported`);
      return;
    }

    if (markDefinition.bindingRequired !== false
      && layer.bindingId === null
      && !allowIncomplete) {
      errors.push(`${layerPath}.bindingId is required`);
    }

    Object.entries(layer.encoding).forEach(([role, encoding]) => {
      const slot = markDefinition.slots[role];
      if (!slot) {
        errors.push(`${layerPath}.encoding.${role} is not valid for ${layer.mark}`);
        return;
      }

      if (Array.isArray(encoding)) {
        if (!slot.multiple) {
          errors.push(`${layerPath}.encoding.${role} does not accept multiple fields`);
          return;
        }
        encoding.forEach((item, index) => {
          validateFieldEncoding(item, `${layerPath}.encoding.${role}[${index}]`, errors);
        });
        return;
      }

      validateFieldEncoding(encoding, `${layerPath}.encoding.${role}`, errors);
    });

    layer.transforms.forEach((transform, transformIndex) => {
      const transformPath = `${layerPath}.transforms[${transformIndex}]`;
      if (!transform || typeof transform !== "object" || !TRANSFORM_TYPES.has(transform.type)) {
        errors.push(`${transformPath}.type is not supported`);
      } else if (transform.type === "window" && !WINDOW_OPERATIONS.has(transform.operation)) {
        errors.push(`${transformPath}.operation is not supported`);
      }
    });

    if (!allowIncomplete) {
      Object.entries(markDefinition.slots).forEach(([role, slot]) => {
        if (slot.required && !layer.encoding[role]) {
          errors.push(`${layerPath}.encoding.${role} is required for ${layer.mark}`);
        }
      });

      (markDefinition.requiredOneOf || []).forEach((roles) => {
        if (!roles.some((role) => layer.encoding[role])) {
          errors.push(`${layerPath}.encoding requires one of ${roles.join(", ")}`);
        }
      });
    }
  });

  return {
    errors,
    spec,
    valid: errors.length === 0,
  };
}

function assertVisualizationSpec(input, options = {}) {
  const validation = validateVisualizationSpec(input, options);
  if (!validation.valid) {
    throw new VisualizationSpecError(validation.errors);
  }

  return validation.spec;
}

module.exports = {
  AGGREGATIONS,
  FIELD_TYPES,
  NULL_POLICIES,
  TRANSFORM_TYPES,
  WINDOW_OPERATIONS,
  VISUALIZATION_SPEC_VERSION,
  VisualizationSpecError,
  assertVisualizationSpec,
  normalizeVisualizationSpec,
  validateVisualizationSpec,
};
