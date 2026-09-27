import {
  getLayouts, getReportOrder, rowHeight, getBreakpoint, breakpoints,
  labels, tidyLayout, autoArrange, deriveLayouts, visualOrder,
} from "../../../../shared/dashboard/layout.mjs";
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import PropTypes from "prop-types";
import {
  Button, Input, Separator, Tabs, TextArea,
  Link, ProgressCircle,
  Spinner,
  Form,
  Label,
  TextField,
  Select,
  ListBox,
} from "@heroui/react";
import { useWindowSize } from "react-use";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { clone } from "lodash";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  LuSquareArrowLeft,
  LuCircleCheck, LuChevronLeft, LuEye, LuImagePlus, LuMoon, LuSun,
  LuRefreshCw, LuShare, LuCircleX,
  LuListFilter,
  LuSlidersHorizontal, LuLayoutDashboard, LuUndo2, LuArrowDownRight,
} from "react-icons/lu";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AceEditor from "../../components/CodeEditor";

import {
  getReport, getProject, updateProject, updateProjectLogo, saveDashboardLayout,
} from "../../slices/project";
import { selectTeams } from "../../slices/team";
import {
  runQueryOnPublic, runQueryWithFilters, selectCharts, shouldSkipFiltering
} from "../../slices/chart";
import Chart from "../Chart/Chart";
import logo from "../../assets/logo_inverted.png";
import { API_HOST } from "../../config/settings";
import canAccess from "../../config/canAccess";
import SharingSettings from "./components/SharingSettings";
import instructionDashboard from "../../assets/instruction-dashboard-report.png";
import Text from "../../components/Text";
import Row from "../../components/Row";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import Container from "../../components/Container";
import { ReportThemeProvider, useTheme } from "../../modules/ThemeContext";
import TextWidget from "../Chart/TextWidget";
import { cols, margin, widthSize } from "../../modules/layoutBreakpoints";
import { selectUser } from "../../slices/user";
import DashboardFilters from "../ProjectDashboard/components/DashboardFilters";
import useInterval from "../../modules/useInterval";
import { buildChartRuntimeRequest } from "../../modules/chartRuntimeFilters";
import { getLayoutPreviewGeometry } from "../../modules/autoLayout";
import ReportAppearance from "./components/ReportAppearance";
import { reportAppearanceRequest } from "./reportAppearanceApi";
import { initialReportAppearance, reportColorVariables, resolveReportMode } from "../../../../shared/reportAppearance.mjs";

const ReportGridLayout = WidthProvider(GridLayout);

const PUBLIC_REPORT_CACHE_REFRESH_INTERVAL = 10 * 60 * 1000;

