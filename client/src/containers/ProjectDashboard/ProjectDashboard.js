import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Container, Row, Button, Loading, Spacer, Text, Link as LinkNext, Tooltip, Grid,
  Card, Modal, useTheme,
} from "@nextui-org/react";
import { Link } from "react-router-dom";
import { useWindowSize } from "react-use";
import _ from "lodash";
import { createMedia } from "@artsy/fresnel";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import {
  CloseSquare, Filter2, Image2, PaperDownload, Play, Plus, Scan
} from "react-iconly";
import { HiRefresh } from "react-icons/hi";

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
import Badge from "../../components/Badge";

const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
};
const AppMedia = createMedia({
  breakpoints,
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [viewExport, setViewExport] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);

  const { height, width } = useWindowSize();
  const { isDark } = useTheme();

  useEffect(() => {
    cleanErrors();
  }, []);

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

  const _onUpdateExport = (chartId, disabled) => {
    updateChart(match.params.projectId, chartId, { disabledExport: disabled }, true);
  };

  return (
    <div>
      {charts && charts.length > 0
        && (
          <div>
            <Container
              fluid
              style={mobile ? styles.actionBarMobile : styles.actionBar}
              css={{ backgroundColor: "$backgroundContrast" }}
            >
              <Row justify="space-between" align="center">
                <Row justify="flex-start" align="center">
                  <Media greaterThan="mobile">
                    <Button
                      ghost
                      iconRight={<Filter2 size="small" />}
                      disabled={filterLoading}
                      onClick={_onShowFilters}
                      css={{ minWidth: "fit-content" }}
                      size="sm"
                      auto
                    >
                      {filterLoading && <Loading type="points" />}
                      {!filterLoading && "Add filter"}
                    </Button>
                  </Media>
                  <Media at="mobile">
                    <Button
                      icon={<Filter2 />}
                      onClick={_onShowFilters}
                      disabled={filterLoading}
                      ghost
                      css={{ minWidth: "fit-content" }}
                      size="sm"
                    />
                  </Media>
                  <Spacer x={0.5} />
                  <div style={mobile ? {} : { borderLeft: "solid 1px #d4d4d5" }}>
                    {filters
                      && filters[match.params.projectId]
                      && filters[match.params.projectId].map((filter) => (
                        <Badge type="primary" key={filter.id}>
                          <span>{`${filter.field.substring(filter.field.lastIndexOf(".") + 1)}`}</span>
                          <strong>{` ${_getOperator(filter.operator)} `}</strong>
                          <span>{`${filter.value}`}</span>
                          <Spacer x={0.2} />
                          <LinkNext onClick={() => _onRemoveFilter(filter.id)} css={{ color: "$text" }}>
                            <CloseSquare size="small" />
                          </LinkNext>
                        </Badge>
                      ))}
                  </div>
                </Row>
                <Row justify="flex-end" align="center">
                  {_canAccess("admin") && (
                    <>
                      <Tooltip content="Create a template from this dashboard" placement="bottom">
                        <Button
                          ghost
                          icon={<Scan />}
                          onClick={() => setTemplateVisible(true)}
                          auto
                          css={{ minWidth: "fit-content" }}
                          size="sm"
                        />
                      </Tooltip>
                    </>
                  )}
                  {_canExport() && (
                    <>
                      <Spacer x={0.2} />
                      <Tooltip content="Export charts to Excel" placement="bottom">
                        <Button
                          ghost
                          icon={<PaperDownload />}
                          onClick={_openExport}
                          auto
                          css={{ minWidth: "fit-content" }}
                          size="sm"
                        />
                      </Tooltip>
                    </>
                  )}
                  {!mobile && (
                    <>
                      <Spacer x={0.2} />
                      <Tooltip content="Open print view" placement="bottomEnd">
                        <Button
                          ghost
                          icon={<Image2 />}
                          onClick={onPrint}
                          auto
                          css={{ minWidth: "fit-content" }}
                          size="sm"
                        />
                      </Tooltip>
                    </>
                  )}

                  <>
                    <Spacer x={0.2} />
                    <Media greaterThan="mobile">
                      <Tooltip content="Refresh data" placement="bottomStart">
                        <Button
                          ghost
                          icon={refreshLoading ? <Loading type="points" /> : <HiRefresh size={20} />}
                          onClick={() => _onRefreshData()}
                          disabled={refreshLoading}
                          css={{ minWidth: "fit-content" }}
                          size="sm"
                          auto
                        >
                          Refresh all charts
                        </Button>
                      </Tooltip>
                    </Media>
                    <Media at="mobile">
                      <>
                        <Tooltip content="Refresh all charts" placement="bottomEnd">
                          <Button
                            ghost
                            icon={refreshLoading ? <Loading type="points" /> : <HiRefresh size={22} />}
                            onClick={() => _onRefreshData()}
                            disabled={refreshLoading}
                            css={{ minWidth: "fit-content" }}
                            size="sm"
                          />
                        </Tooltip>
                      </>
                    </Media>
                  </>
                </Row>
              </Row>
            </Container>
          </div>
        )}
      <div style={styles.container(width < breakpoints.tablet)}>
        {connections.length === 0 && charts.length === 0
          && (
            <Container justify="center" style={{ paddingTop: height / 3 }}>
              <Row justify="center" align="center">
                <Text h1>
                  Welcome to your dashboard
                </Text>
              </Row>
              <Spacer y={0.5} />
              <Row justify="center" align="center">
                <Text h3>
                  {"Connect to a data source and start visualizing your data. "}
                </Text>
              </Row>
              <Spacer y={1} />
              <Row justify="center" align="center">
                <Link
                  to={{
                    pathname: `/${match.params.teamId}/${match.params.projectId}/connections`,
                    state: { onboarding: true },
                  }}
                >
                  <Button shadow iconRight={<Play />} size="lg" auto>
                    Get started
                  </Button>
                </Link>
              </Row>
            </Container>
          )}

        {_canAccess("editor") && charts.length < 1 && connections.length > 0 && (
          <Container justify="center" style={styles.addCard}>
            <Row justify="center" align="center">
              <Link to={`/${match.params.teamId}/${match.params.projectId}/chart`}>
                <Card
                  isHoverable
                  isPressable
                >
                  <Card.Body>
                    <Row justify="center" align="center">
                      <Plus size="large" />
                    </Row>
                    <Row justify="center" align="center">
                      <Text h3>Add your first chart</Text>
                    </Row>
                  </Card.Body>
                </Card>
              </Link>
            </Row>
          </Container>
        )}

        <Grid.Container gap={1.5}>
          {charts.map((chart, index) => {
            if (chart.draft && !showDrafts) return (<span style={{ display: "none" }} key={chart.id} />);
            if (!chart.id) return (<span style={{ display: "none" }} key={`no_id_${index}`} />); // eslint-disable-line
            return (
              <Grid
                xs={12}
                sm={chart.chartSize * 4 > 12 ? 12 : chart.chartSize * 4}
                md={chart.chartSize * 3 > 12 ? 12 : chart.chartSize * 3}
                key={chart.id}
                css={{ minHeight: 400, overflowY: "hidden" }}
              >
                <Chart
                  key={chart.id}
                  chart={chart}
                  charts={charts}
                  showDrafts={showDrafts}
                  onChangeOrder={(chartId, type) => _onChangeOrder(chartId, type, index)}
                />
              </Grid>
            );
          })}
        </Grid.Container>
      </div>

      <Filters
        charts={charts}
        projectId={match.params.projectId}
        onAddFilter={_onAddFilter}
        open={showFilters}
        onClose={() => setShowFilters(false)}
      />

      <Modal open={viewExport} closeButton onClose={() => setViewExport(false)} width="800px">
        <Modal.Header>
          <Text h3>Export to Excel (.xlsx)</Text>
        </Modal.Header>
        <Modal.Body>
          <ChartExport
            charts={charts}
            onExport={_onExport}
            loading={exportLoading}
            error={exportError}
            onUpdate={(chartId, disabled) => _onUpdateExport(chartId, disabled)}
            showDisabled={_canAccess("admin")}
          />
        </Modal.Body>
      </Modal>

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
        theme={isDark ? "dark" : "light"}
      />
    </div>
  );
}

const styles = {
  container: (mobile) => ({
    flex: 1,
    padding: mobile ? 0 : 10,
    paddingTop: 10,
    paddingLeft: mobile ? 0 : 10,
  }),
  actionBar: {
    padding: 10,
    borderRadius: 0,
    boxShadow: "none",
    width: "100%",
  },
  actionBarMobile: {
    boxShadow: "none",
    padding: 5,
  },
  addChartBtn: {
    boxShadow: "0 1px 10px 0 #d4d4d5, 0 0 0 1px #d4d4d5",
  },
  refreshBtn: {
    position: "fixed",
    bottom: 25,
    right: 25,
  },
  chartGrid: (mobile) => ({
    padding: mobile ? 0 : 10,
    paddingTop: 10,
    paddingBottom: 10,
  }),
  mainGrid: (mobile) => ({
    padding: mobile ? 0 : 10,
    paddingTop: 10,
    paddingBottom: 10,
  }),
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
