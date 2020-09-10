import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Segment, Loader, Header, Message, List, Image, Responsive
} from "semantic-ui-react";

import { getPublicDashboard } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Chart from "./Chart/Chart";
import { blue } from "../config/colors";
import cbLogo from "../assets/logo_inverted.png";

/*
  Description
*/
class PublicDashboard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      dashboard: null,
      loading: true,
    };
  }

  componentDidMount() {
    const { getPublicDashboard, match, cleanErrors } = this.props;
    cleanErrors();
    getPublicDashboard(match.params.brewName)
      .then((dashboard) => {
        this.setState({ dashboard, loading: false });
      })
      .catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _screenUpdate = (e, { width }) => {
    if (width < 639) {
      this.setState({ mobile: true });
    } else {
      this.setState({ mobile: false });
    }
  }

  _isPublic() {
    const { dashboard } = this.state;
    if (!dashboard.Charts) return false;

    let isPublic = false;
    for (let i = 0; i < dashboard.Charts.length; i++) {
      if (dashboard.Charts[i].public) {
        isPublic = true;
        break;
      }
    }

    return isPublic;
  }

  render() {
    const {
      dashboard, mobile, loading, error,
    } = this.state;

    return (
      <div style={styles.container}>
        <Responsive
          as="div"
          textAlign="center"
          fireOnMount
          onUpdate={this._screenUpdate}
        >
          <Segment inverted color="blue" style={styles.mainContent}>
            {loading
              && (
              <Loader inverted active={loading} size="huge" style={{ marginTop: 30 }}>
                Preparing the dashboard
              </Loader>
              )}

            {error
              && (
              <Message warning>
                <Message.Header>{"This dashboard might not exist or it's not made public"}</Message.Header>
              </Message>
              )}

            {dashboard && dashboard.Charts.length > 0 && this._isPublic()
              && (
              <div>
                <div style={mobile ? styles.brewBadgeMobile : styles.brewBadge}>
                  <List selection verticalAlign="middle" inverted size={mobile ? "small" : "normal"}>
                    <List.Item as={Link} to="/">
                      <Image size="mini" src={cbLogo} alt="Chartbrew Chart Dasboard" />
                    </List.Item>
                  </List>
                </div>
                <Header inverted textAlign="center" size="huge" style={{ paddingBottom: 30 }}>
                  {dashboard.dashboardTitle || dashboard.name}
                </Header>
                <Chart isPublic charts={dashboard.Charts} />
              </div>
              )}
            {dashboard && !this._isPublic()
              && (
              <Header>
                Sorry, this dashboard is not public
              </Header>
              )}
          </Segment>
        </Responsive>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: blue,
    height: window.innerHeight,
    paddingBottom: 100,
  },
  brewBadge: {
    paddingLeft: 5,
    paddingRight: 5,
    position: "absolute",
    top: 10,
    right: 10,
  },
  brewBadgeMobile: {
    position: "absolute",
    top: 5,
    left: 5,
  },
};

PublicDashboard.propTypes = {
  getPublicDashboard: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getPublicDashboard: (brewName) => dispatch(getPublicDashboard(brewName)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(PublicDashboard));
