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
  Surface,
  Tabs,
  TextField,
} from "@heroui/react";
import {
  LuChartBar,
  LuChartLine,
  LuChartPie,
  LuCheck,
  LuFileText,
  LuPlus,
  LuUsers,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import { createFromChartTemplate } from "../../slices/chartTemplate";

const TEMPLATE_ICONS = {
  ChartBar: LuChartBar,
  ChartLine: LuChartLine,
  ChartPie: LuChartPie,
  FileText: LuFileText,
  Users: LuUsers,
};

const LAYOUT_GROUPS = [
  { kind: "kpi", label: "Totals" },
  { kind: "trend", label: "Trends" },
  { kind: "comparison", label: "Top lists" },
];

function getChartGroup(chart) {
  if (chart.type === "kpi") return "kpi";
  if (chart.type === "line") return "trend";
  return "comparison";
}

export function getDatasetIdsForCharts(template, chartIds) {
  if (!template) return [];

  const datasetIds = new Set();
  template.charts
    .filter((chart) => chartIds.includes(chart.id))
    .forEach((chart) => chart.requiredDatasetIds.forEach((id) => datasetIds.add(id)));

  return template.datasets
    .map((dataset) => dataset.id)
    .filter((id) => datasetIds.has(id));
}

function ChartTile(props) {
  const { chart, isSelected, onPress } = props;
  const Icon = TEMPLATE_ICONS[chart.icon] || LuChartBar;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onPress}
      className={[
        "relative flex min-h-[132px] w-full flex-col items-start rounded-3xl border-2 p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-content3 bg-surface hover:border-primary/50 hover:bg-content2/30",
      ].join(" ")}
    >
      <span
        className={[
          "mb-4 flex size-9 items-center justify-center rounded-lg border bg-surface",
          isSelected ? "border-primary/30 text-primary" : "border-divider text-foreground-500",
        ].join(" ")}
      >
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <Checkbox
        isSelected={isSelected}
        onPress={onPress}
        variant="secondary"
        className="absolute right-5 top-5"
        aria-label={chart.name}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
      <span className="pr-10 text-sm font-semibold text-foreground">{chart.name}</span>
      <span className="mt-2 text-sm text-muted">{chart.description}</span>
    </button>
  );
}

