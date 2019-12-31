import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Icon, Button, Container, Header, Image
} from "semantic-ui-react";
import { Link } from "react-router-dom";

import Chart from "./Chart";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import dashboardImage from "../assets/290.png";
/*
  Description
*/
class ProjectDashboard extends Component {
  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
  }

  render() {
    const {
      connections, charts, match, showDrafts,
    } = this.props;

    return (
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
          <Container text textAlign="center" style={{ paddingTop: 50 }}>
            <Header size="huge" textAlign="center">
              <span role="img" aria-label="wave">👋</span>
              {" "}
              Welcome to Chart Brew
              <Header.Subheader>
                {"Why not jump right into it? Create a new database connection and start visualizing your data. "}
              </Header.Subheader>
            </Header>
            <Image centered size="large" src={dashboardImage} alt="Chartbrew create chart" />
            <br />
            <Link to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
              <Button primary icon labelPosition="right" size="huge">
                <Icon name="play" />
                Get started
              </Button>
            </Link>
          </Container>
          )}
        {connections.length > 0 && (
          <>
            <Chart charts={charts} showDrafts={showDrafts} />

            <Container textAlign="center" style={{ paddingTop: 50 }}>
              <Link to={`/${match.params.teamId}/${match.params.projectId}/chart`}>
                <Button secondary icon labelPosition="right" style={styles.addChartBtn}>
                  <Icon name="plus" />
                  Add a new chart
                </Button>
              </Link>
            </Container>
          </>
        )}
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    padding: 10,
    paddingLeft: 20,
  },
  addChartBtn: {
    boxShadow: "0 1px 10px 0 #d4d4d5, 0 0 0 1px #d4d4d5",
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
