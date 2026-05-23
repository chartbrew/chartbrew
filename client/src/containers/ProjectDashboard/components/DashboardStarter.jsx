import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Table,
} from "@heroui/react";
import {
  LuArrowRight,
  LuBrainCircuit,
  LuChartColumn,
  LuDatabase,
  LuFileText,
  LuPlug,
  LuPlus,
  LuShare,
  LuSparkles,
} from "react-icons/lu";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

import {
  createCdc,
  createChart,
  runQuery,
  selectCharts,
} from "../../../slices/chart";
import { selectConnections } from "../../../slices/connection";
import { selectDatasetsNoDrafts } from "../../../slices/dataset";
import { showAiModal } from "../../../slices/ui";
import { chartColors } from "../../../config/colors";
import { placeNewWidget } from "../../../modules/autoLayout";
import getConnectionLogo from "../../../modules/getConnectionLogo";
import getDefaultCdcBindings from "../../../modules/getDefaultCdcBindings";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";
import { widthSize } from "../../../modules/layoutBreakpoints";
import { getPaginationPageNumbers } from "../../../modules/getPaginationPageNumbers";
import { useTheme } from "../../../modules/ThemeContext";

const DATASETS_PER_PAGE = 5;

const workflowSteps = [
  { key: "connect", label: "Connect source", icon: LuPlug },
  { key: "dataset", label: "Create dataset", icon: LuDatabase },
  { key: "charts", label: "Add charts", icon: LuChartColumn },
  { key: "share", label: "Share dashboard", icon: LuShare },
];

const starterIconClasses = {
  accent: {
    wrapper: "bg-accent/10",
    icon: "text-accent",
  },
  success: {
    wrapper: "bg-success/10",
    icon: "text-success",
  },
  warning: {
    wrapper: "bg-warning/10",
    icon: "text-warning",
  },
  default: {
    wrapper: "bg-content3",
    icon: "text-foreground",
  },
};

function StarterCard({
  title,
  description,
  actionLabel,
  actionVariant = "primary",
  icon: Icon,
  iconColor = "accent",
  featured,
  onPress,
}) {
  const iconClasses = starterIconClasses[iconColor] || starterIconClasses.default;

  return (
    <Card
      className={`min-h-44 gap-4 border border-divider p-5 shadow-none ${featured ? "border-accent/50 ring-1 ring-accent/25" : ""}`}
      variant="default"
    >
      <div className="flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${iconClasses.wrapper}`}>
          <Icon size={24} className={iconClasses.icon} />
        </div>
        <Card.Header className="min-w-0 gap-1 p-0">
          <Card.Title className="text-xl font-semibold leading-snug">{title}</Card.Title>
          {description && (
            <Card.Description className="text-base leading-relaxed text-foreground-500">
              {description}
            </Card.Description>
          )}
        </Card.Header>
      </div>
      <Card.Footer className="mt-auto p-0">
        <Button onPress={onPress} variant={actionVariant}>
          {actionLabel}
          <LuArrowRight size={18} />
        </Button>
      </Card.Footer>
    </Card>
  );
}

StarterCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actionLabel: PropTypes.string.isRequired,
  actionVariant: PropTypes.string,
  icon: PropTypes.elementType.isRequired,
  iconColor: PropTypes.string,
  featured: PropTypes.bool,
  onPress: PropTypes.func.isRequired,
};

StarterCard.defaultProps = {
  description: "",
  actionVariant: "primary",
  iconColor: "accent",
  featured: false,
};

