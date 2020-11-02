import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Card, Icon, Header, Grid, Segment, Dimmer, Loader, Modal, Button,
  Dropdown, Message, Popup, Form, TextArea, Label,
} from "semantic-ui-react";
import {
  Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import moment from "moment";
import "chart.piecelabel.js";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import LineChart from "./components/LineChart";
import {
  removeChart, runQuery, updateChart, changeOrder
} from "../../actions/chart";
import canAccess from "../../config/canAccess";
import { SITE_HOST } from "../../config/settings";
import BarChart from "./components/BarChart";

/*
  This is the container that generates the Charts together with the menu
*/
function Chart(props) {
  const {
    updateChart, match, changeOrder, runQuery, removeChart, refreshRequested,
    team, user, charts, isPublic, connections, showDrafts, onCompleteRefresh,
  } = props;

  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);
  const [publicModal, setPublicModal] = useState(false);
  const [embedModal, setEmbedModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateFrequency, setUpdateFrequency] = useState(false);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (refreshRequested) {
      _onRefreshAll();
    }
  }, [refreshRequested]);

  const _onRefreshAll = () => {
    const refreshPromises = [];
    for (let i = 0; i < charts.length; i++) {
      refreshPromises.push(
        runQuery(match.params.projectId, charts[i].id)
          .then(() => {
            chartLoading(false);
          })
          .catch((error) => {
            if (error === 413) {
              setChartLoading(false);
            } else {
              setChartLoading(false);
            }
          })
      );
    }

    return Promise.all(refreshPromises)
      .then(() => {
        onCompleteRefresh();
      })
      .catch(() => {
        onCompleteRefresh();
      });
  };

  const _onChangeSize = (chartId, size) => {
    setChartLoading(chartId);
    updateChart(
      match.params.projectId,
      chartId,
      { chartSize: size }
    )
      .then(() => {
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
      });
  };

  const _onChangeOrder = (chartId, otherId) => {
    setChartLoading(chartId);
    changeOrder(
      match.params.projectId,
      chartId,
      otherId
    )
      .then(() => {
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
      });
  };

  const _onGetChartData = (chartId) => {
    setChartLoading(chartId);
    runQuery(match.params.projectId, chartId)
      .then(() => {
        setChartLoading(false);
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

  const _onDeleteChartConfirmation = (chartId) => {
    setDeleteModal(chartId);
  };

  const _onDeleteChart = () => {
    setChartLoading(deleteModal);
    removeChart(match.params.projectId, deleteModal)
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

  const _onPublicConfirmation = (chart) => {
    if (chart.public) {
      setSelectedChart(chart);
      setTimeout(() => {
        _onPublic(chart);
      }, 100);
    } else {
      setPublicModal(true);
      setSelectedChart(chart);
    }
  };

  const _onPublic = (chart) => {
    const publicChart = selectedChart || chart;
    setSelectedChart(publicChart);
    setPublicModal(false);
    setPublicLoading(true);

    updateChart(
      match.params.projectId,
      publicChart.id,
      { public: !publicChart.public }
    )
      .then(() => {
        setChartLoading(false);
        setSelectedChart(false);
        setPublicLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setSelectedChart(false);
        setError(true);
        setPublicLoading(false);
      });
  };

  const _onEmbed = (chart) => {
    setSelectedChart(chart);
    setEmbedModal(true);
  };

  const _exportPDF = (chart) => {
    const input = document.getElementById("export_as_pdf");
    html2canvas(input)
      .then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("landscape");
        pdf.text(20, 20, `Chart Name: ${chart.name}`);
        pdf.addImage(imgData, "JPEG", 15, 40);
        pdf.save(`chart-${chart.name}.pdf`);
      });
  };

  const _openUpdateModal = (chart) => {
    setUpdateModal(true);
    setSelectedChart(chart);
    setUpdateFrequency(chart.autoUpdate);
  };

  const _onChangeAutoUpdate = () => {
    setAutoUpdateLoading(true);

    updateChart(
      match.params.projectId,
      selectedChart.id,
      { autoUpdate: updateFrequency }
    )
      .then(() => {
        setAutoUpdateLoading(false);
        setUpdateModal(false);
        setSelectedChart(false);
      })
      .catch(() => {
        setAutoUpdateLoading(false);
        setError(true);
        setUpdateModal(false);
        setSelectedChart(false);
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _isKpi = (chart) => {
    return chart.mode === "kpi";
  };

  const _activateMenu = (chartId) => setMenuVisible(chartId);
  const _deactivateMenu = () => setMenuVisible(false);

  const { projectId } = match.params;

  return (
    <div style={styles.container}>
      {error
          && (
          <Message
            negative
            onDismiss={() => setError(false)}
            header="There was a problem with your request"
            content="This is on us, we couldn't process your request. Try to refresh the page and try again."
          />
          )}
      {charts.length < 1
          && (
          <Grid centered style={styles.addCard}>
            <Card
              raised
              as={Link}
              to={`/${match.params.teamId}/${match.params.projectId}/chart`}
              color="olive"
            >
              <Header as="h2" textAlign="center" icon>
                <Icon name="plus" color="blue" />
                Add your first chart
              </Header>
            </Card>
          </Grid>
          )}

      <Grid stackable centered style={styles.mainGrid}>
        {connections && charts.map((chart, index) => {
          if (isPublic && !chart.public) return (<span style={{ display: "none" }} key={chart.id} />);
          if (isPublic && chart.draft) return (<span style={{ display: "none" }} key={chart.id} />);
          if (chart.draft && !showDrafts) return (<span style={{ display: "none" }} key={chart.id} />);
            if (!chart.id) return (<span style={{ display: "none" }} key={`no_id_${index}`} />); // eslint-disable-line

          // get connection
          let connection;
          for (let i = 0; i < connections.length; i++) {
            if (connections[i].id === chart.connection_id) {
              connection = connections[i];
            }
          }

          return (
            <Grid.Column width={chart.chartSize * 4} key={chart.id} style={styles.chartGrid}>
              <Segment
                style={styles.chartContainer(_isKpi(chart))}
                onMouseEnter={() => _activateMenu(chart.id)}
                onMouseLeave={() => _deactivateMenu()}
              >
                <div style={styles.titleArea(_isKpi(chart))}>
                  {_canAccess("editor") && projectId
                      && (
                        <Dropdown
                          icon={menuVisible === chart.id ? "ellipsis horizontal" : ""}
                          direction="left"
                          button
                          basic
                          className="circular icon"
                          style={styles.menuBtn(menuVisible === chart.id)}
                        >
                          <Dropdown.Menu>
                            <Dropdown.Item
                              icon="refresh"
                              text="Refresh data"
                              onClick={() => _onGetChartData(chart.id)}
                            />
                            <Dropdown.Item
                              icon="clock"
                              text="Auto-update"
                              onClick={() => _openUpdateModal(chart)}
                            />
                            <Dropdown.Item
                              icon="pencil"
                              text="Edit"
                              as={Link}
                              to={`/${match.params.teamId}/${match.params.projectId}/chart/${chart.id}/edit`}
                            />
                            {!chart.draft && (
                              <>
                                <Dropdown.Item
                                  onClick={() => _onPublicConfirmation(chart)}
                                >
                                  <Icon name="world" color={chart.public ? "red" : "green"} />
                                  {chart.public ? "Make private" : "Make public"}
                                </Dropdown.Item>
                                <Dropdown.Item
                                  icon="code"
                                  text="Embed"
                                  onClick={() => _onEmbed(chart)}
                                />
                                <Dropdown.Item
                                  icon="download"
                                  text="Export as PDF"
                                  onClick={() => _exportPDF(chart)}
                                />
                              </>
                            )}
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
                                  onClick={() => _onChangeSize(chart.id, 1)}
                                />
                                <Dropdown.Item
                                  text="Medium"
                                  icon={chart.chartSize === 2 ? "checkmark" : false}
                                  onClick={() => _onChangeSize(chart.id, 2)}
                                />
                                <Dropdown.Item
                                  text="Large"
                                  icon={chart.chartSize === 3 ? "checkmark" : false}
                                  onClick={() => _onChangeSize(chart.id, 3)}
                                />
                                <Dropdown.Item
                                  text="Full width"
                                  icon={chart.chartSize === 4 ? "checkmark" : false}
                                  onClick={() => _onChangeSize(chart.id, 4)}
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
                                  disabled={index === 0}
                                  onClick={() => _onChangeOrder(chart.id, "top")}
                                />
                                <Dropdown.Item
                                  text="Move up"
                                  icon="chevron up"
                                  disabled={index === 0}
                                  onClick={() => _onChangeOrder(chart.id, charts[index - 1].id)}
                                />
                                <Dropdown.Item
                                  text="Move down"
                                  icon="chevron down"
                                  disabled={index === charts.length - 1}
                                  onClick={() => _onChangeOrder(chart.id, charts[index + 1].id)}
                                />
                                <Dropdown.Item
                                  text="Move to bottom"
                                  icon="angle double down"
                                  disabled={index === charts.length - 1}
                                  onClick={() => {
                                    _onChangeOrder(chart.id, "bottom");
                                  }}
                                />
                              </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown.Divider />
                            <Dropdown.Item
                              icon="trash"
                              text="Delete"
                              onClick={() => _onDeleteChartConfirmation(chart.id)}
                            />
                          </Dropdown.Menu>
                        </Dropdown>
                      )}
                  <Header style={{ display: "contents" }}>
                    {chart.draft && (
                      <Label color="olive" style={styles.draft}>Draft</Label>
                    )}
                    <span>
                      {chart.public && !isPublic
                          && (
                            <Popup
                              trigger={<Icon name="world" />}
                              content="This chart is public"
                              position="bottom center"
                            />
                          )}
                      {chart.name}
                    </span>
                    {connection && _canAccess("editor") && projectId
                        && (
                          <Popup
                            trigger={(
                              <Header.Subheader>
                                {connection.name}
                                <Icon
                                  name={connection.active ? "plug" : "pause"}
                                  color={connection.active ? "green" : "orange"}
                                />
                              </Header.Subheader>
                            )}
                            content={connection.active ? "Connection active" : "Connection not active"}
                            position="bottom left"
                          />
                        )}
                  </Header>
                  {chart.chartData && (
                    <div>
                      <p><small><i>{`Last Updated ${moment(chart.chartDataUpdated).calendar()}`}</i></small></p>
                    </div>
                  )}
                </div>
                {chart.chartData && (
                  <>
                    <Dimmer inverted active={chartLoading === chart.id}>
                      <Loader inverted />
                    </Dimmer>
                    <div id="export_as_pdf" style={styles.mainChartArea(_isKpi(chart))}>
                      {chart.type === "line"
                        && (
                          <LineChart chart={chart} />
                        )}
                      {chart.type === "bar"
                        && (
                          <BarChart chart={chart} />
                        )}
                      {chart.type === "pie"
                        && (
                        <Pie
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
                        )}
                      {chart.type === "doughnut"
                        && (
                        <Doughnut
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
                        )}
                      {chart.type === "radar"
                        && (
                        <Radar
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
                        )}
                      {chart.type === "polar"
                        && (
                        <Polar
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
                        )}
                    </div>
                  </>
                )}
              </Segment>
            </Grid.Column>
          );
        })}
      </Grid>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal open={!!deleteModal} basic size="small" onClose={() => setDeleteModal(false)}>
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
            loading={!!chartLoading}
            onClick={_onDeleteChart}
            >
            <Icon name="x" />
            Remove completely
          </Button>
        </Modal.Actions>
      </Modal>

      {/* MAKE CHART PUBLIC MODAL */}
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

      {/* AUTO-UPDATE MODAL */}
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

      {/* EMBED CHART MODAL */}
      {selectedChart && (
      <Modal
        open={embedModal}
        basic
        size="small"
        onClose={() => setEmbedModal(false)}
          >
        <Header
          icon="code"
          content="Embed your chart on other websites"
            />
        <Modal.Content>
          <p>
            {"Copy the following code on the website you wish to add your chart in."}
          </p>
          <p>
            {"You can customize the iframe in any way you wish, but leave the 'src' attribute the way it is below."}
          </p>
          <Form>
            <TextArea
              value={`<iframe src="${SITE_HOST}/chart/${selectedChart.id}/embedded" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0"></iframe>`}
                />
          </Form>
        </Modal.Content>
        <Modal.Actions>
          {selectedChart.public && (
          <Button
            basic
            inverted
            onClick={() => setEmbedModal(false)}
                >
            Done
          </Button>
          )}
          {!selectedChart.public && (
          <Button
            basic
            inverted
            onClick={() => setEmbedModal(false)}
                >
            Cancel
          </Button>
          )}
          {!selectedChart.public && (
          <Button
            color="teal"
            inverted
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
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  addCard: {
    paddingTop: 50,
  },
  draft: {
    marginRight: 10,
  },
  chartContainer: (noPadding) => ({
    borderRadius: 6,
    boxShadow: "0 2px 5px 0 rgba(51, 51, 79, .07)",
    border: "none",
    padding: noPadding ? 0 : 15,
  }),
  mainChartArea: (noPadding) => ({
    paddingTop: 10,
    paddingBottom: noPadding ? 0 : 10,
  }),
  menuBtn: (hovered) => ({
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: !hovered && "transparent",
    boxShadow: !hovered && "none",
  }),
  titleArea: (isKpi) => ({
    paddingLeft: isKpi ? 15 : 0,
    paddingTop: isKpi ? 15 : 0,
  }),
  chartGrid: {
    padding: 10,
  },
  mainGrid: {
    padding: 10,
  },
};

Chart.defaultProps = {
  isPublic: false,
  showDrafts: true,
  refreshRequested: false,
  onCompleteRefresh: () => {},
};

Chart.propTypes = {
  charts: PropTypes.array.isRequired,
  connections: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  removeChart: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  updateChart: PropTypes.func.isRequired,
  changeOrder: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  showDrafts: PropTypes.bool,
  refreshRequested: PropTypes.bool,
  onCompleteRefresh: PropTypes.func,
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
    removeChart: (projectId, chartId) => dispatch(removeChart(projectId, chartId)),
    runQuery: (projectId, chartId) => dispatch(runQuery(projectId, chartId)),
    updateChart: (projectId, chartId, data) => dispatch(updateChart(projectId, chartId, data)),
    changeOrder: (projectId, chartId, otherId) => (
      dispatch(changeOrder(projectId, chartId, otherId))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Chart));
