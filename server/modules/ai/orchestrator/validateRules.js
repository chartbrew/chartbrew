/* eslint-disable max-len */
/* eslint-disable no-console */

/**
 * Validation script for entity creation rules
 *
 * Run with: node server/modules/ai/validateRules.js
 *
 * Checks:
 * - Rules are properly formatted
 * - No common typos or issues
 * - Token count estimation
 * - Required sections present
 */

const { ENTITY_CREATION_RULES, FIELD_SPECS, DEFAULTS } = require("./entityCreationRules");

const REQUIRED_SECTIONS = [
  "Dataset:",
  "DataRequest:",
  "Chart:",
  "ChartDatasetConfig:",
  "Sequence:"
];

const REQUIRED_KEYWORDS = {
  Dataset: ["Required:", "draft", "main_dr_id", "xAxis", "yAxis"],
  DataRequest: ["Required:", "query"],
  Chart: ["Required:", "draft", "type"],
  ChartDatasetConfig: ["Required:", "chart_id", "dataset_id"]
};

function validateRules() {
  const issues = [];
  const warnings = [];
  let score = 100;

  console.log("🔍 Validating AI Entity Creation Rules...\n");

  // Check 1: All required sections present
  console.log("✓ Checking required sections...");
  REQUIRED_SECTIONS.forEach((section) => {
    if (!ENTITY_CREATION_RULES.includes(section)) {
      issues.push(`Missing required section: "${section}"`);
      score -= 20;
    }
  });

  // Check 2: Required keywords for each entity type
  console.log("✓ Checking required keywords...");
  Object.entries(REQUIRED_KEYWORDS).forEach(([entity, keywords]) => {
    keywords.forEach((keyword) => {
      const sectionRegex = new RegExp(`\\*\\*${entity}:\\*\\*([\\s\\S]*?)(?=\\*\\*|$)`);
      const match = ENTITY_CREATION_RULES.match(sectionRegex);
      if (match && !match[1].includes(keyword)) {
        warnings.push(`${entity} section missing keyword: "${keyword}"`);
        score -= 5;
      }
    });
  });

  // Check 3: Field specs match entities
  console.log("✓ Checking field specs...");
  const expectedEntities = ["Dataset", "DataRequest", "Chart", "ChartDatasetConfig"];
  expectedEntities.forEach((entity) => {
    if (!FIELD_SPECS[entity]) {
      warnings.push(`FIELD_SPECS missing entry for: ${entity}`);
      score -= 10;
    } else if (!FIELD_SPECS[entity].required || FIELD_SPECS[entity].required.length === 0) {
      warnings.push(`${entity} has no required fields defined`);
      score -= 5;
    }
  });

  // Check 4: Token count estimation
  console.log("✓ Estimating token count...");
  const tokenCount = Math.ceil(ENTITY_CREATION_RULES.length / 4); // Rough estimate
  console.log(`  Estimated tokens: ${tokenCount}`);
  if (tokenCount > 400) {
    warnings.push(`Rules are getting long (${tokenCount} tokens). Consider condensing.`);
    score -= 5;
  }

  // Check 5: Common typos
  console.log("✓ Checking for common typos...");
  const typos = [
    { wrong: "datarequest", correct: "DataRequest" },
    { wrong: "chartdatasetconfig", correct: "ChartDatasetConfig" },
    { wrong: "datasource", correct: "DataRequest" },
  ];

  typos.forEach(({ wrong, correct }) => {
    if (ENTITY_CREATION_RULES.toLowerCase().includes(wrong.toLowerCase())
      && !ENTITY_CREATION_RULES.includes(correct)) {
      warnings.push(`Possible typo: "${wrong}" (should be "${correct}"?)`);
      score -= 2;
    }
  });

  // Check 6: Creation sequence has numbered steps
  console.log("✓ Checking creation sequence...");
  const sequenceMatch = ENTITY_CREATION_RULES.match(/\*\*Sequence:\*\*([\s\S]*?)$/);
  if (sequenceMatch) {
    const sequence = sequenceMatch[1];
    const steps = (sequence.match(/^\d+\./gm) || []).length;
    if (steps < 5) {
      warnings.push(`Creation sequence has only ${steps} steps (expected 6+)`);
      score -= 5;
    }
    console.log(`  Found ${steps} creation steps`);
  }

  // Check 7: Defaults are reasonable
  console.log("✓ Checking defaults...");
  if (!DEFAULTS.chartColors || DEFAULTS.chartColors.length === 0) {
    warnings.push("No default chart colors defined");
    score -= 5;
  }
  if (!DEFAULTS.chartTypes || Object.keys(DEFAULTS.chartTypes).length === 0) {
    warnings.push("No chart types defined in DEFAULTS");
    score -= 5;
  }

  // Report results
  console.log(`\n${"=".repeat(60)}`);
  if (issues.length === 0 && warnings.length === 0) {
    console.log("✅ All checks passed! Rules are valid.");
    console.log(`📊 Score: ${score}/100`);
  } else {
    if (issues.length > 0) {
      console.log("\n❌ ISSUES FOUND:");
      issues.forEach((issue) => console.log(`   - ${issue}`));
    }
    if (warnings.length > 0) {
      console.log("\n⚠️  WARNINGS:");
      warnings.forEach((warning) => console.log(`   - ${warning}`));
    }
    console.log(`\n📊 Score: ${score}/100`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📈 Statistics:");
  console.log(`   Rules length: ${ENTITY_CREATION_RULES.length} characters`);
  console.log(`   Estimated tokens: ~${tokenCount}`);
  console.log(`   Entity types: ${Object.keys(FIELD_SPECS).length}`);
  console.log(`   Chart types: ${Object.keys(DEFAULTS.chartTypes).length}`);
  console.log(`   Default colors: ${DEFAULTS.chartColors.length}`);

  // Return validation result
  return {
    valid: issues.length === 0,
    score,
    issues,
    warnings,
    stats: {
      tokenCount,
      entityTypes: Object.keys(FIELD_SPECS).length,
      chartTypes: Object.keys(DEFAULTS.chartTypes).length
    }
  };
}

// Run if called directly
if (require.main === module) {
  const result = validateRules();
  process.exit(result.valid ? 0 : 1);
}

module.exports = { validateRules };
