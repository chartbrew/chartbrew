import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Card, Spacer, Tooltip, Dropdown, Button, Modal, Input,
  Link as LinkNext, Textarea, Switch, Popover, Chip, CardHeader, CircularProgress, PopoverTrigger, PopoverContent, DropdownMenu, DropdownTrigger, DropdownItem, ModalHeader, ModalBody, ModalFooter, CardBody, ModalContent, Select, SelectItem, Listbox, ListboxItem,
} from "@nextui-org/react";

import moment from "moment";
import _ from "lodash";
import { enGB } from "date-fns/locale";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  IoAdd, IoArrowDown, IoArrowUp, IoCheckmark, IoChevronDown, IoChevronDownCircleOutline,
  IoChevronUp, IoClipboardOutline, IoClose, IoCloseCircle, IoEasel, IoEaselOutline,
  IoEllipsisHorizontalCircle, IoFilterCircleOutline, IoLink, IoLockClosed, IoLockOpen,
  IoLockOpenOutline, IoReload, IoSettings, IoShare, IoTime, IoTimeOutline, IoTrashBin,
} from "react-icons/io5";
import { RiFileExcelLine } from "react-icons/ri";

import {
  removeChart as removeChartAction,
  runQuery as runQueryAction,
  updateChart as updateChartAction,
  runQueryWithFilters as runQueryWithFiltersAction,
  exportChart,
  exportChartPublic,
  createShareString as createShareStringAction,
  getChart as getChartAction,
} from "../../actions/chart";
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
    updateChart, match, runQuery, removeChart, runQueryWithFilters,
    team, user, chart, isPublic, charts, onChangeOrder, print, height,
    createShareString, getChart, showExport, password, history,
  } = props;

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
    getFiltersFromStorage(match.params.projectId)
  );
  const [conditions, setConditions] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [redraw, setRedraw] = useState(false);
  const [updateFreqType, setUpdateFreqType] = useState("hours");
  const [customUpdateFreq, setCustomUpdateFreq] = useState("");
  const [autoUpdateError, setAutoUpdateError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  useInterval(() => {
    getChart(chart.project_id, chart.id, isPublic ? window.localStorage.getItem("reportPassword") : null, true);
  }, chart.autoUpdate ? chart.autoUpdate * 1000 : null);

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

  const _onChangeSize = (size) => {
    setChartLoading(true);
    updateChart(
      match.params.projectId,
      chart.id,
      { chartSize: size },
      true
    )
      .then(() => {
        setRedraw(true);
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
      });
  };

  const _onGetChartData = () => {
    const { projectId } = match.params;

    setChartLoading(true);
    runQuery(projectId, chart.id)
      .then(() => {
        setChartLoading(false);

        setDashboardFilters(getFiltersFromStorage(projectId));
        setTimeout(() => {
          if (dashboardFilters && _chartHasFilter()) {
            runQueryWithFilters(chart.project_id, chart.id, dashboardFilters);
          }
        }, 100);
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

  const _onDeleteChartConfirmation = () => {
    setDeleteModal(true);
  };

  const _onDeleteChart = () => {
    setChartLoading(true);
    removeChart(match.params.projectId, chart.id)
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

    updateChart(
      match.params.projectId,
      chart.id,
      { public: !chart.public },
      true,
    )
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

    updateChart(
      match.params.projectId,
      chart.id,
      { onReport: !chart.onReport },
    )
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
    updateChart(
      match.params.projectId,
      chart.id,
      { autoUpdate: frequency },
      true,
    )
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
      await createShareString(match.params.projectId, chart.id);
    }

    await updateChart(
      match.params.projectId,
      chart.id,
      { shareable: !chart.shareable },
      true,
    );
    setShareLoading(false);
  };

  const _chartHasFilter = () => {
    let found = false;
    if (chart.Datasets) {
      chart.Datasets.map((dataset) => {
        if (dataset.fieldsSchema) {
          Object.keys(dataset.fieldsSchema).forEach((key) => {
            if (_.find(dashboardFilters, (o) => o.field === key)) {
              found = true;
            }
          });
        }
        return dataset;
      });
    }

    return found;
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.Datasets.forEach((d) => {
      if (d.conditions) {
        filterCount += d.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _isKpi = (chart) => {
    return chart.mode === "kpi";
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

  const _getChartIndex = () => {
    return _.findIndex(charts, (c) => c.id === chart.id);
  };

  const _onExport = () => {
    setExportLoading(true);
    return exportChart(match.params.projectId, [chart.id], dashboardFilters)
      .then(() => {
        setExportLoading(false);
      })
      .catch(() => {
        setExportLoading(false);
      });
  };

  const _onPublicExport = (chart) => {
    setExportLoading(true);
    return exportChartPublic(chart, password)
      .then(() => {
        setExportLoading(false);
      })
      .catch(() => {
        setExportLoading(false);
      });
  };

  const _getUpdatedTime = (updatedAt) => {
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

    runQueryWithFilters(chart.project_id, chart.id, newConditions);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    runQueryWithFilters(chart.project_id, chart.id, newConditions);
  };

  const _getEmbedUrl = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    return `${SITE_HOST}/chart/${shareString}/embedded`;
  };

  const _getEmbedString = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    return `<iframe src="${SITE_HOST}/chart/${shareString}/embedded" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  const _onCreateSharingString = async () => {
    setShareLoading(true);
    await createShareString(match.params.projectId, chart.id);
    setShareLoading(false);
  };

  const { projectId } = match.params;

  return (
    <motion.div
      animate={{ opacity: [0, 1] }}
      transition={{ duration: 0.5 }}
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
          className={`h-full bg-content1 border-solid border-1 border-content3 ${!print ? "min-h-[350px]" : "min-h-[350px] shadow-none border-solid border-1 border-content4"}`}
        >
          <CardHeader className="pb-0 grid grid-cols-12 items-start">
            <div className="col-span-6 sm:col-span-8 flex items-start justify-start">
              <div>
                <Row justify="flex-start" align="center">
                  {chart.draft && (
                    <>
                      <Chip color="secondary" size="sm">Draft</Chip>
                      <Spacer x={1} />
                    </>
                  )}
                  <>
                    {_canAccess("editor") && (
                      <Link to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}>
                        <Text b size="lg" className={"text-default"}>{chart.name}</Text>
                      </Link>
                    )}
                    {!_canAccess("editor") && (
                      <Text b size="lg">{chart.name}</Text>
                    )}
                  </>
                  <Spacer x={0.5} />
                  {chart.Datasets && conditions.map((c) => {
                    return (
                      <Chip
                        color="primary"
                        variant={"flat"}
                        key={c.id}
                        size="sm"
                        endContent={(
                          <LinkNext onClick={() => _onClearFilter(c)} className="text-default-500 flex items-center">
                            <IoCloseCircle size={14} />
                          </LinkNext>
                        )}
                      >
                        <Text size="sm">
                          {c.type !== "date" && `${c.value}`}
                          {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                        </Text>
                      </Chip>
                    );
                  })}
                </Row>
                {chart.chartData && (
                  <Row justify="flex-start" align="center">
                    {!chartLoading && !chart.loading && (
                      <>
                        {!print && <Text size="xs" i title="Last updated">{`${_getUpdatedTime(chart.chartDataUpdated)}`}</Text>}
                        {print && <Text size="xs" i>{`${moment(chart.chartDataUpdated).format("LLL")}`}</Text>}
                      </>
                    )}
                    {(chartLoading || chart.loading) && (
                      <>
                        <CircularProgress classNames={{ svg: "w-4 h-4" }} />
                        <Spacer x={0.5} />
                        <Text size="xs">{"Updating..."}</Text>
                      </>
                    )}
                    <Spacer x={0.5} />
                    {chart.autoUpdate > 0 && (
                      <Tooltip content={`Updates every ${_getUpdateFreqText(chart.autoUpdate)}`}>
                        <div>
                          <IoTimeOutline size={14} />
                        </div>
                      </Tooltip>
                    )}
                    {chart.public && !isPublic && !print && (
                      <Tooltip content="This chart is public">
                        <div>
                          <IoLockOpenOutline size={14} />
                        </div>
                      </Tooltip>
                    )}
                    {chart.onReport && !isPublic && !print && (
                      <Tooltip content="This chart is on a report">
                        <div>
                          <IoEaselOutline size={14} />
                        </div>
                      </Tooltip>
                    )}
                  </Row>
                )}
              </div>
            </div>
            <div className="col-span-6 sm:col-span-4 flex items-start justify-end">
              {_checkIfFilters() && (
                <Popover placement="bottom-right">
                  <PopoverTrigger>
                    <LinkNext className="text-gray-500">
                      <IoFilterCircleOutline size={24} />
                    </LinkNext>
                  </PopoverTrigger>
                  <PopoverContent>
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                    />
                  </PopoverContent>
                </Popover>
              )}
              {projectId && !print && (
                <Dropdown>
                  <DropdownTrigger>
                    <LinkNext color="foreground">
                      <IoEllipsisHorizontalCircle size={24} />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem
                      startContent={(chartLoading || chart.loading) ? <CircularProgress classNames={{ svg: "w-5 h-5" }} size="sm" /> : <IoReload />}
                      onClick={_onGetChartData}
                    >
                      Refresh chart
                    </DropdownItem>
                    {_canAccess("editor") && (
                      <DropdownItem startContent={<IoTime />} onClick={_openUpdateModal}>
                        Auto-update
                      </DropdownItem>
                    )}
                    {_canAccess("editor") && (
                      <DropdownItem
                        startContent={<IoSettings />}
                        onClick={() => history.push(`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`)}
                      >
                        Edit chart
                      </DropdownItem>
                    )}
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" /> : <RiFileExcelLine />}
                      onClick={_onExport}
                    >
                      Export to Excel
                    </DropdownItem>
                    {!chart.draft && _canAccess("editor") && (
                      <DropdownItem startContent={<IoEasel />} onClick={_onChangeReport}>
                        {chart.onReport ? "Remove from report" : "Add to report"}
                      </DropdownItem>
                    )}
                    {!chart.draft && _canAccess("editor") && (
                      <DropdownItem
                        showDivider
                        startContent={chart.public ? <IoLockOpen /> : <IoLockClosed />}
                        onClick={_onPublicConfirmation}
                      >
                        {chart.public ? "Make private" : "Make public"}
                      </DropdownItem>
                    )}
                    {!chart.draft && (
                      <DropdownItem startContent={<IoShare />} onClick={_onEmbed}>
                        {"Embed & Share"}
                      </DropdownItem>
                    )}
                    {!chart.draft && chart.shareable && (
                      <DropdownItem startContent={<IoLink />} onClick={_onOpenEmbed}>
                        {"Open in a new tab"}
                      </DropdownItem>
                    )}
                    {_canAccess("editor") && (
                      <DropdownItem startContent={<IoChevronDownCircleOutline />} closeOnSelect={false}>
                        <Popover>
                          <PopoverTrigger>
                            <Text>Chart size</Text>
                          </PopoverTrigger>
                          <PopoverContent>
                            <Listbox
                              onSelectionChange={(keys) => {
                                if (keys?.currentKey) {
                                  _onChangeSize(keys.currentKey);
                                }
                              }}
                              selectedKeys={[`${chart.chartSize}`]}
                              selectionMode="single"
                            >
                                <ListboxItem key={1}>
                                  <Text>Small</Text>
                                </ListboxItem>
                                <ListboxItem key={2}>
                                  <Text>Medium</Text>
                                </ListboxItem>
                                <ListboxItem key={3}>
                                  <Text>Large</Text>
                                </ListboxItem>
                                <ListboxItem key={4}>
                                  <Text>Full width</Text>
                                </ListboxItem>
                              </Listbox>
                          </PopoverContent>
                        </Popover>
                      </DropdownItem>
                    )}
                    {_canAccess("editor") && (
                      <DropdownItem showDivider startContent={<IoChevronDownCircleOutline />}>
                        <Dropdown>
                          <DropdownTrigger>
                            <Text>Change order</Text>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem startContent={<IoArrowUp />}>
                              {_getChartIndex() === 0 && (
                                <Text className={"text-gray-300"}>
                                  Move to top
                                </Text>
                              )}
                              {_getChartIndex() !== 0 && (
                                <Text onClick={() => onChangeOrder(chart.id, "top")}>
                                  Move to top
                                </Text>
                              )}
                            </DropdownItem>
                            <DropdownItem startContent={<IoChevronUp />}>
                              {_getChartIndex() === 0 && (
                                <Text className={"text-gray-300"}>
                                  Move up
                                </Text>
                              )}
                              {_getChartIndex() !== 0 && (
                                <Text onClick={() => onChangeOrder(chart.id, "up")}>
                                  Move up
                                </Text>
                              )}
                            </DropdownItem>
                            <DropdownItem startContent={<IoChevronDown />}>
                              {_getChartIndex() === charts.length - 1 && (
                                <Text css={{ color: "$accents4" }}>
                                  Move down
                                </Text>
                              )}
                              {_getChartIndex() < charts.length - 1 && (
                                <Text onClick={() => onChangeOrder(chart.id, "down")}>
                                  Move down
                                </Text>
                              )}
                            </DropdownItem>
                            <DropdownItem startContent={<IoArrowDown />}>
                              {_getChartIndex() === charts.length - 1 && (
                                <Text className={"text-gray-300"}>
                                  Move to bottom
                                </Text>
                              )}
                              {_getChartIndex() !== charts.length - 1 && (
                                <Text onClick={() => onChangeOrder(chart.id, "bottom")}>
                                  Move to bottom
                                </Text>
                              )}
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </DropdownItem>
                    )}
                    {_canAccess("editor") && (
                      <DropdownItem startContent={<IoTrashBin />} color="danger" onClick={_onDeleteChartConfirmation}>
                        Delete chart
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              )}

              {showExport && (
                <Dropdown>
                  <DropdownTrigger>
                    <LinkNext color="foreground">
                      <IoEllipsisHorizontalCircle size={24} />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" /> : <RiFileExcelLine />}
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
          <CardBody className="pt-5 overflow-y-hidden">
            {chart.chartData && (
              <div style={styles.mainChartArea(_isKpi(chart))}>
                {chart.type === "line"
                  && (
                    <LineChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "bar"
                  && (
                    <BarChart
                      chart={chart}
                      height={height}
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
                    <TableContainer
                      height={height - 32}
                      tabularData={chart.chartData}
                      chartSize={chart.chartSize}
                      datasets={chart.Datasets}
                    />
                  )}
                {chart.type === "avg"
                  && (
                    <LineChart
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
              endContent={<IoTrashBin />}
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
              endContent={<IoLockOpen />}
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
                >
                    <SelectItem key="0" onClick={() => setUpdateFrequency(0)}>
                      {"Don't auto update"}
                    </SelectItem>
                    <SelectItem key="60" onClick={() => setUpdateFrequency(60)}>
                      Every minute
                    </SelectItem>
                    <SelectItem key="300" onClick={() => setUpdateFrequency(300)}>
                      Every 5 minutes
                    </SelectItem>
                    <SelectItem key="900" onClick={() => setUpdateFrequency(900)}>
                      Every 15 minutes
                    </SelectItem>
                    <SelectItem key="1800" onClick={() => setUpdateFrequency(1800)}>
                      Every 30 minutes
                    </SelectItem>
                    <SelectItem key="3600" onClick={() => setUpdateFrequency(3600)}>
                      Every hour
                    </SelectItem>
                    <SelectItem key="10800" onClick={() => setUpdateFrequency(10800)}>
                      Every 3 hours
                    </SelectItem>
                    <SelectItem key="21600" onClick={() => setUpdateFrequency(21600)}>
                      Every 6 hours
                    </SelectItem>
                    <SelectItem key="43200" onClick={() => setUpdateFrequency(43200)}>
                      Every 12 hours
                    </SelectItem>
                    <SelectItem key="86400" onClick={() => setUpdateFrequency(86400)}>
                      Every day
                    </SelectItem>
                    <SelectItem key="604800" onClick={() => setUpdateFrequency(604800)}>
                      Every week
                    </SelectItem>
                    <SelectItem key="2592000" onClick={() => setUpdateFrequency(2592000)}>
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
                  startContent={(<Text className={"text-default-400"}>Every</Text>)}
                  onChange={(e) => setCustomUpdateFreq(e.target.value)}
                  value={customUpdateFreq}
                  variant="bordered"
                  disableAnimation
                  min={updateFreqType === "seconds" ? 10 : 1}
                />
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      variant="bordered"
                      color="default"
                      endContent={(
                        <div>
                          <IoChevronDown />
                        </div>
                      )}
                    >
                      {updateFreqType}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem key="seconds" onClick={() => setUpdateFreqType("seconds")}>
                      <Text>Seconds</Text>
                    </DropdownItem>
                    <DropdownItem key="minutes" onClick={() => setUpdateFreqType("minutes")}>
                      <Text>Minutes</Text>
                    </DropdownItem>
                    <DropdownItem key="hours" onClick={() => setUpdateFreqType("hours")}>
                      <Text>Hours</Text>
                    </DropdownItem>
                    <DropdownItem key="days" onClick={() => setUpdateFreqType("days")}>
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
              auto
              onClick={() => setUpdateModal(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              endContent={<IoClose />}
              auto
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
              endContent={<IoCheckmark />}
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
              <div>
                <Row align="center">
                  <Switch
                    label={chart.shareable ? "Disable sharing" : "Enable sharing"}
                    onChange={_onToggleShareable}
                    isSelected={chart.shareable}
                    disabled={!_canAccess("editor")}
                  />
                  <Spacer x={0.5} />
                  <Text>
                    {chart.shareable ? "Disable sharing" : "Enable sharing"}
                  </Text>
                  <Spacer x={0.5} />
                  {shareLoading && (<CircularProgress size="sm" />)}
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
                {!_canAccess("editor") && !chart.public && !chart.shareable && (
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
                        endContent={<IoAdd />}
                        auto
                        onClick={_onCreateSharingString}
                      >
                        Create a sharing code
                      </Button>
                    </Row>
                  </>
                )}
                <Spacer y={2} />
                {shareLoading && (
                  <Row><CircularProgress /></Row>
                )}

                {(chart.shareable || chart.public)
              && !chartLoading
              && (chart.Chartshares && chart.Chartshares.length > 0)
              && (
                <>
                  <Row>
                    <Text>
                      {"Copy the following code on the website you wish to add your chart in."}
                    </Text>
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Textarea
                      id="iframe-text"
                      value={_getEmbedString()}
                      fullWidth
                      readOnly
                    />
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Button
                      color={iframeCopied ? "success" : "primary"}
                      endContent={iframeCopied ? <IoClose /> : <IoClipboardOutline />}
                      onClick={_onCopyIframe}
                      variant="ghost"
                      auto
                    >
                      {!iframeCopied && "Copy the code"}
                      {iframeCopied && "Copied to your clipboard"}
                    </Button>
                  </Row>

                  <Spacer y={2} />
                  <Row>
                    <Text>{"Or get just the URL"}</Text>
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Input value={_getEmbedUrl()} id="url-text" fullWidth readOnly />
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Button
                      color={urlCopied ? "success" : "primary"}
                      endContent={iframeCopied ? <IoClose /> : <IoClipboardOutline />}
                      variant="ghost"
                      onClick={_onCopyUrl}
                      auto
                    >
                      {!urlCopied && "Copy URL"}
                      {urlCopied && "Copied to your clipboard"}
                    </Button>
                  </Row>
                </>
              )}
              </div>
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
    </motion.div>
  );
}

const styles = {
  container: {
    width: "100%",
  },
  draft: {
    marginRight: 10,
  },
  chartContainer: (print) => {
    if (!print) {
      return {
        minHeight: 350,
      };
    } else {
      return {
        minHeight: 350,
        boxShadow: "none",
        border: "solid 1px rgba(34,36,38,.15)",
      };
    }
  },
  mainChartArea: (noPadding) => ({
    paddingBottom: noPadding ? 0 : 10,
  }),
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
};

Chart.propTypes = {
  chart: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  removeChart: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  runQueryWithFilters: PropTypes.func.isRequired,
  updateChart: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  onChangeOrder: PropTypes.func,
  print: PropTypes.string,
  height: PropTypes.number,
  createShareString: PropTypes.func.isRequired,
  getChart: PropTypes.func.isRequired,
  showExport: PropTypes.bool,
  password: PropTypes.string,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    team: state.team.active,
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    removeChart: (projectId, chartId) => dispatch(removeChartAction(projectId, chartId)),
    runQuery: (projectId, chartId) => dispatch(runQueryAction(projectId, chartId)),
    updateChart: (projectId, chartId, data, justUpdates) => (
      dispatch(updateChartAction(projectId, chartId, data, justUpdates))
    ),
    runQueryWithFilters: (projectId, chartId, filters) => (
      dispatch(runQueryWithFiltersAction(projectId, chartId, filters))
    ),
    createShareString: (projectId, chartId) => (
      dispatch(createShareStringAction(projectId, chartId))
    ),
    getChart: (projectId, chartId, password, fromInterval) => (
      dispatch(getChartAction(projectId, chartId, password, fromInterval))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Chart));
