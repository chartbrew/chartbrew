import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card, Spacer, Tooltip, Dropdown, Button, Modal, Input, Link as LinkNext,
  Textarea, Switch, Popover, Chip, CardHeader, CircularProgress, PopoverTrigger,
  PopoverContent, DropdownMenu, DropdownTrigger, DropdownItem, ModalHeader,
  ModalBody, ModalFooter, CardBody, ModalContent, Select, SelectItem, RadioGroup, Radio,
  Badge,
  Divider,
  Kbd,
} from "@heroui/react";
import {
  LuBell,
  LuCalendarClock, LuCheck, LuChevronDown, LuClipboard, LuClipboardCheck, LuEllipsis, LuEllipsisVertical, LuFileDown,
  LuLayoutDashboard, LuLink, LuListFilter, LuLock, LuLockOpen,
  LuPlus, LuRefreshCw, LuSettings, LuShare, LuTrash, LuMonitor, LuMonitorX, LuX,
  LuCircleCheck,
} from "react-icons/lu";

import moment from "moment";
import _ from "lodash";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import {
  removeChart, runQuery, runQueryWithFilters, getChart, exportChart,
  exportChartPublic, createShareString, updateChart,
} from "../../slices/chart";
import canAccess from "../../config/canAccess";
import { SITE_HOST } from "../../config/settings";
import LineChart from "./components/LineChart";
import BarChart from "./components/BarChart";
import RadarChart from "./components/RadarChart";
import PolarChart from "./components/PolarChart";
import DoughnutChart from "./components/DoughnutChart";
import PieChart from "./components/PieChart";
import TableContainer from "./components/TableView/TableContainer";
import ChartFilters from "./components/ChartFilters";
import useInterval from "../../modules/useInterval";
import Row from "../../components/Row";
import Text from "../../components/Text";
import KpiMode from "./components/KpiMode";
import useChartSize from "../../modules/useChartSize";
import DatasetAlerts from "../AddChart/components/DatasetAlerts";
import isMac from "../../modules/isMac";

const getFiltersFromStorage = (projectId) => {
  try {
    const filters = JSON.parse(window.localStorage.getItem("_cb_filters"));
    return filters[projectId] || null;
  } catch (e) {
    return null;
  }
};