function PrivatusAnalyticsTemplateSetup(props) {
  const {
    connection,
    error,
    fixedProjectId,
    loading,
    projects,
    result,
    teamId,
    template: selectedTemplate,
    templates,
    title,
  } = props;

  const [dashboardMode, setDashboardMode] = useState("existing");
  const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId ? `${fixedProjectId}` : null);
  const [newDashboardName, setNewDashboardName] = useState("Website traffic");
  const [selectedChartIds, setSelectedChartIds] = useState([]);
  const [initializedTemplateId, setInitializedTemplateId] = useState(null);
  const [hasStartedCreate, setHasStartedCreate] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const visibleProjects = useMemo(() => (projects || []).filter((project) => !project.ghost), [projects]);
  const template = selectedTemplate || templates[0] || null;
  const fixedProject = visibleProjects.find((project) => `${project.id}` === `${fixedProjectId}`);

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
    if (!fixedProjectId && visibleProjects.length === 0) {
      setDashboardMode("new");
    }
  }, [fixedProjectId, selectedProjectId, visibleProjects]);

  useEffect(() => {
    if (template?.id && initializedTemplateId !== template.id) {
      setSelectedChartIds(template.charts.map((chart) => chart.id));
      setInitializedTemplateId(template.id);
    }
  }, [initializedTemplateId, template]);

  useEffect(() => {
    if (!hasStartedCreate || loading || !result?.project_id) return;
    navigate(`/dashboard/${result.project_id}`);
  }, [hasStartedCreate, loading, navigate, result?.project_id]);

  const _toggleChart = (chartId) => {
    if (selectedChartIds.includes(chartId)) {
      setSelectedChartIds(selectedChartIds.filter((id) => id !== chartId));
    } else {
      setSelectedChartIds([...selectedChartIds, chartId]);
    }
  };

  const _createCharts = () => {
    if (!template) return;

    const dashboard = dashboardMode === "new"
      ? { type: "new", name: newDashboardName || "Website traffic" }
      : { type: "existing", project_id: selectedProjectId };

    setHasStartedCreate(true);
    dispatch(createFromChartTemplate({
      team_id: teamId,
      source: template.source,
      slug: template.slug,
      data: {
        connection_id: connection.id,
        dashboard,
        dataset_template_ids: getDatasetIdsForCharts(template, selectedChartIds),
        chart_template_ids: selectedChartIds,
      },
    }));
  };

  const groupedCharts = LAYOUT_GROUPS
    .map((group) => ({
      ...group,
      charts: (template?.charts || []).filter((chart) => getChartGroup(chart) === group.kind),
    }))
    .filter((group) => group.charts.length > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-4">
            {error && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Could not create charts</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {loading && !template && (
              <span className="text-sm text-foreground-500">Loading templates...</span>
            )}

            {template && (
              <>
                <div className="flex flex-row items-center justify-between">
                  <p className="font-semibold">{title || template.name}</p>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => setSelectedChartIds(template.charts.map((chart) => chart.id))}
                  >
                    Select all
                  </Button>
                </div>

                {groupedCharts.map((group) => (
                  <div key={group.kind}>
                    <p className="mb-3 text-sm font-semibold">{group.label}</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.charts.map((chart) => (
                        <ChartTile
                          key={chart.id}
                          chart={chart}
                          isSelected={selectedChartIds.includes(chart.id)}
                          onPress={() => _toggleChart(chart.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Surface>
      </div>

      <div>
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-4">
            <p className="font-semibold">Add selected to</p>

            {fixedProjectId ? (
              <Chip variant="secondary" className="max-w-fit">
                {fixedProject?.name || "Current dashboard"}
              </Chip>
            ) : (
              <>
                <Tabs
                  selectedKey={dashboardMode}
                  onSelectionChange={(key) => setDashboardMode(key)}
                  className="w-full max-w-md"
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
                  <TextField fullWidth name="privatus-analytics-template-dashboard-name">
                    <Label>Dashboard name</Label>
                    <Input
                      value={newDashboardName}
                      onChange={(e) => setNewDashboardName(e.target.value)}
                      variant="secondary"
                    />
                  </TextField>
                )}
              </>
            )}
          </div>
        </Surface>

        <div className="mt-4">
          {!result && (
            <Button
              isDisabled={!template || selectedChartIds.length === 0 || (dashboardMode === "existing" && !selectedProjectId)}
              isPending={loading}
              variant="primary"
              onPress={_createCharts}
              fullWidth
            >
              Create selected
              {selectedChartIds.length > 0 && (
                <Chip size="sm" variant="secondary" color="accent">
                  {selectedChartIds.length}
                </Chip>
              )}
            </Button>
          )}

          {result && (
            <Button
              variant="primary"
              onPress={() => navigate(`/dashboard/${result.project_id}`)}
            >
              <LuCheck />
              Open dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

ChartTile.propTypes = {
  chart: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onPress: PropTypes.func.isRequired,
};

PrivatusAnalyticsTemplateSetup.propTypes = {
  connection: PropTypes.object.isRequired,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  fixedProjectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  loading: PropTypes.bool,
  projects: PropTypes.array,
  result: PropTypes.object,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  template: PropTypes.object,
  templates: PropTypes.array,
  title: PropTypes.string,
};

PrivatusAnalyticsTemplateSetup.defaultProps = {
  error: null,
  fixedProjectId: null,
  loading: false,
  projects: [],
  result: null,
  template: null,
  templates: [],
  title: null,
};

export default PrivatusAnalyticsTemplateSetup;
