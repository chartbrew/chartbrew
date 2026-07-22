import React, { useCallback, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Separator,
  Switch,
  TextField,
  Tooltip,
} from "@heroui/react";
import { LuInfo } from "react-icons/lu";

import AceEditor from "../../../components/CodeEditor";
import {
  BOARD_TYPE_OPTIONS,
  DATE_FIELD_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  MODE_OPTIONS,
  RESOURCE_TRANSFORM_OPTIONS,
  SPRINT_STATE_OPTIONS,
  TRANSFORM_OPTIONS,
} from "../jira-builder.constants";
import JiraBuilderAutocompleteField from "./jira-builder-autocomplete-field";
import JiraBuilderSelectField from "./jira-builder-select-field";
import JiraDateRangeFields from "./jira-date-range-fields";
import { useJiraBuilder } from "./jira-builder-context";

function parseCsvKeys(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProjectItems(projects) {
  return projects.map((project) => ({
    id: project.key,
    label: `${project.key} - ${project.name}`,
    shortLabel: project.key,
    description: project.name,
    searchText: `${project.key} ${project.name}`,
  }));
}

function getBoardItems(boards) {
  return boards.map((board) => ({
    id: `${board.id}`,
    label: board.name,
    shortLabel: `${board.id}`,
    description: `${board.type || "board"} #${board.id}`,
    searchText: `${board.id} ${board.name} ${board.type || ""}`,
  }));
}

function getSprintItems(sprints) {
  return sprints.map((sprint) => ({
    id: `${sprint.id}`,
    label: sprint.name,
    shortLabel: `${sprint.id}`,
    description: `${sprint.state || "sprint"} #${sprint.id}`,
    searchText: `${sprint.id} ${sprint.name} ${sprint.state || ""}`,
  }));
}

function JiraConfigStep() {
  const {
    configuration,
    jiraBoards,
    jiraProjects,
    jiraSprints,
    loadBoards,
    loadSprints,
    metadataLoading,
    mode,
    resolveVariableValue,
    setMode,
    updateConfiguration,
    updateTransform,
    updateVisual,
  } = useJiraBuilder();
  const visual = configuration.visual || {};
  const projectItems = useMemo(() => getProjectItems(jiraProjects || []), [jiraProjects]);
  const boardItems = useMemo(() => getBoardItems(jiraBoards || []), [jiraBoards]);
  const sprintItems = useMemo(() => getSprintItems(jiraSprints || []), [jiraSprints]);
  const selectedProjectKeys = useMemo(() => parseCsvKeys(resolveVariableValue(visual.projects)), [
    resolveVariableValue,
    visual.projects,
  ]);
  const selectedBoardId = resolveVariableValue(configuration.boardId);
  const selectedSprintId = resolveVariableValue(configuration.sprintId);
  const resource = configuration.resource || "issues";
  const supportsJql = ["issues", "sprint_issues"].includes(resource);
  const availableModeOptions = supportsJql
    ? MODE_OPTIONS
    : MODE_OPTIONS.filter((option) => option.id !== "jql");
  const transformOptions = RESOURCE_TRANSFORM_OPTIONS[resource] || TRANSFORM_OPTIONS;
  const selectedTransform = transformOptions.some((option) => option.value === configuration.transform?.type)
    ? configuration.transform?.type
    : transformOptions[0]?.value || "raw";
  const showGroupOptions = selectedTransform === "grouped";
  const supportsDoneAt = ["issues", "sprint_issues"].includes(resource);
  const doneAtAutoEnabled = ["created_resolved_trend", "sprint_summary"].includes(selectedTransform);
  const doneAtEnabled = doneAtAutoEnabled || Boolean(configuration.includeDoneAt);
  const dateFieldOptions = doneAtEnabled
    ? DATE_FIELD_OPTIONS
    : DATE_FIELD_OPTIONS.filter((option) => option.value !== "doneAt");

  useEffect(() => {
    if (!supportsJql && mode === "jql") {
      setMode("visual");
      updateConfiguration({ mode: "visual" });
    }
  }, [mode, supportsJql]);

  useEffect(() => {
    if (!doneAtEnabled && visual.dateField === "doneAt") {
      updateVisual({ dateField: "created" });
    }
  }, [doneAtEnabled, visual.dateField]);

  useEffect(() => {
    if (selectedTransform !== configuration.transform?.type) {
      updateTransform({ type: selectedTransform });
    }
  }, [configuration.transform?.type, selectedTransform]);

  const updateIssueProjects = useCallback((keys) => {
    const projectKeys = Array.isArray(keys) ? keys.map((key) => `${key}`) : [];
    updateVisual({ projects: projectKeys.join(", ") });
    loadBoards(projectKeys[0] || "");
  }, [loadBoards, updateVisual]);

  const updateProjectFilter = useCallback((projectKeyOrId) => {
    const nextProject = projectKeyOrId ? `${projectKeyOrId}` : "";
    updateConfiguration({ projectIdOrKey: nextProject });
    loadBoards(nextProject);
  }, [loadBoards, updateConfiguration]);

  const updateBoard = useCallback((boardId) => {
    const nextBoardId = boardId ? `${boardId}` : "";
    updateConfiguration({
      boardId: nextBoardId,
      sprintId: "",
    });
    loadSprints(nextBoardId);
  }, [loadSprints, updateConfiguration]);

  const updateSprint = useCallback((sprintId) => {
    updateConfiguration({ sprintId: sprintId ? `${sprintId}` : "" });
  }, [updateConfiguration]);

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-accent">Step 2</span>
            <span className="text-base font-semibold text-foreground">Configure your dataset</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableModeOptions.map((option) => (
              <Button
                key={option.id}
                size="sm"
                className="rounded-full"
                variant={mode === option.id ? "primary" : "secondary"}
                onPress={() => {
                  setMode(option.id);
                  updateConfiguration({ mode: option.id });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {mode === "visual" && (
          <div className="flex flex-col gap-5">
            {resource === "issues" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <JiraBuilderAutocompleteField
                  label="Project keys"
                  name="jira-projects"
                  placeholder={metadataLoading ? "Loading projects..." : "Select projects"}
                  items={projectItems}
                  value={selectedProjectKeys}
                  selectionMode="multiple"
                  onChange={updateIssueProjects}
                  isDisabled={metadataLoading && projectItems.length === 0}
                  emptyLabel="No Jira projects found"
                />
                <TextField fullWidth name="jira-issue-type">
                  <Label>Issue type</Label>
                  <Input
                    placeholder="Bug, Story, Task"
                    value={visual.issueType || ""}
                    onChange={(event) => updateVisual({ issueType: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <TextField fullWidth name="jira-status-category">
                  <Label>Status category</Label>
                  <Input
                    placeholder="To Do, In Progress, Done"
                    value={visual.statusCategory || ""}
                    onChange={(event) => updateVisual({ statusCategory: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <TextField fullWidth name="jira-assignee">
                  <Label>Assignee</Label>
                  <Input
                    placeholder="account id or username"
                    value={visual.assignee || ""}
                    onChange={(event) => updateVisual({ assignee: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <TextField fullWidth name="jira-priority">
                  <Label>Priority</Label>
                  <Input
                    placeholder="High"
                    value={visual.priority || ""}
                    onChange={(event) => updateVisual({ priority: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <TextField fullWidth name="jira-fix-version">
                  <Label>Fix version</Label>
                  <Input
                    placeholder="v5.2.0"
                    value={visual.fixVersion || ""}
                    onChange={(event) => updateVisual({ fixVersion: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <JiraBuilderSelectField
                  label="Date field"
                  name="jira-date-field"
                  value={visual.dateField || "created"}
                  options={dateFieldOptions}
                  onChange={(value) => updateVisual({ dateField: value })}
                />
                <div className="md:col-span-2">
                  <JiraDateRangeFields />
                </div>
              </div>
            )}

            {resource === "sprint_issues" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField fullWidth name="jira-sprint-jql">
                  <Label>JQL filter</Label>
                  <Input
                    placeholder="statusCategory != Done"
                    value={configuration.jql || ""}
                    onChange={(event) => updateConfiguration({ jql: event.target.value })}
                    variant="secondary"
                  />
                </TextField>
                <JiraBuilderAutocompleteField
                  label="Board"
                  name="jira-sprint-issues-board"
                  placeholder={metadataLoading ? "Loading boards..." : "Select board"}
                  items={boardItems}
                  value={selectedBoardId}
                  selectionMode="single"
                  onChange={updateBoard}
                  isDisabled={metadataLoading && boardItems.length === 0}
                  emptyLabel="No Jira boards found"
                />
                <JiraBuilderAutocompleteField
                  label="Sprint"
                  name="jira-sprint-id"
                  placeholder={selectedBoardId ? "Select sprint" : "Select a board first"}
                  items={sprintItems}
                  value={selectedSprintId}
                  selectionMode="single"
                  onChange={updateSprint}
                  isDisabled={!selectedBoardId || (metadataLoading && sprintItems.length === 0)}
                  emptyLabel="No Jira sprints found"
                />
              </div>
            )}

            {resource === "boards" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <JiraBuilderAutocompleteField
                  label="Project"
                  name="jira-board-project"
                  placeholder={metadataLoading ? "Loading projects..." : "Filter by project"}
                  items={projectItems}
                  value={configuration.projectIdOrKey || ""}
                  selectionMode="single"
                  onChange={updateProjectFilter}
                  isDisabled={metadataLoading && projectItems.length === 0}
                  emptyLabel="No Jira projects found"
                />
                <JiraBuilderSelectField
                  label="Board type"
                  name="jira-board-type"
                  value={configuration.boardType || ""}
                  options={BOARD_TYPE_OPTIONS}
                  onChange={(value) => updateConfiguration({ boardType: value })}
                />
              </div>
            )}

            {resource === "sprints" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <JiraBuilderAutocompleteField
                  label="Board"
                  name="jira-board-id"
                  placeholder={metadataLoading ? "Loading boards..." : "Select board"}
                  items={boardItems}
                  value={selectedBoardId}
                  selectionMode="single"
                  onChange={updateBoard}
                  isDisabled={metadataLoading && boardItems.length === 0}
                  emptyLabel="No Jira boards found"
                />
                <JiraBuilderSelectField
                  label="Sprint state"
                  name="jira-sprint-state"
                  value={configuration.state || "active"}
                  options={SPRINT_STATE_OPTIONS}
                  onChange={(value) => updateConfiguration({ state: value })}
                />
              </div>
            )}

            {resource === "versions" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <JiraBuilderAutocompleteField
                  label="Project"
                  name="jira-version-project"
                  placeholder={metadataLoading ? "Loading projects..." : "Select project"}
                  items={projectItems}
                  value={configuration.projectIdOrKey || ""}
                  selectionMode="single"
                  onChange={(projectKeyOrId) => updateConfiguration({ projectIdOrKey: projectKeyOrId ? `${projectKeyOrId}` : "" })}
                  isDisabled={metadataLoading && projectItems.length === 0}
                  emptyLabel="No Jira projects found"
                />
              </div>
            )}
          </div>
        )}

        {mode === "jql" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">JQL</p>
              <p className="text-sm text-muted">Use Jira query language while keeping Chartbrew in charge of API details.</p>
            </div>
            <AceEditor
              mode="sql"
              theme="tomorrow"
              value={configuration.jql || ""}
              onChange={(value) => updateConfiguration({ jql: value })}
              height="180px"
              width="100%"
            />
          </div>
        )}

        {mode === "advanced" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Jira configuration</p>
              <p className="text-sm text-muted">Edit the source-owned configuration object directly.</p>
            </div>
            <AceEditor
              mode="json"
              theme="tomorrow"
              value={JSON.stringify(configuration, null, 2)}
              onChange={(value) => {
                try {
                  updateConfiguration(JSON.parse(value));
                } catch (error) {
                  // Keep editing until valid JSON is entered.
                }
              }}
              height="260px"
              width="100%"
            />
          </div>
        )}

        {supportsDoneAt && (
          <div className="flex flex-row flex-wrap items-center justify-between gap-3 rounded-lg border border-divider bg-surface-secondary/40 p-3">
            <Switch
              isSelected={doneAtEnabled}
              isDisabled={doneAtAutoEnabled}
              onChange={(isSelected) => updateConfiguration({ includeDoneAt: isSelected })}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Fetch done date from status history
              </Switch.Content>
            </Switch>
            <div className="flex items-center gap-2">
              {doneAtAutoEnabled && (
                <span className="text-xs text-muted">Enabled for this transform</span>
              )}
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    aria-label="Explain done date fetching"
                    size="sm"
                    variant="tertiary"
                  >
                    <LuInfo size={15} />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content className="max-w-xs">
                  Fetches Jira status history to populate doneAt when resolutiondate is empty. This adds changelog data to issue requests.
                </Tooltip.Content>
              </Tooltip>
            </div>
          </div>
        )}

        <Separator variant="tertiary" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <JiraBuilderSelectField
            label="Transform"
            name="jira-transform"
            value={selectedTransform}
            options={transformOptions}
            onChange={(value) => updateTransform({ type: value })}
          />
          {showGroupOptions && (
            <>
              <JiraBuilderSelectField
                label="Group by"
                name="jira-group-by"
                value={configuration.transform?.groupBy || "status"}
                options={GROUP_BY_OPTIONS}
                onChange={(value) => updateTransform({ groupBy: value })}
              />
              <JiraBuilderSelectField
                label="Metric"
                name="jira-metric"
                value={configuration.transform?.metric || "count"}
                options={METRIC_OPTIONS}
                onChange={(value) => updateTransform({ metric: value })}
              />
            </>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export default JiraConfigStep;
