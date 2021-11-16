import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Icon, Button, Container, Header, Divider, Menu,
  Label, TransitionablePortal, Modal, Grid, Card, Popup, Checkbox,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useLocalStorage, useWindowSize } from "react-use";
import _ from "lodash";
import { createMedia } from "@artsy/fresnel";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";

import Chart from "../Chart/Chart";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import Filters from "./components/Filters";
import { operators } from "../../modules/filterOperations";
import {
  getProjectCharts as getProjectChartsAction,
  runQueryWithFilters as runQueryWithFiltersAction,
  runQuery as runQueryAction,
  changeOrder as changeOrderAction,
  exportChart,
  updateChart as updateChartAction,
} from "../../actions/chart";
import canAccess from "../../config/canAccess";
import ChartExport from "./components/ChartExport";
import CreateTemplateForm from "../../components/CreateTemplateForm";
import { whiteTransparent } from "../../config/colors";

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const { Media } = AppMedia;

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
function ProjectDashboard(props) {
  const {
    cleanErrors, connections, charts, match, showDrafts, runQueryWithFilters,
    getProjectCharts, runQuery, changeOrder, user, team, onPrint, mobile, updateChart,
  } = props;

  const [filters, setFilters] = useState(getFiltersFromStorage());
  const [autoRefresh, setAutoRefresh] = useLocalStorage("_cb_auto_refresh", []);
  const [autoRefreshed, setAutoRefreshed] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [viewExport, setViewExport] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);

  const { height } = useWindowSize();

  useEffect(() => {
    cleanErrors();
    setTimeout(() => {
      setAutoRefreshed(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (!autoRefreshed && _.indexOf(autoRefresh, match.params.projectId) > -1) {
      _onRefreshData();
    }
  }, [autoRefreshed]);

  useEffect(() => {
    if (!filterLoading) {
      _runFiltering();
    }
  }, [filters]);

  const _onAddFilter = (filter) => {
    const { projectId } = match.params;

    const newFilters = _.clone(filters) || {};
    if (!newFilters[projectId]) newFilters[projectId] = [];
    newFilters[projectId].push(filter);
    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
    setShowFilters(false);
  };

  const _onRemoveFilter = (filterId) => {
    const { projectId } = match.params;
    if (filters && filters[projectId].length === 1) {
      const newFilters = _.cloneDeep(filters);
      delete newFilters[projectId];
      setFilters(newFilters);
      window.localStorage.removeItem("_cb_filters");
      _runFiltering({});
      return;
    }

    const index = _.findIndex(filters[projectId], { id: filterId });
    if (!index && index !== 0) return;

    const newFilters = _.cloneDeep(filters);
    newFilters[projectId].splice(index, 1);

    setFilters(newFilters);
    window.localStorage.setItem("_cb_filters", JSON.stringify(newFilters));
  };

  const _runFiltering = (currentFilters = filters) => {
    setFilterLoading(true);
    setTimeout(() => {
      _onFilterCharts(currentFilters);
    }, 500);
  };

  const _onFilterCharts = (currentFilters = filters) => {
    const { projectId } = match.params;

    if (!currentFilters || !currentFilters[projectId]) {
      getProjectCharts(projectId);
      setFilterLoading(false);
      return Promise.resolve("done");
    }

    const refreshPromises = [];
    for (let i = 0; i < charts.length; i++) {
      if (currentFilters && currentFilters[projectId]) {
        setFilterLoading(true);
        // first, discard the charts on which the filters don't apply
        if (_chartHasFilter(charts[i])) {
          refreshPromises.push(
            runQueryWithFilters(projectId, charts[i].id, currentFilters[projectId])
          );
        }
      }
    }

    return Promise.all(refreshPromises)
      .then(() => {
        setFilterLoading(false);
      })
      .catch(() => {
        setFilterLoading(false);
      });
  };

  const _onRefreshData = () => {
    const { projectId } = match.params;

    setRefreshLoading(true);
    const refreshPromises = [];
    for (let i = 0; i < charts.length; i++) {
      refreshPromises.push(
        runQuery(projectId, charts[i].id)
      );
    }

    return Promise.all(refreshPromises)
      .then(() => {
        if (filters && filters[projectId]) {
          _onFilterCharts();
        }
        setRefreshLoading(false);
      })
      .catch(() => {
        setRefreshLoading(false);
      });
  };

  const _chartHasFilter = (chart) => {
    let found = false;
    if (chart.Datasets) {
      chart.Datasets.map((dataset) => {
        if (dataset.fieldsSchema) {
          Object.keys(dataset.fieldsSchema).forEach((key) => {
            if (_.find(filters[match.params.projectId], (o) => o.field === key)) {
              found = true;
            }
          });
        }
        return dataset;
      });
    }

    return found;
  };

  const _getOperator = (operator) => {
    const found = _.find(operators, (o) => o.value === operator);
    return (found && found.key) || "";
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
    changeOrder(
      match.params.projectId,
      chartId,
      otherId
    );
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _openExport = () => {
    setViewExport(true);
  };

  const _onExport = (ids) => {
    setExportLoading(true);
    setExportError(false);
    const appliedFilters = (filters && filters[match.params.projectId]) || null;
    return exportChart(match.params.projectId, ids, appliedFilters)
      .then(() => {
        setExportLoading(false);
        setViewExport(false);
      })
      .catch(() => {
        setExportLoading(false);
        setExportError(true);
      });
  };

  const _canExport = () => {
    if (!team || !team.TeamRoles) return false;

    let canExport = false;
    team.TeamRoles.map((teamRole) => {
      if (teamRole.team_id === parseInt(match.params.teamId, 10)
        && teamRole.user_id === user.id
        && (teamRole.canExport || teamRole.role === "owner")
      ) {
        canExport = true;
      }
      return teamRole;
    });

    return canExport;
  };

  const _onChangeAutoRefresh = () => {
    const tempAutoRefresh = autoRefresh || [];
    const index = _.indexOf(autoRefresh, match.params.projectId);
    if (index > -1) {
      tempAutoRefresh.splice(index, 1);
    } else {
      tempAutoRefresh.push(match.params.projectId);
    }

    setAutoRefresh(tempAutoRefresh);
  };

  const _onUpdateExport = (chartId, disabled) => {
    updateChart(match.params.projectId, chartId, { disabledExport: disabled }, true);
  };

  return (
    <div>
      {charts && charts.length > 0
        && (
          <div>
            <Menu
              tabular
              fluid
              compact
              style={mobile ? styles.actionBarMobile : styles.actionBar}
              size="small"
            >
              <Menu.Item
                name="filters"
              >
                <Media greaterThan="mobile">
                  <Button
                    basic
                    primary
                    icon="filter"
                    content="Add filter"
                    loading={filterLoading}
                    onClick={_onShowFilters}
                    size="small"
                  />
                </Media>
                <Media at="mobile">
                  <Button
                    basic
                    primary
                    icon="filter"
                    loading={filterLoading}
                    onClick={_onShowFilters}
                    size="small"
                  />
                </Media>
              </Menu.Item>
              <Menu.Item style={mobile ? {} : { borderLeft: "solid 1px #d4d4d5" }}>
                <div>
                  <Label.Group size="small">
                    {filters
                      && filters[match.params.projectId]
                      && filters[match.params.projectId].map((filter) => (
                        <Label color="violet" as="a" key={filter.id} style={{ marginBottom: 0 }}>
                          <span>{`${filter.field.substring(filter.field.lastIndexOf(".") + 1)}`}</span>
                          <strong>{` ${_getOperator(filter.operator)} `}</strong>
                          <span>{`${filter.value}`}</span>
                          <Label.Detail>
                            <Icon name="x" onClick={() => _onRemoveFilter(filter.id)} />
                          </Label.Detail>
                        </Label>
                      ))}
                  </Label.Group>
                </div>
              </Menu.Item>
              <Menu.Menu position="right">
                {_canAccess("admin") && (
                  <Menu.Item style={{ padding: 0 }}>
                    <Popup
                      trigger={(
                        <Button
                          button
                          basic
                          primary
                          icon="clone"
                          className="icon"
                          onClick={() => setTemplateVisible(true)}
                        />
                      )}
                      content="Create a template from this dashboard"
                      position="bottom right"
                    />
                  </Menu.Item>
                )}
                {_canExport() && (
                  <Menu.Item style={{ padding: 0 }}>
                    <Popup
                      trigger={(
                        <Button
                          button
                          basic
                          primary
                          icon="file excel"
                          className="icon"
                          onClick={_openExport}
                        />
                      )}
                      content="Export charts to Excel (.xlsx)"
                      position="bottom right"
                    />
                  </Menu.Item>
                )}
                {!mobile && (
                  <Menu.Item style={{ padding: 0 }}>
                    <Popup
                      trigger={(
                        <Button
                          basic
                          primary
                          icon="print"
                          onClick={onPrint}
                        />
                      )}
                      content="Open print view"
                      position="bottom right"
                    />
                  </Menu.Item>
                )}

                <Menu.Item style={{ padding: 0 }}>
                  <Media greaterThan="mobile">
                    <Button size="tiny" as="div" labelPosition="right">
                      <Popup
                        trigger={(
                          <Button
                            basic
                            primary
                            icon="refresh"
                            onClick={() => _onRefreshData()}
                            loading={refreshLoading}
                            content="Refresh all charts"
                            size="tiny"
                          />
                        )}
                        content="This function will get fresh data from all the data sources."
                        position="bottom right"
                      />
                      <Popup
                        trigger={(
                          <Label
                            size="small"
                            color="violet"
                            basic
                            as="a"
                            pointing="left"
                          >
                            <Checkbox
                              toggle
                              checked={_.indexOf(autoRefresh, match.params.projectId) > -1}
                              onChange={_onChangeAutoRefresh}
                            />
                          </Label>
                        )}
                        content="Auto-refresh the charts when opening the dashboard"
                      />
                    </Button>
                  </Media>
                  <Media at="mobile">
                    <Button
                      basic
                      primary
                      icon
                      onClick={() => _onRefreshData()}
                      loading={refreshLoading}
                      size="small"
                    >
                      <Icon name="refresh" />
                    </Button>
                  </Media>
                </Menu.Item>
              </Menu.Menu>
            </Menu>
          </div>
        )}
      <div style={styles.container}>
        {connections.length === 0 && charts.length !== 0
            && (
            <Message
              floating
              warning
            >
              <Link to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
                <Button primary floated="right" icon labelPosition="right">
                  <Icon name="plug" />
                  Connect now
                </Button>
              </Link>
              <div>
                <Icon name="database" size="big" />
                Your project is not connected to any database yet.
              </div>
            </Message>
            )}
        {connections.length === 0 && charts.length === 0
          && (
            <Container text textAlign="center" style={{ paddingTop: height / 3 }}>
              <Header size="huge" textAlign="center" icon>
                Welcome to your dashboard
                <Header.Subheader>
                  {"Create a new database connection and start visualizing your data. "}
                </Header.Subheader>
              </Header>
              <Divider hidden />
              <Link
                to={{
                  pathname: `/${match.params.teamId}/${match.params.projectId}/connections`,
                  state: { onboarding: true },
                }}
              >
                <Button primary icon labelPosition="right" size="huge">
                  <Icon name="play" />
                  Get started
                </Button>
              </Link>
            </Container>
          )}

        {_canAccess("editor") && charts.length < 1 && connections.length > 0
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

        {connections.length > 0 && (
          <Grid stackable centered style={styles.mainGrid}>
            {charts.map((chart, index) => {
              if (chart.draft && !showDrafts) return (<span style={{ display: "none" }} key={chart.id} />);
              if (!chart.id) return (<span style={{ display: "none" }} key={`no_id_${index}`} />); // eslint-disable-line
              return (
                <Grid.Column width={chart.chartSize * 4} key={chart.id} style={styles.chartGrid}>
                  <Chart
                    key={chart.id}
                    chart={chart}
                    charts={charts}
                    showDrafts={showDrafts}
                    onChangeOrder={(chartId, type) => _onChangeOrder(chartId, type, index)}
                  />
                </Grid.Column>
              );
            })}
          </Grid>
        )}
        {connections.length > 0 && charts.length > 0 && _canAccess("editor") && (
        <Container textAlign="center" style={{ paddingTop: 50 }}>
          <Link to={`/${match.params.teamId}/${match.params.projectId}/chart`}>
            <Button secondary icon labelPosition="right" style={styles.addChartBtn}>
              <Icon name="plus" />
              Add a new chart
            </Button>
          </Link>
        </Container>
        )}
      </div>

      <TransitionablePortal open={showFilters}>
        <Modal open={showFilters} closeIcon onClose={() => setShowFilters(false)}>
          <Modal.Header>
            <span style={{ verticalAlign: "middle" }}>{" Dashboard filters "}</span>
            <Label style={{ verticalAlign: "middle" }} color="olive">New!</Label>
          </Modal.Header>
          <Modal.Content>
            <Filters
              charts={charts}
              projectId={match.params.projectId}
              onAddFilter={_onAddFilter}
            />
          </Modal.Content>
        </Modal>
      </TransitionablePortal>

      <TransitionablePortal open={viewExport}>
        <Modal open={viewExport} closeIcon onClose={() => setViewExport(false)}>
          <Modal.Header>
            Export to Excel (.xlsx)
          </Modal.Header>
          <Modal.Content>
            <ChartExport
              charts={charts}
              onExport={_onExport}
              loading={exportLoading}
              error={exportError}
              onUpdate={(chartId, disabled) => _onUpdateExport(chartId, disabled)}
              showDisabled={_canAccess("admin")}
            />
          </Modal.Content>
        </Modal>
      </TransitionablePortal>

      <CreateTemplateForm
        teamId={match.params.teamId}
        projectId={match.params.projectId}
        onClose={(isComplete) => {
          if (isComplete) toast.success("✨ The template was saved successfully");
          setTemplateVisible(false);
        }}
        visible={templateVisible}
      />

      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: 10,
    paddingLeft: 20,
  },
  actionBar: {
    paddingRight: 10,
    paddingLeft: 10,
    borderRadius: 0,
    backgroundColor: whiteTransparent(1),
    boxShadow: "none",
  },
  actionBarMobile: {
    boxShadow: "none",
  },
  addChartBtn: {
    boxShadow: "0 1px 10px 0 #d4d4d5, 0 0 0 1px #d4d4d5",
  },
  refreshBtn: {
    position: "fixed",
    bottom: 25,
    right: 25,
  },
  chartGrid: {
    padding: 10,
  },
  mainGrid: {
    padding: 10,
  },
  addCard: {
    paddingTop: 50,
  },
};

ProjectDashboard.defaultProps = {
  showDrafts: true,
  mobile: false,
};

ProjectDashboard.propTypes = {
  connections: PropTypes.array.isRequired,
  charts: PropTypes.array.isRequired,
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  runQueryWithFilters: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  getProjectCharts: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired,
  changeOrder: PropTypes.func.isRequired,
  showDrafts: PropTypes.bool,
  mobile: PropTypes.bool,
  updateChart: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    charts: state.chart.data,
    user: state.user.data,
    team: state.team.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
    runQueryWithFilters: (projectId, chartId, filters) => (
      dispatch(runQueryWithFiltersAction(projectId, chartId, filters))
    ),
    runQuery: (projectId, chartId) => dispatch(runQueryAction(projectId, chartId)),
    getProjectCharts: (projectId) => dispatch(getProjectChartsAction(projectId)),
    changeOrder: (projectId, chartId, otherId) => (
      dispatch(changeOrderAction(projectId, chartId, otherId))
    ),
    updateChart: (projectId, chartId, data, justUpdates) => (
      dispatch(updateChartAction(projectId, chartId, data, justUpdates))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectDashboard));
