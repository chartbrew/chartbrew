import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Icon, Button, Container, Header, Divider, Menu,
  Label, TransitionablePortal, Modal,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useLocalStorage, useWindowSize } from "react-use";
import _ from "lodash";

import Chart from "../Chart/Chart";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import Filters from "./components/Filters";
import { operators } from "../../modules/filterOperations";

/*
  Dashboard container (for the charts)
*/
function ProjectDashboard(props) {
  const {
    cleanErrors, connections, charts, match, showDrafts
  } = props;

  const initialFilters = window.localStorage.getItem("_cb_filters");
  const [refreshRequested, setRefreshRequested] = useState(false);
  const [filters, setFilters] = useLocalStorage("_cb_filters", initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const { height } = useWindowSize();

  useEffect(() => {
    cleanErrors();
  }, []);

  const _onCompleteRefresh = () => setRefreshRequested(false);

  const _onAddFilter = (filter) => {
    const newFilters = _.clone(filters) || [];
    newFilters.push(filter);
    setFilters(newFilters);
    setShowFilters(false);
  };

  const _onRemoveFilter = (filterId) => {
    if (filters.length === 1) {
      setFilters([]);
      return;
    }

    const index = _.findIndex(filters, { id: filterId });
    if (!index) return;

    const newFilters = _.clone(filters);
    newFilters.splice(index, 1);

    setFilters(newFilters);
  };

  const _getOperator = (operator) => {
    const found = _.find(operators, (o) => o.value === operator);
    return (found && found.key) || "";
  };

  const _onShowFilters = () => {
    setShowFilters(true);
  };

  return (
    <div>
      {charts && charts.length > 0
        && (
          <div>
            <Menu tabular fluid compact style={styles.actionBar}>
              <Menu.Item
                name="filters"
              >
                <Button
                  basic
                  primary
                  size="small"
                  icon="filter"
                  content="Add filters"
                  onClick={_onShowFilters}
                />
              </Menu.Item>
              <Menu.Item style={{ borderLeft: "solid 1px #d4d4d5" }}>
                <div>
                  <Label.Group>
                    {filters && filters.map((filter) => (
                      <Label color="violet" as="a" key={filter.id}>
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
                <Menu.Item>
                  <Button
                    basic
                    primary
                    size="small"
                    icon="refresh"
                    onClick={() => setRefreshRequested(true)}
                    loading={refreshRequested}
                    content="Refresh charts"
                  />
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
        {connections.length > 0 && (
          <Chart
            charts={charts}
            showDrafts={showDrafts}
            refreshRequested={refreshRequested}
            onCompleteRefresh={_onCompleteRefresh}
          />
        )}
        {connections.length > 0 && charts.length > 0 && (
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
          <Modal.Header>Dashboard filters</Modal.Header>
          <Modal.Content>
            <Filters
              charts={charts}
              projectId={match.params.projectId}
              onAddFilter={_onAddFilter}
            />
          </Modal.Content>
        </Modal>
      </TransitionablePortal>
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
    backgroundColor: "transparent",
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
};

ProjectDashboard.defaultProps = {
  showDrafts: true,
};

ProjectDashboard.propTypes = {
  connections: PropTypes.array.isRequired,
  charts: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  showDrafts: PropTypes.bool,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    charts: state.chart.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectDashboard));