/*
  This is the container that generates the Charts together with the menu
*/
function Chart(props) {
  const {
    team, user, chart, isPublic, print, height,
    showExport, password, editingLayout, onEditLayout,
    variables,
  } = props;

  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [publicModal, setPublicModal] = useState(false);
  const [embedModal, setEmbedModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateFrequency, setUpdateFrequency] = useState(false);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [iframeCopied, setIframeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [dashboardFilters, setDashboardFilters] = useState(
    getFiltersFromStorage(params.projectId)
  );
  const [conditions, setConditions] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [redraw, setRedraw] = useState(false);
  const [updateFreqType, setUpdateFreqType] = useState("hours");
  const [customUpdateFreq, setCustomUpdateFreq] = useState("");
  const [autoUpdateError, setAutoUpdateError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [embedTheme, setEmbedTheme] = useState("");
  const [alertsModal, setAlertsModal] = useState(false);
  const [alertsDatasetId, setAlertsDatasetId] = useState(null);
  const chartSize = useChartSize(chart.layout);

  useInterval(() => {
    dispatch(getChart({
      project_id: chart.project_id,
      chart_id: chart.id,
      password: isPublic ? window.localStorage.getItem("reportPassword") : null,
      fromInterval: true
    }));

    if (params.projectId) {
      _runFiltering(getFiltersFromStorage(params.projectId));
    } else {
      _runFiltering();
    }
  }, chart.autoUpdate > 0 && chart.autoUpdate < 600 ? chart.autoUpdate * 1000 : 600000);

  useEffect(() => {
    setIframeCopied(false);
    setUrlCopied(false);
  }, [embedModal]);

  useEffect(() => {
    if (customUpdateFreq && updateFreqType) {
      if (updateFreqType === "days") {
        setUpdateFrequency(customUpdateFreq * 3600 * 24);
      } else if (updateFreqType === "hours") {
        setUpdateFrequency(customUpdateFreq * 3600);
      } else if (updateFreqType === "minutes") {
        setUpdateFrequency(customUpdateFreq * 60);
      } else if (updateFreqType === "seconds") {
        setUpdateFrequency(customUpdateFreq);
      }
    }
  }, [customUpdateFreq, updateFreqType]);

  const _onGetChartData = () => {
    const { projectId } = params;

    const skipStateUpdate = getFiltersFromStorage(projectId)?.length > 0;

    setChartLoading(true);
    dispatch(runQuery({ project_id: projectId, chart_id: chart.id, skipStateUpdate }))
      .then(() => {
        setChartLoading(false);

        setDashboardFilters(getFiltersFromStorage(projectId));
        if (getFiltersFromStorage(projectId) && _chartHasFilter()) {
          _runFiltering(getFiltersFromStorage(projectId));
        } else {
          _runFiltering();
        }
      })
      .catch((error) => {
        if (error === 413) {
          setChartLoading(false);
        } else {
          setChartLoading(false);
          setError(true);
        }
      });
  };

  const _runFiltering = async (filters) => {
    if (filters) {
      await dispatch(runQueryWithFilters({
        project_id: chart.project_id,
        chart_id: chart.id,
        filters,
      }));
    }

    // if variables exist, run query again with variables
    if (variables?.[params.projectId]) {
      // check if any filters have the same variable name and run query with filters
      chart.ChartDatasetConfigs.forEach((cdc) => {
        if (Array.isArray(cdc.Dataset?.conditions)) {
          const newConditions = [];
          variables[params.projectId].forEach((variable) => {
            const found = cdc.Dataset.conditions.find((c) => c.variable === variable.variable);
            if (found) {
              newConditions.push({
                ...found,
                value: variable.value,
              });
            }
          });

          if (newConditions.length > 0) {
            dispatch(runQueryWithFilters({
              project_id: chart.project_id,
              chart_id: chart.id,
              filters: newConditions,
            }));
          }
        }
      });
    }
  };

  const _onGetChart = () => {
    dispatch(getChart({ project_id: params.projectId, chart_id: chart.id }));
  };

  const _onDeleteChartConfirmation = () => {
    setDeleteModal(true);
  };

  const _onDeleteChart = () => {
    setChartLoading(true);
    dispatch(removeChart({ project_id: params.projectId, chart_id: chart.id }))
      .then(() => {
        setChartLoading(false);
        setDeleteModal(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
        setDeleteModal(false);
      });
  };

  const _onPublicConfirmation = () => {
    if (chart.public) {
      setTimeout(() => {
        _onPublic(chart);
      }, 100);
    } else {
      setPublicModal(true);
    }
  };

  const _onPublic = () => {
    setPublicModal(false);
    setPublicLoading(true);

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { public: !chart.public },
      justUpdates: true,
    }))
      .then(() => {
        setChartLoading(false);
        setPublicLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
        setPublicLoading(false);
      });
  };

  const _onChangeReport = () => {
    setChartLoading(true);

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { onReport: !chart.onReport },
    }))
      .then(() => {
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
      });
  };

  const _onEmbed = () => {
    setEmbedModal(true);
  };

  const _onOpenEmbed = () => {
    if (chart.Chartshares && chart.Chartshares.length > 0) {
      // open the chart in a new tab
      window.open(
        `/chart/${chart.Chartshares[0].shareString}/embedded`,
        "_blank"
      );
    }
  };

  const _openUpdateModal = () => {
    setUpdateModal(true);
    setUpdateFrequency(chart.autoUpdate);
  };

  const _openAlertsModal = () => {
    setAlertsModal(true);
    setAlertsDatasetId(chart?.ChartDatasetConfigs?.[0]?.id);
  };

  const _getUpdateFreqText = (value) => {
    let text = "Update schedule";

    if (value === 60) text = "minute";
    else if (value === 300) text = "5 minutes";
    else if (value === 900) text = "15 minutes";
    else if (value === 1800) text = "30 minutes";
    else if (value === 3600) text = "1 hour";
    else if (value === 10800) text = "3 hours";
    else if (value === 21600) text = "6 hours";
    else if (value === 43200) text = "12 hours";
    else if (value === 86400) text = "day";
    else if (value === 604800) text = "week";
    else if (value === 2592000) text = "month";
    else if (value < 120 && value > 0) text = `${value} seconds`;
    else if (value > 119 && value < 3600) {
      text = `${Math.floor(value / 60)} minutes`;
    } else if (value > 3600 && value < 86400) {
      text = `${Math.floor(value / 3600)} hours`;
    } else if (value > 86400 && value < 604800) {
      text = `${Math.floor(value / 86400)} days`;
    }

    return text;
  };

  const _onChangeAutoUpdate = (frequency = updateFrequency) => {
    if (updateFreqType === "seconds" && frequency < 10 && frequency > 0) {
      setAutoUpdateError("Invalid update frequency");
      return;
    }

    setAutoUpdateLoading(true);
    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { autoUpdate: frequency },
      justUpdates: true,
    }))
      .then(() => {
        setAutoUpdateLoading(false);
        setUpdateModal(false);
      })
      .catch(() => {
        setAutoUpdateLoading(false);
        setError(true);
        setUpdateModal(false);
      });
  };

  const _onToggleShareable = async () => {
    // first, check if the chart has a share string
    if (!chart.Chartshares || chart.Chartshares.length === 0) {
      setShareLoading(true);
      await dispatch(createShareString({ project_id: params.projectId, chart_id: chart.id }));
    }

    await dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { shareable: !chart.shareable },
      justUpdates: true,
    }));
    setShareLoading(false);
  };

  const _chartHasFilter = () => {
    let found = false;
    if (chart.ChartDatasetConfigs) {
      chart.ChartDatasetConfigs.forEach((cdConfig) => {
        if (cdConfig.Dataset?.fieldsSchema) {
          Object.keys(cdConfig.Dataset.fieldsSchema).forEach((key) => {
            if (_.find(dashboardFilters, (o) => o.field === key)) {
              found = true;
            }
          });
        }
      });
    }

    return found;
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.ChartDatasetConfigs.forEach((d) => {
      if (Array.isArray(d.Dataset?.conditions)) {
        filterCount += d.Dataset.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _onCopyIframe = () => {
    const iframeText = document.getElementById("iframe-text");
    iframeText.select();
    document.execCommand("copy");
    setIframeCopied(true);
  };

  const _onCopyUrl = () => {
    const urlText = document.getElementById("url-text");
    urlText.select();
    document.execCommand("copy");
    setUrlCopied(true);
  };

  const _onExport = () => {
    setExportLoading(true);
    return dispatch(exportChart({
      project_id: params.projectId,
      chartIds: [chart.id],
      filters: dashboardFilters,
    }))
      .then(() => {
        setExportLoading(false);
      })
      .catch(() => {
        setExportLoading(false);
      });
  };

  const _onPublicExport = (chart) => {
    setExportLoading(true);
    return dispatch(exportChartPublic({ chart, password }))
      .then(() => {
        setExportLoading(false);
      })
      .catch(() => {
        setExportLoading(false);
      });
  };

  const _getUpdatedTime = (chart) => {
    const updatedAt = chart.chartDataUpdated || chart.lastAutoUpdate;
    if (moment().diff(moment(updatedAt), "days") > 1) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onAddFilter = (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    _runFiltering(newConditions);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    _runFiltering(newConditions);
  };

  const _getEmbedUrl = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    return `${SITE_HOST}/chart/${shareString}/embedded${embedTheme ? `?theme=${embedTheme}` : ""}`;
  };

  const _getEmbedString = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    return `<iframe src="${SITE_HOST}/chart/${shareString}/embedded${embedTheme ? `?theme=${embedTheme}` : ""}" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  const _onCreateSharingString = async () => {
    setShareLoading(true);
    await dispatch(createShareString({ project_id: params.projectId, chart_id: chart.id }));
    setShareLoading(false);
  };

  const _onPublishChart = async () => {
    const res = await dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { draft: false },
    }));

    if (res.error) {
      toast.error("There was a problem publishing your chart");
    } else {
      toast.success("Chart published successfully");
    }
  };

  const { projectId } = params;

  return (
    <motion.div
      animate={{ opacity: [0, 1] }}
      transition={{ duration: 0.7 }}
      style={styles.container}
    >
      {error && (
        <Text color="danger" onClick={() => setError(false)}>
          {"There was a problem with your request. Please refresh the page and try again."}
        </Text>
      )}
      {chart && (
        <Card
          shadow="none"
          className={`h-full bg-content1 border-solid border-1 border-divider ${print && "min-h-[350px] shadow-none border-solid border-1 border-content4"}`}
        >
          <CardHeader className="pb-0 grid grid-cols-12 items-start">
            <div className="col-span-6 sm:col-span-8 flex items-start justify-start">
              <div>
                <Row align="center" className={"flex-wrap gap-1"}>
                  {chart.draft && (
                    <Chip color="secondary" variant="flat" size="sm">Draft</Chip>
                  )}
                  <>
                    {_canAccess("projectEditor") && !editingLayout && (
                      <Link to={`/${params.teamId}/${params.projectId}/chart/${chart.id}/edit`}>
                        <Text b className={"text-default"}>{chart.name}</Text>
                      </Link>
                    )}
                    {(!_canAccess("projectEditor") || editingLayout) && (
                      <Text b>{chart.name}</Text>
                    )}
                  </>
                </Row>
                {chart.chartData && (
                  <Row justify="flex-start" align="center" className={"gap-1"}>
                    {!chartLoading && !chart.loading && (
                      <>
                        <span className="text-[10px] text-default-500" title="Last updated">{`${_getUpdatedTime(chart)}`}</span>
                      </>
                    )}
                    {(chartLoading || chart.loading) && (
                      <>
                        <CircularProgress classNames={{ svg: "w-4 h-4" }} aria-label="Updating chart" />
                        <Spacer x={1} />
                        <span className="text-[10px] text-default-500">{"Updating..."}</span>
                      </>
                    )}
                    {chart.autoUpdate > 0 && (
                      <Tooltip content={`Updates every ${_getUpdateFreqText(chart.autoUpdate)}`}>
                        <div>
                          <LuCalendarClock size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {chart.public && !isPublic && !print && (
                      <Tooltip content="This chart is public">
                        <div>
                          <LuLockOpen size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {(chart.onReport && !isPublic && !print && !chart.draft) && (
                      <Tooltip content="This chart is visible on your report">
                        <div>
                          <LuMonitor size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {(!chart.onReport || chart.draft) && (
                      <Tooltip
                        content={chart.draft ? "Draft charts are not visible on your report" : "This chart is not visible on your report"}
                      >
                        <div>
                          <LuMonitorX size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {chart?.Alerts?.length > 0 && (
                      <Tooltip content="This chart has alerts">
                        <div className="hover:text-primary cursor-pointer" onClick={_openAlertsModal}>
                          <LuBell size={12} />
                        </div>
                      </Tooltip>
                    )}
                  </Row>
                )}
              </div>
            </div>
            <div className="col-span-6 sm:col-span-4 flex items-start justify-end">
              {_checkIfFilters() && (
                <div className="flex items-start gap-1">
                  {chartSize?.[2] > 3 && (
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                      inline
                      size="sm"
                      amount={1}
                    />
                  )}
                  <Popover>
                    <PopoverTrigger>
                      <LinkNext className="text-gray-500">
                        <Badge
                          color="primary"
                          content={conditions.length}
                          size="sm"
                          isInvisible={!conditions || conditions.length === 0}
                        >
                          <LuListFilter />
                        </Badge>
                      </LinkNext>
                    </PopoverTrigger>
                    <PopoverContent className="pt-3">
                      <ChartFilters
                        chart={chart}
                        onAddFilter={_onAddFilter}
                        onClearFilter={_onClearFilter}
                        conditions={conditions}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {projectId && !print && (
                <Dropdown aria-label="Select a chart option">
                  <DropdownTrigger>
                    <LinkNext className="text-gray-500 cursor-pointer chart-settings-tutorial">
                      <LuEllipsisVertical />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem
                      startContent={(chartLoading || chart.loading) ? <CircularProgress classNames={{ svg: "w-5 h-5" }} size="sm" aria-label="Refreshing chart" /> : <LuRefreshCw />}
                      onPress={_onGetChartData}
                      textValue="Refresh chart"
                    >
                      Refresh chart
                    </DropdownItem>
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuSettings />}
                        onPress={() => navigate(`/${params.teamId}/${params.projectId}/chart/${chart.id}/edit`)}
                        textValue="Edit chart"
                      >
                        Edit chart
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && chart.draft && (
                      <DropdownItem
                        startContent={<LuCircleCheck />}
                        onPress={_onPublishChart}
                        textValue="Publish chart"
                      >
                        Publish chart
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuLayoutDashboard className={editingLayout ? "text-primary" : ""} />}
                        onPress={onEditLayout}
                        showDivider
                        textValue={editingLayout ? "Complete layout" : "Edit layout"}
                        endContent={<Kbd keys={[isMac ? "command" : "ctrl", "e"]}>E</Kbd>}
                      >
                        <span className={editingLayout ? "text-primary" : ""}>
                          {editingLayout ? "Complete layout" : "Edit layout"}
                        </span>
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuCalendarClock />}
                        onPress={_openUpdateModal}
                        textValue="Auto-update"
                      >
                        Auto-update
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuBell />}
                        onPress={_openAlertsModal}
                        textValue="Alerts"
                      >
                        Alerts
                      </DropdownItem>
                    )}
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" aria-label="Exporting chart" /> : <LuFileDown />}
                      onPress={_onExport}
                      textValue="Export to Excel"
                    >
                      Export to Excel
                    </DropdownItem>
                    {!chart.draft && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={chart.onReport ? <LuMonitorX /> : <LuMonitor />}
                        onPress={_onChangeReport}
                        textValue={chart.onReport ? "Remove from report" : "Add to report"}
                        showDivider
                      >
                        {chart.onReport ? "Remove from report" : "Add to report"}
                      </DropdownItem>
                    )}
                    {!chart.draft && chart.public && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={chart.public ? <LuLockOpen /> : <LuLock />}
                        onPress={_onPublicConfirmation}
                        textValue={chart.public ? "Make private" : "Make public"}
                      >
                        {"Make private"}
                      </DropdownItem>
                    )}
                    {!chart.draft && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuShare />}
                        onPress={_onEmbed}
                        textValue="Embed & Share"
                      >
                        {"Embed & Share"}
                      </DropdownItem>
                    )}
                    {!chart.draft && chart.shareable && (
                      <DropdownItem
                        startContent={<LuLink />}
                        onPress={_onOpenEmbed}
                        textValue="Open in a new tab"
                        showDivider
                      >
                        {"Open in a new tab"}
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuTrash />}
                        color="danger"
                        onPress={_onDeleteChartConfirmation}
                        textValue="Delete chart"
                      >
                        Delete chart
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              )}

              {showExport && (
                <Dropdown aria-label="Select an export option">
                  <DropdownTrigger>
                    <LinkNext color="foreground">
                      <LuEllipsis size={24} />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" aria-label="Exporting chart" /> : <LuFileDown />}
                      onClick={() => _onPublicExport(chart)}
                      textValue="Export to Excel"
                    >
                      <Text>Export to Excel</Text>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </CardHeader>
          <CardBody className="pt-2 pb-4 overflow-y-hidden">
            {chart.chartData && (
              <div className="h-full">
                {chart.type === "line"
                  && (
                    <LineChart
                      chart={chart}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "bar"
                  && (
                    <BarChart
                      chart={chart}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "pie"
                  && (
                  <PieChart
                    chart={chart}
                    height={height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "doughnut"
                  && (
                    <DoughnutChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "radar"
                  && (
                  <RadarChart
                    chart={chart}
                    height={height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "polar"
                  && (
                    <PolarChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "table"
                  && (
                    <div className="h-full">
                      <TableContainer
                        tabularData={chart.chartData}
                        datasets={chart.ChartDatasetConfigs}
                      />
                    </div>
                  )}
                {(chart.type === "kpi" || chart.type === "avg")
                  && (
                    <KpiMode
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} backdrop="blur">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to remove this chart?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"All the chart data will be removed and you won't be able to see it on your dashboard anymore if you proceed with the removal."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              onClick={() => setDeleteModal(false)}
              auto
            >
              Go back
            </Button>
            <Button
              color="danger"
              endContent={<LuTrash />}
              onClick={_onDeleteChart}
              isLoading={chartLoading}
            >
              Remove completely
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* MAKE CHART PUBLIC MODAL */}
      <Modal onClose={() => setPublicModal(false)} isOpen={publicModal}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to make your chart public?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"Public charts will show in your Public Dashboard page and it can be viewed by everyone with access to the unique sharing link. Nobody other than you and your team will be able to edit or update the chart data."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              auto
              onClick={() => setPublicModal(false)}
            >
              Go back
            </Button>
            <Button
              isLoading={publicLoading}
              color="primary"
              endContent={<LuLockOpen />}
              onClick={_onPublic}
            >
              Make the chart public
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AUTO-UPDATE MODAL */}
      <Modal isOpen={updateModal} className="w-[500px]" onClose={() => setUpdateModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Set up auto-update for your chart</Text>
          </ModalHeader>
          <ModalBody>
            <div>
              <Row align="center">
                <Select
                  label="Select a preset"
                  selectionMode="single"
                  selectedKeys={[`${updateFrequency}`]}
                  onSelectionChange={(key) => {
                    setUpdateFrequency(parseInt(key[0].value));
                  }}
                  variant="bordered"
                  aria-label="Select a preset"
                >
                    <SelectItem key="0" onClick={() => setUpdateFrequency(0)} textValue="Don't auto update">
                      {"Don't auto update"}
                    </SelectItem>
                    <SelectItem key="60" onClick={() => setUpdateFrequency(60)} textValue="Every minute">
                      Every minute
                    </SelectItem>
                      <SelectItem key="300" onClick={() => setUpdateFrequency(300)} textValue="Every 5 minutes">
                      Every 5 minutes
                    </SelectItem>
                    <SelectItem key="900" onClick={() => setUpdateFrequency(900)} textValue="Every 15 minutes">
                      Every 15 minutes
                    </SelectItem>
                    <SelectItem key="1800" onClick={() => setUpdateFrequency(1800)} textValue="Every 30 minutes">
                      Every 30 minutes
                    </SelectItem>
                    <SelectItem key="3600" onClick={() => setUpdateFrequency(3600)} textValue="Every hour">
                      Every hour
                    </SelectItem>
                    <SelectItem key="10800" onClick={() => setUpdateFrequency(10800)} textValue="Every 3 hours">
                      Every 3 hours
                    </SelectItem>
                    <SelectItem key="21600" onClick={() => setUpdateFrequency(21600)} textValue="Every 6 hours">
                      Every 6 hours
                    </SelectItem>
                    <SelectItem key="43200" onClick={() => setUpdateFrequency(43200)} textValue="Every 12 hours">
                      Every 12 hours
                    </SelectItem>
                    <SelectItem key="86400" onClick={() => setUpdateFrequency(86400)} textValue="Every day">
                      Every day
                    </SelectItem>
                    <SelectItem key="604800" onClick={() => setUpdateFrequency(604800)} textValue="Every week">
                      Every week
                    </SelectItem>
                    <SelectItem key="2592000" onClick={() => setUpdateFrequency(2592000)} textValue="Every month">
                      Every month
                    </SelectItem>
                </Select>
              </Row>
              <Spacer y={4} />
              <Row>
                <Text>Or enter a custom frequency:</Text>
              </Row>
              <Row align="center" className={"gap-2"}>
                <Input
                  type="number"
                  labelPlacement="outside"
                  startContent={(<Text className={"text-default-400"}>Every</Text>)}
                  onChange={(e) => setCustomUpdateFreq(e.target.value)}
                  value={customUpdateFreq}
                  variant="bordered"
                  disableAnimation
                  min={updateFreqType === "seconds" ? 10 : 1}
                />
                <Dropdown aria-label="Select a time unit">
                  <DropdownTrigger>
                    <Button
                      variant="bordered"
                      color="default"
                      endContent={(
                        <div>
                          <LuChevronDown />
                        </div>
                      )}
                    >
                      {updateFreqType}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem key="seconds" onClick={() => setUpdateFreqType("seconds")} textValue="Seconds">
                      <Text>Seconds</Text>
                    </DropdownItem>
                    <DropdownItem key="minutes" onClick={() => setUpdateFreqType("minutes")} textValue="Minutes">
                      <Text>Minutes</Text>
                    </DropdownItem>
                    <DropdownItem key="hours" onClick={() => setUpdateFreqType("hours")} textValue="Hours">
                      <Text>Hours</Text>
                    </DropdownItem>
                    <DropdownItem key="days" onClick={() => setUpdateFreqType("days")} textValue="Days">
                      <Text>Days</Text>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Row>
              {autoUpdateError && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Text color="danger">{autoUpdateError}</Text>
                  </Row>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color={"warning"}
              onClick={() => setUpdateModal(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              endContent={<LuX />}
              variant="flat"
              color="danger"
              isLoading={autoUpdateLoading}
              onClick={() => {
                setUpdateFrequency(0);
                _onChangeAutoUpdate(0);
              }}
              size="sm"
            >
              Stop auto-updating
            </Button>
            <Button
              endContent={<LuCheck />}
              color="primary"
              isLoading={autoUpdateLoading}
              onClick={() => _onChangeAutoUpdate()}
              size="sm"
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* EMBED CHART MODAL */}
      {chart && (
        <Modal isOpen={embedModal} onClose={() => setEmbedModal(false)} size="xl">
          <ModalContent>
            <ModalHeader>
              <Text size="h4">{"Embed your chart on other websites"}</Text>
            </ModalHeader>
            <ModalBody>
              <Row align="center">
                <Switch
                  label={chart.shareable ? "Disable sharing" : "Enable sharing"}
                  onChange={_onToggleShareable}
                  isSelected={chart.shareable}
                  disabled={!_canAccess("projectEditor")}
                  size="sm"
                />
                <Spacer x={0.5} />
                <Text>
                  {chart.shareable ? "Disable sharing" : "Enable sharing"}
                </Text>
                <Spacer x={0.5} />
                {shareLoading && (<CircularProgress size="sm" aria-label="Sharing chart" />)}
              </Row>
              <Spacer y={2} />
              {chart.public && !chart.shareable && (
                <Row>
                  <Text color="primary">
                    {"The chart is public. A public chart can be shared even if the sharing toggle is disabled. This gives you more flexibility if you want to hide the chart from the public dashboard but you still want to individually share it."}
                  </Text>
                </Row>
              )}
              {!chart.public && !chart.shareable && (
                <>
                  <Spacer y={2} />
                  <Row align="center">
                    <Text>
                      {"The chart is private. A private chart can only be seen by members of the team. If you enable sharing, others outside of your team can see the chart and you can also embed it on other websites."}
                    </Text>
                  </Row>
                </>
              )}
              {!_canAccess("projectEditor") && !chart.public && !chart.shareable && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Text color="danger">
                      {"You do not have the permission to enable sharing on this chart. Only editors and admins can enable this."}
                    </Text>
                  </Row>
                </>
              )}
              {(chart.public || chart.shareable)
              && (!chart.Chartshares || chart.Chartshares.length === 0)
              && (
                <>
                  <Spacer y={2} />
                  <Row align="center">
                    <Button
                      endContent={<LuPlus />}
                      onClick={_onCreateSharingString}
                      color="primary"
                    >
                      Create a sharing code
                    </Button>
                  </Row>
                </>
              )}
              {shareLoading && (
                <Row><CircularProgress aria-label="Creating sharing code" /></Row>
              )}

              {(chart.shareable || chart.public)
              && !chartLoading
              && (chart.Chartshares && chart.Chartshares.length > 0)
              && (
                <>
                  <div className="flex items-center">
                    <RadioGroup
                      label="Select a theme"
                      orientation="horizontal"
                      size="sm"
                    >
                      <Radio value="os" onClick={() => setEmbedTheme("")} checked={embedTheme === ""}>
                        System default
                      </Radio>
                      <Radio value="dark" onClick={() => setEmbedTheme("dark")} checked={embedTheme === "dark"}>
                        Dark
                      </Radio>
                      <Radio value="light" onClick={() => setEmbedTheme("light")} checked={embedTheme === "light"}>
                        Light
                      </Radio>
                    </RadioGroup>
                  </div>
                  <Spacer y={1} />
                  <Row>
                    <Textarea
                      label={"Copy the following code on the website you wish to add your chart in."}
                      labelPlacement="outside"
                      id="iframe-text"
                      value={_getEmbedString()}
                      fullWidth
                      readOnly
                    />
                  </Row>
                  <Row>
                    <Button
                      color={iframeCopied ? "success" : "primary"}
                      endContent={iframeCopied ? <LuClipboardCheck /> : <LuClipboard />}
                      onClick={_onCopyIframe}
                      variant={iframeCopied ? "flat" : "solid"}
                      size="sm"
                    >
                      {!iframeCopied && "Copy the code"}
                      {iframeCopied && "Copied to your clipboard"}
                    </Button>
                  </Row>

                  <Spacer y={1} />
                  <Row>
                    <Input
                      label={"Or copy the following URL"}
                      labelPlacement="outside"
                      value={_getEmbedUrl()}
                      id="url-text"
                      fullWidth
                      readOnly
                    />
                  </Row>
                  <Row>
                    <Button
                      color={urlCopied ? "success" : "primary"}
                      endContent={iframeCopied ? <LuClipboardCheck /> : <LuClipboard />}
                      variant={urlCopied ? "flat" : "solid"}
                      onClick={_onCopyUrl}
                      size="sm"
                    >
                      {!urlCopied && "Copy URL"}
                      {urlCopied && "Copied to your clipboard"}
                    </Button>
                  </Row>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                color="warning"
                onClick={() => setEmbedModal(false)}
                auto
              >
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}


      {/* ALERTS MODAL */}
      <Modal isOpen={alertsModal} onClose={() => setAlertsModal(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">{"Alerts"}</div>
          </ModalHeader>
          <ModalBody>
            <div className="text-sm">{"Select a dataset to set up alerts for"}</div>
            <Select
              selectionMode="single"
              selectedKeys={[`${alertsDatasetId}`]}
              onSelectionChange={(keys) => {
                setAlertsDatasetId(keys.currentKey);
              }}
              variant="bordered"
              aria-label="Select a dataset"
            >
              {chart?.ChartDatasetConfigs?.map((config) => (
                <SelectItem key={config.id} value={config.id} textValue={config.legend}>
                  {config.legend}
                </SelectItem>
              ))}
            </Select>

            {alertsDatasetId && (
              <>
                <Divider />
                {chart?.Alerts?.length > 0 && (
                  <div className="text-sm">{"Your current alerts:"}</div>
                )}

                <DatasetAlerts
                  chartType={chart.type}
                  chartId={chart.id}
                  cdcId={alertsDatasetId}
                  projectId={chart.project_id}
                  onChanged={_onGetChart}
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setAlertsModal(false)}
              auto
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
  },
  draft: {
    marginRight: 10,
  },
  filterBtn: (addPadding) => ({
    position: "absolute",
    right: addPadding ? 40 : 10,
    top: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  }),
  titleArea: (isKpi) => ({
    paddingLeft: isKpi ? 15 : 0,
  }),
};

Chart.defaultProps = {
  isPublic: false,
  onChangeOrder: () => {},
  print: "",
  height: 300,
  showExport: false,
  password: "",
  editingLayout: false,
  onEditLayout: () => {},
};

Chart.propTypes = {
  chart: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  onChangeOrder: PropTypes.func,
  print: PropTypes.string,
  height: PropTypes.number,
  showExport: PropTypes.bool,
  password: PropTypes.string,
  editingLayout: PropTypes.bool,
  onEditLayout: PropTypes.func,
  variables: PropTypes.object,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    team: state.team.active,
    user: state.user.data,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
