import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Stripe template setup redirects to the dashboard after loading completes", async () => {
  const source = await readSource("./stripe/stripe-template-setup.jsx");

  assert.match(source, /const \[hasStartedCreate, setHasStartedCreate\] = useState\(false\);/);
  assert.match(source, /setHasStartedCreate\(true\);\s*dispatch\(createFromChartTemplate/s);
  assert.match(source, /useEffect\(\(\) => \{\s*if \(!hasStartedCreate \|\| !showCreateResult \|\| !result\?\.project_id\) return;\s*navigate\(`\/dashboard\/\$\{result\.project_id\}`\);\s*\}, \[hasStartedCreate, navigate, result\?\.project_id, showCreateResult\]\);/s);
});

test("Jira template setup redirects to the dashboard after chart creation loading completes", async () => {
  const source = await readSource("./jira/jira-template-setup.jsx");

  assert.match(source, /useEffect\(\(\) => \{\s*if \(!createResult\?\.project_id \|\| isCreating \|\| actionMode !== "dashboard"\) return;\s*navigate\(`\/dashboard\/\$\{createResult\.project_id\}`\);\s*\}, \[actionMode, createResult\?\.project_id, isCreating, navigate\]\);/s);
});
