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
  LuCheck,
  LuCircleX,
  LuCircleDollarSign,
  LuCreditCard,
  LuDollarSign,
  LuFileText,
  LuHeartHandshake,
  LuPlus,
  LuReceipt,
  LuRefreshCw,
  LuTable,
  LuTrendingDown,
  LuTrendingUp,
  LuUndo2,
  LuUserMinus,
  LuUsers,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import { createFromChartTemplate, getChartTemplate } from "../../slices/chartTemplate";
import { getProjectCharts } from "../../slices/chart";
import { ButtonSpinner } from "../../components/ButtonSpinner";

const GROUPS = [{
  id: "business",
  label: "Business metrics",
  description: "Computed Stripe metrics that combine multiple API resources.",
}, {
  id: "revenue",
  label: "Revenue",
  description: "Cash movement, gross amounts, fees, refunds, and net revenue.",
}, {
  id: "payments",
  label: "Payments",
  description: "Successful, failed, and recent payment activity.",
}, {
  id: "customers",
  label: "Customers",
  description: "Customer-level estimates and account value metrics.",
}, {
  id: "subscriptions",
  label: "Subscriptions",
  description: "Recurring revenue, subscription starts, active records, and churn.",
}, {
  id: "invoices",
  label: "Invoices",
  description: "Invoice tables and payment status follow-up.",
}];

const TEMPLATE_ORDER = {
  "compiled-metrics": 0,
  "starter-metrics": 1,
};

const DASHBOARD_CREATE_SETTLE_DELAY_MS = 10000;

const TEMPLATE_ICONS = {
  BadgeDollarSign: LuBadgeDollarSign,
  ChartBar: LuChartBar,
  ChartLine: LuChartLine,
  CheckCircle: LuCheck,
  CircleDollarSign: LuCircleDollarSign,
  CreditCard: LuCreditCard,
  DollarSign: LuDollarSign,
  FileText: LuFileText,
  HeartHandshake: LuHeartHandshake,
  Receipt: LuReceipt,
  RefreshCw: LuRefreshCw,
  Table: LuTable,
  TrendingDown: LuTrendingDown,
  TrendingUp: LuTrendingUp,
  Undo2: LuUndo2,
  UserMinus: LuUserMinus,
  Users: LuUsers,
  XCircle: LuCircleX,
};

const RESOURCE_LABELS = {
  balance_transactions: "Balance transactions",
  charges: "Charges",
  customers: "Customers",
  invoices: "Invoices",
  payment_intents: "Payment Intents",
  payouts: "Payouts",
  refunds: "Refunds",
  subscriptions: "Subscriptions",
};

const COMPILED_METRIC_LABELS = {
  active_subscribers: "Active subscribers",
  arpa: "ARPA",
  arr: "ARR",
  customer_lifetime_value: "Customer lifetime value",
  gross_mrr_churn_rate: "Gross MRR churn rate",
  mrr: "MRR",
  net_cash_flow: "Net cash flow",
  net_mrr_churn_rate: "Net MRR churn rate",
  subscriber_churn_rate: "Subscriber churn rate",
};

