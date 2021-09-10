import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Icon, Header, Segment, Modal, Button, TransitionablePortal,
  Dropdown, Message, Popup, Form, TextArea, Label, Input, Divider,
} from "semantic-ui-react";
import moment from "moment";
import _ from "lodash";
import { enGB } from "date-fns/locale";
import { format } from "date-fns";

import {
  removeChart as removeChartAction,
  runQuery as runQueryAction,
  updateChart as updateChartAction,
  runQueryWithFilters as runQueryWithFiltersAction,
  exportChart,
} from "../../actions/chart";
import canAccess from "../../config/canAccess";
import { SITE_HOST } from "../../config/settings";
import LineChart from "./components/LineChart";
import BarChart from "./components/BarChart";
import RadarChart from "./components/RadarChart";
import PolarChart from "./components/PolarChart";
import DoughnutChart from "./components/DoughnutChart";
import PieChart from "./components/PieChart";
import { blackTransparent } from "../../config/colors";
import TableContainer from "./components/TableView/TableContainer";
import ChartFilters from "./components/ChartFilters";

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
            runQueryWithFilters(projectId, chart.id, dashboardFilters);
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

  const _onEmbed = () => {
    setEmbedModal(true);
  };

  const _openUpdateModal = () => {
    setUpdateModal(true);
    setUpdateFrequency(chart.autoUpdate);
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

    runQueryWithFilters(match.params.projectId, chart.id, newConditions);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    runQueryWithFilters(match.params.projectId, chart.id, newConditions);
  };

  const { projectId } = match.params;

  return (
    <div style={styles.container}>
      {error && (
        <Message
          negative
          onDismiss={() => setError(false)}
          header="There was a problem with your request"
          content="This is on us, we couldn't process your request. Try to refresh the page and try again."
        />
      )}
      {chart && (
        <Segment
          style={styles.chartContainer(_isKpi(chart), print)}
        >
          <div style={styles.titleArea(_isKpi(chart))}>
            <Popup
              trigger={(
                <Button
                  icon="filter"
                  direction="left"
                  basic
                  className="circular icon"
                  style={styles.filterBtn}
                />
              )}
              on="click"
              position="top right"
              flowing
              size="tiny"
              popperModifiers={{
                preventOverflow: {
                  boundariesElement: "offsetParent"
                }
              }}
            >
              <ChartFilters
                chart={chart}
                onAddFilter={_onAddFilter}
                onClearFilter={_onClearFilter}
                conditions={conditions}
              />
            </Popup>
            {projectId && !print
              && (
                <Dropdown
                  icon="ellipsis horizontal"
                  direction="left"
                  button
                  basic
                  className="circular icon"
                  style={styles.menuBtn}
                >
                  <Dropdown.Menu>
                    <Dropdown.Item
                      icon="refresh"
                      text="Refresh chart"
                      onClick={_onGetChartData}
                    />
                    {_canAccess("editor") && (
                      <>
                        <Dropdown.Item
                          icon="clock"
                          text="Auto-update"
                          onClick={_openUpdateModal}
                        />
                        <Dropdown.Item
                          icon="pencil"
                          text="Edit"
                          as={Link}
                          to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}
                        />
                      </>
                    )}
                    {!chart.draft && (
                      <>
                        {_canAccess("editor") && (
                          <Dropdown.Item
                            onClick={_onPublicConfirmation}
                          >
                            <Icon name="world" color={chart.public ? "red" : "green"} />
                            {chart.public ? "Make private" : "Make public"}
                          </Dropdown.Item>
                        )}
                        <Dropdown.Item
                          icon="code"
                          text="Embed"
                          onClick={_onEmbed}
                        />
                      </>
                    )}
                    <Dropdown.Item
                      icon="file excel"
                      text="Export to Excel"
                      onClick={_onExport}
                    />
                    {_canAccess("editor") && (
                      <>
                        <Dropdown.Divider />
                        <Dropdown
                          item
                          icon={false}
                          trigger={(
                            <p style={{ marginBottom: 0 }}>
                              <Icon name="caret left" />
                              {" "}
                              Size
                            </p>
                          )}
                        >
                          <Dropdown.Menu>
                            <Dropdown.Item
                              text="Small"
                              icon={chart.chartSize === 1 ? "checkmark" : false}
                              onClick={() => _onChangeSize(1)}
                            />
                            <Dropdown.Item
                              text="Medium"
                              icon={chart.chartSize === 2 ? "checkmark" : false}
                              onClick={() => _onChangeSize(2)}
                            />
                            <Dropdown.Item
                              text="Large"
                              icon={chart.chartSize === 3 ? "checkmark" : false}
                              onClick={() => _onChangeSize(3)}
                            />
                            <Dropdown.Item
                              text="Full width"
                              icon={chart.chartSize === 4 ? "checkmark" : false}
                              onClick={() => _onChangeSize(4)}
                            />
                          </Dropdown.Menu>
                        </Dropdown>
                        <Dropdown
                          item
                          icon={false}
                          trigger={(
                            <p style={{ marginBottom: 0 }}>
                              <Icon name="caret left" />
                              {" "}
                              Order
                            </p>
                          )}
                        >
                          <Dropdown.Menu>
                            <Dropdown.Item
                              text="Move to top"
                              icon="angle double up"
                              disabled={_getChartIndex() === 0}
                              onClick={() => onChangeOrder(chart.id, "top")}
                            />
                            <Dropdown.Item
                              text="Move up"
                              icon="chevron up"
                              disabled={_getChartIndex() === 0}
                              onClick={() => onChangeOrder(chart.id, "up")}
                            />
                            <Dropdown.Item
                              text="Move down"
                              icon="chevron down"
                              disabled={_getChartIndex() === charts.length - 1}
                              onClick={() => onChangeOrder(chart.id, "down")}
                            />
                            <Dropdown.Item
                              text="Move to bottom"
                              icon="angle double down"
                              disabled={_getChartIndex() === charts.length - 1}
                              onClick={() => onChangeOrder(chart.id, "bottom")}
                            />
                          </Dropdown.Menu>
                        </Dropdown>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          icon="trash"
                          text="Delete"
                          onClick={_onDeleteChartConfirmation}
                        />
                      </>
                    )}
                  </Dropdown.Menu>
                </Dropdown>
              )}
            <Header style={{ display: "contents" }}>
              {chart.draft && (
                <Label color="olive" style={styles.draft}>Draft</Label>
              )}
              <span>
                {chart.public && !isPublic && !print
                    && (
                      <Popup
                        trigger={<Icon name="world" />}
                        content="This chart is public"
                        position="bottom center"
                      />
                    )}
                {_canAccess("editor") && (
                  <Link to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}>
                    <span style={{ color: blackTransparent(0.9) }}>{chart.name}</span>
                  </Link>
                )}
                {!_canAccess("editor") && (
                  <span>{chart.name}</span>
                )}
              </span>
            </Header>
            {chart.chartData && (
              <div>
                <p>
                  <small>
                    {!chartLoading && !chart.loading && (
                      <i>
                        {!print && <span title="Last updated">{`${_getUpdatedTime(chart.chartDataUpdated)}`}</span>}
                        {print && <small>{`${moment(chart.chartDataUpdated).format("LLL")}`}</small>}
                      </i>
                    )}
                    {(chartLoading || chart.loading) && (
                      <>
                        <Icon name="spinner" loading />
                        <span>{" Updating..."}</span>
                      </>
                    )}
                  </small>
                  {chart.Datasets && (
                    <Label.Group style={{ display: "inline", marginLeft: 10 }} size="small">
                      {conditions.map((c) => {
                        return (
                          <Label key={c.id} icon>
                            {c.type !== "date" && c.value}
                            {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                            <Icon name="delete" onClick={() => _onClearFilter(c)} />
                          </Label>
                        );
                      })}
                    </Label.Group>
                  )}
                </p>
              </div>
            )}
          </div>
          {chart.chartData && (
            <>
              <div style={styles.mainChartArea(_isKpi(chart))}>
                {chart.type === "line"
                  && (
                    <LineChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                    />
                  )}
                {chart.type === "bar"
                  && (
                    <BarChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                    />
                  )}
                {chart.type === "pie"
                  && (
                  <PieChart
                    chart={chart}
                    height={chart.mode === "kpi" ? height + 25 : height}
                  />
                  )}
                {chart.type === "doughnut"
                  && (
                  <div>
                    <DoughnutChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                    />
                  </div>
                  )}
                {chart.type === "radar"
                  && (
                  <RadarChart
                    chart={chart}
                    height={chart.mode === "kpi" ? height + 25 : height}
                  />
                  )}
                {chart.type === "polar"
                  && (
                  <div>
                    <PolarChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                    />
                  </div>
                  )}
                {chart.type === "table"
                  && (
                    <div>
                      <TableContainer
                        height={height - 55}
                        tabularData={chart.chartData}
                      />
                    </div>
                  )}
              </div>
            </>
          )}
        </Segment>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <TransitionablePortal open={deleteModal}>
        <Modal open={deleteModal} basic size="small" onClose={() => setDeleteModal(false)}>
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to remove this chart?"
            />
          <Modal.Content>
            <p>
              {"All the chart data will be removed and you won't be able to see it on your dashboard anymore if you proceed with the removal."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => setDeleteModal(false)}
              >
              Go back
            </Button>
            <Button
              color="orange"
              inverted
              loading={chartLoading}
              onClick={_onDeleteChart}
              >
              <Icon name="x" />
              Remove completely
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      {/* MAKE CHART PUBLIC MODAL */}
      <TransitionablePortal open={publicModal}>
        <Modal
          open={publicModal}
          basic
          size="small"
          onClose={() => setPublicModal(false)}
          >
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to make your chart public?"
            />
          <Modal.Content>
            <p>
              {"Public charts will show in your Public Dashboard page and it can be viewed by everyone that has access to your domain. Nobody other than you and your team will be able to edit or update the chart data."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => setPublicModal(false)}
              >
              Go back
            </Button>
            <Button
              color="teal"
              inverted
              loading={publicLoading}
              onClick={_onPublic}
              >
              <Icon name="checkmark" />
              Make the chart public
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      {/* AUTO-UPDATE MODAL */}
      <TransitionablePortal open={updateModal}>
        <Modal
          open={updateModal}
          size="small"
          onClose={() => setUpdateModal(false)}
          >
          <Modal.Header>
            Set up auto-update for your chart
          </Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <label>Select the desired frequency</label>
                <Dropdown
                  placeholder="Select the frequency"
                  selection
                  options={[{
                    text: "Don't auto update",
                    value: 0,
                  }, {
                    text: "Every minute",
                    value: 60,
                  }, {
                    text: "Every 5 minutes",
                    value: 300,
                  }, {
                    text: "Every 15 minutes",
                    value: 900,
                  }, {
                    text: "Every 30 minutes",
                    value: 1800,
                  }, {
                    text: "Every hour",
                    value: 3600,
                  }, {
                    text: "Every 3 hours",
                    value: 10800,
                  }, {
                    text: "Every day",
                    value: 86400,
                  }, {
                    text: "Every week",
                    value: 604800,
                  }, {
                    text: "Every month",
                    value: 2592000,
                  }]}
                  value={updateFrequency || 0}
                  onChange={(e, data) => setUpdateFrequency(data.value)}
                  />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => setUpdateModal(false)}
              >
              Cancel
            </Button>
            <Button
              primary
              loading={autoUpdateLoading}
              onClick={_onChangeAutoUpdate}
              >
              <Icon name="checkmark" />
              Save
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      {/* EMBED CHART MODAL */}
      {chart && (
        <TransitionablePortal open={embedModal}>
          <Modal
            open={embedModal}
            onClose={() => setEmbedModal(false)}
              >
            <Modal.Header>
              <Icon name="code" />
              {" Embed your chart on other websites"}
            </Modal.Header>
            <Modal.Content>
              <Form>
                <Form.Field>
                  <label>
                    {"Copy the following code on the website you wish to add your chart in."}
                  </label>
                  <TextArea
                    id="iframe-text"
                    value={`<iframe src="${SITE_HOST}/chart/${chart.id}/embedded" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0"></iframe>`}
                  />
                </Form.Field>
                <Form.Field>
                  <Button
                    primary={!iframeCopied}
                    positive={iframeCopied}
                    basic
                    icon
                    labelPosition="right"
                    onClick={_onCopyIframe}
                  >
                    {!iframeCopied && <Icon name="clipboard" />}
                    {iframeCopied && <Icon name="checkmark" />}
                    {!iframeCopied && "Copy iframe"}
                    {iframeCopied && "Copied to your clipboard"}
                  </Button>
                </Form.Field>
              </Form>

              <Divider />
              <Form>
                <Form.Field>
                  <label>{"Or get just the URL"}</label>
                  <Input value={`${SITE_HOST}/chart/${chart.id}/embedded`} id="url-text" />
                </Form.Field>
                <Form.Field>
                  <Button
                    primary={!urlCopied}
                    positive={urlCopied}
                    basic
                    icon
                    labelPosition="right"
                    onClick={_onCopyUrl}
                  >
                    {!urlCopied && <Icon name="clipboard" />}
                    {urlCopied && <Icon name="checkmark" />}
                    {!urlCopied && "Copy URL"}
                    {urlCopied && "Copied to your clipboard"}
                  </Button>
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              {chart.public && (
              <Button
                onClick={() => setEmbedModal(false)}
              >
                Done
              </Button>
              )}
              {!chart.public && (
              <Button
                onClick={() => setEmbedModal(false)}
              >
                Cancel
              </Button>
              )}
              {!chart.public && (
              <Button
                primary
                onClick={() => {
                  _onPublic();
                  setEmbedModal(false);
                }}
              >
                Make public
              </Button>
              )}
            </Modal.Actions>
          </Modal>
        </TransitionablePortal>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  draft: {
    marginRight: 10,
  },
  chartContainer: (noPadding, print) => ({
    borderRadius: 6,
    boxShadow: print ? "none" : "0 2px 5px 0 rgba(51, 51, 79, .07)",
    border: print ? "solid 1px rgba(34,36,38,.15)" : "none",
    padding: noPadding ? 0 : 15,
  }),
  mainChartArea: (noPadding) => ({
    paddingTop: 10,
    paddingBottom: noPadding ? 0 : 10,
  }),
  menuBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  filterBtn: {
    position: "absolute",
    right: 40,
    top: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  titleArea: (isKpi) => ({
    paddingLeft: isKpi ? 15 : 0,
    paddingTop: isKpi ? 15 : 0,
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
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Chart));
