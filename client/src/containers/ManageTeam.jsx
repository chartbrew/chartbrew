import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Routes } from "react-router";
import {
  CircularProgress, Listbox, ListboxSection, ListboxItem,
} from "@nextui-org/react";
import { LuCode2, LuSettings, LuUsers2 } from "react-icons/lu";

import { getTeam, saveActiveTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import ApiKeys from "./ApiKeys/ApiKeys";
import Container from "../components/Container";
import Row from "../components/Row";

/*
  Description
*/
function ManageTeam(props) {
  const {
    cleanErrors, getTeam, saveActiveTeam, match, user, team, history,
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

  const checkActive = () => {
    if (window.location.pathname.indexOf("members") > -1) return "members";
    if (window.location.pathname.indexOf("settings") > -1) return "settings";
    if (window.location.pathname.indexOf("payment") > -1) return "payment";
    if (window.location.pathname.indexOf("api-keys") > -1) return "api-keys";
      
    return false;
  };

  const _onMenuSelect = (key) => {
    if (key === "members") {
      history.push(`/manage/${match.params.teamId}/members`);
    }
    if (key === "settings") {
      history.push(`/manage/${match.params.teamId}/settings`);
    }
    if (key === "api-keys") {
      history.push(`/manage/${match.params.teamId}/api-keys`);
    }
  }

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (!team.id || loading) {
    return (
      <Container size="sm" justify="center" style={{ paddingTop: 100 }}>
        <Row justify="center" align="center">
          <CircularProgress size="lg">Loading your team</CircularProgress>
        </Row>
      </Container>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="grid grid-cols-12 gap-4 container mx-auto">
        <div className="col-span-12 sm:col-span-3 md:col-span-2">
          <div className="pt-4">
            <Listbox
              selectedKeys={[checkActive()]}
              onSelectionChange={(keys) => _onMenuSelect(keys.currentKey) }
              selectionMode="single"
              itemClasses={{ title: "text-md" }}
            >
              <ListboxSection title="Manage the team">
                {_canAccess("teamOwner") && (
                  <ListboxItem key="settings" startContent={<LuSettings />}>
                    Settings
                  </ListboxItem>
                )}
                <ListboxItem key="members" startContent={<LuUsers2 />}>
                  Members
                </ListboxItem>
              </ListboxSection>
              {_canAccess("teamAdmin") && (
                <ListboxSection title="Developers">
                  <ListboxItem key="api-keys" startContent={<LuCode2 />}>
                    API Keys
                  </ListboxItem>
                </ListboxSection>
              )}
            </Listbox>
          </div>
        </div>

        <div className="col-span-12 sm:col-span-9 md:col-span-10">
          <div className="container mx-auto py-4">
            <Routes>
              <Route path="/manage/:teamId/members" component={TeamMembers} />
              {_canAccess("teamOwner") && (
                <Route
                  path="/manage/:teamId/settings"
                  component={TeamSettings}
                />
              )}
              {_canAccess("teamAdmin") && team.id && (
                <Route
                  path="/manage/:teamId/api-keys"
                  render={() => (<ApiKeys teamId={team.id} />)}
                />
              )}
            </Routes>
          </div>
        </div>
      </div>
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
  history: PropTypes.object.isRequired,
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

export default connect(mapStateToProps, mapDispatchToProps)(ManageTeam);
