import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import {
  Card, Icon, Header, Grid, Segment, Dimmer, Loader, Modal, Button,
  Dropdown, Message, Popup, Form, TextArea, Label,
} from "semantic-ui-react";
import {
  Line, Bar, Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import moment from "moment";
import "chart.piecelabel.js";

import {
  removeChart, runQuery, updateChart, changeOrder
} from "../actions/chart";
import canAccess from "../config/canAccess";
import { SITE_HOST } from "../config/settings";

/*
  This is the container that generates the Charts together with the menu
*/
class Chart extends Component {
  constructor(props) {
    super(props);

    this.state = {
      chartLoading: false,
    };
  }

  _onChangeSize = (chartId, size) => {
    const { updateChart, match } = this.props;
    this.setState({ chartLoading: chartId });
    updateChart(
      match.params.projectId,
      chartId,
      { chartSize: size }
    )
      .then(() => {
        this.setState({ chartLoading: false });
      })
      .catch(() => {
        this.setState({ chartLoading: false, error: true });
      });
  }

  _onChangeOrder = (chartId, otherId) => {
    const { match, changeOrder } = this.props;
    this.setState({ chartLoading: chartId });
    changeOrder(
      match.params.projectId,
      chartId,
      otherId
    )
      .then(() => {
        this.setState({ chartLoading: false });
      })
      .catch(() => {
        this.setState({ chartLoading: false, error: true });
      });
  }

  _onGetChartData = (chartId) => {
    const { runQuery, match } = this.props;
    this.setState({ chartLoading: chartId });
    runQuery(match.params.projectId, chartId)
      .then(() => {
        this.setState({ chartLoading: false });
      })
      .catch((error) => {
        if (error === 413) {
          this.setState({ chartLoading: false });
        } else {
          this.setState({ chartLoading: false, error: true });
        }
      });
  }

  _onDeleteChartConfirmation = (chartId) => {
    this.setState({ deleteModal: chartId });
  }

  _onDeleteChart = () => {
    const { removeChart, match } = this.props;
    const { deleteModal } = this.state;

    this.setState({ chartLoading: deleteModal });
    removeChart(match.params.projectId, deleteModal)
      .then(() => {
        this.setState({ chartLoading: false, deleteModal: false });
      })
      .catch(() => {
        this.setState({ chartLoading: false, error: true, deleteModal: false });
      });
  }

  _onPublicConfirmation = (chart) => {
    if (chart.public) {
      this.setState({ selectedChart: chart }, () => {
        this._onPublic();
      });
    } else {
      this.setState({ publicModal: true, selectedChart: chart });
    }
  }

  _onPublic = () => {
    const { updateChart, match } = this.props;
    const { selectedChart } = this.state;

    this.setState({ chartLoading: selectedChart, publicModal: false });
    updateChart(
      match.params.projectId,
      selectedChart.id,
      { public: !selectedChart.public }
    )
      .then(() => {
        this.setState({ chartLoading: false, selectedChart: false });
      })
      .catch(() => {
        this.setState({ chartLoading: false, error: true, selectedChart: false });
      });
  }

  _onEmbed = (chart) => {
    this.setState({ selectedChart: chart, embedModal: true });
  }

  _openUpdateModal = (chart) => {
    this.setState({ updateModal: true, selectedChart: chart, updateFrequency: chart.autoUpdate });
  }

  _onChangeAutoUpdate = () => {
    const { updateChart, match } = this.props;
    const { selectedChart, updateFrequency } = this.state;
    this.setState({ autoUpdateLoading: true });

    updateChart(
      match.params.projectId,
      selectedChart.id,
      { autoUpdate: updateFrequency }
    )
      .then(() => {
        this.setState({ autoUpdateLoading: false, updateModal: false, selectedChart: false });
      })
      .catch(() => {
        this.setState({ autoUpdateLoading: false, error: true, selectedChart: false });
      });
  }

  _getUserRole = () => {
    const { team, user } = this.props;
    if (!team.TeamRoles) return "guest";

    let teamRole = "guest";
    for (let i = 0; i < team.TeamRoles.length; i++) {
      if (team.TeamRoles[i].user_id === user.id) {
        teamRole = team.TeamRoles[i].role;
        break;
      }
    }

    return teamRole;
  }

  _canAccess = (role) => {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  render() {
    const {
      charts, isPublic, match, connections, showDrafts,
    } = this.props;
    const { projectId } = match.params;
    const {
      error, chartLoading, deleteModal, publicModal, publicLoading, embedModal,
      updateModal, updateFrequency, autoUpdateLoading, selectedChart,
    } = this.state;

    return (
      <div style={styles.container}>
        {error
          && (
          <Message
            negative
            onDismiss={() => this.setState({ error: false })}
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

        <Grid stackable centered>
          {connections && charts.map((chart, index) => {
            if (isPublic && !chart.public) return (<span key={chart.id} />);
            if (isPublic && chart.draft) return (<span key={chart.id} />);
            if (chart.draft && !showDrafts) return (<span key={chart.id} />);

            // get connection
            let connection;
            for (let i = 0; i < connections.length; i++) {
              if (connections[i].id === chart.connection_id) {
                connection = connections[i];
              }
            }

            return (
              <Grid.Column width={chart.chartSize * 4} key={chart.id}>
                <Segment attached="top" clearing>
                  {chart.draft && (
                    <Label color="olive" size="large" style={styles.draft}>Draft</Label>
                  )}
                  {this._canAccess("editor") && projectId
                    && (
                    <Dropdown icon="ellipsis vertical" direction="left" button className="icon" style={{ float: "right" }}>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          icon="refresh"
                          text="Refresh data"
                          onClick={() => this._onGetChartData(chart.id)}
                        />
                        <Dropdown.Item
                          icon="clock"
                          text="Auto-update"
                          onClick={() => this._openUpdateModal(chart)}
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
                              onClick={() => this._onPublicConfirmation(chart)}
                            >
                              <Icon name="world" color={chart.public ? "red" : "green"} />
                              {chart.public ? "Make private" : "Make public"}
                            </Dropdown.Item>
                            <Dropdown.Item
                              icon="code"
                              text="Embed"
                              onClick={() => this._onEmbed(chart)}
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
                              onClick={() => this._onChangeSize(chart.id, 1)}
                            />
                            <Dropdown.Item
                              text="Medium"
                              icon={chart.chartSize === 2 ? "checkmark" : false}
                              onClick={() => this._onChangeSize(chart.id, 2)}
                            />
                            <Dropdown.Item
                              text="Large"
                              icon={chart.chartSize === 3 ? "checkmark" : false}
                              onClick={() => this._onChangeSize(chart.id, 3)}
                            />
                            <Dropdown.Item
                              text="Full width"
                              icon={chart.chartSize === 4 ? "checkmark" : false}
                              onClick={() => this._onChangeSize(chart.id, 4)}
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
                              text="Move up"
                              icon="arrow up"
                              disabled={index === 0}
                              onClick={() => this._onChangeOrder(chart.id, charts[index - 1].id)}
                            />
                            <Dropdown.Item
                              text="Move down"
                              icon="arrow down"
                              disabled={index === charts.length - 1}
                              onClick={() => this._onChangeOrder(chart.id, charts[index + 1].id)}
                            />
                          </Dropdown.Menu>
                        </Dropdown>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          icon="trash"
                          text="Delete"
                          onClick={() => this._onDeleteChartConfirmation(chart.id)}
                        />
                      </Dropdown.Menu>
                    </Dropdown>
                    )}
                  <Header style={{ display: "contents" }}>
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
                    {connection && this._canAccess("editor") && projectId
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
                </Segment>
                {chart.chartData
                  && (
                  <Segment attached>
                    <Dimmer inverted active={chartLoading === chart.id}>
                      <Loader inverted />
                    </Dimmer>
                    <div style={{ maxHeight: "30em" }}>
                      {chart.type === "line"
                        && (
                        <Line
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
                        )}
                      {chart.type === "bar"
                        && (
                        <Bar
                          data={chart.chartData.data}
                          options={chart.chartData.options}
                          height={300}
                        />
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
                    <p><small><i>{`Last Updated ${moment(chart.chartDataUpdated).calendar()}`}</i></small></p>
                  </Segment>
                  )}
              </Grid.Column>
            );
          })}
        </Grid>

        {/* DELETE CONFIRMATION MODAL */}
        <Modal open={!!deleteModal} basic size="small" onClose={() => this.setState({ deleteModal: false })}>
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
              onClick={() => this.setState({ deleteModal: false })}
            >
              Go back
            </Button>
            <Button
              color="orange"
              inverted
              loading={!!chartLoading}
              onClick={this._onDeleteChart}
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
          onClose={() => this.setState({ publicModal: false })}
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
              onClick={() => this.setState({ publicModal: false })}
            >
              Go back
            </Button>
            <Button
              color="teal"
              inverted
              loading={publicLoading}
              onClick={this._onPublic}
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
          onClose={() => this.setState({ updateModal: false })}
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
                  onChange={(e, data) => this.setState({ updateFrequency: data.value })}
                />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => this.setState({ updateModal: false })}
            >
              Cancel
            </Button>
            <Button
              primary
              loading={autoUpdateLoading}
              onClick={this._onChangeAutoUpdate}
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
            onClose={() => this.setState({ embedModal: false })}
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
                  onClick={() => this.setState({ embedModal: false })}
                >
                  Done
                </Button>
              )}
              {!selectedChart.public && (
                <Button
                  basic
                  inverted
                  onClick={() => this.setState({ embedModal: false })}
                >
                  Cancel
                </Button>
              )}
              {!selectedChart.public && (
                <Button
                  color="teal"
                  inverted
                  onClick={() => {
                    this._onPublic();
                    this.setState({ embedModal: false });
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
};

Chart.defaultProps = {
  isPublic: false,
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
  showDrafts: PropTypes.bool.isRequired,
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
