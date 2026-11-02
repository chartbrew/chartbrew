function normalizeInstruction(value) {
  return `${value || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

function isDirectConfirmation(value) {
  return /^(yes|yes please|confirm|go ahead|do it|please do|proceed)[.!]?$/i.test(value);
}

function isDirectMetricWriteInstruction(question, actionType) {
  if (!actionType?.startsWith("metric_monitor.")) return false;
  const instruction = normalizeInstruction(question);
  if (!instruction || /\b(maybe|might|perhaps|possibly|should|consider)\b/.test(instruction)) {
    return false;
  }
  if (/\b(preview|prepare|show me)\b/.test(instruction)) return false;
  if (/\b(recommend|suggest|which|what)\b/.test(instruction)
    && /\b(watch|monitor|metric)\b/.test(instruction)) {
    return false;
  }
  if (/\b(can|could|would) (this|that|it)\b/.test(instruction)) return false;
  const politePrefix = "(?:please |can you |could you |would you |i want you to )?";
  if (actionType.endsWith(".create")) {
    return new RegExp(`^${politePrefix}(?:watch|start watching|create(?: a)? watch|add(?: a)? watch|set up(?: a)? watch)\\b`)
      .test(instruction);
  }
  if (actionType.endsWith(".update")) {
    return new RegExp(`^${politePrefix}(?:change|edit|update)\\b`).test(instruction);
  }
  return false;
}

function assertPreviewInstruction(question, actionType) {
  const instruction = normalizeInstruction(question);
  const recommendationQuestion = /\b(recommend|suggest|which|what)\b/.test(instruction)
    && /\b(watch|monitor|metric|kpi|summary|review)\b/.test(instruction);
  const uncertainSuggestion = /\b(maybe|might|perhaps|possibly|should|consider)\b/.test(
    instruction
  );
  const capabilityQuestion = /\b(can|could|would) (this|that|it)\b/.test(instruction);
  let allowed = isDirectConfirmation(instruction);
  if (actionType.startsWith("metric_monitor.")) {
    const createInstruction = /\b(create|add|prepare|preview|set up|start watching|watch)\b/.test(
      instruction
    );
    const updateInstruction = /\b(change|edit|prepare|preview|update)\b/.test(instruction);
    allowed = allowed || (actionType.endsWith(".create")
      ? createInstruction && !recommendationQuestion && !uncertainSuggestion && !capabilityQuestion
      : updateInstruction && !uncertainSuggestion && !capabilityQuestion);
  }
  if (actionType.startsWith("kpi_review.")) {
    const createInstruction = /\b(create|prepare|preview|schedule|set up)\b/.test(instruction);
    const updateInstruction = /\b(change|edit|prepare|preview|reschedule|update)\b/.test(instruction);
    allowed = allowed || (actionType.endsWith(".create")
      ? createInstruction && !recommendationQuestion && !uncertainSuggestion && !capabilityQuestion
      : updateInstruction && !uncertainSuggestion && !capabilityQuestion);
  }
  if (!allowed) {
    const error = new Error("Ask the user to prepare this change before creating a preview");
    error.code = "PREVIEW_INSTRUCTION_REQUIRED";
    error.statusCode = 409;
    throw error;
  }
}

module.exports = {
  assertPreviewInstruction,
  isDirectConfirmation,
  isDirectMetricWriteInstruction,
  normalizeInstruction,
};
