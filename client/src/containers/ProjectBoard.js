import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Dimmer, Loader, Container, Icon, Grid,
  Menu, Dropdown, Popup, Header, Button,
} from "semantic-ui-react";
import SplitPane from "react-split-pane";

import { getProject, changeActiveProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { getTeam } from "../actions/team";
import { getProjectCharts } from "../actions/chart";
import { getProjectConnections } from "../actions/connection";
import Connections from "./Connections/Connections";
import ProjectDashboard from "./ProjectDashboard/ProjectDashboard";
import AddChart from "./AddChart/AddChart";
import Navbar from "../components/Navbar";
import { primary, blue, lightGray } from "../config/colors";
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import PublicDashboardEditor from "./PublicDashboardEditor";
import ProjectSettings from "./ProjectSettings";
import canAccess from "../config/canAccess";
import { APP_VERSION } from "../config/settings";

const queryString = require("qs"); // eslint-disable-line

const pageHeight = window.innerHeight;
const sideMaxSize = 220;
/*
  The project screen where the dashboard, builder, etc. are
*/
function ProjectBoard(props) {
  const {
    cleanErrors, history, getProjectCharts, getProjectConnections, match,
    getProject, changeActiveProject, getTeam, project, user, team, projects,
  } = props;

  const [loading, setLoading] = useState(true);
  const [menuSize, setMenuSize] = useState("large");
  const [showDrafts, setShowDrafts] = useState(true);

  useEffect(() => {
    const parsedParams = queryString.parse(document.location.search.slice(1));
    if (parsedParams.new) history.push("connections");

    cleanErrors();
    _init();
    if (window.localStorage.getItem("_cb_menu_size")) {
      _setMenuSize(window.localStorage.getItem("_cb_menu_size"), true);
    }
    if (window.localStorage.getItem("_cb_drafts")) {
      _setDraftsVisible(window.localStorage.getItem("_cb_drafts") === "true");
    }
  }, []);

  const _init = () => {
    _getProject();
    getProjectCharts(match.params.projectId);
    getProjectConnections(match.params.projectId);
  };

  const _getProject = (id) => {
    let { projectId } = match.params;
    if (id) projectId = id;

    getProject(projectId)
      .then(() => {
        return changeActiveProject(projectId);
      })
      .then(() => {
        return getTeam(project.team_id);
      })
      .then(() => {
        return getProjectCharts(projectId);
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _checkIfActive = (path) => {
    switch (path) {
      case "dashboard":
        if (window.location.pathname.indexOf("dashboard") > -1) return true;
        break;
      case "chart":
        if (window.location.pathname.indexOf("chart") > -1) return true;
        break;
      case "connections":
        if (window.location.pathname.indexOf("connections") > -1) return true;
        break;
      case "projectSettings":
        if (window.location.pathname.indexOf("projectSettings") > -1) return true;
        break;
      case "inviteMembers":
        if (window.location.pathname.indexOf("inviteMembers") > -1) return true;
        break;
      case "members":
        if (window.location.pathname.indexOf("members") > -1) return true;
        break;
      case "settings":
        if (window.location.pathname.indexOf("settings") > -1) return true;
        break;
      case "public":
        if (window.location.pathname.indexOf("public") > -1) return true;
        break;
      default:
        return false;
    }

    return false;
  };

  const _setMenuSize = (size, init) => {
    if (init) {
      setMenuSize(size);
      return;
    }
    let newMenuSize = "large";
    if (size < sideMaxSize) {
      newMenuSize = "small";
    }
    setMenuSize(newMenuSize);
    window.localStorage.setItem("_cb_menu_size", newMenuSize);
  };

  const _setDraftsVisible = (isShowing) => {
    setShowDrafts(isShowing);
    window.localStorage.setItem("_cb_drafts", isShowing);
  };

  const _getDefaultMenuSize = () => {
    if (menuSize === "small") return 70;
    if (menuSize === "large") return sideMaxSize;
    if (window.localStorage.getItem("_cb_menu_size") === "small") {
      return 70;
    } else {
      return sideMaxSize;
    }
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (!project.id) {
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
      <SplitPane
        split="vertical"
        minSize={_getDefaultMenuSize()}
        defaultSize={_getDefaultMenuSize()}
        maxSize={_getDefaultMenuSize()}
        step={180}
        style={{ paddingTop: 40 }}
        onChange={() => {}}
      >
        <div
          style={{ backgroundColor: primary, width: menuSize === "small" ? 70 : sideMaxSize }}
        >
          <Menu
            size={menuSize === "small" ? "large" : "huge"}
            fluid
            inverted
            vertical
            icon={menuSize === "small"}
            style={styles.mainSideMenu}
          >
            <Menu.Item header>
              <Dropdown
                text={menuSize === "large" ? project.name : null}
                button={menuSize === "small"}
                labeled={menuSize === "small"}
                icon={menuSize === "small"
                  && (
                    <Popup
                      trigger={<Icon name="list ul" size="large" />}
                      content="Switch projects"
                      position="right center"
                      inverted
                  />
                  )}
                item
                style={styles.centered}
              >
                <Dropdown.Menu>
                  <Dropdown.Header>Select another project</Dropdown.Header>
                  <Dropdown.Divider />
                  {projects.map((project) => {
                    return (
                      <Dropdown.Item
                        key={project.id}
                        as={Link}
                        to={`/${project.team_id}/${project.id}/dashboard`}
                        onClick={() => {
                          setTimeout(() => { _init(); });
                        }}
                      >
                        {project.name}
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown>
            </Menu.Item>

            {_canAccess("editor")
              && (
                <Menu.Item
                  active={_checkIfActive("chart")}
                  style={styles.centered}
                >
                  {menuSize === "small"
                    && (
                      <Popup
                        trigger={(
                          <Button
                            primary
                            icon
                            as={Link}
                            to={`/${match.params.teamId}/${match.params.projectId}/chart`}
                            size="small"
                          >
                            <Icon name="plus" />
                          </Button>
                        )}
                        content="Create a new chart"
                        position="right center"
                        inverted
                      />
                    )}
                  {menuSize === "large" && (
                    <Button
                      primary
                      icon
                      labelPosition="right"
                      as={Link}
                      to={`/${match.params.teamId}/${match.params.projectId}/chart`}
                      fluid
                    >
                      <Icon name="plus" />
                      Create a chart
                    </Button>
                  )}
                </Menu.Item>
              )}

            <Menu.Item>
              {menuSize === "large"
                && (
                <Menu.Header>
                  Project
                </Menu.Header>
                )}
              <Menu.Menu>
                <Menu.Item
                  active={_checkIfActive("dashboard")}
                  as={Link}
                  to={`/${match.params.teamId}/${match.params.projectId}/dashboard`}
                >
                  {menuSize === "small"
                    && (
                    <Popup
                      trigger={<Icon name="line graph" size="large" />}
                      content="Dashboard"
                      position="right center"
                      inverted
                    />
                    )}
                  {menuSize === "large" && <Icon name="line graph" />}
                  {menuSize === "large" && "Dashboard"}
                </Menu.Item>

                {_canAccess("editor")
                  && (
                  <Menu.Item
                    active={_checkIfActive("connections")}
                    as={Link}
                    to={`/${match.params.teamId}/${match.params.projectId}/connections`}
                  >
                    {menuSize === "small"
                      && (
                      <Popup
                        trigger={<Icon name="power cord" size="large" />}
                        content="Connections"
                        position="right center"
                        inverted
                      />
                      )}
                    {menuSize === "large" && <Icon name="power cord" />}
                    {menuSize === "large" && "Connections"}
                  </Menu.Item>
                  )}

                {_canAccess("admin")
                  && (
                  <Menu.Item
                    active={_checkIfActive("projectSettings")}
                    as={Link}
                    to={`/${match.params.teamId}/${match.params.projectId}/projectSettings`}
                  >
                    {menuSize === "small"
                      && (
                      <Popup
                        trigger={<Icon name="cog" size="large" />}
                        content="Project settings"
                        position="right center"
                        inverted
                      />
                      )}
                    {menuSize === "large" && <Icon name="cog" />}
                    {menuSize === "large" && "Settings"}
                  </Menu.Item>
                  )}
              </Menu.Menu>
            </Menu.Item>

            <Menu.Item>
              <Menu.Menu>
                <Menu.Item
                  active={_checkIfActive("public")}
                  as={Link}
                  to={`/${match.params.teamId}/${match.params.projectId}/public`}
                >
                  {menuSize === "small"
                    && (
                    <Popup
                      trigger={<Icon name="world" size="large" />}
                      content="Public dashboard"
                      position="right center"
                      inverted
                    />
                    )}
                  {menuSize === "large" && <Icon name="world" />}
                  {menuSize === "large" && "Public dashboard"}
                </Menu.Item>
              </Menu.Menu>
            </Menu.Item>

            <Menu.Item>
              {menuSize === "large" && <Menu.Header>Team</Menu.Header>}
              <Menu.Menu>
                <Menu.Item active={_checkIfActive("members")} as={Link} to={`/${match.params.teamId}/${match.params.projectId}/members`}>
                  {menuSize === "small"
                    && (
                    <Popup
                      trigger={<Icon name="user" size="large" />}
                      content="Members"
                      position="right center"
                      inverted
                    />
                    )}
                  {menuSize === "large" && <Icon name="user" />}
                  {menuSize === "large" && "Members"}
                </Menu.Item>

                {_canAccess("owner")
                  && (
                  <Menu.Item active={_checkIfActive("settings")} as={Link} to={`/${match.params.teamId}/${match.params.projectId}/settings`}>
                    {menuSize === "small"
                      && (
                      <Popup
                        trigger={<Icon name="settings" size="large" />}
                        content="Settings"
                        position="right center"
                        inverted
                      />
                      )}
                    {menuSize === "large" && <Icon name="settings" />}
                    {menuSize === "large" && "Settings"}
                  </Menu.Item>
                  )}
              </Menu.Menu>
            </Menu.Item>
            <Menu.Menu style={styles.absoluteDrafts}>
              {_checkIfActive("dashboard") && (
                <Popup
                  trigger={(
                    <Menu.Item onClick={() => _setDraftsVisible(!showDrafts)}>
                      {menuSize === "small" && (
                        <>
                          <Icon name={showDrafts ? "toggle on" : "toggle off"} size="large" />
                        </>
                      )}
                      {menuSize === "large" && <Icon name={showDrafts ? "toggle on" : "toggle off"} />}
                      {menuSize === "large" && "Show drafts"}
                    </Menu.Item>
                  )}
                  content={showDrafts ? "Hide drafts" : "Show drafts"}
                  position="right center"
                  inverted
                />
              )}
            </Menu.Menu>
            {menuSize === "large"
              && (
              <Popup
                trigger={(
                  <Menu.Item
                    onClick={() => _setMenuSize(70)}
                    style={styles.absoluteCollapse(menuSize)}
                  >
                    <Icon name="toggle left" size="large" />
                  </Menu.Item>
                )}
                content="Collapse menu"
                position="right center"
                inverted
              />
              )}
            {menuSize === "small"
              && (
              <Menu.Item
                onClick={() => _setMenuSize(sideMaxSize)}
                style={styles.absoluteCollapse(menuSize)}
              >
                <Popup
                  trigger={<Icon name="toggle right" size="large" />}
                  content="Expand menu"
                  position="right center"
                  inverted
                />
              </Menu.Item>
              )}
            <Menu.Item style={styles.absoluteLogo}>
              {/* <Image size="mini" centered src={cbLogo} alt="bottle" /> */}
              <Header as="h6" inverted style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
                {menuSize !== "small" && (
                  <span>
                    Chartbrew
                    { ` ${APP_VERSION}` }
                  </span>
                )}
                {menuSize === "small" && (
                  <span>{APP_VERSION}</span>
                )}
              </Header>
            </Menu.Item>
          </Menu>
        </div>
        <div>
          <Grid columns={1} centered stackable>
            <Grid.Column computer={16} style={{ paddingLeft: 0 }}>
              <Container fluid>
                <Switch>
                  <Route path="/:teamId/:projectId/dashboard" render={() => (<ProjectDashboard showDrafts={showDrafts} />)} />
                  {_canAccess("editor") && <Route path="/:teamId/:projectId/connections" component={Connections} />}
                  {_canAccess("editor") && <Route path="/:teamId/:projectId/chart/:chartId/edit" component={AddChart} />}
                  {_canAccess("editor") && <Route path="/:teamId/:projectId/chart" component={AddChart} />}
                  {_canAccess("admin") && <Route path="/:teamId/:projectId/projectSettings" render={() => (<ProjectSettings style={styles.teamSettings} />)} /> }
                  <Route path="/:teamId/:projectId/members" render={() => (<TeamMembers style={styles.teamSettings} />)} />
                  {_canAccess("owner")
                    && (
                    <Route
                      path="/:teamId/:projectId/settings"
                      render={() => (
                        <div>
                          <TeamSettings style={styles.teamSettings} />
                        </div>
                      )}
                    />
                    )}
                  <Route path="/:teamId/:projectId/public" component={PublicDashboardEditor} />
                </Switch>
              </Container>
            </Grid.Column>
          </Grid>
        </div>
      </SplitPane>
    </div>
  );
}

const styles = {
  container: {
  },
  sideMenu: {
    backgroundColor: primary,
  },
  mainContent: {
    backgroundColor: lightGray,
  },
  absoluteLogo: {
    backgroundColor: primary,
    position: "absolute",
    bottom: 0,
    width: "100%",
    boxShadow: "-5px 1px 10px #000",
    textAlign: "center",
    padding: 5,
    borderRadius: 0,
  },
  cbVersion: {
    verticalAlign: "center",
    padding: 7,
  },
  cbVersionCollapsed: {
    verticalAlign: "center",
  },
  absoluteCollapse: (menuSize) => ({
    position: "absolute",
    bottom: menuSize === "small" ? 35 : 35,
    width: "100%",
  }),
  absoluteDrafts: {
    position: "absolute",
    bottom: 110,
    width: "100%",
  },
  teamSettings: {
    padding: 20,
    paddingLeft: 30,
  },
  draftsHeader: {
    color: "#91A3A2",
    fontSize: 12,
  },
  centered: {
    textAlign: "center",
  },
  mainSideMenu: {
    backgroundColor: blue,
    minHeight: pageHeight,
    borderRadius: 0,
  },
};

ProjectBoard.propTypes = {
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  getProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  projects: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  getProjectCharts: PropTypes.func.isRequired,
  getProjectConnections: PropTypes.func.isRequired,
  getTeam: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    user: state.user.data,
    project: state.project.active,
    projects: state.project.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getProject: id => dispatch(getProject(id)),
    changeActiveProject: id => dispatch(changeActiveProject(id)),
    getProjectCharts: (projectId) => dispatch(getProjectCharts(projectId)),
    getProjectConnections: (projectId) => dispatch(getProjectConnections(projectId)),
    getTeam: (teamId) => dispatch(getTeam(teamId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectBoard));