const CARD_META = {
  "starter-metrics:net-revenue-kpi": {
    group: "revenue",
    caveat: "Last 30 days, daily trend. Uses balance transaction charges after fees.",
    recommended: true,
  },
  "starter-metrics:gross-revenue-kpi": {
    group: "revenue",
    caveat: "Last 30 days, daily trend. Gross Stripe amount before fees.",
  },
  "starter-metrics:stripe-fees-kpi": {
    group: "revenue",
    caveat: "Last 30 days, daily bars. Higher fees are treated as negative growth.",
  },
  "starter-metrics:net-revenue-over-time": {
    group: "revenue",
    caveat: "Last 90 days, weekly trend. Avoids noisy daily revenue spikes.",
    recommended: true,
  },
  "starter-metrics:gross-revenue-vs-fees": {
    group: "revenue",
    caveat: "Last 90 days, weekly bars comparing gross revenue and fees.",
    recommended: true,
  },
  "starter-metrics:refunds-over-time": {
    group: "revenue",
    caveat: "Last 90 days, weekly bars because refunds are usually sparse.",
    recommended: true,
  },
  "starter-metrics:successful-vs-failed-payments": {
    group: "payments",
    caveat: "Last 30 days, daily bars comparing successful and failed payments.",
    recommended: true,
  },
  "starter-metrics:latest-payments-table": {
    group: "payments",
    caveat: "Last 30 days, newest first, capped at 10 rows.",
    recommended: true,
  },
  "starter-metrics:active-subscriptions": {
    group: "subscriptions",
    caveat: "Current active subscribers with positive MRR.",
    recommended: true,
  },
  "starter-metrics:new-subscriptions-over-time": {
    group: "subscriptions",
    caveat: "Last 90 days, weekly bars for new subscriptions.",
    recommended: true,
  },
  "starter-metrics:open-invoice-amount": {
    group: "invoices",
    caveat: "Current open invoice amount due.",
  },
  "starter-metrics:open-invoices-table": {
    group: "invoices",
    caveat: "Current open invoices, newest first, capped at 10 rows.",
  },
  "compiled-metrics:mrr": {
    group: "business",
    caveat: "Last 12 months, monthly only. Excludes taxes, metered usage, multi-currency conversion, and historical price changes; subtracts active recurring customer, subscription, and item discounts returned by Stripe.",
    recommended: true,
  },
  "compiled-metrics:arr": {
    group: "business",
    caveat: "ARR is calculated as MRR times 12 using subscription item recurring prices.",
    recommended: true,
  },
  "compiled-metrics:arpa": {
    group: "business",
    caveat: "Last 12 months, monthly estimate from MRR divided by active customers.",
  },
  "compiled-metrics:net-cash-flow": {
    group: "business",
    caveat: "Last 12 months, monthly bars. Direct Stripe balance movement, not a full accounting ledger.",
  },
  "compiled-metrics:gross-mrr-churn-rate": {
    group: "business",
    caveat: "Last 12 months, monthly percentage based on churned customer MRR.",
  },
  "compiled-metrics:net-mrr-churn-rate": {
    group: "business",
    caveat: "First pass uses canceled MRR only; expansion, contraction, and reactivation are not included yet.",
  },
  "compiled-metrics:subscriber-churn-rate": {
    group: "business",
    caveat: "Churned subscribers divided by starting subscribers plus new subscribers.",
  },
  "compiled-metrics:customer-lifetime-value": {
    group: "business",
    caveat: "Estimated from ARPA divided by subscriber churn; falls back to ARPA when churn is unavailable.",
  },
};

function sortTemplatesBySetupOrder(templatesToSort) {
  return [...templatesToSort].sort((left, right) => {
    const leftOrder = TEMPLATE_ORDER[left.slug] ?? 100;
    const rightOrder = TEMPLATE_ORDER[right.slug] ?? 100;
    return leftOrder - rightOrder;
  });
}

function getChartTypeLabel(type) {
  if (!type) return "Chart";

  const labels = {
    bar: "Bar chart",
    doughnut: "Doughnut chart",
    kpi: "KPI",
    line: "Line chart",
    table: "Table",
  };

  return labels[type] || `${type.charAt(0).toUpperCase()}${type.slice(1)} chart`;
}

