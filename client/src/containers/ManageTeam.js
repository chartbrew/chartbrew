import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";

import { Link } from "react-router-dom";

import {
  Dimmer,
  Grid,
  Menu,
  Loader,
  Container,
  Header,
} from "semantic-ui-react";

import { getTeam, saveActiveTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";

/*
  Description
*/
function ManageTeam(props) {
  const {
    cleanErrors, getTeam, saveActiveTeam, match, user, team
  } = props;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cleanErrors();
    _getTeam();
  }, []);

  const _getTeam = () => {
    getTeam(match.params.teamId)
      .then((team) => {
        saveActiveTeam(team);
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const checkIfActive = (path) => {
    switch (path) {
      case "members":
        if (window.location.pathname.indexOf("members") > -1) return true;
        break;
      case "settings":
        if (window.location.pathname.indexOf("settings") > -1) return true;
        break;
      case "payment":
        if (window.location.pathname.indexOf("payment") > -1) return true;
        break;
      default:
        return false;
    }

    return false;
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (!team.id) {
    return (
      <Container text style={styles.container}>
        <Dimmer active={loading}>
          <Loader />
        </Dimmer>
      </Container>
    );
  }

  return (
    <div style={styles.container}>
      <Navbar />
      <Grid centered padded columns={2} stackable>
        <Grid.Column width={3}>
          <Header as="h3" style={{ paddingTop: 20 }}>
            Manage the team
          </Header>
          <Menu secondary vertical fluid>
            {_canAccess("owner") && (
              <Menu.Item
                active={checkIfActive("settings")}
                as={Link}
                to={`/manage/${match.params.teamId}/settings`}
              >
                Settings
              </Menu.Item>
            )}
            <Menu.Item
              active={checkIfActive("members")}
              as={Link}
              to={`/manage/${match.params.teamId}/members`}
            >
              Members
            </Menu.Item>
          </Menu>
        </Grid.Column>

        <Grid.Column stretched width={12}>
          <Container>
            <Switch>
              <Route path="/manage/:teamId/members" component={TeamMembers} />
              {_canAccess("owner") && (
                <Route
                  path="/manage/:teamId/settings"
                  component={TeamSettings}
                />
              )}
            </Switch>
          </Container>
        </Grid.Column>
      </Grid>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

ManageTeam.propTypes = {
  getTeam: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  saveActiveTeam: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeam: (id) => dispatch(getTeam(id)),
    saveActiveTeam: (team) => dispatch(saveActiveTeam(team)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(
  connect(mapStateToProps, mapDispatchToProps)(ManageTeam)
);
