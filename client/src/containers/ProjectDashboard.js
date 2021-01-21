import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Icon, Button, Container, Header, Divider, Menu, Label
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useWindowSize } from "react-use";

import Chart from "./Chart/Chart";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Dashboard container (for the charts)
*/
function ProjectDashboard(props) {
  const {
    cleanErrors, connections, charts, match, showDrafts
  } = props;
  const [refreshRequested, setRefreshRequested] = useState(false);

  const { height } = useWindowSize();

  useEffect(() => {
    cleanErrors();
  }, []);

  const _onCompleteRefresh = () => setRefreshRequested(false);

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
                />
              </Menu.Item>
              <Menu.Item style={{ borderLeft: "solid 1px #d4d4d5" }}>
                <div>
                  <Label.Group>
                    <Label color="violet" as="a">
                      {"type = kpi"}
                      <Label.Detail>
                        <Icon name="x" />
                      </Label.Detail>
                    </Label>
                    <Label color="violet" as="a">
                      {"createdAt < 12-10-2020"}
                      <Label.Detail>
                        <Icon name="x" />
                      </Label.Detail>
                    </Label>
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
