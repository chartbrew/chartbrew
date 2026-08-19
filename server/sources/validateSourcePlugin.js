const fs = require("fs");
const path = require("path");

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function assertFunction(value, message) {
  if (typeof value !== "function") {
    throw new Error(message);
  }
}

function validateTemplateFiles(plugin) {
  const chartTemplates = plugin.templates?.chartTemplates || [];
  if (!Array.isArray(chartTemplates)) {
    throw new Error(`Source plugin ${plugin.id} templates.chartTemplates must be an array`);
  }

  const supportsChartTemplates = plugin.capabilities?.templates?.charts === true;
  if (supportsChartTemplates && chartTemplates.length === 0) {
    throw new Error(`Source plugin ${plugin.id} supports chart templates but does not list any`);
  }

  if (chartTemplates.length === 0) {
    return;
  }

  if (!plugin.templates?.directory || typeof plugin.templates.directory !== "string") {
    throw new Error(`Source plugin ${plugin.id} templates.directory is required`);
  }

  const templatesDirectory = path.resolve(plugin.templates.directory);
  if (!fs.existsSync(templatesDirectory) || !fs.statSync(templatesDirectory).isDirectory()) {
    throw new Error(`Source plugin ${plugin.id} templates.directory does not exist`);
  }

  chartTemplates.forEach((slug) => {
    if (!slug || typeof slug !== "string") {
      throw new Error(`Source plugin ${plugin.id} has an invalid chart template slug`);
    }

    const templatePath = path.resolve(templatesDirectory, `${slug}.json`);
    if (!isPathInside(templatesDirectory, templatePath) || !fs.existsSync(templatePath)) {
      throw new Error(`Source plugin ${plugin.id} template ${slug} does not exist`);
    }

    const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    if (template.source !== plugin.id) {
      throw new Error(`Source plugin ${plugin.id} template ${slug} has mismatched source`);
    }
    if (template.slug !== slug) {
      throw new Error(`Source plugin ${plugin.id} template ${slug} has mismatched slug`);
    }
  });
}

function validateBackend(plugin) {
  if (plugin.capabilities?.connection?.supportsTest) {
    assertFunction(
      plugin.backend.testConnection,
      `Source plugin ${plugin.id} supports saved connection tests but has no backend.testConnection`
    );
    assertFunction(
      plugin.backend.testUnsavedConnection,
      `Source plugin ${plugin.id} supports unsaved connection tests but has no backend.testUnsavedConnection`
    );
  }

  if (plugin.capabilities?.templates?.charts) {
    assertFunction(
      plugin.backend.getDefaultDataRequest,
      `Source plugin ${plugin.id} supports chart templates but has no backend.getDefaultDataRequest`
    );
  }

  if (plugin.capabilities?.data?.supportsSchema) {
    assertFunction(
      plugin.backend.getSchema,
      `Source plugin ${plugin.id} supports schema loading but has no backend.getSchema`
    );
  }

  if (plugin.backend.prepareConnectionData !== undefined) {
    assertFunction(
      plugin.backend.prepareConnectionData,
      `Source plugin ${plugin.id} backend.prepareConnectionData must be a function`
    );
  }

  if (plugin.backend.authorizeConnectionWrite !== undefined) {
    assertFunction(
      plugin.backend.authorizeConnectionWrite,
      `Source plugin ${plugin.id} backend.authorizeConnectionWrite must be a function`
    );
  }

  if (plugin.backend.redactConnection !== undefined) {
    assertFunction(
      plugin.backend.redactConnection,
      `Source plugin ${plugin.id} backend.redactConnection must be a function`
    );
  }

  if (plugin.backend.completeOAuth !== undefined) {
    assertFunction(
      plugin.backend.completeOAuth,
      `Source plugin ${plugin.id} backend.completeOAuth must be a function`
    );
  }

  if (plugin.backend.oauthClientMetadata !== undefined) {
    assertFunction(
      plugin.backend.oauthClientMetadata,
      `Source plugin ${plugin.id} backend.oauthClientMetadata must be a function`
    );
  }

  if (plugin.backend.applyVariables !== undefined) {
    assertFunction(
      plugin.backend.applyVariables,
      `Source plugin ${plugin.id} backend.applyVariables must be a function`
    );
  }

  if (plugin.capabilities?.ai?.canGenerateQueries) {
    assertFunction(
      plugin.backend.ai?.generateQuery,
      `Source plugin ${plugin.id} supports AI query generation but has no backend.ai.generateQuery`
    );
  }

  const actionNames = plugin.capabilities?.actions || [];
  if (!Array.isArray(actionNames)) {
    throw new Error(`Source plugin ${plugin.id} capabilities.actions must be an array`);
  }

  actionNames.forEach((actionName) => {
    assertFunction(
      plugin.backend.actions?.[actionName],
      `Source plugin ${plugin.id} action ${actionName} is not implemented`
    );
  });
}

function validateAvailability(plugin) {
  const availability = plugin.availability;
  if (availability === undefined) return;

  if (!availability || typeof availability !== "object") {
    throw new Error(`Source plugin ${plugin.id} availability must be an object`);
  }

  if (
    availability.server?.enabled !== undefined
    && typeof availability.server.enabled !== "boolean"
  ) {
    throw new Error(`Source plugin ${plugin.id} availability.server.enabled must be a boolean`);
  }

  if (
    availability.ui?.canCreateConnections !== undefined
    && typeof availability.ui.canCreateConnections !== "boolean"
  ) {
    throw new Error(`Source plugin ${plugin.id} availability.ui.canCreateConnections must be a boolean`);
  }
}

function validateSourcePlugin(plugin) {
  if (!plugin || typeof plugin !== "object") {
    throw new Error("Source plugin must be an object");
  }

  if (!plugin.id || typeof plugin.id !== "string") {
    throw new Error("Source plugin is missing id");
  }

  if (!plugin.type || typeof plugin.type !== "string") {
    throw new Error(`Source plugin ${plugin.id} is missing type`);
  }

  if (plugin.subType !== undefined && typeof plugin.subType !== "string") {
    throw new Error(`Source plugin ${plugin.id} subType must be a string`);
  }

  if (!plugin.name || typeof plugin.name !== "string") {
    throw new Error(`Source plugin ${plugin.id} is missing name`);
  }

  if (!plugin.capabilities || typeof plugin.capabilities !== "object") {
    throw new Error(`Source plugin ${plugin.id} is missing capabilities`);
  }

  if (plugin.dependsOn !== undefined && !Array.isArray(plugin.dependsOn)) {
    throw new Error(`Source plugin ${plugin.id} dependsOn must be an array`);
  }

  if (!plugin.backend || typeof plugin.backend !== "object") {
    throw new Error(`Source plugin ${plugin.id} is missing backend`);
  }

  validateAvailability(plugin);
  validateBackend(plugin);
  validateTemplateFiles(plugin);

  return plugin;
}

module.exports = validateSourcePlugin;
