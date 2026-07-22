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
  LuBadgeDollarSign,
  LuChartArea,
  LuChartBar,
  LuChartLine,
  LuChartPie,
  LuCheck,
  LuCircleDollarSign,
  LuCreditCard,
  LuDollarSign,
  LuFileText,
  LuLayers,
  LuPlus,
  LuReceipt,
  LuRefreshCw,
  LuTable,
  LuUsers,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import { createFromChartTemplate } from "../../slices/chartTemplate";

const TEMPLATE_ICONS = {
  BadgeDollarSign: LuBadgeDollarSign,
  ChartBar: LuChartBar,
  ChartLine: LuChartLine,
  ChartPie: LuChartPie,
  CircleDollarSign: LuCircleDollarSign,
  CreditCard: LuCreditCard,
  DollarSign: LuDollarSign,
  FileText: LuFileText,
  Receipt: LuReceipt,
  RefreshCw: LuRefreshCw,
  Table: LuTable,
  Users: LuUsers,
};

function getTemplateIcon(iconName, fallbackIcon) {
  if (!iconName) return fallbackIcon;
  return TEMPLATE_ICONS[iconName] || fallbackIcon;
}

function getTemplateName(name) {
  return (name || "").replace(/^Stripe\s+/i, "");
}

function getChartTypeLabel(type) {
  if (!type) return null;

  const labels = {
    bar: "Bar",
    doughnut: "Doughnut",
    line: "Line",
    table: "Table",
  };

  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function formatCreatedSummary(result) {
  const parts = [];

  if (result.datasets.length > 0) {
    parts.push(`${result.datasets.length} dataset${result.datasets.length === 1 ? "" : "s"}`);
  }
  if (result.charts.length > 0) {
    parts.push(`${result.charts.length} chart${result.charts.length === 1 ? "" : "s"}`);
  }

  return parts.join(" and ");
}

function TemplateSelectionTile(props) {
  const {
    item,
    isSelected,
    isDisabled,
    onPress,
    fallbackIcon: FallbackIcon,
    unavailableLabel,
    metaLabel,
  } = props;
  const Icon = getTemplateIcon(item.icon, FallbackIcon);

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      disabled={isDisabled}
      onClick={onPress}
      className={[
        "relative flex min-h-[156px] w-full flex-col items-start rounded-3xl border-2 p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-content3 bg-surface hover:border-primary/50 hover:bg-content2/30",
        isDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "mb-5 flex size-9 items-center justify-center rounded-lg border bg-surface",
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
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>

      <div className="flex w-full flex-row items-center gap-2 pr-10">
        <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {getTemplateName(item.name)}
        </span>
      </div>
      <span className="mt-2 text-sm text-muted">
        {item.description}
      </span>
      <div className="flex flex-row items-center gap-2 mt-2">
        {unavailableLabel && (
          <Chip size="sm" variant="soft" color="warning" className="mt-4">
            <Chip.Label>{unavailableLabel}</Chip.Label>
          </Chip>
        )}
        {metaLabel && (
          <Chip size="sm" variant="secondary">
            <Chip.Label>{metaLabel}</Chip.Label>
          </Chip>
        )}
      </div>
    </button>
  );
}

function StripeTemplateSetup(props) {
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
  const [newDashboardName, setNewDashboardName] = useState("Stripe Revenue");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);
  const [selectedChartIds, setSelectedChartIds] = useState([]);
  const [initializedTemplateId, setInitializedTemplateId] = useState(null);
  const [isSyntheticLoading, setIsSyntheticLoading] = useState(false);
  const [hasStartedCreate, setHasStartedCreate] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const visibleProjects = useMemo(() => (projects || []).filter((project) => !project.ghost), [projects]);
  const template = selectedTemplate || templates[0] || null;
  const totalSelectedItems = selectedDatasetIds.length + selectedChartIds.length;
  const fixedProject = visibleProjects.find((project) => `${project.id}` === `${fixedProjectId}`);
  const showCreateResult = result && !isSyntheticLoading;
  const isCreatePending = loading || isSyntheticLoading;

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
    if (template?.id && initializedTemplateId !== template.id) {
      setSelectedDatasetIds(template.datasets.map((dataset) => dataset.id));
      setSelectedChartIds(template.charts.map((chart) => chart.id));
      setInitializedTemplateId(template.id);
    }
  }, [initializedTemplateId, template]);

  useEffect(() => {
    let timeoutId;

    if (result?.charts?.length > 0) {
      setIsSyntheticLoading(true);
      timeoutId = setTimeout(() => {
        setIsSyntheticLoading(false);
      }, 10000);
    } else {
      setIsSyntheticLoading(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [result]);

  useEffect(() => {
    if (!hasStartedCreate || !showCreateResult || !result?.project_id) return;
    navigate(`/dashboard/${result.project_id}`);
  }, [hasStartedCreate, navigate, result?.project_id, showCreateResult]);

  const _toggleDataset = (datasetId) => {
    if (!template) return;

    const nextDatasetIds = selectedDatasetIds.includes(datasetId)
      ? selectedDatasetIds.filter((id) => id !== datasetId)
      : [...selectedDatasetIds, datasetId];

    setSelectedDatasetIds(nextDatasetIds);
    setSelectedChartIds((currentChartIds) => template.charts
      .filter((chart) => currentChartIds.includes(chart.id))
      .filter((chart) => chart.requiredDatasetIds.every((id) => nextDatasetIds.includes(id)))
      .map((chart) => chart.id));
  };

  const _toggleChart = (chartId) => {
    if (!template) return;

    if (selectedChartIds.includes(chartId)) {
      setSelectedChartIds(selectedChartIds.filter((id) => id !== chartId));
    } else {
      setSelectedChartIds([...selectedChartIds, chartId]);
    }
  };

  const _isChartAvailable = (chart) => {
    return chart.requiredDatasetIds.every((datasetId) => selectedDatasetIds.includes(datasetId));
  };

  const _selectAllDatasets = () => {
    if (!template) return;

    const datasetIds = template.datasets.map((dataset) => dataset.id);
    setSelectedDatasetIds(datasetIds);
    setSelectedChartIds(template.charts
      .filter((chart) => chart.requiredDatasetIds.every((datasetId) => datasetIds.includes(datasetId)))
      .map((chart) => chart.id));
  };

  const _selectAllAvailableCharts = () => {
    if (!template) return;

    setSelectedChartIds(template.charts
      .filter((chart) => _isChartAvailable(chart))
      .map((chart) => chart.id));
  };

  const _createTemplates = () => {
    if (!template) return;

    const dashboard = dashboardMode === "new"
      ? { type: "new", name: newDashboardName || "Stripe Revenue" }
      : { type: "existing", project_id: selectedProjectId };

    setHasStartedCreate(true);
    dispatch(createFromChartTemplate({
      team_id: teamId,
      source: template.source,
      slug: template.slug,
      data: {
        connection_id: connection.id,
        dashboard,
        dataset_template_ids: selectedDatasetIds,
        chart_template_ids: selectedChartIds,
      },
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-4">
            {error && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Could not create templates</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {loading && !template && (
              <span className="text-sm text-foreground-500">Loading templates...</span>
            )}

            {template && (
              <>
                <div>
                  <p className="font-semibold">{title || template.name}</p>
                  <p className="text-sm text-foreground-500">{template.description}</p>
                </div>

                <Separator />

                <div>
                  <div className="flex flex-row items-center justify-between mb-3">
                    <div className="flex flex-row items-center gap-2">
                      <LuLayers size={16} />
                      <p className="text-sm font-semibold">Datasets</p>
                      <Chip size="sm" variant="secondary">
                        <Chip.Label>{selectedDatasetIds.length}/{template.datasets.length} selected</Chip.Label>
                      </Chip>
                    </div>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={_selectAllDatasets}
                    >
                      Select all
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {template.datasets.map((dataset) => (
                      <TemplateSelectionTile
                        key={dataset.id}
                        item={dataset}
                        fallbackIcon={LuLayers}
                        isSelected={selectedDatasetIds.includes(dataset.id)}
                        onPress={() => _toggleDataset(dataset.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex flex-row items-center justify-between mb-3">
                    <div className="flex flex-row items-center gap-2">
                      <LuChartArea size={16} />
                      <p className="text-sm font-semibold">Charts</p>
                      <Chip size="sm" variant="secondary">
                        <Chip.Label>{selectedChartIds.length}/{template.charts.length} selected</Chip.Label>
                      </Chip>
                    </div>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={_selectAllAvailableCharts}
                    >
                      Select all
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {template.charts.map((chart) => {
                      const available = _isChartAvailable(chart);
                      return (
                        <TemplateSelectionTile
                          key={chart.id}
                          item={chart}
                          fallbackIcon={LuChartArea}
                          isDisabled={!available}
                          isSelected={selectedChartIds.includes(chart.id) && available}
                          onPress={() => _toggleChart(chart.id)}
                          unavailableLabel={!available ? "Needs dataset" : null}
                          metaLabel={getChartTypeLabel(chart.type)}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </Surface>
      </div>

      <div>
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-4">
            <p className="text-lg font-semibold">Summary</p>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-2">
                <LuLayers size={16} />
                <p className="text-sm">Datasets</p>
              </div>
              <Chip size="sm" variant="secondary">
                <Chip.Label>{selectedDatasetIds.length}</Chip.Label>
              </Chip>
            </div>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-2">
                <LuChartArea size={16} />
                <p className="text-sm">Charts</p>
              </div>
              <Chip size="sm" variant="secondary">
                <Chip.Label>{selectedChartIds.length}</Chip.Label>
              </Chip>
            </div>
          </div>
        </Surface>
        <Surface className="rounded-3xl border border-divider p-5 mt-4" variant="default">
          <div className="flex flex-col gap-4">
            <p className="font-semibold">Add selected to</p>

            {fixedProjectId ? (
              <Chip variant="secondary" className="max-w-fit">
                {fixedProject?.name || "Current dashboard"}
              </Chip>
            ) : (
              <>
                <div className="w-full">
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
                </div>

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
                  <TextField fullWidth name="stripe-template-dashboard-name">
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

            {isSyntheticLoading && (
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Preparing charts</Alert.Title>
                  <Alert.Description>
                    Your datasets and charts have been created. Waiting a few seconds for the initial chart data to load.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {showCreateResult && (
              <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Template content created</Alert.Title>
                  <Alert.Description>
                    {`${formatCreatedSummary(result)} created successfully.`}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </div>
        </Surface>

        <div className="mt-4">
          {!showCreateResult && (
            <Button
              isDisabled={!template || totalSelectedItems === 0 || (dashboardMode === "existing" && !selectedProjectId)}
              isPending={isCreatePending}
              variant="primary"
              onPress={_createTemplates}
              fullWidth
            >
              {isSyntheticLoading ? "Preparing charts" : "Create selected"}
              {totalSelectedItems > 0 && (
                <Chip size="sm" variant="secondary" color="accent">
                  {totalSelectedItems}
                </Chip>
              )}
            </Button>
          )}

          {showCreateResult && (
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

TemplateSelectionTile.propTypes = {
  fallbackIcon: PropTypes.elementType.isRequired,
  isDisabled: PropTypes.bool,
  isSelected: PropTypes.bool.isRequired,
  item: PropTypes.object.isRequired,
  metaLabel: PropTypes.string,
  onPress: PropTypes.func.isRequired,
  unavailableLabel: PropTypes.string,
};

TemplateSelectionTile.defaultProps = {
  isDisabled: false,
  metaLabel: null,
  unavailableLabel: null,
};

StripeTemplateSetup.propTypes = {
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

StripeTemplateSetup.defaultProps = {
  error: null,
  fixedProjectId: null,
  loading: false,
  projects: [],
  result: null,
  template: null,
  templates: [],
  title: null,
};

export default StripeTemplateSetup;
