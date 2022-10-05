import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Card, Text, Grid, Spacer, Row, Loading, Tooltip, Dropdown, Button, Modal, Input,
  Link as LinkNext, Textarea, Switch, Container, Popover,
} from "@nextui-org/react";
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronDownCircle, ChevronUp, CloseSquare,
  Delete, EditSquare, Filter2, Graph, Lock, MoreSquare, Paper, PaperDownload,
  Plus, Send, TickSquare, TimeCircle, Unlock,
} from "react-iconly";
import moment from "moment";
import _ from "lodash";
import { enGB } from "date-fns/locale";
import { format } from "date-fns";
import { motion } from "framer-motion/dist/framer-motion";
import { HiRefresh } from "react-icons/hi";

import {
  removeChart as removeChartAction,
  runQuery as runQueryAction,
  updateChart as updateChartAction,
  runQueryWithFilters as runQueryWithFiltersAction,
  exportChart,
  createShareString as createShareStringAction,
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
import Badge from "../../components/Badge";

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
    createShareString,
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

  useEffect(() => {
    setIframeCopied(false);
    setUrlCopied(false);
  }, [embedModal]);

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

  const _openUpdateModal = () => {
    setUpdateModal(true);
    setUpdateFrequency(chart.autoUpdate);
  };

  const _getUpdateFreqText = (value) => {
    let text = "Not updating automatically";

    if (value === 60) text = "Every minute";
    else if (value === 300) text = "Every 5 minutes";
    else if (value === 900) text = "Every 15 minutes";
    else if (value === 1800) text = "Every 30 minutes";
    else if (value === 3600) text = "Every 1 hour";
    else if (value === 10800) text = "Every 3 hours";
    else if (value === 21600) text = "Every 6 hours";
    else if (value === 43200) text = "Every 12 hours";
    else if (value === 86400) text = "Every day";
    else if (value === 604800) text = "Every week";
    else if (value === 2592000) text = "Every month";
    return text;
  };

  const _onChangeAutoUpdate = () => {
    setAutoUpdateLoading(true);

    updateChart(
      match.params.projectId,
      chart.id,
      { autoUpdate: updateFrequency },
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
    return exportChart(match.params.projectId, [chart.id], dashboardFilters);
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
        <Text color="error" onClick={() => setError(false)}>
          {"There was a problem with your request. Please refresh the page and try again."}
        </Text>
      )}
      {chart && (
        <Card
          style={styles.chartContainer(print)}
          variant="bordered"
          css={{ height: "100%" }}
        >
          <Card.Header css={{ pb: 0 }}>
            <Grid.Container>
              <Grid xs={8} sm={10} md={10} justify="flex-start" alignItems="flex-start">
                <div>
                  <Row justify="flex-start" align="center">
                    {chart.draft && (
                      <>
                        <Badge type="secondary">Draft</Badge>
                        <Spacer x={0.1} />
                      </>
                    )}
                    <>
                      {_canAccess("editor") && (
                        <Link to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}>
                          <Text b size="1.1em" css={{ color: "$text", lineHeight: "$xs" }}>{chart.name}</Text>
                        </Link>
                      )}
                      {!_canAccess("editor") && (
                        <Text b size="1.1em" css={{ color: "$text", lineHeight: "$xs" }}>{chart.name}</Text>
                      )}
                    </>
                    <Spacer x={0.2} />
                    {chart.Datasets && conditions.map((c) => {
                      return (
                        <Badge type="primary" key={c.id}>
                          {c.type !== "date" && `${c.value}`}
                          {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                          <LinkNext onClick={() => _onClearFilter(c)} css={{ color: "$text" }}>
                            <CloseSquare size="small" />
                          </LinkNext>
                        </Badge>
                      );
                    })}
                  </Row>
                  {chart.chartData && (
                    <Row justify="flex-start" align="center">
                      {!chartLoading && !chart.loading && (
                        <>
                          {!print && <Text small i title="Last updated">{`${_getUpdatedTime(chart.chartDataUpdated)}`}</Text>}
                          {print && <Text small i>{`${moment(chart.chartDataUpdated).format("LLL")}`}</Text>}
                        </>
                      )}
                      {(chartLoading || chart.loading) && (
                        <>
                          <Loading type="spinner" size="xs" inlist />
                          <Spacer x={0.2} />
                          <Text small>{"Updating..."}</Text>
                        </>
                      )}
                      <Spacer x={0.2} />
                      {chart.autoUpdate > 0 && (
                        <Tooltip content={`Updates automatically - ${_getUpdateFreqText(chart.autoUpdate)}`}>
                          <TimeCircle size="small" set="light" />
                        </Tooltip>
                      )}
                      {chart.public && !isPublic && !print && (
                        <Tooltip content="This chart is public">
                          <Unlock size="small" set="light" />
                        </Tooltip>
                      )}
                      {chart.onReport && !isPublic && !print && (
                        <Tooltip content="This chart is on a report">
                          <Graph size="small" set="light" />
                        </Tooltip>
                      )}
                    </Row>
                  )}
                </div>
              </Grid>
              <Grid xs={4} sm={2} md={2} justify="flex-end" alignItems="flex-start">
                {_checkIfFilters() && (
                  <Popover placement="bottom-right">
                    <Popover.Trigger>
                      <LinkNext css={{ color: "$accents6" }}>
                        <Filter2 set="light" />
                      </LinkNext>
                    </Popover.Trigger>
                    <Popover.Content>
                      <Container css={{ pt: 10, pb: 10 }}>
                        <ChartFilters
                          chart={chart}
                          onAddFilter={_onAddFilter}
                          onClearFilter={_onClearFilter}
                          conditions={conditions}
                        />
                      </Container>
                    </Popover.Content>
                  </Popover>
                )}
                {projectId && !print && (
                  <Dropdown closeOnSelect={false}>
                    <Dropdown.Trigger>
                      <LinkNext color="text">
                        <MoreSquare set="light" />
                      </LinkNext>
                    </Dropdown.Trigger>
                    <Dropdown.Menu>
                      <Dropdown.Item icon={<HiRefresh size={22} />}>
                        <Text onClick={_onGetChartData}>Refresh chart</Text>
                      </Dropdown.Item>
                      {_canAccess("editor") && (
                        <Dropdown.Item icon={<TimeCircle />}>
                          <Text onClick={_openUpdateModal}>Auto-update</Text>
                        </Dropdown.Item>
                      )}
                      {_canAccess("editor") && (
                        <Dropdown.Item icon={<EditSquare />}>
                          <Link to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}>
                            <Text>Edit chart</Text>
                          </Link>
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item icon={<PaperDownload />}>
                        <Text onClick={_onExport}>Export to Excel</Text>
                      </Dropdown.Item>
                      {!chart.draft && _canAccess("editor") && (
                        <Dropdown.Item withDivider icon={<Graph />}>
                          <Text onClick={_onChangeReport}>
                            {chart.onReport ? "Remove from report" : "Add to report"}
                          </Text>
                        </Dropdown.Item>
                      )}
                      {!chart.draft && _canAccess("editor") && (
                        <Dropdown.Item icon={chart.public ? <Unlock /> : <Lock />}>
                          <Text onClick={_onPublicConfirmation}>
                            {chart.public ? "Make private" : "Make public"}
                          </Text>
                        </Dropdown.Item>
                      )}
                      {!chart.draft && (
                        <Dropdown.Item icon={<Send />}>
                          <Text onClick={_onEmbed}>{"Embed & Share"}</Text>
                        </Dropdown.Item>
                      )}
                      {_canAccess("editor") && (
                        <Dropdown.Item icon={<ChevronDownCircle />} withDivider>
                          <Dropdown>
                            <Dropdown.Trigger>
                              <Text>Chart size</Text>
                            </Dropdown.Trigger>
                            <Dropdown.Menu
                              disallowEmptySelection
                              onSelectionChange={(key) => {
                                if (key && Object.values(key)) {
                                  _onChangeSize(Object.values(key)[0]);
                                }
                              }}
                              selectedKeys={[`${chart.chartSize}`]}
                              selectionMode="single"
                            >
                              <Dropdown.Item key={1}>
                                <Text>Small</Text>
                              </Dropdown.Item>
                              <Dropdown.Item key={2}>
                                <Text>Medium</Text>
                              </Dropdown.Item>
                              <Dropdown.Item key={3}>
                                <Text>Large</Text>
                              </Dropdown.Item>
                              <Dropdown.Item key={4}>
                                <Text>Full width</Text>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        </Dropdown.Item>
                      )}
                      {_canAccess("editor") && (
                        <Dropdown.Item icon={<ChevronDownCircle />}>
                          <Dropdown>
                            <Dropdown.Trigger>
                              <Text>Change order</Text>
                            </Dropdown.Trigger>
                            <Dropdown.Menu>
                              <Dropdown.Item icon={<ArrowUp />}>
                                {_getChartIndex() === 0 && (
                                  <Text css={{ color: "$accents4" }}>
                                    Move to top
                                  </Text>
                                )}
                                {_getChartIndex() !== 0 && (
                                  <Text onClick={() => onChangeOrder(chart.id, "top")}>
                                    Move to top
                                  </Text>
                                )}
                              </Dropdown.Item>
                              <Dropdown.Item icon={<ChevronUp />}>
                                {_getChartIndex() === 0 && (
                                  <Text css={{ color: "$accents4" }}>
                                    Move up
                                  </Text>
                                )}
                                {_getChartIndex() !== 0 && (
                                  <Text onClick={() => onChangeOrder(chart.id, "up")}>
                                    Move up
                                  </Text>
                                )}
                              </Dropdown.Item>
                              <Dropdown.Item icon={<ChevronDown />}>
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
                              </Dropdown.Item>
                              <Dropdown.Item icon={<ArrowDown />}>
                                {_getChartIndex() === charts.length - 1 && (
                                  <Text css={{ color: "$accents4" }}>
                                    Move to bottom
                                  </Text>
                                )}
                                {_getChartIndex() !== charts.length - 1 && (
                                  <Text onClick={() => onChangeOrder(chart.id, "bottom")}>
                                    Move to bottom
                                  </Text>
                                )}
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        </Dropdown.Item>
                      )}
                      {_canAccess("editor") && (
                        <Dropdown.Item icon={<Delete />} color="error" withDivider>
                          <Text onClick={_onDeleteChartConfirmation}>Delete chart</Text>
                        </Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
              </Grid>
            </Grid.Container>
          </Card.Header>
          {chart.chartData && (
            <Card.Body css={{ pt: 5, overflowY: "hidden" }}>
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
                      height={height - 55}
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
            </Card.Body>
          )}
        </Card>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} blur>
        <Modal.Header>
          <Text h4>Are you sure you want to remove this chart?</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {"All the chart data will be removed and you won't be able to see it on your dashboard anymore if you proceed with the removal."}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setDeleteModal(false)}
            auto
          >
            Go back
          </Button>
          <Button
            color="error"
            iconRight={<Delete />}
            onClick={_onDeleteChart}
            auto
          >
            Remove completely
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MAKE CHART PUBLIC MODAL */}
      <Modal onClose={() => setPublicModal(false)} open={publicModal}>
        <Modal.Header>
          <Text h4>Are you sure you want to make your chart public?</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {"Public charts will show in your Public Dashboard page and it can be viewed by everyone with access to the unique sharing link. Nobody other than you and your team will be able to edit or update the chart data."}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            auto
            onClick={() => setPublicModal(false)}
          >
            Go back
          </Button>
          <Button
            loading={publicLoading}
            auto
            iconRight={<Unlock />}
            onClick={_onPublic}
          >
            Make the chart public
          </Button>
        </Modal.Footer>
      </Modal>

      {/* AUTO-UPDATE MODAL */}
      <Modal open={updateModal} onClose={() => setUpdateModal(false)}>
        <Modal.Header>
          <Text h4>Set up auto-update for your chart</Text>
        </Modal.Header>
        <Modal.Body>
          <Container fluid>
            <Row align="center" justify="center">
              <Text>Select the desired frequency:</Text>
            </Row>
            <Row align="center" justify="center">
              <Dropdown selectionMode="single" selectedKeys={[`${updateFrequency}`]}>
                <Dropdown.Button auto bordered>
                  {_getUpdateFreqText(updateFrequency)}
                </Dropdown.Button>
                <Dropdown.Menu>
                  <Dropdown.Item key="0">
                    <Text onClick={() => setUpdateFrequency(0)}>{"Don't auto update"}</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="60">
                    <Text onClick={() => setUpdateFrequency(60)}>Every minute</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="300">
                    <Text onClick={() => setUpdateFrequency(300)}>Every 5 minutes</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="900">
                    <Text onClick={() => setUpdateFrequency(900)}>Every 15 minutes</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="1800">
                    <Text onClick={() => setUpdateFrequency(1800)}>Every 30 minutes</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="3600">
                    <Text onClick={() => setUpdateFrequency(3600)}>Every hour</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="10800">
                    <Text onClick={() => setUpdateFrequency(10800)}>Every 3 hours</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="21600">
                    <Text onClick={() => setUpdateFrequency(21600)}>Every 6 hours</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="43200">
                    <Text onClick={() => setUpdateFrequency(43200)}>Every 12 hours</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="86400">
                    <Text onClick={() => setUpdateFrequency(86400)}>Every day</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="604800">
                    <Text onClick={() => setUpdateFrequency(604800)}>Every week</Text>
                  </Dropdown.Item>
                  <Dropdown.Item key="2592000">
                    <Text onClick={() => setUpdateFrequency(2592000)}>Every month</Text>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color={"warning"}
            auto
            onClick={() => setUpdateModal(false)}
          >
            Cancel
          </Button>
          <Button
            iconRight={<TickSquare />}
            auto
            loading={autoUpdateLoading}
            onClick={_onChangeAutoUpdate}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* EMBED CHART MODAL */}
      {chart && (
        <Modal open={embedModal} onClose={() => setEmbedModal(false)} width="600px">
          <Modal.Header>
            <Text h4>{"Embed your chart on other websites"}</Text>
          </Modal.Header>
          <Modal.Body>
            <Container>
              <Row align="center">
                <Switch
                  label={chart.shareable ? "Disable sharing" : "Enable sharing"}
                  onChange={_onToggleShareable}
                  checked={chart.shareable}
                  disabled={!_canAccess("editor")}
              />
                <Spacer x={0.2} />
                <Text>
                  {chart.shareable ? "Disable sharing" : "Enable sharing"}
                </Text>
                <Spacer x={0.2} />
                {shareLoading && (<Loading type="spinner" size="sm" />)}
              </Row>
              <Spacer y={1} />
              {chart.public && !chart.shareable && (
                <Row>
                  <Text color="primary">
                    {"The chart is public. A public chart can be shared even if the sharing toggle is disabled. This gives you more flexibility if you want to hide the chart from the public dashboard but you still want to individually share it."}
                  </Text>
                </Row>
              )}
              {!chart.public && !chart.shareable && (
                <>
                  <Spacer y={1} />
                  <Row align="center">
                    <Text>
                      {"The chart is private. A private chart can only be seen by members of the team. If you enable sharing, others outside of your team can see the chart and you can also embed it on other websites."}
                    </Text>
                  </Row>
                </>
              )}
              {!_canAccess("editor") && !chart.public && !chart.shareable && (
                <>
                  <Spacer y={1} />
                  <Row>
                    <Text color="error">
                      {"You do not have the permission to enable sharing on this chart. Only editors and admins can enable this."}
                    </Text>
                  </Row>
                </>
              )}
              {(chart.public || chart.shareable)
              && (!chart.Chartshares || chart.Chartshares.length === 0)
              && (
                <>
                  <Spacer y={1} />
                  <Row align="center">
                    <Button
                      iconRight={<Plus />}
                      auto
                      onClick={_onCreateSharingString}
                    >
                      Create a sharing code
                    </Button>
                  </Row>
                </>
              )}
              <Spacer y={1} />
              {shareLoading && (
                <Row><Loading type="points" /></Row>
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
                <Spacer y={0.5} />
                <Row>
                  <Textarea
                    id="iframe-text"
                    value={_getEmbedString()}
                    fullWidth
                    readOnly
                  />
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Button
                    color={iframeCopied ? "success" : "primary"}
                    iconRight={iframeCopied ? <TickSquare /> : <Paper />}
                    onClick={_onCopyIframe}
                    ghost
                    auto
                  >
                    {!iframeCopied && "Copy the code"}
                    {iframeCopied && "Copied to your clipboard"}
                  </Button>
                </Row>

                <Spacer y={1} />
                <Row>
                  <Text>{"Or get just the URL"}</Text>
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Input value={_getEmbedUrl()} id="url-text" fullWidth readOnly />
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Button
                    color={urlCopied ? "success" : "primary"}
                    iconRight={iframeCopied ? <TickSquare /> : <Paper />}
                    ghost
                    onClick={_onCopyUrl}
                    auto
                  >
                    {!urlCopied && "Copy URL"}
                    {urlCopied && "Copied to your clipboard"}
                  </Button>
                </Row>
              </>
            )}
            </Container>
          </Modal.Body>
          <Modal.Footer>
            <Button
              flat
              color="warning"
              onClick={() => setEmbedModal(false)}
              auto
            >
              Close
            </Button>
          </Modal.Footer>
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
    // paddingTop: isKpi ? 15 : 0,
  }),
};

Chart.defaultProps = {
  isPublic: false,
  onChangeOrder: () => {},
  print: "",
  height: 300,
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
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Chart));
