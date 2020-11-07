import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Segment, Loader, Header, Message, List, Image,
} from "semantic-ui-react";
import { createMedia } from "@artsy/fresnel";

import { getPublicDashboard } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Chart from "./Chart/Chart";
import { blue } from "../config/colors";
import cbLogo from "../assets/logo_inverted.png";

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const mediaStyles = AppMedia.createMediaStyle();
const { Media, MediaContextProvider } = AppMedia;

/*
  The dashboard page that can be shared with the public
*/
function PublicDashboard(props) {
  const { getPublicDashboard, match, cleanErrors } = props;

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    cleanErrors();
    getPublicDashboard(match.params.brewName)
      .then((dashboardData) => {
        setDashboard(dashboardData);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const _isPublic = () => {
    if (!dashboard || (dashboard && !dashboard.Charts)) return false;

    let isPublic = false;
    for (let i = 0; i < dashboard.Charts.length; i++) {
      if (dashboard.Charts[i].public) {
        isPublic = true;
        break;
      }
    }

    return isPublic;
  };

  return (
    <div style={styles.container}>
      <style>{mediaStyles}</style>
      <MediaContextProvider>
        <Segment inverted color="blue" style={styles.mainContent}>
          {loading
            && (
            <Loader inverted active={loading} size="huge" style={{ marginTop: 100 }}>
              Preparing the dashboard
            </Loader>
            )}

          {error
            && (
            <Message warning>
              <Message.Header>{"This dashboard might not exist or it's not made public"}</Message.Header>
            </Message>
            )}

          {dashboard && dashboard.Charts.length > 0 && _isPublic()
            && (
            <div>
              <div style={styles.brewBadge}>
                <Media at="mobile">
                  <LogoContainer size="small" />
                </Media>
                <Media greaterThan="mobile">
                  <LogoContainer size="normal" />
                </Media>
              </div>
              <Header inverted textAlign="center" size="huge" style={{ paddingBottom: 30 }}>
                {dashboard.dashboardTitle || dashboard.name}
              </Header>
              <Chart isPublic charts={dashboard.Charts} />
            </div>
            )}
          {dashboard && !_isPublic()
            && (
            <Header>
              Sorry, this dashboard is not public
            </Header>
            )}
        </Segment>
      </MediaContextProvider>
    </div>
  );
}

function LogoContainer({ size }) {
  return (
    <List selection verticalAlign="middle" inverted size={size}>
      <List.Item as={Link} to="/">
        <Image size="mini" src={cbLogo} alt="Chartbrew Chart Dasboard" />
      </List.Item>
    </List>
  );
}

LogoContainer.propTypes = {
  size: PropTypes.string.isRequired,
};

const styles = {
  container: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: blue,
    height: window.innerHeight,
    paddingBottom: 100,
  },
  brewBadge: {
    position: "absolute",
    top: 5,
    left: 5,
  },
  mainContent: {
    marginTop: 0,
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
