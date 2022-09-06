import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Grid, Container, Row, Loading, Text, Spacer, Button,
} from "@nextui-org/react";

import { getTeam, saveActiveTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import ApiKeys from "./ApiKeys/ApiKeys";

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
      case "api-keys":
        if (window.location.pathname.indexOf("api-keys") > -1) return true;
        break;
      default:
        return false;
    }

    return false;
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (!team.id || loading) {
    return (
      <Container sm justify="center" css={{ pt: 100 }}>
        <Row justify="center" align="center">
          <Loading type="points" size="lg">Loading your team</Loading>
        </Row>
      </Container>
    );
  }

  return (
    <div>
      <Navbar />
      <Grid.Container gap={1}>
        <Grid xs={12} sm={3} md={2}>
          <Container css={{ pt: 20 }}>
            <Row>
              <Text h4>
                Manage the team
              </Text>
            </Row>
            {_canAccess("owner") && (
              <>
                <Row>
                  <Link to={`/manage/${match.params.teamId}/settings`}>
                    <Button
                      light
                      auto
                      color={checkIfActive("settings") ? "primary" : "default"}
                      disabled={!checkIfActive("settings")}
                      size="lg"
                    >
                      Settings
                    </Button>
                  </Link>
                </Row>
              </>
            )}

            <Row>
              <Link to={`/manage/${match.params.teamId}/members`}>
                <Button
                  light
                  auto
                  color={checkIfActive("members") ? "primary" : "default"}
                  disabled={!checkIfActive("members")}
                  size="lg"
                >
                  Members
                </Button>
              </Link>
            </Row>
            <Spacer y={1} />

            {_canAccess("admin") && (
              <>
                <Row>
                  <Text h4>
                    Developers
                  </Text>
                </Row>
                <Row>
                  <Link to={`/manage/${match.params.teamId}/api-keys`}>
                    <Button
                      light
                      color={checkIfActive("api-keys") ? "primary" : "default"}
                      auto
                      disabled={!checkIfActive("api-keys")}
                      size="lg"
                    >
                      API Keys
                    </Button>
                  </Link>
                </Row>
              </>
            )}
          </Container>
        </Grid>

        <Grid xs={12} sm={9} md={10}>
          <Container
            css={{
              backgroundColor: "$backgroundContrast",
              br: "$md",
              p: 10,
              "@xs": {
                p: 20,
              },
              "@sm": {
                p: 20,
              },
              "@md": {
                p: 20,
                m: 20,
              },
              "@lg": {
                p: 20,
                m: 20,
              },
            }}
          >
            <Switch>
              <Route path="/manage/:teamId/members" component={TeamMembers} />
              {_canAccess("owner") && (
                <Route
                  path="/manage/:teamId/settings"
                  component={TeamSettings}
                />
              )}
              {_canAccess("admin") && team.id && (
                <Route
                  path="/manage/:teamId/api-keys"
                  render={() => (<ApiKeys teamId={team.id} />)}
                />
              )}
            </Switch>
          </Container>
        </Grid>
      </Grid.Container>
    </div>
  );
}

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
