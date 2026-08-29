export const databaseUnitTests = [
  "tests/unit/bullBoardAuth.test.js",
  "tests/unit/chartControllerBackgroundUpdate.test.js",
  "tests/unit/mcpHttpFixture.test.js",
  "tests/unit/safeRequest.test.js",
  "tests/unit/stripeOfficialAi.test.js",
  "tests/unit/stripeOfficialAiHarness.test.js",
  "tests/unit/updateAudit.test.js",
];

export const databaseTests = [
  "tests/integration/**/*.test.js",
  ...databaseUnitTests,
];