function formatFieldName(field) {
  return String(field || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFilter(filter) {
  if (!filter?.field) return null;
  if (filter.value === undefined || filter.value === null || filter.value === "") return null;
  const operator = filter.operator === "isNot" ? "is not" : filter.operator || "is";
  return `${formatFieldName(filter.field)} ${operator} ${filter.value}`;
}

function getMetricLabel(config) {
  if (config?.mode === "compiled_metric") {
    return COMPILED_METRIC_LABELS[config.compiledMetric] || formatFieldName(config.compiledMetric);
  }

  const operation = config?.metric?.operation || "count";
  const field = config?.metric?.field ? formatFieldName(config.metric.field) : "records";
  return `${formatFieldName(operation)} ${field}`;
}

function getSourceLabel(config) {
  if (config?.mode === "compiled_metric") {
    return COMPILED_METRIC_LABELS[config.compiledMetric] || formatFieldName(config.compiledMetric);
  }

  return RESOURCE_LABELS[config?.resource] || formatFieldName(config?.resource);
}

function getTemplateIcon(iconName) {
  return TEMPLATE_ICONS[iconName] || LuChartArea;
}

function uniq(values) {
  return [...new Set(values)];
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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
      const filters = (config.filters || []).map(formatFilter).filter(Boolean);

      return {
        key,
        id: chart.id,
        template,
        chart,
        datasets,
        group: meta.group || "business",
        caveat: meta.caveat || primaryDataset.description || chart.description,
        recommended: meta.recommended === true,
        isComputed: config.mode === "compiled_metric",
        sourceLabel: getSourceLabel(config),
        metricLabel: getMetricLabel(config),
        filters,
      };
    });
  });
}

function formatCreatedSummary(result) {
  const datasetCount = result.datasets.length;
  const chartCount = result.charts.length;
  const parts = [];

  if (datasetCount > 0) {
    parts.push(`${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`);
  }
  if (chartCount > 0) {
    parts.push(`${chartCount} chart${chartCount === 1 ? "" : "s"}`);
  }

  return parts.join(" and ");
}

function MetricCard(props) {
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
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox>
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{card.chart.name}</span>
        </div>
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
          <span className="text-muted">{card.isComputed ? "Metric" : "Resource"}</span>
          <span className="text-right font-medium text-foreground">{card.sourceLabel}</span>
        </div>
        <div className="flex flex-row items-center justify-between gap-3">
          <span className="text-muted">Default</span>
          <span className="text-right font-medium text-foreground">{card.metricLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {card.isComputed && (
          <Chip color="warning" size="sm" variant="soft">Computed metric</Chip>
        )}
        {card.filters.length > 0 ? card.filters.map((filter) => (
          <Chip key={filter} size="sm" variant="secondary">{filter}</Chip>
        )) : (
          <Chip size="sm" variant="secondary">No filters</Chip>
        )}
      </div>

      {/* {card.caveat && (
        <p className="mt-3 text-xs leading-5 text-muted">{card.caveat}</p>
      )} */}
    </div>
  );
}

