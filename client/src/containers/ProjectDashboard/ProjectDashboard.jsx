import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Tooltip,
  Modal,
  Chip,
  Avatar,
  Popover,
  ListBox,
  Separator,
  Dropdown,
  Kbd,
  ButtonGroup,
  Tabs,
  Skeleton,
} from "@heroui/react";
import {
  Link, useNavigate, useParams, useSearchParams,
} from "react-router";
import _, { isEqual } from "lodash";
import toast from "react-hot-toast";
import {
  LuCalendarClock,
  LuCopyPlus, LuFileDown, LuLayoutDashboard, LuListFilter,
  LuRefreshCw, LuUser, LuUsers,
  LuEllipsisVertical, LuShare, LuChartPie, LuLetterText,
  LuMonitorSmartphone, LuUndo2,
  LuMonitorUp,
  LuArrowDownRight,
  LuTvMinimal,
  LuChevronDown,
  LuSettings,
  LuPlus,
} from "react-icons/lu";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { v4 as uuidv4 } from "uuid";

import Chart from "../Chart/Chart";
import AddFilters from "./components/AddFilters";
import {
  runQueryWithFilters, runQuery, changeOrder, updateChart, selectCharts,
  clearStagedCharts,
  setCharts,
  exportChart,
  stageChart,
  shouldSkipFiltering,
} from "../../slices/chart";
import canAccess from "../../config/canAccess";
import ChartExport from "./components/ChartExport";
import CreateTemplateForm from "../../components/CreateTemplateForm";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import Text from "../../components/Text";
import { selectProjectMembers, selectTeam } from "../../slices/team";
import { cols, margin, widthSize } from "../../modules/layoutBreakpoints";
import { selectUser } from "../../slices/user";
import UpdateSchedule from "./components/UpdateSchedule";
import { exportMultipleChartsToExcel, canExportChart } from "../../modules/exportChart";
import { selectProject, getProject, saveDashboardLayout } from "../../slices/project";
import SharingSettings from "../PublicDashboard/components/SharingSettings";
import isMac from "../../modules/isMac";
import { displayInitials } from "../../modules/utils";
import TextWidget from "../Chart/TextWidget";
import SnapshotSchedule from "./components/SnapshotSchedule";
import DashboardFilters from "./components/DashboardFilters";
import { placeNewWidget } from "../../modules/autoLayout";
import SuspenseLoader from "../../components/SuspenseLoader";
import { buildChartRuntimeRequest } from "../../modules/chartRuntimeFilters";
import { mergeDashboardFilters } from "../../modules/dashboardFilters";
import DashboardStarter from "./components/DashboardStarter";

import { getBreakpoint, getLayouts, getReportOrder, deriveLayouts, visualOrder, defaultSize, breakpoints, labels, rowHeight, tidyLayout, autoArrange } from "../../../../shared/dashboard/layout.mjs";

const ResponsiveGridLayout = WidthProvider(Responsive, { measureBeforeMount: true });