function AiRecommendation({
  title,
  description,
  actionLabel,
  disabled,
  icon: Icon,
  onPress,
}) {
  return (
    <div className={`rounded-2xl border border-divider bg-surface p-5 ${disabled ? "border-dashed" : ""}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${disabled ? "bg-content3 text-foreground-500" : "bg-accent/10 text-accent"}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold leading-snug">{title}</h3>
          <p className="mt-1 text-base text-foreground-500">{description}</p>
          {actionLabel && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onPress={onPress}
                variant={disabled ? "outline" : "primary"}
                isDisabled={disabled}
              >
                <LuSparkles size={18} />
                {actionLabel}
              </Button>
              {disabled && (
                <span className="text-sm text-foreground-500">
                  Describe what you want to track. AI suggests sources and templates.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

AiRecommendation.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  actionLabel: PropTypes.string,
  disabled: PropTypes.bool,
  icon: PropTypes.elementType.isRequired,
  onPress: PropTypes.func.isRequired,
};

AiRecommendation.defaultProps = {
  actionLabel: "",
  disabled: false,
};

function WorkflowGuide({ activeStep }) {
  return (
    <Card className="gap-4 border border-divider p-5 shadow-none" variant="default">
      <Card.Header className="p-0">
        <Card.Title className="text-lg font-semibold text-foreground-500">Workflow</Card.Title>
      </Card.Header>
      <Card.Content className="p-0">
        <Breadcrumbs
          aria-label="Dashboard creation workflow"
          className="flex flex-wrap gap-y-3"
          separator={<LuArrowRight className="text-foreground-400" size={18} />}
        >
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            const isActive = step.key === activeStep;

            return (
              <Breadcrumbs.Item key={step.key} className="shrink-0">
                <span className={`flex min-h-11 items-center gap-3 rounded-xl px-4 ${isActive ? "bg-accent/10 text-accent" : "text-foreground-400"}`}>
                  <Icon size={20} />
                  <span className="font-medium">{step.label}</span>
                </span>
              </Breadcrumbs.Item>
            );
          })}
        </Breadcrumbs>
      </Card.Content>
    </Card>
  );
}

WorkflowGuide.propTypes = {
  activeStep: PropTypes.string.isRequired,
};

const getDatasetSources = (dataset) => {
  const sources = dataset?.DataRequests?.map((request) => (
    request?.Connection?.name || request?.Connection?.subType || request?.Connection?.type
  )).filter(Boolean) || [];

  return [...new Set(sources)];
};

const getDatasetConnectionTypes = (dataset) => {
  const connectionTypes = dataset?.DataRequests?.map((request) => (
    request?.Connection?.subType || request?.Connection?.type
  )).filter(Boolean) || [];

  return [...new Set(connectionTypes)];
};

const getDatasetPrimaryConnection = (dataset) => (
  dataset?.DataRequests?.find((request) => request?.Connection)?.Connection || null
);

const formatConnectionType = (connectionType) => {
  if (!connectionType) return "Unknown";

  return String(connectionType)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function DashboardStarter({
  projectId,
}) {
  const [datasetSearch, setDatasetSearch] = useState("");
  const [datasetConnectionType, setDatasetConnectionType] = useState("all");
  const [datasetPage, setDatasetPage] = useState(1);
  const [creatingDatasetChartId, setCreatingDatasetChartId] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const charts = useSelector(selectCharts);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasetsNoDrafts);
  const { isDark } = useTheme();

  const getNewChartLayout = () => {
    const computedLayout = {};
    const dashboardChartsToPlace = charts.filter((chart) => `${chart.project_id}` === projectId);

    Object.keys(widthSize).forEach((bp) => {
      const bpLayout = dashboardChartsToPlace.reduce((items, chart) => {
        if (!chart?.layout?.[bp]) return items;

        items.push({
          i: `${chart.id}`,
          x: chart.layout[bp][0] || 0,
          y: chart.layout[bp][1] || 0,
          w: chart.layout[bp][2],
          h: chart.layout[bp][3],
        });

        return items;
      }, []);

      const w = bp === "lg" ? 4 : bp === "md" ? 5 : bp === "sm" ? 3 : bp === "xs" ? 2 : 2;
      const pos = placeNewWidget(bpLayout, { w, h: 2 }, bp);
      computedLayout[bp] = [pos.x, pos.y, pos.w, pos.h];
    });

    return computedLayout;
  };

  const createChartFromDataset = async (dataset) => {
    if (!dataset?.id) return;

    setCreatingDatasetChartId(dataset.id);

    let initialDataFetchStarted = false;

    try {
      const datasetName = getDatasetDisplayName(dataset) || "Untitled dataset";
      const defaultBindings = getDefaultCdcBindings(dataset);
      const chart = await dispatch(createChart({
        project_id: projectId,
        data: {
          type: "line",
          subType: "lcTimeseries",
          name: datasetName,
          layout: getNewChartLayout(),
        },
      })).unwrap();

      await dispatch(createCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        data: {
          dataset_id: dataset.id,
          legend: datasetName,
          datasetColor: chartColors.blue.hex,
          fill: false,
          order: 0,
          ...defaultBindings,
        },
      })).unwrap();

      initialDataFetchStarted = true;
      await dispatch(runQuery({
        project_id: chart.project_id,
        chart_id: chart.id,
        noSource: false,
        skipParsing: false,
        getCache: true,
      })).unwrap();

      navigate(`/dashboard/${projectId}/chart/${chart.id}/edit`);
    } catch (error) {
      toast.error(initialDataFetchStarted
        ? "We couldn't fetch data for this chart yet. Please check the dataset and try again."
        : "Oups! Can't create the chart. Please try again.");
    } finally {
      setCreatingDatasetChartId(null);
    }
  };

  const browseTemplates = () => {
    navigate(`/dashboard/${projectId}/chart?tab=templates`);
  };

  const showAi = () => {
    dispatch(showAiModal());
  };

  const starterState = datasets.length > 0 ? "datasets" : connections.length > 0 ? "connections" : "blank";
  const datasetConnectionTypes = [...new Set(datasets.flatMap((dataset) => getDatasetConnectionTypes(dataset)))]
    .sort((left, right) => formatConnectionType(left).localeCompare(formatConnectionType(right)));
  const filteredDatasets = datasets.filter((dataset) => {
    const datasetName = getDatasetDisplayName(dataset).toLowerCase();
    const matchesName = !datasetSearch.trim()
      || datasetName.includes(datasetSearch.trim().toLowerCase());
    const matchesConnectionType = datasetConnectionType === "all"
      || getDatasetConnectionTypes(dataset).includes(datasetConnectionType);

    return matchesName && matchesConnectionType;
  });
  const datasetTotalPages = Math.max(1, Math.ceil(filteredDatasets.length / DATASETS_PER_PAGE));
  const safeDatasetPage = Math.min(datasetPage, datasetTotalPages);
  const datasetPageStart = (safeDatasetPage - 1) * DATASETS_PER_PAGE;
  const paginatedDatasets = filteredDatasets.slice(datasetPageStart, datasetPageStart + DATASETS_PER_PAGE);
  const datasetResultStart = filteredDatasets.length === 0 ? 0 : datasetPageStart + 1;
  const datasetResultEnd = Math.min(datasetPageStart + DATASETS_PER_PAGE, filteredDatasets.length);
  const datasetPaginationItems = getPaginationPageNumbers(safeDatasetPage, datasetTotalPages);

  const pageCopy = {
    blank: {
      title: "Create your first dashboard by connecting a data source.",
      description: "Chartbrew turns your data into reusable datasets and dashboards. Start by connecting a source.",
      workflowStep: "connect",
    },
    connections: {
      title: "Turn your connected sources into reusable datasets.",
      description: "Datasets are saved queries you can reuse across charts and dashboards.",
      workflowStep: "dataset",
    },
    datasets: {
      title: "Start adding charts from your existing datasets.",
      description: "You already have reusable datasets. Pick one and build a chart.",
      workflowStep: "charts",
    },
  }[starterState];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
            {pageCopy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground-500">
            {pageCopy.description}
          </p>
        </div>
      </div>

      {starterState === "blank" && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <StarterCard
              title="Connect data source"
              description="Postgres, MySQL, MongoDB, Stripe, REST API and more."
              actionLabel="Connect data source"
              icon={LuPlug}
              featured
              onPress={() => navigate("/connections/new")}
            />
            <StarterCard
              title="Browse templates"
              description="Start from a pre-built dashboard template."
              actionLabel="Browse templates"
              icon={LuFileText}
              iconColor="warning"
              onPress={browseTemplates}
              actionVariant="outline"
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground-500">Recommended next step</h2>
            <AiRecommendation
              title="AI unlocks after you connect data"
              description="Connect a source first so Chartbrew can inspect your schema and suggest charts."
              actionLabel="Plan my dashboard"
              disabled
              icon={LuBrainCircuit}
              onPress={showAi}
            />
          </section>
        </>
      )}

      {starterState === "connections" && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <StarterCard
              title="Create your first dataset"
              actionLabel="Create dataset"
              description="Create a dataset from your connected sources."
              icon={LuDatabase}
              featured
              onPress={() => navigate("/datasets/new")}
            />
            <StarterCard
              title="Start from a template"
              actionLabel="Use templates"
              description="Start from a pre-built dashboard template."
              icon={LuFileText}
              iconColor="warning"
              onPress={browseTemplates}
              actionVariant="outline"
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground-500">Recommended next step</h2>
            <AiRecommendation
              title="Ask AI to suggest datasets"
              description="AI can help with setup based on your connected sources. Insights come once datasets exist."
              actionLabel="Ask AI to suggest datasets"
              icon={LuBrainCircuit}
              onPress={showAi}
            />
          </section>
        </>
      )}

      {starterState === "datasets" && (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <StarterCard
              title="Add chart from dataset"
              actionLabel="Add chart from dataset"
              description="Use your existing datasets to create charts."
              icon={LuChartColumn}
              featured
              onPress={() => navigate(`/dashboard/${projectId}/chart`)}
            />
            <StarterCard
              title="Build with AI"
              actionLabel="Ask your data"
              description="Ask the assistant to build the dashboard for you."
              icon={LuBrainCircuit}
              iconColor="success"
              onPress={showAi}
              actionVariant="outline"
            />
            <StarterCard
              title="Browse templates"
              actionLabel="Browse templates"
              description="Start from a pre-built dashboard template."
              icon={LuFileText}
              iconColor="warning"
              onPress={browseTemplates}
              actionVariant="outline"
            />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground-500">Your datasets</h2>
                <p className="text-sm text-foreground-500">
                  {`Showing ${datasetResultStart}-${datasetResultEnd} of ${filteredDatasets.length} datasets`}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
                <SearchField
                  aria-label="Search datasets by name"
                  name="dashboard-starter-dataset-search"
                  onChange={(value) => {
                    setDatasetSearch(value);
                    setDatasetPage(1);
                  }}
                  value={datasetSearch}
                  variant="secondary"
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search datasets" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <Select
                  aria-label="Filter datasets by connection type"
                  onChange={(value) => {
                    setDatasetConnectionType(value || "all");
                    setDatasetPage(1);
                  }}
                  placeholder="Connection type"
                  value={datasetConnectionType}
                  variant="secondary"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="all" textValue="All connection types">
                        All connection types
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {datasetConnectionTypes.map((connectionType) => (
                        <ListBox.Item key={connectionType} id={connectionType} textValue={formatConnectionType(connectionType)}>
                          {formatConnectionType(connectionType)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>
            <Table variant="secondary" className="overflow-hidden rounded-3xl border border-divider bg-surface">
              <Table.ScrollContainer>
                <Table.Content aria-label="Reusable datasets" className="min-w-full">
                  <Table.Header>
                    <Table.Column id="name" isRowHeader>Dataset name</Table.Column>
                    <Table.Column id="source">Source</Table.Column>
                    <Table.Column id="usedIn">Used in</Table.Column>
                    <Table.Column id="action" className="text-right">Action</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex min-h-32 items-center justify-center text-sm text-foreground-500">
                        No datasets match these filters.
                      </div>
                    )}
                  >
                    {paginatedDatasets.map((dataset) => {
                      const sources = getDatasetSources(dataset);
                      const primaryConnection = getDatasetPrimaryConnection(dataset);
                      const usedInCount = dataset.project_ids?.length || 0;
                      const isCreatingChart = creatingDatasetChartId === dataset.id;

                      return (
                        <Table.Row key={dataset.id} id={String(dataset.id)}>
                          <Table.Cell>
                            <div className="flex min-w-[220px] items-center gap-3">
                              <Avatar size="sm" className="shrink-0 bg-content3">
                                {primaryConnection ? (
                                  <Avatar.Image
                                    src={getConnectionLogo(primaryConnection, isDark)}
                                    alt={`${primaryConnection.subType || primaryConnection.type} logo`}
                                  />
                                ) : null}
                                <Avatar.Fallback>
                                  <LuPlug size={16} />
                                </Avatar.Fallback>
                              </Avatar>
                              <span className="font-medium text-foreground">{getDatasetDisplayName(dataset) || "Untitled dataset"}</span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-foreground-500">{sources[0] || "Unknown source"}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-foreground-500">
                              {`${usedInCount} dashboard${usedInCount === 1 ? "" : "s"}`}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                isPending={isCreatingChart}
                                onPress={() => createChartFromDataset(dataset)}
                              >
                                <LuPlus size={16} />
                                Add chart
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
              {datasetTotalPages > 1 && (
                <Table.Footer className="flex flex-col gap-3 border-t border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <Pagination size="sm" aria-label="Dashboard starter dataset pagination">
                    <Pagination.Content>
                      <Pagination.Item>
                        <Pagination.Previous
                          isDisabled={safeDatasetPage <= 1}
                          onPress={() => setDatasetPage(safeDatasetPage - 1)}
                        >
                          <Pagination.PreviousIcon />
                        </Pagination.Previous>
                      </Pagination.Item>
                      {datasetPaginationItems.map((item, index) => (
                        item === "ellipsis" ? (
                          <Pagination.Item key={`dataset-pagination-ellipsis-${index}`}>
                            <Pagination.Ellipsis />
                          </Pagination.Item>
                        ) : (
                          <Pagination.Item key={item}>
                            <Pagination.Link
                              isActive={item === safeDatasetPage}
                              onPress={() => setDatasetPage(item)}
                            >
                              {item}
                            </Pagination.Link>
                          </Pagination.Item>
                        )
                      ))}
                      <Pagination.Item>
                        <Pagination.Next
                          isDisabled={safeDatasetPage >= datasetTotalPages}
                          onPress={() => setDatasetPage(safeDatasetPage + 1)}
                        >
                          <Pagination.NextIcon />
                        </Pagination.Next>
                      </Pagination.Item>
                    </Pagination.Content>
                  </Pagination>
                </Table.Footer>
              )}
            </Table>
          </section>
        </>
      )}

      <WorkflowGuide activeStep={pageCopy.workflowStep} />
    </div>
  );
}

DashboardStarter.propTypes = {
  projectId: PropTypes.string.isRequired,
};

export default DashboardStarter;
