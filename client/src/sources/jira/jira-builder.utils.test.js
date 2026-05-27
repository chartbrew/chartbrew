import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const DEFAULT_CONFIGURATION = {
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "created >= {{start_date}} AND created <= {{end_date}} ORDER BY updated DESC",
  fields: ["key", "summary", "status", "assignee", "priority", "issuetype", "created", "updated", "resolutiondate", "project"],
  transform: {
    type: "raw",
  },
  includeDoneAt: false,
  visual: {
    dateField: "created",
    startDate: "last_30_days",
    endDate: "now",
  },
  pagination: {
    startAt: 0,
    maxResults: 100,
    maxRecords: 5000,
  },
};

async function loadJiraBuilderUtils() {
  const source = await readFile(new URL("./jira-builder.utils.js", import.meta.url), "utf8");
  const context = vm.createContext({
    Date,
    RegExp,
    String,
    Number,
  });

  const modules = {
    "./jira.source": new vm.SyntheticModule(["DEFAULT_CONFIGURATION"], function() {
      this.setExport("DEFAULT_CONFIGURATION", DEFAULT_CONFIGURATION);
    }, { context }),
  };

  const mod = new vm.SourceTextModule(source, {
    context,
    identifier: "jira-builder.utils.js",
  });

  await mod.link((specifier) => modules[specifier]);
  await mod.evaluate();

  return mod.namespace;
}

test("mergeConfiguration preserves template JQL when visual fields are not explicit", async () => {
  const { mergeConfiguration } = await loadJiraBuilderUtils();
  const dataRequest = {
    configuration: {
      source: "jira",
      resource: "issues",
      mode: "visual",
      jql: "project IN ({{projects}}) AND statusCategory != Done",
      transform: {
        type: "grouped",
        metric: "count",
        groupBy: "status",
      },
      pagination: {
        startAt: 0,
        maxResults: 100,
        maxRecords: 5000,
      },
    },
  };

  const configuration = mergeConfiguration(dataRequest);

  assert.equal(configuration.jql, "project IN ({{projects}}) AND statusCategory != Done");
  assert.equal(configuration.transform.groupBy, "status");
});

test("buildJqlFromVisualConfig includes the full selected end date", async () => {
  const { buildJqlFromVisualConfig } = await loadJiraBuilderUtils();

  const jql = buildJqlFromVisualConfig({
    visual: {
      projects: "CB",
      dateField: "created",
      startDate: "2026-04-27",
      endDate: "2026-05-27",
    },
  });

  assert.equal(jql, "project IN (CB) AND created >= 2026-04-27 AND created <= \"2026-05-27 23:59\" ORDER BY created DESC");
});