function Report({ editMode = false }) {
  const [project, setProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [newChanges, setNewChanges] = useState({
    backgroundColor: "#FFFFFF",
    titleColor: "#000000",
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [noCharts, setNoCharts] = useState(false);
  const [preview, setPreview] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [layouts, setLayouts] = useState(null);
  const [previewBreakpoint, setPreviewBreakpoint] = useState("current");
  const [layoutDraft, setLayoutDraft] = useState(null);
  const [savedLayoutOrder, setSavedLayoutOrder] = useState(null);
  const [layoutUndo, setLayoutUndo] = useState(null);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [movingLayout, setMovingLayout] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState(null);
  const [savedAppearance, setSavedAppearance] = useState(null);
  const [appearanceRevision, setAppearanceRevision] = useState(0);
  const [appearanceMode, setAppearanceMode] = useState(null);
  const [appearanceError, setAppearanceError] = useState("");
  const [appearanceConflict, setAppearanceConflict] = useState(false);
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [previewGeometry, setPreviewGeometry] = useState({ scale: 1, height: 0 });
  const previewContainerRef = useRef(null);
  const reportRef = useRef(null);
  const { width: windowWidth } = useWindowSize();
  const selectedBreakpoint = editMode && previewBreakpoint !== "current" ? previewBreakpoint : null;
  const gridBreakpoint = selectedBreakpoint || getBreakpoint(windowWidth);
  const previewWidth = selectedBreakpoint ? widthSize[selectedBreakpoint] + 1 : null;

  const [logoAspectRatio, setLogoAspectRatio] = useState(1);
  const [dashboardFilters, setDashboardFilters] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [chartFilters, setChartFilters] = useState({});
  const [initialRuntimeHydrationPending, setInitialRuntimeHydrationPending] = useState(false);

  const teams = useSelector(selectTeams);
  const charts = useSelector(selectCharts);
  const user = useSelector(selectUser);

  const [searchParams] = useSearchParams();
  const { setTheme, isDark } = useTheme();
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const hasRunInitialFiltering = useRef(false);
  const cacheRefreshRef = useRef(false);

  const removeStyling = searchParams.get("removeStyling") === "true";
  const removeHeader = searchParams.get("removeHeader") === "true";
  const appearanceChanged = JSON.stringify(appearanceDraft) !== JSON.stringify(savedAppearance);
  const editableAppearance = useMemo(() => appearanceDraft || initialReportAppearance(project), [appearanceDraft, project]);
  const reportMode = resolveReportMode({
    preview: editMode ? appearanceMode : null,
    query: !editMode ? searchParams.get("theme") : null,
    mode: appearanceDraft?.mode || (editMode ? (isDark ? "dark" : "light") : "system"),
    prefersDark,
  });
  const reportColors = !removeStyling ? appearanceDraft?.[reportMode] : null;
  const reportStyle = useMemo(() => reportColorVariables(reportColors), [reportColors]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const container = previewContainerRef.current;
    const report = reportRef.current;
    if (!container || !report) return undefined;
    const updateGeometry = () => {
      setPreviewGeometry(getLayoutPreviewGeometry(
        container.clientWidth, previewWidth || container.clientWidth, report.offsetHeight
      ));
    };
    const observer = new ResizeObserver(updateGeometry);
    observer.observe(container);
    observer.observe(report);
    updateGeometry();
    return () => observer.disconnect();
  }, [previewWidth, project.id, editorVisible, preview]);

  const _getReportQueryParams = () => {
    const allQueryParams = {};
    searchParams.forEach((value, key) => {
      allQueryParams[key] = value;
    });

    return allQueryParams;
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (!editMode || acceptedFiles.length === 0) return;
    
    setNewChanges({ ...newChanges, logo: acceptedFiles });
    setIsSaved(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };

    reader.readAsDataURL(acceptedFiles[0]);
  }, [editMode, newChanges]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: "image/*",
    onDrop,
    multiple: false,
  });

  // Public report cache refresh. This intentionally avoids source refreshes.
  useInterval(async () => {
    if (!project?.id || cacheRefreshRef.current) {
      return;
    }

    cacheRefreshRef.current = true;
    _onRefreshCharts({
      refresh: false,
      getCache: true,
      cacheOnly: true,
      showLoading: false,
    }).finally(() => {
      cacheRefreshRef.current = false;
    });
  }, PUBLIC_REPORT_CACHE_REFRESH_INTERVAL);

  useEffect(() => {
    setLoading(true);
    _fetchProject(window.localStorage.getItem("reportPassword"));

  }, []);

  useEffect(() => {
    if (project?.id) {
      setAppearanceDraft(project.reportAppearance || null);
      setSavedAppearance(project.reportAppearance || null);
      setAppearanceRevision(project.reportAppearanceRevision || 0);
      setNewChanges({
        backgroundColor: project.backgroundColor || "",
        titleColor: project.titleColor || "",
        dashboardTitle: project.dashboardTitle || project.name,
        description: project.description,
        logo: project.logo && `${API_HOST}/${project.logo}`,
        headerCode: project.headerCode || "",
        logoLink: project.logoLink,
      });

      _checkSearchParamsForFilters();
      _checkSearchParamsForFields();

      // get and format the dashboard filters
      if (project.DashboardFilters) {
        const formattedFilters = project.DashboardFilters.filter(f => f.onReport).map((f) => ({
          ...f?.configuration,
          id: f.id,
          onReport: f.onReport,
        }));

        setDashboardFilters({ [project.id]: formattedFilters });
      }
    }
  }, [project]);

  const updateAppearance = (changes) => {
    setNewChanges((current) => ({ ...current, ...changes }));
    setIsSaved(false);
  };

  useEffect(() => {
    setLayouts(getLayouts(charts));
  }, [charts]);

  useEffect(() => {
    setChartFilters((currentChartFilters) => {
      const nextChartFilters = {};

      Object.keys(currentChartFilters || {}).forEach((chartId) => {
        if (charts.some((chart) => `${chart.id}` === `${chartId}`)) {
          nextChartFilters[chartId] = currentChartFilters[chartId];
        }
      });

      return JSON.stringify(currentChartFilters) === JSON.stringify(nextChartFilters)
        ? currentChartFilters
        : nextChartFilters;
    });
  }, [charts]);

  const _fetchProject = (password) => {
    if (password) window.localStorage.setItem("reportPassword", password);

    setLoading(true);
    
    dispatch(getReport({ 
      brewName: params.brewName, 
      password, 
      token: searchParams.get("token"),
      queryParams: _getReportQueryParams()
    }))
      .then((data) => {
        if (data.error) {
          if (data.error.message === "403") {
            if (passwordRequired) {
              toast.error("The password you entered is incorrect.");
            }
            setPasswordRequired(true);
          } else if (data.error.message === "401") {
            setNotAuthorized(true);
            window.location.pathname = "/login";
          } else {
            setNoCharts(true);
          }

          setLoading(false);
        } else {
          setProject(data.payload);
          setLoading(false);
          setNotAuthorized(false);
          setPasswordRequired(false);

          // now get the project (mainly to check if the user can edit)
          dispatch(getProject({ project_id: data.payload?.id }))
            .then((projectData) => {
              if (!projectData.payload) throw new Error(projectData.error.status);

              setProject({ ...projectData.payload });
              setEditorVisible(editMode);
            })
            .catch(() => {});
          }
      });
  };

  const _checkSearchParamsForFilters = () => {
    // URL variables are now handled by the backend based on SharePolicy
    // This function is kept for potential future dashboard filter handling
    // but URL variables processing is no longer needed here
    return;
  };

  const _checkSearchParamsForFields = () => {
    // Field filters from URL are now handled by the backend based on SharePolicy
    // This function is kept for potential future dashboard filter handling
    // but URL field processing is no longer needed here
    return;
  };

  const _isOnReport = () => {
    return charts.filter((c) => c.onReport).length > 0;
  };

  const _onSaveChanges = async () => {
    setSaveLoading(true);
    setAppearanceError("");
    setAppearanceConflict(false);
    const updateData = clone(newChanges);
    if (updateData.logo) delete updateData.logo;
    try {
      if (appearanceChanged) {
        const result = await reportAppearanceRequest(`/project/${project.id}/report-appearance`, "PUT", {
          appearance: appearanceDraft, revision: appearanceRevision,
        });
        setAppearanceRevision(result.reportAppearanceRevision);
        setSavedAppearance(result.reportAppearance);
      }
      if (!isSaved) {
        await dispatch(updateProject({ project_id: project.id, data: updateData })).unwrap();
        if (typeof newChanges.logo === "object" && newChanges.logo !== null) {
          const updated = await dispatch(updateProjectLogo({ project_id: project.id, logo: newChanges.logo })).unwrap();
          setNewChanges((current) => ({ ...current, logo: `${API_HOST}/${updated.logo}` }));
        }
      }
      setIsSaved(true);
      toast.success("Report saved");
    } catch (error) {
      setAppearanceError(error.message || "The report could not be saved. Try again.");
      setAppearanceConflict(error.status === 409);
      toast.error("The report could not be fully saved. Your edits are kept.");
    } finally {
      setSaveLoading(false);
    }
  };

  const reloadAppearance = async () => {
    setSaveLoading(true);
    try {
      const result = await dispatch(getProject({ project_id: project.id })).unwrap();
      setSavedAppearance(result.reportAppearance || null);
      setAppearanceDraft(result.reportAppearance || null);
      setAppearanceRevision(result.reportAppearanceRevision || 0);
      setAppearanceError("");
      setAppearanceConflict(false);
    } catch {
      setAppearanceError("The appearance could not be loaded. Try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  const _onRefreshCharts = ({
    refresh = true,
    getCache = false,
    cacheOnly = false,
    showLoading = true,
  } = {}) => {
    const runtimeCharts = charts.filter((chart) => chart.type !== "markdown");

    if (runtimeCharts.length === 0) {
      if (showLoading) setRefreshLoading(false);
      return Promise.resolve("done");
    }

    if (showLoading) setRefreshLoading(true);
    return _processChartBatches(runtimeCharts, dashboardFilters, chartFilters, { refresh, getCache, cacheOnly })
      .then(() => {
        if (showLoading) setRefreshLoading(false);
      })
      .catch(() => {
        if (showLoading) setRefreshLoading(false);
      });
  };

  const _canAccess = (role) => {
    const team = teams.filter((t) => t.id === project.team_id)[0];
    if (!team) return false;
    const canReallyAccess = canAccess(role, user.id, team.TeamRoles);
    return canReallyAccess;
  };

  const _onLoadLogo = ({ target: img }) => {
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    setLogoAspectRatio(aspectRatio);
  };
  const _buildRuntimeRequest = (chart, currentFilters = dashboardFilters, currentChartFilters = chartFilters) => {
    return buildChartRuntimeRequest({
      chart,
      dashboardFilters: currentFilters?.[project.id] || [],
      chartFilters: currentChartFilters?.[chart.id] || [],
    });
  };

  useEffect(() => {
    if (filterLoading || !project?.id || charts.length === 0 || hasRunInitialFiltering.current) {
      return;
    }

    const runtimeChartIds = charts
      .filter((chart) => chart.type !== "markdown")
      .filter((chart) => _buildRuntimeRequest(chart, dashboardFilters, chartFilters).hasRuntimeFilters)
      .map((chart) => chart.id);

    hasRunInitialFiltering.current = true;

    if (runtimeChartIds.length === 0) {
      return;
    }

    setInitialRuntimeHydrationPending(true);
    _runFiltering(dashboardFilters, runtimeChartIds, chartFilters)
      .finally(() => {
        setInitialRuntimeHydrationPending(false);
      });
  }, [project?.id, dashboardFilters, charts, chartFilters, filterLoading]);

  const _runChartRequest = (
    chart,
    currentFilters = dashboardFilters,
    currentChartFilters = chartFilters,
    { refresh = false, getCache = false, cacheOnly = false } = {}
  ) => {
    if (!chart || chart.type === "markdown") return Promise.resolve(null);

    const runtimeRequest = _buildRuntimeRequest(chart, currentFilters, currentChartFilters);
    const shouldClearRuntimeState = !runtimeRequest.hasRuntimeFilters && Boolean(chart.filterMetadata);

    if (!refresh && !getCache && !cacheOnly && !shouldClearRuntimeState && !runtimeRequest.hasRuntimeFilters) {
      return Promise.resolve(null);
    }

    if (!refresh && !getCache && !cacheOnly && shouldSkipFiltering(chart, runtimeRequest.filters, runtimeRequest.variables)) {
      return Promise.resolve(null);
    }

    if (refresh && !runtimeRequest.hasRuntimeFilters) {
      return dispatch(runQueryOnPublic({
        chart_id: chart.id,
        password: window.localStorage.getItem("reportPassword"),
        shareToken: searchParams.get("token"),
        accessToken: searchParams.get("accessToken"),
        queryParams: _getReportQueryParams(),
      })).catch(() => null);
    }

    return dispatch(runQueryWithFilters({
      project_id: project.id,
      chart_id: chart.id,
      filters: runtimeRequest.filters,
      variables: runtimeRequest.variables,
      shareToken: searchParams.get("token"),
      password: window.localStorage.getItem("reportPassword"),
      accessToken: searchParams.get("accessToken"),
      queryParams: _getReportQueryParams(),
      refresh,
      getCache,
      cacheOnly,
    })).catch(() => null);
  };

  const _processChartBatches = (chartsToProcess, currentFilters = dashboardFilters, currentChartFilters = chartFilters, options = {}, index = 0, batchSize = 5) => {
    if (index >= chartsToProcess.length) return Promise.resolve("done");

    const batch = chartsToProcess.slice(index, index + batchSize);
    return Promise.all(batch.map((chart) => _runChartRequest(chart, currentFilters, currentChartFilters, options)))
      .then(() => _processChartBatches(chartsToProcess, currentFilters, currentChartFilters, options, index + batchSize, batchSize));
  };

  const _runFiltering = (currentFilters = dashboardFilters, chartIds = null, currentChartFilters = chartFilters) => {
    if (charts.length === 0) return Promise.resolve("done");

    const chartsToProcess = (chartIds ? charts.filter((chart) => chartIds.includes(chart.id)) : charts)
      .filter((chart) => chart.type !== "markdown");

    setFilterLoading(true);
    return _processChartBatches(chartsToProcess, currentFilters, currentChartFilters)
      .then(() => {
        setDashboardFilters(currentFilters);
        setFilterLoading(false);
      })
      .catch(() => {
        setFilterLoading(false);
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
    _runFiltering(dashboardFilters, [chartId], updatedChartFilters);
  };

  const _onApplyFilterValue = (filters) => {
    // URL variables are now handled by the backend, just apply dashboard filters
    setDashboardFilters(filters);
    _runFiltering(filters);
  };

  const _onRemoveFilter = () => {
    // No need to do anything here since we don't store filters in localStorage
  };

  const startLayoutEditing = async () => {
    setLayoutBusy(true);
    setLayoutError("");
    try {
      const current = await dispatch(getProject({ project_id: project.id })).unwrap();
      setLayoutDraft({
        charts: current.Charts,
        layouts: getLayouts(current.Charts),
        order: getReportOrder(current.Charts, current.layoutOrder),
        custom: current.layoutCustom || breakpoints,
        revision: current.layoutRevision,
      });
      setLayoutUndo(null);
    } catch {
      setLayoutError("The layout could not be loaded. Try again.");
    } finally {
      setLayoutBusy(false);
    }
  };

  const changeLayout = (items) => {
    setMovingLayout(false);
    if (!layoutDraft || layoutBusy) return;
    try {
      const nextLayout = tidyLayout(items, gridBreakpoint);
      const order = gridBreakpoint === "lg"
        ? visualOrder(nextLayout).map((item) => String(item.i)) : layoutDraft.order;
      const custom = [...new Set([...layoutDraft.custom, gridBreakpoint])];
      setLayoutUndo(layoutDraft);
      setLayoutDraft({
        ...layoutDraft,
        layouts: deriveLayouts({ ...layoutDraft.layouts, [gridBreakpoint]: nextLayout }, order, custom),
        order,
        custom,
      });
      setLayoutError("");
    } catch (error) {
      setLayoutError(error.message);
    }
  };

  const saveLayout = async () => {
    setLayoutBusy(true);
    setLayoutError("");
    try {
      const { layouts: draftLayouts, order, custom, revision } = layoutDraft;
      const result = await dispatch(saveDashboardLayout({
        projectId: project.id,
        data: { layouts: draftLayouts, order, custom, revision },
      })).unwrap();
      setSavedLayoutOrder(result.layoutOrder);
      setLayoutDraft(null);
      setLayoutUndo(null);
      toast.success("Layout saved");
    } catch (error) {
      setLayoutError(error.message || "The layout could not be saved. Try again.");
    } finally {
      setLayoutBusy(false);
    }
  };

  const displayedCharts = layoutDraft?.charts || charts;
  const displayedOrder = layoutDraft?.order || savedLayoutOrder || project.layoutOrder;

  // Keep text edits from rebuilding chart elements and their runtime callbacks.
  const reportCharts = useMemo(() => (
    getReportOrder(displayedCharts, displayedOrder)
      .map((id) => displayedCharts.find((chart) => String(chart.id) === id))
      .filter((chart) => layoutDraft || (!chart.draft && chart.onReport))
      .map((chart) => (
        <div
          key={chart.id}
          className={layoutDraft ? "rounded-3xl outline-2 outline-dashed outline-accent" : undefined}
        >
          {layoutDraft && (chart.draft || !chart.onReport) ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-surface p-4 text-center">
              <span className="text-sm font-medium">{chart.name}</span>
              <span className="text-xs text-muted">Not in report</span>
            </div>
          ) : chart.type === "markdown" ? (
            <TextWidget
              isPublic
              chart={chart}
              onEditLayout={() => {}}
              editingLayout={false}
              onCancelChanges={() => {}}
              onSaveChanges={() => {}}
              onEditContent={() => {}}
            />
          ) : (
            <Chart
              editingLayout={Boolean(layoutDraft)}
              isPublic
              chart={chart}
              charts={charts}
              deferRendering
              dashboardFilters={dashboardFilters?.[project.id] || []}
              chartFilters={chartFilters?.[chart.id] || []}
              onAddChartFilter={_onChartFilterChange}
              onClearChartFilter={_onChartFilterChange}
              onRefreshRuntimeChart={(chartId, options = {}) => {
                const selectedChart = charts.find((chartItem) => chartItem.id === chartId);
                if (!selectedChart) return Promise.resolve(null);
                return _runChartRequest(selectedChart, dashboardFilters, chartFilters, options);
              }}
              className="chart-card"
              showExport={project.Team?.allowReportExport}
              password={project.password || window.localStorage.getItem("reportPassword")}
            />
          )}
        </div>
      ))
  ), [charts, project, dashboardFilters, chartFilters, searchParams, dispatch, layoutDraft, savedLayoutOrder]);

  if (loading && !project?.id && !noCharts) {
    return (
      <>
        <Helmet>
          <style type="text/css">
            {`
            body, html {
              background-color: transparent;
            }

            #root {
              background-color: transparent;
            }
          `}
          </style>
        </Helmet>
        <div style={styles.container} className="items-center">
          <div className="h-4" />
          <Row align="center" justify="center">
            <ProgressCircle size="lg" aria-label="Loading" />
          </Row>
        </div>
      </>
    );
  }

  if (notAuthorized || passwordRequired) {
    return (
      <div>
        <Helmet>
          <title>
            {newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"}
          </title>
          <meta name="description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
          <meta name="robots" content="noindex" />
          <meta name="og:title" content={newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"} />
          <meta name="og:description" content={project.description || newChanges.description || "Chartbrew dashboard"} />

          {(newChanges?.headerCode || project?.headerCode) && !removeStyling && (
            <style type="text/css">{newChanges.headerCode}</style>
          )}
        </Helmet>

        {passwordRequired && (
          <div className="container mx-auto max-w-xl p-16">
            <div>
              <h3 className="text-xl font-bold">
                Please enter the password to access this report
              </h3>
            </div>
            <div className="h-2" />

            <Form
              onSubmit={(e) => {
                e.preventDefault();
                _fetchProject(reportPassword);
              }}
              className="flex flex-col gap-2"
            >
              <Input
                placeholder="Enter the password here"
                value={reportPassword}
                type="password"
                onChange={(e) => setReportPassword(e.target.value)}
                size="lg"
                className="w-full"
                variant="primary"
              />
              <Button
                variant="primary"
                loading={loading}
                onPress={() => {}}
                type="submit"
              >
                Access report
              </Button>
            </Form>
          </div>
        )}
      </div>
    );
  }

  if (noCharts && user.id) {
    return (
      <div>
        <Container justify="center" className={"mt-20"}>
          <Row justify="center">
            <Text size="h1">
              {"This report does not contain any charts"}
            </Text>
          </Row>
          <div className="h-1" />
          <Row justify="center">
            <Text b>
              {"Head back to your dashboard and add charts to the report from the individual chart settings menu."}
            </Text>
          </Row>
          <div className="h-4" />
          <Row justify="center">
            <Button
              onPress={() => window.history.back()}
              variant="primary"
              size="lg"
            >
              <LuChevronLeft />
              Go back
            </Button>
          </Row>
          <div className="h-1" />
          <Row justify="center">
            <img
              src={instructionDashboard}
              height={500}
              width={1000}
              alt="How to add charts to your report"
              className="p-[15px]"
              style={{ filter: "drop-shadow(1px 5px 5px rgba(0, 0, 0, 0.5))" }}
            />
          </Row>
        </Container>
      </div>
    );
  }

  if (noCharts && !user.id) {
    return (
      <div>
        <div className="container mx-auto pt-16">
          <div className="flex flex-col items-center justify-center">
            <img src={logo} height={50} width={50} alt="Chartbrew logo" className="rounded-none" />
            <div className="h-2" />
            <h3 className="text-xl font-bold">{"This report is not available"}</h3>
            <p className="text-sm">{"This report is not available because it has no charts or it is not public."}</p>
          </div>
          <div className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container min-h-screen bg-background text-foreground">
      <Helmet>
        <title>
          {newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"}
        </title>
        <meta name="description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
        <meta name="robots" content="noindex" />
        <meta name="og:title" content={newChanges.dashboardTitle || project.dashboardTitle || project.name || "Chartbrew dashboard"} />
        <meta name="og:description" content={project.description || newChanges.description || "Chartbrew dashboard"} />
        <meta name="og:image" content={project.logo ? `${API_HOST}/${project.logo}` : logo} />
        <meta name="og:url" content={window.location.href} />
        <meta name="og:type" content="website" />
        <meta name="og:site_name" content={project.name || "Chartbrew dashboard"} />
        <meta name="og:locale" content="en_US" />
        {(newChanges?.headerCode || project?.headerCode) && !removeStyling && (
          <style type="text/css">{newChanges.headerCode}</style>
        )}
      </Helmet>

      {editMode && editorVisible && !preview && (
        <aside
          className="border-b border-border bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-80 lg:flex-col lg:border-r lg:border-b-0"
          aria-label="Report editor"
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label="Back to dashboard"
              title="Back to dashboard"
              onPress={() => navigate(`/dashboard/${project.id}`)}
            >
              <LuSquareArrowLeft size={18} />
            </Button>
            <h2 className="flex-1 text-base font-medium">Edit report</h2>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label={isDark ? "Use light theme" : "Use dark theme"}
              title={isDark ? "Use light theme" : "Use dark theme"}
              onPress={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <LuSun size={18} /> : <LuMoon size={18} />}
            </Button>
            <Button
              className="lg:hidden"
              size="sm"
              variant="secondary"
              aria-expanded={mobileSettingsOpen}
              aria-controls="report-settings"
              onPress={() => setMobileSettingsOpen(!mobileSettingsOpen)}
            >
              <LuSlidersHorizontal size={16} />
              Settings
            </Button>
          </div>

          <div id="report-settings" className={`${mobileSettingsOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {project?.id && _canAccess("projectEditor") && (
                <Tabs variant="secondary" className="gap-5">
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Report settings" className="w-full">
                      <Tabs.Tab id="content" className="flex-1">
                        Content
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="layout" className="flex-1">
                        Layout
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="appearance" className="flex-1">
                        Appearance
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>

                  <Tabs.Panel id="content" className="flex flex-col gap-5">
                    <TextField name="report-title" isDisabled={saveLoading}>
                      <Label>Report title</Label>
                      <Input
                        value={newChanges.dashboardTitle || ""}
                        onChange={(e) => updateAppearance({ dashboardTitle: e.target.value })}
                        variant="secondary"
                        className="w-full"
                      />
                    </TextField>
                    <TextField name="report-description" isDisabled={saveLoading}>
                      <Label>Description</Label>
                      <TextArea
                        value={newChanges.description || ""}
                        onChange={(e) => updateAppearance({ description: e.target.value })}
                        variant="secondary"
                        rows={3}
                        className="resize-y"
                      />
                    </TextField>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-medium">Logo</h3>
                      <div
                        {...getRootProps()}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-secondary p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        aria-label="Change report logo"
                      >
                        <input {...getInputProps()} aria-label="Upload report logo" />
                        <img
                          src={logoPreview || newChanges.logo || logo}
                          alt=""
                          className="h-10 w-12 object-contain"
                        />
                        <span className="flex flex-1 items-center gap-2 text-sm">
                          <LuImagePlus size={16} />
                          Change logo
                        </span>
                      </div>
                    </div>
                    <TextField name="company-website-url" isDisabled={saveLoading}>
                      <Label>Logo link</Label>
                      <Input
                        placeholder="https://example.com"
                        value={newChanges.logoLink || ""}
                        onChange={(e) => updateAppearance({ logoLink: e.target.value })}
                        variant="secondary"
                        className="w-full"
                      />
                    </TextField>
                  </Tabs.Panel>

                  <Tabs.Panel id="layout" className="flex flex-col gap-4">
                    <Select
                      variant="secondary"
                      value={previewBreakpoint}
                      onChange={(value) => { if (value) setPreviewBreakpoint(value); }}
                      isDisabled={layoutBusy}
                    >
                      <Label>Screen size</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox aria-label="Screen size">
                          <ListBox.Item id="current" textValue="Current window">
                            Current window
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          {breakpoints.map((bp) => (
                            <ListBox.Item key={bp} id={bp} textValue={labels[bp]}>
                              {labels[bp]}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <span className="text-sm text-muted">
                      {labels[gridBreakpoint]}
                      {previewGeometry.scale < 1 && ` · ${Math.round(previewGeometry.scale * 100)}%`}
                    </span>
                    {layoutDraft ? (
                      <>
                        <p className="text-sm">Layout changes also apply to the dashboard.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={layoutBusy}
                            onPress={() => changeLayout(autoArrange(
                              layoutDraft.layouts[gridBreakpoint], layoutDraft.charts, gridBreakpoint
                            ))}
                          >
                            <LuLayoutDashboard size={16} />
                            Auto-arrange
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="secondary"
                            aria-label="Undo layout change"
                            title="Undo layout change"
                            isDisabled={!layoutUndo || layoutBusy}
                            onPress={() => {
                              setLayoutDraft(layoutUndo);
                              setLayoutUndo(null);
                              setLayoutError("");
                            }}
                          >
                            <LuUndo2 size={16} />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            isDisabled={layoutBusy}
                            onPress={() => {
                              setLayoutDraft(null);
                              setLayoutUndo(null);
                              setLayoutError("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button variant="primary" isPending={layoutBusy} onPress={saveLayout}>
                            {layoutBusy && <ButtonSpinner />}
                            Save layout
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button variant="secondary" isPending={layoutBusy} onPress={startLayoutEditing}>
                        {layoutBusy ? <ButtonSpinner /> : <LuLayoutDashboard size={16} />}
                        Edit layout
                      </Button>
                    )}
                    {layoutError && <p role="alert" className="text-sm text-danger">{layoutError}</p>}
                  </Tabs.Panel>

                  <Tabs.Panel id="appearance" className="flex flex-col gap-5">
                    <ReportAppearance
                      value={editableAppearance}
                      onChange={setAppearanceDraft}
                      mode={reportMode}
                      onModeChange={setAppearanceMode}
                      onReset={() => setAppearanceDraft(savedAppearance)}
                      canReset={appearanceChanged}
                      teamId={project.team_id}
                      userId={user.id}
                      teamAdmin={_canAccess("teamAdmin")}
                      disabled={saveLoading}
                    />
                    <Separator />
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium">Custom CSS</summary>
                      {newChanges.headerCode && <p className="mt-2 text-xs text-warning">Custom CSS can override theme colors.</p>}
                      <div className="mt-3">
                        <AceEditor
                          mode="css"
                          theme={isDark ? "one_dark" : "tomorrow"}
                          height="240px"
                          value={newChanges.headerCode}
                          onChange={(headerCode) => updateAppearance({ headerCode })}
                          readOnly={saveLoading}
                          options={{ ariaLabel: "Report custom CSS" }}
                          className="border border-border"
                        />
                      </div>
                    </details>
                  </Tabs.Panel>
                </Tabs>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-5">
              {appearanceError && <p role="alert" className="text-sm text-danger">{appearanceError}</p>}
              {appearanceConflict && (
                <Button variant="secondary" size="sm" onPress={reloadAppearance} isDisabled={saveLoading}>
                  Discard color edits and reload
                </Button>
              )}
              {project?.id && _canAccess("projectEditor") && (
                <Button
                  variant="primary"
                  isDisabled={(isSaved && !appearanceChanged) || Boolean(layoutDraft) || layoutBusy || appearanceConflict}
                  isPending={saveLoading}
                  onPress={_onSaveChanges}
                  className="w-full"
                >
                  {saveLoading ? <ButtonSpinner /> : <LuCircleCheck size={16} />}
                  {isSaved && !appearanceChanged ? "Saved" : "Save changes"}
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" isDisabled={Boolean(layoutDraft) || layoutBusy} onPress={() => setPreview(true)}>
                  <LuEye size={16} />
                  Preview
                </Button>
                {project?.id && _canAccess("projectEditor") && (
                  <Button variant="secondary" className="flex-1" isDisabled={Boolean(layoutDraft) || layoutBusy} onPress={() => setShowSettings(true)}>
                    <LuShare size={16} />
                    Share
                  </Button>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      <div className={editMode && editorVisible && !preview ? "min-w-0 lg:ml-80" : "min-w-0"}>
        {editMode && preview && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
            <span className="text-sm font-medium">Report preview</span>
            <Button onPress={() => setPreview(false)} variant="secondary" size="sm">
              <LuCircleX size={16} />
              Exit preview
            </Button>
          </div>
        )}

        <div
          ref={previewContainerRef}
          className="w-full min-w-0"
          style={previewWidth ? { height: previewGeometry.height, overflowX: "clip" } : undefined}
        >
          <ReportThemeProvider mode={reportMode} colors={reportColors}>
          <div
            ref={reportRef}
            data-theme={reportMode}
            className={`report-surface ${reportMode} min-h-screen ${removeStyling ? "bg-transparent" : "bg-background"} text-foreground ${previewWidth ? "shadow-sm outline outline-1 -outline-offset-1 outline-border" : ""}`}
            style={{ ...reportStyle, ...(previewWidth ? {
              width: previewWidth,
              transform: `scale(${previewGeometry.scale})`,
              transformOrigin: "top left",
              marginInline: previewGeometry.scale === 1 ? "auto" : undefined,
            } : {}) }}
          >
            {!removeHeader && (
              <header
                className="header border-b border-border bg-surface"
                style={removeStyling ? undefined : {
                  backgroundColor: reportColors?.header || newChanges.backgroundColor || undefined,
                  color: reportColors?.headerText || newChanges.titleColor || undefined,
                }}
              >
                <div className="title-container mx-auto flex max-w-none flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
                  <a
                    className="dashboard-logo-container shrink-0"
                    href={newChanges.logoLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      onLoad={_onLoadLogo}
                      className="dashboard-logo max-w-40 object-contain"
                      src={logoPreview || newChanges.logo || logo}
                      alt={`${project.name} logo`}
                      height={32}
                      width={32 * logoAspectRatio}
                      style={{ height: 32 }}
                    />
                  </a>
                  <div className="min-w-0 flex-1 basis-40">
                    <h1
                      className="dashboard-title break-words text-lg font-medium leading-6"
                    >
                      {newChanges.dashboardTitle || project.name}
                    </h1>
                    {newChanges.description && (
                      <p className="dashboard-sub-title mt-0.5 max-w-3xl whitespace-pre-wrap break-words text-sm leading-5 opacity-80">
                        {newChanges.description}
                      </p>
                    )}
                  </div>
                  {project?.Team?.allowReportRefresh && (
                    <Button onPress={() => _onRefreshCharts()} isPending={refreshLoading} variant="secondary" size="sm">
                      {refreshLoading ? <ButtonSpinner /> : <LuRefreshCw size={16} />}
                      Refresh
                    </Button>
                  )}
                </div>
              </header>
            )}

            {removeHeader && project?.Team?.allowReportRefresh && (
              <div className="flex justify-end px-5 pt-4">
                <Button onPress={() => _onRefreshCharts()} isPending={refreshLoading} variant="secondary" size="sm">
                  {refreshLoading ? <ButtonSpinner /> : <LuRefreshCw size={16} />}
                  Refresh
                </Button>
              </div>
            )}

            {(layoutDraft || (charts && charts.length > 0 && _isOnReport())) && (
              <div className="main-container relative mx-auto px-2 py-5 sm:px-5 sm:py-6">
                {loading && charts.length === 0 && (
                  <Container style={styles.container}>
                    <div className="h-4" />
                    <Row align="center" justify="center">
                      <ProgressCircle size="lg" aria-label="Loading" />
                    </Row>
                  </Container>
                )}

                {dashboardFilters?.[project.id]?.length > 0 && (
                  <div className="mx-3 mb-4 flex flex-wrap items-center gap-3">
                    {!filterLoading && (
                      <div className="flex flex-row items-center gap-2">
                        <LuListFilter size={20} />
                        <div className="block sm:hidden text-sm">Filters</div>
                      </div>
                    )}
                    {filterLoading && (
                      <Spinner size="sm" aria-label="Loading" />
                    )}
                    <DashboardFilters
                      filters={dashboardFilters}
                      projectId={project.id}
                      onRemoveFilter={_onRemoveFilter}
                      onApplyFilterValue={_onApplyFilterValue}
                      onReport
                    />
                  </div>
                )}

                {initialRuntimeHydrationPending && charts?.length > 0 && (
                  <div className="flex min-h-[320px] items-center justify-center">
                    <Spinner size="lg" aria-label="Loading dashboard filters" />
                  </div>
                )}

                {!initialRuntimeHydrationPending && layouts && charts?.length > 0 && (
                  <div className="w-full">
                    <ReportGridLayout
                      key={editMode && editorVisible && !preview ? "editor" : "report"}
                      className="layout chart-grid"
                      layout={(layoutDraft?.layouts || layouts)[gridBreakpoint]}
                      cols={cols[gridBreakpoint]}
                      margin={margin[gridBreakpoint]}
                      compactType={movingLayout ? "vertical" : null}
                      transformScale={previewGeometry.scale}
                      onDragStart={() => setMovingLayout(true)}
                      onDragStop={changeLayout}
                      onResizeStop={changeLayout}
                      rowHeight={rowHeight}
                      isDraggable={Boolean(layoutDraft) && !layoutBusy}
                      isResizable={Boolean(layoutDraft) && !layoutBusy}
                      resizeHandle={(
                        <div className="react-resizable-handle react-resizable-handle-se">
                          <LuArrowDownRight className="text-accent" size={20} />
                        </div>
                      )}
                    >
                      {reportCharts}
                    </ReportGridLayout>
                  </div>
                )}

                {project.Team && project.Team.showBranding && (
                  <div className="footer-content mt-4 pr-4 flex justify-end">
                    <Link
                      className="flex items-center gap-1 text-xs no-underline hover:underline"
                      style={{ color: "var(--foreground)" }}
                      href="https://chartbrew.com?ref=chartbrew_report"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Powered by
                      <span className="font-medium">Chartbrew</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
          </ReportThemeProvider>
        </div>
      </div>

      {editMode && project && (
        <SharingSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onReport={true}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    minHeight: "100vh",
    paddingBottom: 100,
  },
};

Report.propTypes = {
  editMode: PropTypes.bool,
};

export default Report;
