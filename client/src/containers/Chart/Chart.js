import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Icon, Header, Segment, Modal, Button, TransitionablePortal,
  Dropdown, Message, Popup, Form, TextArea, Label, Input, Divider, Checkbox, Placeholder,
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
          className="chart-card"
        >
          <div style={styles.titleArea(_isKpi(chart))}>
            {_checkIfFilters() && (
              <Popup
                trigger={(
                  <Button
                    icon="filter"
                    direction="left"
                    basic
                    className="circular icon"
                    style={styles.filterBtn(projectId && !print)}
                  />
                )}
                on="click"
                position="bottom right"
                flowing
                size="tiny"
              >
                <ChartFilters
                  chart={chart}
                  onAddFilter={_onAddFilter}
                  onClearFilter={_onClearFilter}
                  conditions={conditions}
                />
              </Popup>
            )}
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
                    <Dropdown.Item
                      icon="file excel"
                      text="Export to Excel"
                      onClick={_onExport}
                    />
                    <Dropdown.Divider />
                    {!chart.draft && (
                      <>
                        {_canAccess("editor") && (
                          <Dropdown.Item
                            onClick={_onChangeReport}
                          >
                            <Icon name="desktop" />
                            {chart.onReport ? "Remove from report" : "Add to report"}
                          </Dropdown.Item>
                        )}
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
                    {_canAccess("editor") && (
                      <>
                        <Dropdown.Divider />
                        <Dropdown
                          item
                          icon={false}
                          trigger={(
                            <p style={{ marginBottom: 0 }}>
                              <Icon name="caret down" />
                              {" "}
                              Size
                            </p>
                          )}
                        >
                          <Dropdown.Menu direction="left">
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
                              <Icon name="caret down" />
                              {" "}
                              Order
                            </p>
                          )}
                        >
                          <Dropdown.Menu direction="left">
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
                    {" "}
                    <span>
                      {chart.public && !isPublic && !print
                        && (
                          <Popup
                            trigger={<Icon name="world" />}
                            content="This chart is public"
                            position="bottom center"
                            inverted
                          />
                        )}
                      {chart.onReport && !isPublic && !print && (
                        <Popup
                          trigger={<Icon name="desktop" />}
                          content="This chart is on the report"
                          position="bottom center"
                          inverted
                        />
                      )}
                    </span>
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
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "bar"
                  && (
                    <BarChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "pie"
                  && (
                  <PieChart
                    chart={chart}
                    height={chart.mode === "kpi" ? height + 25 : height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "doughnut"
                  && (
                  <div>
                    <DoughnutChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  </div>
                  )}
                {chart.type === "radar"
                  && (
                  <RadarChart
                    chart={chart}
                    height={chart.mode === "kpi" ? height + 25 : height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "polar"
                  && (
                  <div>
                    <PolarChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
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
                {chart.type === "avg"
                  && (
                    <LineChart
                      chart={chart}
                      height={chart.mode === "kpi" ? height + 25 : height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
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
              {"Public charts will show in your Public Dashboard page and it can be viewed by everyone that access to the unique sharing link. Nobody other than you and your team will be able to edit or update the chart data."}
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
              primary
              inverted
              loading={publicLoading}
              onClick={_onPublic}
              >
              <Icon name="globe" />
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
                  <Checkbox
                    toggle
                    label={chart.shareable ? "Disable sharing" : "Enable sharing"}
                    onChange={_onToggleShareable}
                    checked={chart.shareable}
                    disabled={!_canAccess("editor")}
                    loading
                  />
                </Form.Field>
              </Form>
              {chart.public && !chart.shareable && (
                <Message
                  info
                  icon="globe"
                  header="The chart is public"
                  content="A public chart can be shared even if the sharing toggle is disabled. This gives you more flexibility if you want to hide the chart from the public dashboard but you still want to individually share it."
                  size="small"
                />
              )}
              {!chart.public && !chart.shareable && (
                <Message
                  icon
                  size="small"
                >
                  <Icon name="lock" />
                  <Message.Content>
                    <Message.Header>
                      {"The chart is private"}
                    </Message.Header>
                    <p>{"A private chart can only be seen by members of the team. If you enable sharing, others outside of your team can see the chart and you can also embed it on other websites."}</p>
                    {!_canAccess("editor") && (
                      <p><i>{"You do not have the permission to enable sharing on this chart. Only editors and admins can enable this."}</i></p>
                    )}
                  </Message.Content>
                </Message>
              )}
              {(chart.public || chart.shareable)
              && (!chart.Chartshares || chart.Chartshares.length === 0)
              && (
                <Button
                  icon="plus"
                  content="Create a sharing code"
                  primary
                  onClick={_onCreateSharingString}
                />
              )}

              {shareLoading && (
                <Placeholder>
                  <Placeholder.Line />
                  <Placeholder.Line />
                  <Placeholder.Line />
                  <Placeholder.Line />
                  <Placeholder.Line />
                </Placeholder>
              )}

              {(chart.shareable || chart.public)
              && !chartLoading
              && (chart.Chartshares && chart.Chartshares.length > 0)
              && (
                <>
                  <Divider />
                  <Form>
                    <Form.Field>
                      <label>
                        {"Copy the following code on the website you wish to add your chart in."}
                      </label>
                      <TextArea
                        id="iframe-text"
                        value={_getEmbedString()}
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
                        {!iframeCopied && "Copy the code"}
                        {iframeCopied && "Copied to your clipboard"}
                      </Button>
                    </Form.Field>
                  </Form>

                  <Divider />
                  <Form>
                    <Form.Field>
                      <label>{"Or get just the URL"}</label>
                      <Input value={_getEmbedUrl()} id="url-text" />
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
                </>
              )}
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => setEmbedModal(false)}
              >
                Close
              </Button>
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
    minHeight: 350,
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
  filterBtn: (addPadding) => ({
    position: "absolute",
    right: addPadding ? 40 : 10,
    top: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  }),
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