function DashboardChartSkeleton({ height }) {
  const skeletonHeight = Math.max(height || 150, 150);

  return (
    <div
      className="h-full rounded-2xl border border-solid border-divider bg-surface shadow-none"
      style={{ minHeight: skeletonHeight }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-40 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24 rounded-lg" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton
          className="w-full rounded-xl"
          style={{ height: Math.max(skeletonHeight - 88, 96) }}
        />
      </div>
    </div>
  );
}

DashboardChartSkeleton.propTypes = {
  height: PropTypes.number,
};

DashboardChartSkeleton.defaultProps = {
  height: 150,
};

const getFiltersFromStorage = () => {
  try {
    const filters = JSON.parse(window.localStorage.getItem("_cb_filters"));
    return filters || null;
  } catch (e) {
    return null;
  }
};

/*
  Dashboard container (for the charts)
*/
function ProjectDashboard() {
  const [filters, setFilters] = useState(getFiltersFromStorage());
  const [showFilters, setShowFilters] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [viewExport, setViewExport] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [layouts, setLayouts] = useState(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [layoutOrder, setLayoutOrder] = useState([]);
  const [layoutCustom, setLayoutCustom] = useState(breakpoints);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [layoutUndo, setLayoutUndo] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [stagedContent, setStagedContent] = useState({});
  const [previewSize, setPreviewSize] = useState({});
  const [snapshotScheduleVisible, setSnapshotScheduleVisible] = useState(false);
  const [gridBreakpoint, setGridBreakpoint] = useState(null);
  const [pendingScrollWidgetId, setPendingScrollWidgetId] = useState(null);
  const [chartFilters, setChartFilters] = useState({});
  const [initialRuntimeHydrationPending, setInitialRuntimeHydrationPending] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const charts = useSelector(selectCharts);
  const project = useSelector(selectProject);
  const chartsLoading = useSelector((state) => state.chart.loading);
  const projectMembers = useSelector((state) => selectProjectMembers(state, params.projectId));

  const hasRunInitialFiltering = useRef(null);
  const dashboardRef = useRef(null);
  const dashboardParentRef = useRef(null);

  useEffect(() => {
    if (Number(project?.id) !== Number(params.projectId)) return;
    const setup = searchParams.get("setup");
    if (setup === "updates") setScheduleVisible(true);
    if (setup === "sharing") setShowShare(true);
    if (setup === "updates" || setup === "sharing") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("setup");
      setSearchParams(nextParams, { replace: true });
    }
  }, [params.projectId, project?.id, searchParams, setSearchParams]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only trigger if no input/textarea is focused
      if (event.target.tagName.toLowerCase() === "input" || event.target.tagName.toLowerCase() === "textarea") return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (editingLayout) {
          _onCancelChanges();
        } else {
          _onEditLayout();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [editingLayout]);

  useEffect(() => {
    if (!editingLayout) {
      setLayouts(getLayouts(charts));
      if (charts.some((chart) => chart.staged)) _onEditLayout();
    }
  }, [charts, editingLayout]);

  useEffect(() => {
    setChartFilters((currentChartFilters) => {
      const nextChartFilters = {};

      Object.keys(currentChartFilters || {}).forEach((chartId) => {
        if (charts.some((chart) => `${chart.id}` === `${chartId}`)) {
          nextChartFilters[chartId] = currentChartFilters[chartId];
        }
      });

      return isEqual(currentChartFilters, nextChartFilters) ? currentChartFilters : nextChartFilters;
    });
  }, [charts]);

  useEffect(() => {
    if (project?.DashboardFilters) {
      const storedFilters = JSON.parse(window.localStorage.getItem("_cb_filters") || "{}");
      const projectId = project.id;

      // Get existing filters for this project
      const existingFilters = storedFilters[projectId] || [];

      const nextProjectFilters = mergeDashboardFilters(project.DashboardFilters, existingFilters);
      const hasUpdatedFilters = JSON.stringify(nextProjectFilters) !== JSON.stringify(existingFilters);

      if (hasUpdatedFilters) {
        const finalFilters = {
          ...storedFilters,
          [projectId]: nextProjectFilters,
        };

        // Only update localStorage if the filters have actually changed
        const currentFiltersStr = window.localStorage.getItem("_cb_filters");
        const newFiltersStr = JSON.stringify(finalFilters);
        
        if (currentFiltersStr !== newFiltersStr) {
          window.localStorage.setItem("_cb_filters", newFiltersStr);
          setFilters(finalFilters);
        }
      }
    }
  }, [project?.DashboardFilters]);

  useEffect(() => {
    if (!pendingScrollWidgetId || !layouts) return undefined;

    const hasPendingWidget = charts.some((chart) => `${chart.id}` === `${pendingScrollWidgetId}`);
    if (!hasPendingWidget) return undefined;

    const timeoutId = window.setTimeout(() => {
      const widgetElement = document.getElementById(`dashboard-widget-${pendingScrollWidgetId}`);
      if (!widgetElement) return;

      widgetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setPendingScrollWidgetId(null);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [charts, layouts, pendingScrollWidgetId]);

  const _onEditLayout = async () => {
    if (editingLayout || layoutSaving) return;
    setLayoutError("");
    try {
      const current = await dispatch(getProject({ project_id: params.projectId })).unwrap();
      const currentCharts = [...current.Charts, ...charts.filter((chart) => chart.staged)];
      dispatch(setCharts(currentCharts));
      setLayoutOrder(getReportOrder(currentCharts, current.layoutOrder));
      setLayoutCustom(current.layoutCustom || breakpoints);
      setLayoutRevision(current.layoutRevision);
      setLayouts(getLayouts(currentCharts));
      setLayoutUndo(null);
      const bp = getBreakpoint(dashboardParentRef.current?.offsetWidth || 1201);
      setPreviewSize({ breakpoint: bp, size: (widthSize[bp] || 1200) + 1 });
      setEditingLayout(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const _onChangePreviewSize = (key) => {
    setPreviewSize({ size: widthSize[key] + 1, breakpoint: key });
  };

  const _applyAutoLayout = (action = "arrange") => {
    if (!layouts || layoutSaving) return;
    const bp = previewSize.breakpoint || gridBreakpoint;
    const byId = new Map((layouts[bp] || []).map((item) => [String(item.i), item]));
    const order = getReportOrder(charts, layoutOrder);
    const items = order.map((id) => byId.get(id)).filter(Boolean);
    try {
      const nextCustom = action === "automatic" ? layoutCustom.filter((key) => key !== bp)
        : [...new Set([...layoutCustom, bp])];
      const next = action === "automatic" ? layouts : {
        ...layouts, [bp]: action === "tidy" ? tidyLayout(items, bp) : autoArrange(items, charts, bp),
      };
      setLayoutUndo({ layouts, order: layoutOrder, custom: layoutCustom });
      const nextOrder = bp === "lg" ? visualOrder(next[bp]).map((item) => String(item.i)) : order;
      setLayoutOrder(nextOrder);
      setLayouts(deriveLayouts(next, nextOrder, nextCustom));
      setLayoutCustom(nextCustom);
      setLayoutError("");
    } catch (error) {
      setLayoutError(error.message);
    }
  };

  const _onManualLayout = (layout) => {
    if (layoutSaving) return;
    const bp = previewSize.breakpoint || gridBreakpoint;
    const order = bp === "lg" ? visualOrder(layout).map((item) => String(item.i)) : getReportOrder(charts, layoutOrder);
    const custom = [...new Set([...layoutCustom, bp])];
    setLayoutUndo({ layouts, order: layoutOrder, custom: layoutCustom });
    setLayoutOrder(order);
    setLayoutCustom(custom);
    setLayouts(deriveLayouts({ ...layouts, [bp]: layout }, order, custom));
  };

  const _onAddFilter = (filter) => {
    const { projectId } = params;

    const newFilters = _.clone(filters) || {};
    if (!newFilters[projectId]) newFilters[projectId] = [];

    newFilters[projectId].push(filter);
    setFilters(newFilters);

    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));

    setShowFilters(false);
    _runFiltering(newFilters);
  };

  const _onAddVariableFilter = (variableFilter) => {
    const { projectId } = params;

    const newFilters = _.clone(filters) || {};
    if (!newFilters[projectId]) newFilters[projectId] = [];

    // Convert variable filter to unified filter format
    const filter = {
      id: uuidv4(),
      type: "variable",
      ...variableFilter,
    };

    newFilters[projectId].push(filter);
    setFilters(newFilters);

    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));

    _runFiltering(newFilters);
    setShowFilters(false);
  };

  const _onRemoveFilter = (filterId) => {
    const { projectId } = params;
    if (filters && filters[projectId].length === 1) {
      const newFilters = _.cloneDeep(filters);
      delete newFilters[projectId];
      setFilters(newFilters);
      
      // Only remove the entire localStorage if no other projects have filters
      if (Object.keys(newFilters).length === 0) {
        window.localStorage.removeItem("_cb_filters");
      } else {
        window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
      }
      
      _runFiltering(newFilters);
      return;
    }

    const index = _.findIndex(filters[projectId], { id: filterId });
    if (!index && index !== 0) return;

    const newFilters = _.cloneDeep(filters);
    newFilters[projectId].splice(index, 1);

    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
    _runFiltering(newFilters);
  };

  const _onReorderFilters = (projectFilters) => {
    const { projectId } = params;
    const newFilters = {
      ...(filters || {}),
      [projectId]: projectFilters,
    };

    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
  };

  const _buildRuntimeRequest = (chart, currentFilters = filters, currentChartFilters = chartFilters) => {
    return buildChartRuntimeRequest({
      chart,
      dashboardFilters: currentFilters?.[params.projectId] || [],
      chartFilters: currentChartFilters?.[chart.id] || [],
    });
  };

  useEffect(() => {
    if (filterLoading || !filters || charts.length === 0 || hasRunInitialFiltering.current) {
      return;
    }

    const runtimeChartIds = charts
      .filter((chart) => chart.type !== "markdown")
      .filter((chart) => _buildRuntimeRequest(chart, filters, chartFilters).hasRuntimeFilters)
      .map((chart) => chart.id);

    hasRunInitialFiltering.current = true;

    if (runtimeChartIds.length === 0) {
      return;
    }

    setInitialRuntimeHydrationPending(true);
    _runFiltering(filters, runtimeChartIds, chartFilters)
      .finally(() => {
        setInitialRuntimeHydrationPending(false);
      });
  }, [filters, charts, chartFilters, filterLoading]);

  const _runChartRequest = (chart, currentFilters = filters, currentChartFilters = chartFilters, { refresh = false } = {}) => {
    if (!chart || chart.type === "markdown") return Promise.resolve(null);

    const runtimeRequest = _buildRuntimeRequest(chart, currentFilters, currentChartFilters);
    const shouldClearRuntimeState = !runtimeRequest.hasRuntimeFilters && Boolean(chart.filterMetadata);

    if (!refresh && !shouldClearRuntimeState && !runtimeRequest.hasRuntimeFilters) {
      return Promise.resolve(null);
    }

    if (!refresh && shouldSkipFiltering(chart, runtimeRequest.filters, runtimeRequest.variables)) {
      return Promise.resolve(null);
    }

    if (refresh && !runtimeRequest.hasRuntimeFilters) {
      return dispatch(runQuery({
        project_id: params.projectId,
        chart_id: chart.id,
        noSource: false,
        skipParsing: false,
        getCache: false,
      })).catch(() => null);
    }

    return dispatch(runQueryWithFilters({
      project_id: params.projectId,
      chart_id: chart.id,
      filters: runtimeRequest.filters,
      variables: runtimeRequest.variables,
      refresh,
    })).catch(() => null);
  };

  const _shouldRenderChartSkeleton = (chart) => {
    if (!chart || chart.type === "markdown" || editingLayout) return false;

    const runtimeRequest = _buildRuntimeRequest(chart, filters, chartFilters);
    const waitingForRuntimeFilters = runtimeRequest.hasRuntimeFilters
      && !shouldSkipFiltering(chart, runtimeRequest.filters, runtimeRequest.variables);
    const waitingToClearStaleRuntimeState = !runtimeRequest.hasRuntimeFilters && Boolean(chart.filterMetadata);

    return (waitingForRuntimeFilters || waitingToClearStaleRuntimeState)
      && (chart.loading || filterLoading || initialRuntimeHydrationPending);
  };

  const _processChartBatches = (chartsToProcess, currentFilters = filters, currentChartFilters = chartFilters, options = {}, index = 0, batchSize = 5) => {
    if (index >= chartsToProcess.length) return Promise.resolve("done");

    const batch = chartsToProcess.slice(index, index + batchSize);
    return Promise.all(batch.map((chart) => _runChartRequest(chart, currentFilters, currentChartFilters, options)))
      .then(() => _processChartBatches(chartsToProcess, currentFilters, currentChartFilters, options, index + batchSize, batchSize));
  };

  const _runFiltering = (currentFilters = filters, chartIds = null, currentChartFilters = chartFilters) => {
    if (charts.length === 0) return Promise.resolve("done");

    const chartsToProcess = (chartIds ? charts.filter((chart) => chartIds.includes(chart.id)) : charts)
      .filter((chart) => chart.type !== "markdown");

    setFilterLoading(true);
    return _processChartBatches(chartsToProcess, currentFilters, currentChartFilters)
      .then(() => {
        setFilters(currentFilters);
        setFilterLoading(false);
      })
      .catch(() => {
        setFilterLoading(false);
      });
  };

  const _onRefreshData = () => {
    const allCharts = charts
      .filter((chart) => !chart.staged || chart.type === "markdown")
      .filter((chart) => chart.type !== "markdown");

    if (allCharts.length === 0) {
      setRefreshLoading(false);
      return Promise.resolve("done");
    }

    setRefreshLoading(true);
    return _processChartBatches(allCharts, filters, chartFilters, { refresh: true })
      .then(() => {
        setRefreshLoading(false);
      })
      .catch(() => {
        setRefreshLoading(false);
      });
  };

  const _onChartFilterChange = (chartId, nextFilters) => {
    const updatedChartFilters = {
      ...chartFilters,
      [chartId]: nextFilters,
    };

    if (!nextFilters || nextFilters.length === 0) {
      delete updatedChartFilters[chartId];
    }

    setChartFilters(updatedChartFilters);
    _runFiltering(filters, [chartId], updatedChartFilters);
  };

  const _onShowFilters = () => {
    setShowFilters(true);
  };

  const _onChangeOrder = (chartId, type, index) => {
    let otherId;
    switch (type) {
      case "up":
        otherId = charts[index - 1].id;
        break;
      case "down":
        otherId = charts[index + 1].id;
        break;
      case "top":
        otherId = "top";
        break;
      case "bottom":
        otherId = "bottom";
        break;
      default:
        break;
    }
    dispatch(changeOrder({
      project_id: params.projectId,
      chart_id: chartId,
      otherId,
    }));
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _openExport = () => {
    setViewExport(true);
  };

  const _onExport = async (ids, exportMode = "shown") => {
    setExportLoading(true);
    setExportError(false);

    try {
      if (exportMode === "source") {
        await dispatch(exportChart({
          project_id: params.projectId,
          chartIds: ids,
          filters: filters?.[params.projectId] || [],
          mode: "source",
        })).unwrap();
        toast.success(`${ids.length} chart(s) exported successfully`);
        setViewExport(false);
        return;
      }

      // Get the selected charts by their IDs
      const selectedCharts = charts.filter(chart => ids.includes(chart.id));
      
      // Filter out charts that cannot be exported
      const exportableCharts = selectedCharts.filter(chart => canExportChart(chart));
      
      if (exportableCharts.length === 0) {
        toast.error("No charts with data available for export");
        setExportLoading(false);
        setExportError(true);
        return;
      }

      if (exportableCharts.length < selectedCharts.length) {
        toast.error(`${selectedCharts.length - exportableCharts.length} chart(s) skipped due to missing data`);
      }

      // Use client-side export with the already filtered data
      exportMultipleChartsToExcel(exportableCharts, "chartbrew-dashboard-export.xlsx");
      toast.success(`${exportableCharts.length} chart(s) exported successfully`);
      setViewExport(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export charts");
      setExportError(true);
    } finally {
      setExportLoading(false);
    }
  };

  const _canExport = () => {
    if (!team || !team.TeamRoles) return false;

    let canExport = false;
    team.TeamRoles.forEach((teamRole) => {
      if (teamRole.team_id === team?.id
        && teamRole.user_id === user.id
        && (teamRole.canExport || teamRole.role === "teamOwner")
      ) {
        canExport = true;
      }
      return teamRole;
    });

    return canExport;
  };

  const _onUpdateExport = (chartId, disabled) => {
    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chartId,
      data: { disabledExport: disabled },
      justUpdates: true
    }));
  };

  const _onCancelChanges = async () => {
    if (layoutSaving) return;
    await dispatch(clearStagedCharts());
    setLayouts(getLayouts(charts.filter((chart) => !chart.staged)));
    setLayoutError("");
    setEditingLayout(false);
    setLayoutUndo(null);
  };

  const _onGetChartHeight = (chart) => {
    const bp = (editingLayout ? previewSize.breakpoint : gridBreakpoint) || "lg";
    const item = layouts?.[bp]?.find((entry) => entry.i === String(chart.id));
    const height = item?.h || defaultSize(chart, bp).h;
    return height * rowHeight + (height - 1) * margin[bp][1];
  };

  const _onSaveChanges = async () => {
    if (layoutSaving) return;
    setLayoutSaving(true);
    setLayoutError("");
    try {
      const result = await dispatch(saveDashboardLayout({
        projectId: params.projectId,
        data: {
          revision: layoutRevision, layouts, custom: layoutCustom,
          order: getReportOrder(charts, layoutOrder),
          staged: charts.filter((chart) => chart.staged).map((chart) => ({
            id: chart.id, name: chart.name, type: "markdown",
            content: stagedContent[chart.id] ?? chart.content ?? "",
          })),
        },
      })).unwrap();
      setLayouts(getLayouts(result.Charts));
      setStagedContent({});
      setLayoutUndo(null);
      setEditingLayout(false);
    } catch (error) {
      setLayoutError(error.message);
    } finally {
      setLayoutSaving(false);
    }
  };

  const _onAddMarkdown = async () => {
    if (layoutSaving) return;

    const computedLayout = {};
    Object.keys(widthSize).forEach((bp) => {
      const bpLayout = layouts?.[bp] || [];
      const pos = placeNewWidget(bpLayout, defaultSize({ type: "markdown" }, bp), bp);
      computedLayout[bp] = [pos.x, pos.y, pos.w, pos.h];
    });

    const newChart = {
      id: uuidv4(),
      project_id: parseInt(params.projectId, 10),
      type: "markdown",
      name: "Markdown",
      layout: computedLayout,
      staged: true,
    };

    await dispatch(stageChart(newChart));

    setStagedContent({
      ...stagedContent,
      [newChart.id]: newChart.content,
    });

    setLayouts(getLayouts([...charts.map((chart) => ({
      ...chart, layout: Object.fromEntries(breakpoints.map((bp) => {
        const item = layouts?.[bp]?.find((entry) => entry.i === String(chart.id));
        return [bp, item ? [item.x, item.y, item.w, item.h] : chart.layout?.[bp]];
      })),
    })), newChart]));
    setLayoutOrder([...getReportOrder(charts, layoutOrder), String(newChart.id)]);
    setPendingScrollWidgetId(newChart.id);
  };

  if (!layouts && chartsLoading) {
    return (
      <SuspenseLoader />
    );
  }

  const projectMemberStackMax = 3;
  const projectMemberStack = projectMembers || [];
  const projectMemberStackOverflow = projectMemberStack.length > projectMemberStackMax
    ? projectMemberStack.length - (projectMemberStackMax - 1)
    : 0;
  const projectMemberStackVisible = projectMemberStackOverflow > 0
    ? projectMemberStack.slice(0, projectMemberStackMax - 1)
    : projectMemberStack.slice(0, projectMemberStackMax);
  const currentDashboardCharts = charts.filter((chart) => `${chart.project_id}` === params.projectId);

  return (
    <div className={`w-full bg-background ${editingLayout && "overflow-x-auto"}`}>
      {charts && currentDashboardCharts.length > 0
        && (
          <div ref={dashboardParentRef}>
            <div
              className={"w-full box-shadow-none radius-0"}
            >
              <div className="flex flex-row justify-between w-full">
                <div className="flex flex-row items-center gap-1">
                  {projectMembers?.length > 0 && (
                    <>
                      <div className="hidden sm:flex sm:flex-row border-r border-solid border-content3 pl-1">
                        <Popover>
                          <Popover.Trigger>
                            <div className="cursor-pointer">
                              <div className="flex flex-row -space-x-2 rtl:space-x-reverse cursor-pointer pointer-events-none">
                                {projectMemberStackVisible.map((member, idx) => (
                                  <Avatar
                                    key={member.id}
                                    size="sm"
                                    className="ring-2 ring-background shrink-0"
                                    style={{ zIndex: idx }}
                                  >
                                    <Avatar.Fallback>
                                      {member.name ? displayInitials(member.name) : <LuUser />}
                                    </Avatar.Fallback>
                                  </Avatar>
                                ))}
                                {projectMemberStackOverflow > 0 && (
                                  <Avatar size="sm" className="ring-2 ring-background shrink-0" style={{ zIndex: projectMemberStackVisible.length }}>
                                    <Avatar.Fallback>{`+${projectMemberStackOverflow}`}</Avatar.Fallback>
                                  </Avatar>
                                )}
                              </div>
                            </div>
                          </Popover.Trigger>
                          <Popover.Content className="pt-4">
                            <Popover.Dialog>
                              {_canAccess("teamAdmin") && (
                                <div className="w-full">
                                  <Link to={"/settings/team/members"}>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      fullWidth
                                      className="pointer-events-none"
                                    >
                                      Edit access
                                      <LuUsers />
                                    </Button>
                                  </Link>
                                  <div className="h-2" />
                                  <Separator />
                                  <div className="h-2" />
                                </div>
                              )}
                              <Text>
                                {"Users with project access"}
                              </Text>
                              <ListBox aria-label="Select a user" selectionMode="none">
                                {projectMembers.map((member) => (
                                  <ListBox.Item
                                    key={member.id}
                                    id={String(member.id)}
                                    textValue={member.name}
                                  >
                                    <div className="flex w-full items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium">{member.name}</div>
                                        <div className="text-xs text-default-500">{member.email}</div>
                                      </div>
                                      <Chip size="sm" variant="soft">
                                        {member.TeamRoles?.find((r) => r.team_id === team?.id)?.role}
                                      </Chip>
                                    </div>
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Popover.Dialog>
                          </Popover.Content>
                        </Popover>
                        <div className="w-3" />
                      </div>
                      <div className="w-0.5" />
                    </>
                  )}
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant="outline"
                        className="bg-surface"
                        isIconOnly
                        isPending={filterLoading}
                        onPress={_onShowFilters}
                        size="sm"
                      >
                        {filterLoading ? <ButtonSpinner /> : <LuListFilter size={18} />}
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="bottom">Add dashboard filters</Tooltip.Content>
                  </Tooltip>
                  <div className="md:pl-2">
                    <DashboardFilters
                      filters={filters}
                      projectId={params.projectId}
                      onRemoveFilter={_onRemoveFilter}
                      onApplyFilterValue={_runFiltering}
                      onReorderFilters={_onReorderFilters}
                    />
                  </div>
                </div>
                {!editingLayout && (
                  <div className="flex flex-row items-center gap-1">
                    <ButtonGroup className="hidden sm:flex bg-surface rounded-full" variant="outline">
                      <Dropdown aria-label="Add widget">
                        <Button
                          variant="outline"
                        >
                          <LuPlus size={18} />
                          {"Add insight"}
                          <LuChevronDown size={14} />
                        </Button>
                        <Dropdown.Popover>
                          <Dropdown.Menu>
                            <Dropdown.Item
                              id="add-chart"
                              onPress={() => {
                                navigate(`/dashboard/${params.projectId}/chart`);
                              }}
                              textValue="Add chart"
                            >
                              <LuChartPie />
                              Add chart
                            </Dropdown.Item>
                            <Dropdown.Item
                              id="add-text"
                              onPress={() => _onAddMarkdown()}
                              textValue="Add text"
                            >
                              <LuLetterText />
                              Add text
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                      <Tooltip>
                        <Button
                          onPress={() => setShowShare(true)}
                          isIconOnly
                          variant="outline"
                        >
                          <ButtonGroup.Separator />
                          <LuShare size={18} />
                        </Button>
                        <Tooltip.Content placement="bottom">Share this dashboard</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Button
                          onPress={() => _onRefreshData()}
                          isPending={refreshLoading}
                          isIconOnly
                          variant="outline"
                        >
                          <ButtonGroup.Separator />
                          {refreshLoading ? <ButtonSpinner /> : <LuRefreshCw />}
                        </Button>
                        <Tooltip.Content placement="bottom">Refresh all charts</Tooltip.Content>
                      </Tooltip>
                      {_canAccess("projectEditor") && (
                        <Tooltip>
                          <Button
                            variant="outline"
                            isIconOnly
                            onPress={() => setScheduleVisible(true)}
                          >
                            <ButtonGroup.Separator />
                            <LuCalendarClock
                              className={`${project.updateSchedule?.frequency ? "text-accent" : ""}`}
                              size={22}
                            />
                          </Button>
                          <Tooltip.Content placement="bottom">Schedule data updates for this dashboard</Tooltip.Content>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button
                            variant="secondary"
                            isIconOnly
                            onPress={() => _onRefreshData()}
                            isPending={refreshLoading}
                            className="flex sm:hidden bg-background"
                          >
                            <ButtonGroup.Separator />
                            {refreshLoading ? <ButtonSpinner /> : <LuRefreshCw />}
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="bottom end">Refresh all charts</Tooltip.Content>
                      </Tooltip>
                      <Dropdown aria-label="Dashboard actions">
                        <Button
                          variant="outline"
                          isIconOnly
                        >
                          <ButtonGroup.Separator />
                          <LuEllipsisVertical size={20} />
                        </Button>
                        <Dropdown.Popover>
                          <Dropdown.Menu>
                            <Dropdown.Item
                              id="edit-layout"
                              onPress={() => _onEditLayout()}
                              textValue="Edit layout"
                            >
                              <LuLayoutDashboard />
                              {"Edit layout"}
                              <Kbd className="ms-auto">
                                <Kbd.Abbr keyValue={isMac() ? "command" : "ctrl"} />
                                <Kbd.Content>E</Kbd.Content>
                              </Kbd>
                            </Dropdown.Item>
                            <Dropdown.Item
                              id="open-report"
                              onPress={() => navigate(`/report/${project.brewName}/edit`)}
                              textValue="Open report"
                            >
                              <LuTvMinimal />
                              {"Open report"}
                            </Dropdown.Item>
                            {_canAccess("projectEditor") && (
                              <Dropdown.Item
                                id="snapshots"
                                onPress={() => setSnapshotScheduleVisible(true)}
                                textValue="Dashboard snapshots"
                              >
                                <LuMonitorUp />
                                {"Dashboard snapshots"}
                                {project?.snapshotSchedule?.frequency && (
                                  <Chip size="sm" variant="soft" color="success" className="rounded-sm">
                                    Active
                                  </Chip>
                                )}
                              </Dropdown.Item>
                            )}
                            {_canAccess("teamAdmin") && (
                              <Dropdown.Item
                                id="template"
                                onPress={() => setTemplateVisible(true)}
                                textValue="Create a template"
                              >
                                <LuCopyPlus />
                                {"Create a template"}
                              </Dropdown.Item>
                            )}
                            {_canExport() && (
                              <Dropdown.Item
                                id="export"
                                onPress={() => _openExport()}
                                textValue="Export to Excel"
                              >
                                <LuFileDown />
                                {"Export to Excel"}
                              </Dropdown.Item>
                            )}
                            {_canAccess("teamAdmin") && (
                              <Dropdown.Item
                                id="settings"
                                onPress={() => navigate("settings")}
                                textValue="Dashboard settings"
                              >
                                <LuSettings />
                                {"Dashboard settings"}
                              </Dropdown.Item>
                            )}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </ButtonGroup>
                  </div>
                )}
                
                {editingLayout && (
                  <div className="flex flex-row items-center gap-1">
                    <Button
                      variant="primary"
                      size="sm"
                      isPending={layoutSaving}
                      onPress={() => _onSaveChanges()}
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      isDisabled={layoutSaving}
                      onPress={_onCancelChanges}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      {layoutError ? (
        <div role="alert" className="flex items-center gap-3 px-4 py-3 text-danger">
          <p>{layoutError}</p>
          <Button variant="secondary" size="sm" onPress={async () => {
            try {
              const current = await dispatch(getProject({ project_id: params.projectId })).unwrap();
              dispatch(setCharts(current.Charts));
              setLayouts(getLayouts(current.Charts));
              setLayoutRevision(current.layoutRevision);
              setLayoutOrder(getReportOrder(current.Charts, current.layoutOrder));
              setLayoutCustom(current.layoutCustom || breakpoints);
              setStagedContent({});
              setLayoutUndo(null);
              setLayoutError("");
            } catch (error) {
              setLayoutError(error.message);
            }
          }}>
            Discard edits and reload
          </Button>
        </div>
      ) : null}
      <div
        className={`bg-background w-full relative p-0 ${editingLayout ? "border-2 border-divider rounded-2xl" : ""}`}
        style={{
          ...(editingLayout && previewSize?.breakpoint && {
            width: previewSize.size,
            margin: "0 auto",
            boxSizing: "border-box",
            marginTop: 5,
            overflowX: previewSize.size > dashboardRef.current?.offsetWidth ? "auto" : "hidden",
          }),
          ...(editingLayout && {
            paddingBottom: 100,
          }),
        }}
        ref={dashboardRef}
      >
        {currentDashboardCharts.length === 0 && !chartsLoading && (
          <DashboardStarter
            projectId={params.projectId}
          />
        )}

        {layouts && currentDashboardCharts.length > 0 && (
          <ResponsiveGridLayout
            className="layout dashboard-tutorial"
            layouts={layouts}
            margin={margin}
            breakpoints={widthSize}
            cols={cols}
            rowHeight={rowHeight}
            compactType={null}
            onDragStop={_onManualLayout}
            onResizeStop={_onManualLayout}
            breakpoint={editingLayout ? previewSize.breakpoint : undefined}
            onBreakpointChange={(bp) => setGridBreakpoint(bp)}
            resizeHandle={(
              <div className="react-resizable-handle react-resizable-handle-se">
                <LuArrowDownRight className="text-accent" size={20} />
              </div>
            )}
            isDraggable={editingLayout && !layoutSaving}
            isResizable={editingLayout && !layoutSaving}
            style={{
              marginLeft: -11,
              paddingLeft: -1,
              marginRight: -11,
              paddingRight: -1,
            }}
          >
            {getReportOrder(charts, editingLayout ? layoutOrder : project.layoutOrder).map((id) => charts.find((chart) => String(chart.id) === id)).map((chart, index) => (
              <div
                key={chart.id}
                id={chart.type === "markdown" ? `dashboard-widget-${chart.id}` : undefined}
                className={editingLayout ? "border-2 border-dashed border-primary rounded-3xl" : ""}
              >
                {chart.type === "markdown" ? (
                  <TextWidget
                    chart={chart}
                    onEditLayout={() => _onEditLayout()}
                    editingLayout={editingLayout}
                    onCancelChanges={_onCancelChanges}
                    onSaveChanges={() => _onSaveChanges()}
                    onEditContent={(content) => setStagedContent({
                      ...stagedContent,
                      [chart.id]: content,
                    })}
                  />
                ) : (
                  <>
                    {_shouldRenderChartSkeleton(chart) ? (
                      <DashboardChartSkeleton height={_onGetChartHeight(chart)} />
                    ) : (
                      <Chart
                        key={chart.id}
                        chart={chart}
                        charts={charts}
                        dashboardFilters={filters?.[params.projectId] || []}
                        chartFilters={chartFilters?.[chart.id] || []}
                        onAddChartFilter={_onChartFilterChange}
                        onClearChartFilter={_onChartFilterChange}
                        onRefreshRuntimeChart={(chartId, options = {}) => {
                          const selectedChart = charts.find((chartItem) => chartItem.id === chartId);
                          if (!selectedChart) return Promise.resolve(null);
                          return _runChartRequest(selectedChart, filters, chartFilters, options);
                        }}
                        onChangeOrder={(chartId, type) => _onChangeOrder(chartId, type, index)}
                        height={() => _onGetChartHeight(chart)}
                        editingLayout={editingLayout}
                        onEditLayout={() => _onEditLayout()}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
      
      <AddFilters
        charts={charts}
        projectId={params.projectId}
        onAddFilter={_onAddFilter}
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onAddVariableFilter={_onAddVariableFilter}
        filters={filters}
      />

      <Modal>
        <Modal.Backdrop isOpen={viewExport} onOpenChange={setViewExport}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-2xl">
              <Modal.Header>
                <div className="font-bold">Export to Excel (.xlsx)</div>
              </Modal.Header>
              <Modal.Body>
                <ChartExport
                  charts={charts}
                  onExport={_onExport}
                  loading={exportLoading}
                  error={exportError}
                  onUpdate={(chartId, disabled) => _onUpdateExport(chartId, disabled)}
                  showDisabled={_canAccess("projectEditor")}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <UpdateSchedule
        isOpen={scheduleVisible}
        onClose={() => setScheduleVisible(false)}
        timezone={project.timezone}
        openSnapshotSchedule={() => setSnapshotScheduleVisible(true)}
      />

      <SnapshotSchedule
        isOpen={snapshotScheduleVisible}
        onClose={() => setSnapshotScheduleVisible(false)}
        timezone={project.timezone}
      />

      <CreateTemplateForm
        teamId={team?.id}
        projectId={params.projectId}
        onClose={(isComplete) => {
          if (isComplete) toast.success("✨ The template was saved successfully");
          setTemplateVisible(false);
        }}
        visible={templateVisible}
      />

      <SharingSettings
        open={showShare}
        onClose={() => setShowShare(false)}
        project={project}
      />

      {editingLayout && (
        <div className="dark fixed bottom-0 left-0 right-0 z-50 border-t border-solid border-content3">
          <div className="bg-background flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 animate-appearance-in">
            <div className="flex min-w-0 items-center gap-3">
              <LuMonitorSmartphone className="shrink-0 text-foreground" aria-hidden="true" />
              <Tabs
                size="sm"
                variant="primary"
                className="hidden sm:block"
                selectedKey={["lg", "sm", "xs"].includes(previewSize?.breakpoint) ? previewSize.breakpoint : null}
                onSelectionChange={(key) => _onChangePreviewSize(key)}
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Screen size">
                    {["lg", "sm", "xs"].map((bp) => (
                      <Tabs.Tab id={bp} key={bp} className="whitespace-nowrap">
                        <Tabs.Indicator />
                        {labels[bp]}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
              <Dropdown>
                <Button size="sm" variant="secondary" className="whitespace-nowrap" aria-label="More screen sizes" isDisabled={layoutSaving}>
                  <span className="hidden sm:inline">
                    {["lg", "sm", "xs"].includes(previewSize?.breakpoint) ? "More sizes" : labels[previewSize?.breakpoint]}
                  </span>
                  <span className="sm:hidden">{labels[previewSize?.breakpoint]}</span>
                  <LuChevronDown />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="Screen size"
                    selectionMode="single"
                    selectedKeys={[previewSize?.breakpoint]}
                    onAction={(key) => _onChangePreviewSize(key)}
                  >
                    {breakpoints.map((bp) => (
                      <Dropdown.Item id={bp} key={bp} textValue={labels[bp]}>
                        {labels[bp]}
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" isDisabled={layoutSaving} onPress={() => _applyAutoLayout("arrange")}>
                <LuLayoutDashboard />
                Auto-arrange
              </Button>
              <Dropdown>
                <Button size="sm" variant="secondary" isIconOnly aria-label="More layout actions" isDisabled={layoutSaving}>
                  <LuChevronDown />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu>
                    <Dropdown.Item id="autolayout-current" onPress={() => _applyAutoLayout("tidy")} textValue="Tidy">
                      Tidy
                    </Dropdown.Item>
                    <Dropdown.Item id="automatic-layout" isDisabled={previewSize.breakpoint === "lg"} onPress={() => _applyAutoLayout("automatic")} textValue="Reset to automatic">
                      Reset to automatic
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              <Tooltip>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="Undo layout change"
                  isDisabled={!layoutUndo || layoutSaving}
                  onPress={() => {
                    setLayouts(layoutUndo.layouts);
                    setLayoutOrder(layoutUndo.order);
                    setLayoutCustom(layoutUndo.custom);
                    setLayoutUndo(null);
                    setLayoutError("");
                  }}
                >
                  <LuUndo2 />
                </Button>
                <Tooltip.Content>Undo</Tooltip.Content>
              </Tooltip>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:ml-0">
              <Button size="sm" variant="secondary" isDisabled={layoutSaving} onPress={_onCancelChanges}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" isPending={layoutSaving} onPress={() => _onSaveChanges()}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ProjectDashboard.propTypes = {
  mobile: PropTypes.bool,
};

export default ProjectDashboard;
