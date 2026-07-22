import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Surface,
  Tabs,
  TextField,
} from "@heroui/react";
import {
  LuActivity,
  LuBug,
  LuChartArea,
  LuChartBar,
  LuChartLine,
  LuChartPie,
  LuCheck,
  LuCircleCheck,
  LuClock,
  LuGauge,
  LuListChecks,
  LuPlus,
  LuTable,
  LuUsers,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import { createFromChartTemplate, getChartTemplate } from "../../slices/chartTemplate";
import { getProjectCharts } from "../../slices/chart";
import { runSourceAction } from "../../slices/connection";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import JiraBuilderAutocompleteField from "./components/jira-builder-autocomplete-field";

const DASHBOARD_CREATE_SETTLE_DELAY_MS = 10000;

const GROUPS = [{
  id: "overview",
  label: "Project overview",
  description: "Issue trends, status breakdowns, workload, and recently completed work.",
}, {
  id: "sprint",
  label: "Sprint health",
  description: "Sprint completion, completed story points, carryover, and assignee workload.",
}, {
  id: "bugs",
  label: "Bug tracking",
  description: "Open bugs, priority breakdowns, oldest bugs, and bug trends.",
}, {
  id: "workload",
  label: "Team workload",
  description: "Open work, work in progress, and stale issues by assignee.",
}];

const TEMPLATE_ORDER = {
  "project-overview": 0,
  "sprint-health": 1,
  "bug-tracking": 2,
  "team-workload": 3,
};

const TEMPLATE_ICONS = {
  Activity: LuActivity,
  BadgeCheck: LuCircleCheck,
  BarChart3: LuChartBar,
  Bug: LuBug,
  Clock: LuClock,
  Gauge: LuGauge,
  LineChart: LuChartLine,
  ListChecks: LuListChecks,
  PieChart: LuChartPie,
  Table: LuTable,
  Users: LuUsers,
};

const RESOURCE_LABELS = {
  boards: "Boards",
  issues: "Issues",
  sprint_issues: "Sprint issues",
  sprints: "Sprints",
  versions: "Versions",
};

const CARD_META = {
  "project-overview:created-vs-resolved": {
    group: "overview",
    filters: ["Project", "Date range"],
    recommended: true,
  },
  "project-overview:issues-by-status": {
    group: "overview",
    filters: ["Open issues"],
    recommended: true,
  },
  "project-overview:issues-by-assignee": {
    group: "overview",
    filters: ["Open issues"],
    recommended: true,
  },
  "project-overview:recent-completed-work": {
    group: "overview",
    filters: ["Resolved recently"],
    recommended: true,
  },
  "sprint-health:sprint-completion": {
    group: "sprint",
    filters: ["Sprint ID"],
    recommended: true,
  },
  "sprint-health:story-points-completed": {
    group: "sprint",
    filters: ["Sprint ID"],
    recommended: true,
  },
  "sprint-health:sprint-work-by-assignee": {
    group: "sprint",
    filters: ["Sprint ID"],
    recommended: true,
  },
  "sprint-health:sprint-status-breakdown": {
    group: "sprint",
    filters: ["Sprint ID"],
  },
  "sprint-health:carryover-issues": {
    group: "sprint",
    filters: ["Not done", "Sprint ID"],
    recommended: true,
  },
  "bug-tracking:bugs-by-priority": {
    group: "bugs",
    filters: ["Bug", "Open"],
    recommended: true,
  },
  "bug-tracking:bug-trend": {
    group: "bugs",
    filters: ["Bug", "Date range"],
    recommended: true,
  },
  "bug-tracking:oldest-open-bugs": {
    group: "bugs",
    filters: ["Bug", "Open"],
    recommended: true,
  },
  "team-workload:open-issues-by-assignee": {
    group: "workload",
    filters: ["Open issues"],
    recommended: true,
  },
  "team-workload:wip-by-assignee": {
    group: "workload",
    filters: ["In progress"],
    recommended: true,
  },
  "team-workload:stale-issues": {
    group: "workload",
    filters: ["Open", "Not updated 14d"],
    recommended: true,
  },
};

function sortTemplates(templatesToSort) {
  return [...templatesToSort].sort((left, right) => {
    return (TEMPLATE_ORDER[left.slug] ?? 100) - (TEMPLATE_ORDER[right.slug] ?? 100);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function uniq(values) {
  return [...new Set(values)];
}

function parseCsvValues(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProjectItems(jiraProjects) {
  return jiraProjects.map((project) => ({
    id: project.key,
    label: `${project.key} - ${project.name}`,
    shortLabel: project.key,
    description: project.name,
    searchText: `${project.key} ${project.name}`,
  }));
}

function getBoardItems(jiraBoards) {
  return jiraBoards.map((board) => ({
    id: `${board.id}`,
    label: board.name,
    shortLabel: `${board.id}`,
    description: `${board.type || "board"} #${board.id}`,
    searchText: `${board.id} ${board.name} ${board.type || ""}`,
  }));
}

function getSprintItems(jiraSprints) {
  return jiraSprints.map((sprint) => ({
    id: `${sprint.id}`,
    label: sprint.name,
    shortLabel: `${sprint.id}`,
    description: `${sprint.state || "sprint"} #${sprint.id}`,
    searchText: `${sprint.id} ${sprint.name} ${sprint.state || ""}`,
  }));
}

function formatCreatedSummary(result) {
  const datasetCount = result.datasets.length;
  const chartCount = result.charts.length;
  const parts = [];

  if (datasetCount > 0) parts.push(`${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`);
  if (chartCount > 0) parts.push(`${chartCount} chart${chartCount === 1 ? "" : "s"}`);

  return parts.join(" and ");
}

function formatFieldName(field) {
  return String(field || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getChartTypeLabel(type) {
  const labels = {
    bar: "Bar chart",
    doughnut: "Doughnut chart",
    gauge: "Gauge",
    kpi: "KPI",
    line: "Line chart",
    table: "Table",
  };

  return labels[type] || `${formatFieldName(type)} chart`;
}

function getTemplateIcon(iconName) {
  return TEMPLATE_ICONS[iconName] || LuChartArea;
}

function getSourceLabel(config) {
  return RESOURCE_LABELS[config?.resource] || formatFieldName(config?.resource || "issues");
}

function getMetricLabel(config) {
  const transform = config?.transform || {};

  if (transform.type === "created_resolved_trend") return "Created vs resolved";
  if (transform.type === "sprint_summary") return "Sprint summary";
  if (transform.type === "stale_table") return "Stale issues";
  if (transform.type === "raw") return "Issue rows";
  if (transform.metric === "storyPoints") return "Sum story points";
  if (transform.metric === "averageAge") return "Average age";
  if (transform.metric === "leadTime") return "Lead time";
  return "Count issues";
}

function cardUsesVariable(card, variableName) {
  return card.datasets.some((dataset) => {
    const bindings = dataset.dataRequest?.variableBindings || [];
    return bindings.some((binding) => binding.name === variableName || binding.variableName === variableName);
  });
}

function buildCards(templates) {
  return templates.flatMap((template) => {
    return (template.charts || []).map((chart) => {
      const key = `${template.slug}:${chart.id}`;
      const meta = CARD_META[key] || {};
      const datasets = (template.datasets || []).filter((dataset) => {
        return (chart.requiredDatasetIds || []).includes(dataset.id);
      });
      const primaryDataset = datasets[0] || {};
      const config = primaryDataset.dataRequest?.configuration || {};

      return {
        key,
        id: chart.id,
        template,
        chart,
        datasets,
        group: meta.group || template.slug || "overview",
        filters: meta.filters || [],
        recommended: meta.recommended === true,
        sourceLabel: getSourceLabel(config),
        metricLabel: getMetricLabel(config),
      };
    });
  });
}

function JiraChartCard(props) {
  const { card, isSelected, onToggle } = props;
  const Icon = getTemplateIcon(card.chart.icon);
  const _onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(card.key);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onToggle(card.key)}
      onKeyDown={_onKeyDown}
      className={[
        "cursor-pointer",
        "flex min-h-[224px] w-full flex-col rounded-lg border p-4 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-divider bg-surface hover:border-primary/50 hover:bg-content2/30",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface-secondary text-foreground">
          <Icon size={18} />
        </span>
        <span onClick={(event) => event.stopPropagation()}>
          <Checkbox isSelected={isSelected} onPress={() => onToggle(card.key)} variant="secondary">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground">{card.chart.name}</span>
        <p className="text-xs text-muted">{card.chart.description}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs">
        <div className="flex flex-row items-center justify-between gap-3">
          <span className="text-muted">Creates</span>
          <span className="text-right font-medium text-foreground">
            {card.datasets.length} dataset{card.datasets.length === 1 ? "" : "s"} + {getChartTypeLabel(card.chart.type)}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between gap-3">
          <span className="text-muted">Resource</span>
          <span className="text-right font-medium text-foreground">{card.sourceLabel}</span>
        </div>
        <div className="flex flex-row items-center justify-between gap-3">
          <span className="text-muted">Default</span>
          <span className="text-right font-medium text-foreground">{card.metricLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {card.filters.length > 0 ? card.filters.map((filter) => (
          <Chip key={filter} size="sm" variant="secondary">{filter}</Chip>
        )) : (
          <Chip size="sm" variant="secondary">No filters</Chip>
        )}
      </div>
    </div>
  );
}

function JiraTemplateSetup(props) {
  const {
    connection,
    error,
    fixedProjectId,
    loading,
    projects,
    teamId,
    templates,
    title,
  } = props;

  const [dashboardMode, setDashboardMode] = useState("existing");
  const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId ? `${fixedProjectId}` : null);
  const [newDashboardName, setNewDashboardName] = useState("Jira Dashboard");
  const [fullTemplates, setFullTemplates] = useState([]);
  const [selectedCardKeys, setSelectedCardKeys] = useState([]);
  const [initializedCardsSignature, setInitializedCardsSignature] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [actionMode, setActionMode] = useState("dashboard");
  const [jiraProjectKeys, setJiraProjectKeys] = useState("");
  const [jiraBoardId, setJiraBoardId] = useState("");
  const [jiraSprintId, setJiraSprintId] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraBoards, setJiraBoards] = useState([]);
  const [jiraSprints, setJiraSprints] = useState([]);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const visibleProjects = useMemo(() => (projects || []).filter((project) => !project.ghost), [projects]);
  const fixedProject = visibleProjects.find((project) => `${project.id}` === `${fixedProjectId}`);
  const templatesSignature = useMemo(() => templates.map((template) => `${template.source}:${template.slug}`).join("|"), [templates]);
  const cards = useMemo(() => buildCards(fullTemplates), [fullTemplates]);
  const cardsSignature = useMemo(() => cards.map((card) => card.key).join("|"), [cards]);
  const selectedCards = useMemo(() => {
    return cards.filter((card) => selectedCardKeys.includes(card.key));
  }, [cards, selectedCardKeys]);
  const selectedDatasetCount = useMemo(() => {
    return uniq(selectedCards.flatMap((card) => card.datasets.map((dataset) => `${card.template.slug}:${dataset.id}`))).length;
  }, [selectedCards]);
  const selectedChartCount = selectedCards.length;
  const needsProjectKeys = useMemo(() => {
    return selectedCards.some((card) => cardUsesVariable(card, "projects"));
  }, [selectedCards]);
  const needsSprintId = useMemo(() => {
    return selectedCards.some((card) => cardUsesVariable(card, "sprint_id"));
  }, [selectedCards]);
  const selectedProjectKeys = useMemo(() => parseCsvValues(jiraProjectKeys), [jiraProjectKeys]);
  const selectedProjectKeysSignature = selectedProjectKeys.join(",");
  const projectItems = useMemo(() => getProjectItems(jiraProjects), [jiraProjects]);
  const boardItems = useMemo(() => getBoardItems(jiraBoards), [jiraBoards]);
  const sprintItems = useMemo(() => getSprintItems(jiraSprints), [jiraSprints]);

  const runJiraAction = (action, actionParams = {}) => {
    if (!teamId || !connection?.id) return Promise.resolve([]);

    return dispatch(runSourceAction({
      team_id: teamId,
      connection_id: connection.id,
      action,
      params: actionParams,
    })).unwrap().then((result) => {
      if (Array.isArray(result)) return result;
      if (result?.error) throw new Error(result.error);
      return [];
    });
  };

  const loadProjects = () => {
    if (!teamId || !connection?.id) return;

    setMetadataLoading(true);
    runJiraAction("listProjects")
      .then((loadedProjects) => setJiraProjects(loadedProjects))
      .catch(() => setCreateError("Could not load Jira projects."))
      .finally(() => setMetadataLoading(false));
  };

  const loadBoards = (projectKeyOrId = "") => {
    if (!teamId || !connection?.id) return;

    setMetadataLoading(true);
    runJiraAction("listBoards", {
      projectKeyOrId: projectKeyOrId || undefined,
      maxResults: 50,
    })
      .then((loadedBoards) => setJiraBoards(loadedBoards))
      .catch(() => setCreateError("Could not load Jira boards."))
      .finally(() => setMetadataLoading(false));
  };

  const loadSprints = (boardId) => {
    if (!teamId || !connection?.id || !boardId) {
      setJiraSprints([]);
      return;
    }

    setMetadataLoading(true);
    runJiraAction("listSprints", {
      boardId,
      maxResults: 50,
      state: "active",
    })
      .then((loadedSprints) => setJiraSprints(loadedSprints))
      .catch(() => setCreateError("Could not load Jira sprints."))
      .finally(() => setMetadataLoading(false));
  };

  useEffect(() => {
    if (fixedProjectId) {
      setDashboardMode("existing");
      setSelectedProjectId(`${fixedProjectId}`);
    }
  }, [fixedProjectId]);

  useEffect(() => {
    if (!fixedProjectId && !selectedProjectId && visibleProjects.length > 0) {
      setSelectedProjectId(`${visibleProjects[0].id}`);
    }
  }, [fixedProjectId, selectedProjectId, visibleProjects]);

  useEffect(() => {
    loadProjects();
  }, [teamId, connection?.id]);

  useEffect(() => {
    loadBoards(selectedProjectKeys[0] || "");
  }, [selectedProjectKeysSignature, teamId, connection?.id]);

  useEffect(() => {
    if (!needsSprintId) {
      setJiraBoardId("");
      setJiraSprintId("");
      setJiraSprints([]);
      return;
    }

    loadSprints(jiraBoardId);
  }, [needsSprintId, jiraBoardId, teamId, connection?.id]);

  useEffect(() => {
    let isMounted = true;

    if (!teamId || !templatesSignature) {
      setFullTemplates([]);
      return () => {
        isMounted = false;
      };
    }

    Promise.all(templates.map((template) => dispatch(getChartTemplate({
      team_id: teamId,
      source: template.source,
      slug: template.slug,
    })).unwrap()))
      .then((loadedTemplates) => {
        if (!isMounted) return;
        setFullTemplates(sortTemplates(loadedTemplates));
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setCreateError(loadError.message || "Could not load Jira templates");
      });

    return () => {
      isMounted = false;
    };
  }, [dispatch, teamId, templatesSignature]);

  useEffect(() => {
    if (cards.length === 0 || initializedCardsSignature === cardsSignature) return;

    const recommendedCards = cards.filter((card) => card.recommended);
    setSelectedCardKeys((recommendedCards.length > 0 ? recommendedCards : cards).map((card) => card.key));
    setInitializedCardsSignature(cardsSignature);
  }, [cards, cardsSignature, initializedCardsSignature]);

  const _toggleCard = (cardKey) => {
    setSelectedCardKeys((currentKeys) => (
      currentKeys.includes(cardKey)
        ? currentKeys.filter((key) => key !== cardKey)
        : [...currentKeys, cardKey]
    ));
  };

  const _toggleGroup = (groupCards) => {
    const allSelected = groupCards.every((card) => selectedCardKeys.includes(card.key));
    if (allSelected) {
      setSelectedCardKeys(selectedCardKeys.filter((key) => !groupCards.some((card) => card.key === key)));
      return;
    }

    setSelectedCardKeys(uniq([...selectedCardKeys, ...groupCards.map((card) => card.key)]));
  };

  const _selectAllCards = () => {
    setSelectedCardKeys(cards.map((card) => card.key));
    setInitializedCardsSignature(cardsSignature);
  };

  const _deselectAllCards = () => {
    setSelectedCardKeys([]);
    setInitializedCardsSignature(cardsSignature);
  };

  const createSelected = async (mode) => {
    setActionMode(mode);
    setIsCreating(true);
    setCreateError(null);
    setCreateResult(null);

    try {
      let projectId = dashboardMode === "existing" ? selectedProjectId : null;
      const aggregatedResult = {
        project_id: projectId,
        datasets: [],
        charts: [],
      };

      const templatesToCreate = sortTemplates(fullTemplates.filter((template) => {
        return selectedCards.some((card) => card.template.slug === template.slug);
      }));

      for (const template of templatesToCreate) {
        const cardsForTemplate = selectedCards.filter((card) => card.template.slug === template.slug);
        const dashboard = projectId
          ? { type: "existing", project_id: projectId }
          : { type: "new", name: newDashboardName || "Jira Dashboard" };
        const result = await dispatch(createFromChartTemplate({
          team_id: teamId,
          source: template.source,
          slug: template.slug,
          data: {
            connection_id: connection.id,
            dashboard,
            dataset_template_ids: uniq(cardsForTemplate.flatMap((card) => card.datasets.map((dataset) => dataset.id))),
            chart_template_ids: mode === "dashboard" ? cardsForTemplate.map((card) => card.chart.id) : [],
            variable_defaults: {
              projects: jiraProjectKeys.trim(),
              sprint_id: jiraSprintId.trim(),
            },
          },
        })).unwrap();

        projectId = result.project_id;
        aggregatedResult.project_id = result.project_id;
        aggregatedResult.datasets.push(...(result.datasets || []));
        aggregatedResult.charts.push(...(result.charts || []));
      }

      if (mode === "dashboard") {
        await wait(DASHBOARD_CREATE_SETTLE_DELAY_MS);
        await dispatch(getProjectCharts({ project_id: projectId })).unwrap().catch(() => null);
      }

      setCreateResult(aggregatedResult);
    } catch (createTemplateError) {
      setCreateError(createTemplateError.message || "Could not create Jira templates");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!createResult?.project_id || isCreating || actionMode !== "dashboard") return;
    navigate(`/dashboard/${createResult.project_id}`);
  }, [actionMode, createResult?.project_id, isCreating, navigate]);

  const openCreatedContent = () => {
    if (actionMode === "dashboard" && createResult?.project_id) {
      navigate(`/dashboard/${createResult.project_id}`);
      return;
    }

    navigate("/datasets");
  };

  const isLoadPending = loading || (templates.length > 0 && fullTemplates.length === 0);
  const createDisabled = isCreating
    || selectedCards.length === 0
    || (dashboardMode === "existing" && !selectedProjectId)
    || (needsProjectKeys && !jiraProjectKeys.trim())
    || (needsSprintId && !jiraSprintId.trim());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold">{title || "What do you want to track?"}</p>
              <p className="text-sm text-muted">
                Choose Jira charts and Chartbrew will create the matching datasets and charts.
              </p>
              {!isLoadPending && cards.length > 0 && (
                <div className="mt-3 flex flex-row flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onPress={_selectAllCards}>
                    Select all
                  </Button>
                  <Button size="sm" variant="tertiary" onPress={_deselectAllCards}>
                    Deselect all
                  </Button>
                </div>
              )}
            </div>

            {(error || createError) && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Could not prepare Jira templates</Alert.Title>
                  <Alert.Description>{error || createError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {isLoadPending && (
              <span className="text-sm text-foreground-500">Loading Jira chart templates...</span>
            )}

            {!isLoadPending && GROUPS.map((group) => {
              const groupCards = cards.filter((card) => card.group === group.id);
              if (groupCards.length === 0) return null;
              const groupSelectedCount = groupCards.filter((card) => selectedCardKeys.includes(card.key)).length;

              return (
                <section key={group.id} className="flex flex-col gap-3">
                  <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-row items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{group.label}</p>
                        <Chip size="sm" variant="secondary">
                          {groupSelectedCount}/{groupCards.length}
                        </Chip>
                      </div>
                      <p className="text-sm text-muted">{group.description}</p>
                    </div>
                    <Button size="sm" variant="tertiary" onPress={() => _toggleGroup(groupCards)}>
                      {groupSelectedCount === groupCards.length ? "Clear group" : "Select group"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {groupCards.map((card) => (
                      <JiraChartCard
                        key={card.key}
                        card={card}
                        isSelected={selectedCardKeys.includes(card.key)}
                        onToggle={_toggleCard}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Surface>
      </div>

      <aside>
        <div className="sticky top-16 flex flex-col gap-4">
          <Surface className="rounded-3xl border border-divider p-5" variant="default">
            <div className="flex flex-col gap-4">
              <p className="text-lg font-semibold">Summary</p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-row items-center justify-between gap-3">
                  <span className="text-muted">Charts</span>
                  <span className="font-medium text-foreground">{selectedChartCount}</span>
                </div>
                <div className="flex flex-row items-center justify-between gap-3">
                  <span className="text-muted">Datasets</span>
                  <span className="font-medium text-foreground">{selectedDatasetCount}</span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Add selected to</p>
                {fixedProjectId ? (
                  <Chip variant="secondary" className="max-w-fit">
                    {fixedProject?.name || "Current dashboard"}
                  </Chip>
                ) : (
                  <>
                    <Tabs
                      selectedKey={dashboardMode}
                      onSelectionChange={(key) => setDashboardMode(key)}
                      className="w-full"
                    >
                      <Tabs.ListContainer>
                        <Tabs.List>
                          <Tabs.Tab id="existing">
                            Existing
                            <Tabs.Indicator />
                          </Tabs.Tab>
                          <Tabs.Tab id="new">
                            New
                            <LuPlus size={16} className="ml-2" />
                            <Tabs.Indicator />
                          </Tabs.Tab>
                        </Tabs.List>
                      </Tabs.ListContainer>
                    </Tabs>

                    {dashboardMode === "existing" && (
                      <Select
                        placeholder="Select dashboard"
                        fullWidth
                        selectionMode="single"
                        value={selectedProjectId}
                        onChange={(value) => setSelectedProjectId(value)}
                        variant="secondary"
                      >
                        <Label>Select a dashboard</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {visibleProjects.map((project) => (
                              <ListBox.Item key={project.id} id={`${project.id}`} textValue={project.name}>
                                {project.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}

                    {dashboardMode === "new" && (
                      <TextField fullWidth name="jira-template-dashboard-name">
                        <Label>Dashboard name</Label>
                        <Input
                          value={newDashboardName}
                          onChange={(event) => setNewDashboardName(event.target.value)}
                          variant="secondary"
                        />
                      </TextField>
                    )}
                  </>
                )}
              </div>

              {createResult && (
                <Alert status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Jira content created</Alert.Title>
                    <Alert.Description>{formatCreatedSummary(createResult)} created successfully.</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </div>
          </Surface>

          <Surface className="rounded-3xl border border-divider p-5" variant="default">
            {(needsProjectKeys || needsSprintId) && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Required Jira filters</p>
                {needsProjectKeys && (
                  <JiraBuilderAutocompleteField
                    label="Project key(s)"
                    name="jira-template-project-keys"
                    placeholder={metadataLoading ? "Loading projects..." : "Select projects"}
                    items={projectItems}
                    value={selectedProjectKeys}
                    selectionMode="multiple"
                    onChange={(projectKeys) => {
                      setJiraProjectKeys((projectKeys || []).join(", "));
                      setJiraBoardId("");
                      setJiraSprintId("");
                    }}
                    isDisabled={metadataLoading && projectItems.length === 0}
                    emptyLabel="No Jira projects found"
                  />
                )}
                {needsSprintId && (
                  <>
                    <JiraBuilderAutocompleteField
                      label="Board"
                      name="jira-template-board"
                      placeholder={metadataLoading ? "Loading boards..." : "Select board"}
                      items={boardItems}
                      value={jiraBoardId}
                      selectionMode="single"
                      onChange={(boardId) => {
                        setJiraBoardId(boardId ? `${boardId}` : "");
                        setJiraSprintId("");
                      }}
                      isDisabled={metadataLoading && boardItems.length === 0}
                      emptyLabel="No Jira boards found"
                    />
                    <JiraBuilderAutocompleteField
                      label="Sprint"
                      name="jira-template-sprint-id"
                      placeholder={jiraBoardId ? "Select sprint" : "Select a board first"}
                      items={sprintItems}
                      value={jiraSprintId}
                      selectionMode="single"
                      onChange={(sprintId) => setJiraSprintId(sprintId ? `${sprintId}` : "")}
                      isDisabled={!jiraBoardId || (metadataLoading && sprintItems.length === 0)}
                      emptyLabel="No Jira sprints found"
                    />
                  </>
                )}
              </div>
            )}
          </Surface>

          {!createResult && (
            <div className="flex flex-col gap-2">
              <Button
                fullWidth
                isDisabled={createDisabled}
                isPending={isCreating && actionMode === "dashboard"}
                variant="primary"
                onPress={() => createSelected("dashboard")}
              >
                {isCreating && actionMode === "dashboard" ? <ButtonSpinner /> : null}
                Create and add to dashboard
              </Button>
              <Button
                fullWidth
                isDisabled={createDisabled}
                isPending={isCreating && actionMode === "datasets"}
                variant="secondary"
                onPress={() => createSelected("datasets")}
              >
                {isCreating && actionMode === "datasets" ? <ButtonSpinner /> : null}
                Create datasets only
              </Button>
            </div>
          )}

          {createResult && (
            <Button fullWidth variant="primary" onPress={openCreatedContent}>
              <LuCheck />
              {actionMode === "dashboard" ? "Open dashboard" : "Open datasets"}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

JiraChartCard.propTypes = {
  card: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

JiraTemplateSetup.propTypes = {
  connection: PropTypes.object.isRequired,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  fixedProjectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  loading: PropTypes.bool,
  projects: PropTypes.array,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  templates: PropTypes.array,
  title: PropTypes.string,
};

JiraTemplateSetup.defaultProps = {
  error: null,
  fixedProjectId: null,
  loading: false,
  projects: [],
  templates: [],
  title: null,
};

export default JiraTemplateSetup;