function StripeOfficialTemplateSetup(props) {
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
  const [newDashboardName, setNewDashboardName] = useState("Stripe Revenue");
  const [fullTemplates, setFullTemplates] = useState([]);
  const [selectedCardKeys, setSelectedCardKeys] = useState([]);
  const [initializedCardsSignature, setInitializedCardsSignature] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [actionMode, setActionMode] = useState("dashboard");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const visibleProjects = useMemo(() => (projects || []).filter((project) => !project.ghost), [projects]);
  const fixedProject = visibleProjects.find((project) => `${project.id}` === `${fixedProjectId}`);
  const templatesSignature = useMemo(() => (
    templates.map((template) => `${template.source}:${template.slug}`).join("|")
  ), [templates]);
  const cards = useMemo(() => buildCards(fullTemplates), [fullTemplates]);
  const cardsSignature = useMemo(() => cards.map((card) => card.key).join("|"), [cards]);
  const selectedCards = useMemo(() => {
    return cards.filter((card) => selectedCardKeys.includes(card.key));
  }, [cards, selectedCardKeys]);
  const selectedDatasetCount = useMemo(() => {
    return uniq(selectedCards.flatMap((card) => card.datasets.map((dataset) => `${card.template.slug}:${dataset.id}`))).length;
  }, [selectedCards]);
  const selectedChartCount = selectedCards.length;

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
        setFullTemplates(sortTemplatesBySetupOrder(loadedTemplates));
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setCreateError(loadError.message || "Could not load Stripe templates");
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

  const _createSelected = async (mode) => {
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

      const templatesToCreate = sortTemplatesBySetupOrder(fullTemplates.filter((template) => {
        return selectedCards.some((card) => card.template.slug === template.slug);
      }));

      for (const template of templatesToCreate) {
        const cardsForTemplate = selectedCards.filter((card) => card.template.slug === template.slug);
        const dashboard = projectId
          ? { type: "existing", project_id: projectId }
          : { type: "new", name: newDashboardName || "Stripe Revenue" };
        const result = await dispatch(createFromChartTemplate({
          team_id: teamId,
          source: template.source,
          slug: template.slug,
          data: {
            connection_id: connection.id,
            dashboard,
            dataset_template_ids: uniq(cardsForTemplate.flatMap((card) => card.datasets.map((dataset) => dataset.id))),
            chart_template_ids: mode === "dashboard" ? cardsForTemplate.map((card) => card.chart.id) : [],
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
      setCreateError(createTemplateError.message || "Could not create Stripe templates");
    } finally {
      setIsCreating(false);
    }
  };

  const _openCreatedContent = () => {
    if (actionMode === "dashboard" && createResult?.project_id) {
      navigate(`/dashboard/${createResult.project_id}`);
      return;
    }

    navigate("/datasets");
  };

  const isLoadPending = loading || (templates.length > 0 && fullTemplates.length === 0);
  const createDisabled = isCreating || selectedCards.length === 0 || (dashboardMode === "existing" && !selectedProjectId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Surface className="rounded-3xl border border-divider p-5" variant="default">
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold">{title || "What do you want to track?"}</p>
              <p className="text-sm text-muted">
                Choose Stripe metrics and Chartbrew will create the matching datasets and charts.
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
                  <Alert.Title>Could not prepare Stripe templates</Alert.Title>
                  <Alert.Description>{error || createError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {isLoadPending && (
              <span className="text-sm text-foreground-500">Loading Stripe metric packs...</span>
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
                      <MetricCard
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
                  <span className="text-muted">Metrics</span>
                  <span className="font-medium text-foreground">{selectedCards.length}</span>
                </div>
                <div className="flex flex-row items-center justify-between gap-3">
                  <span className="text-muted">Datasets</span>
                  <span className="font-medium text-foreground">{selectedDatasetCount}</span>
                </div>
                <div className="flex flex-row items-center justify-between gap-3">
                  <span className="text-muted">Charts</span>
                  <span className="font-medium text-foreground">{selectedChartCount}</span>
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
                      <TextField fullWidth name="stripe-official-template-dashboard-name">
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
                    <Alert.Title>Stripe content created</Alert.Title>
                    <Alert.Description>{formatCreatedSummary(createResult)} created successfully.</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </div>
          </Surface>

          {!createResult && (
            <div className="flex flex-col gap-2">
              <Button
                fullWidth
                isDisabled={createDisabled}
                isPending={isCreating && actionMode === "dashboard"}
                variant="primary"
                onPress={() => _createSelected("dashboard")}
              >
                {isCreating && actionMode === "dashboard" ? <ButtonSpinner /> : null}
                Create and add to dashboard
              </Button>
              <Button
                fullWidth
                isDisabled={createDisabled}
                isPending={isCreating && actionMode === "datasets"}
                variant="secondary"
                onPress={() => _createSelected("datasets")}
              >
                {isCreating && actionMode === "datasets" ? <ButtonSpinner /> : null}
                Create datasets only
              </Button>
            </div>
          )}

          {createResult && (
            <Button fullWidth variant="primary" onPress={_openCreatedContent}>
              <LuCheck />
              {actionMode === "dashboard" ? "Open dashboard" : "Open datasets"}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

MetricCard.propTypes = {
  card: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

StripeOfficialTemplateSetup.propTypes = {
  connection: PropTypes.object.isRequired,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  fixedProjectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  loading: PropTypes.bool,
  projects: PropTypes.array,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  templates: PropTypes.array,
  title: PropTypes.string,
};

StripeOfficialTemplateSetup.defaultProps = {
  error: null,
  fixedProjectId: null,
  loading: false,
  projects: [],
  templates: [],
  title: null,
};

export default StripeOfficialTemplateSetup;
