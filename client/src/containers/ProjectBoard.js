import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Dimmer, Loader, Container, Icon, Grid,
  Menu, Dropdown, Popup, Image, Header,
} from "semantic-ui-react";
import SplitPane from "react-split-pane";

import { getProject, changeActiveProject } from "../actions/project";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { getTeam } from "../actions/team";
import { getProjectCharts } from "../actions/chart";
import { getProjectConnections } from "../actions/connection";
import Connections from "./Connections";
import ProjectDashboard from "./ProjectDashboard";
import AddChart from "./AddChart";
import Navbar from "../components/Navbar";
import { primary, blue, lightGray } from "../config/colors";
import cbLogo from "../assets/cb_logo_4_small.png";
import TeamMembers from "./TeamMembers";
import TeamSettings from "./TeamSettings";
import PublicDashboardEditor from "./PublicDashboardEditor";
import ProjectSettings from "./ProjectSettings";
import canAccess from "../config/canAccess";

const pageHeight = window.innerHeight;
/*
  Description
*/
class ProjectBoard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      menuSize: "large",
      showDrafts: true,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
    this._init();
    if (window.localStorage.getItem("_cb_menu_size")) {
      this._setMenuSize(window.localStorage.getItem("_cb_menu_size"), true);
    }
    if (window.localStorage.getItem("_cb_drafts")) {
      this._setDraftsVisible(window.localStorage.getItem("_cb_drafts") === "true");
    }
  }

  _init = () => {
    const { getProjectCharts, getProjectConnections, match } = this.props;

    this._getProject();
    getProjectCharts(match.params.projectId);
    getProjectConnections(match.params.projectId);
  }

  _getProject = (id) => {
    const {
      match, getProject, changeActiveProject, getTeam, project,
    } = this.props;
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
        this.setState({ loading: false });
      })
      .catch(() => {
        this.setState({ loading: false });
      });
  }

  _checkIfActive = (path) => {
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
  }

  _setMenuSize = (size, init) => {
    if (init) {
      this.setState({ menuSize: size });
      return;
    }

    let menuSize = "large";
    if (size < 250) {
      menuSize = "small";
    }

    this.setState({ menuSize });
    window.localStorage.setItem("_cb_menu_size", menuSize);
  }

  _setDraftsVisible = (isShowing) => {
    this.setState({ showDrafts: isShowing });
    window.localStorage.setItem("_cb_drafts", isShowing);
  }

  _getDefaultMenuSize() {
    const { menuSize } = this.state;
    if (menuSize === "small") return 70;
    if (menuSize === "large") return 250;
    if (window.localStorage.getItem("_cb_menu_size") === "small") {
      return 70;
    } else {
      return 250;
    }
  }

  _canAccess(role) {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  render() {
    const { project, projects, match } = this.props;
    const { loading, menuSize, showDrafts } = this.state;

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
          minSize={this._getDefaultMenuSize()}
          defaultSize={this._getDefaultMenuSize()}
          maxSize={this._getDefaultMenuSize()}
          step={180}
          style={{ paddingTop: 40 }}
          onChange={() => {}}
        >
          <div
            style={{ backgroundColor: primary, width: menuSize === "small" ? 70 : 250 }}
          >
            <Menu
              size="huge"
              fluid
              inverted
              vertical
              icon={menuSize === "small"}
              style={{ backgroundColor: blue, minHeight: pageHeight }}
            >
              <Menu.Item header>
                <Dropdown
                  text={menuSize === "large" ? project.name : null}
                  button={menuSize === "small"}
                  labeled={menuSize === "small"}
                  icon={menuSize === "small"
                    ? (
                      <Popup
                        trigger={<Icon name="list ul" size="large" />}
                        content="Switch projects"
                        position="right center"
                        inverted
                    />
                    ) : "list ul"}
                  item
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
                            setTimeout(() => { this._init(); });
                          }}
                        >
                          {project.name}
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              </Menu.Item>
              <Menu.Item>
                {menuSize === "large"
                  && (
                  <Menu.Header>
                    Project
                  </Menu.Header>
                  )}
                <Menu.Menu>
                  <Menu.Item
                    active={this._checkIfActive("dashboard")}
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

                  {this._canAccess("editor")
                    && (
                    <Menu.Item
                      active={this._checkIfActive("chart")}
                      as={Link}
                      to={`/${match.params.teamId}/${match.params.projectId}/chart`}
                    >
                      {menuSize === "small"
                        && (
                        <Popup
                          trigger={<Icon name="plus" size="large" />}
                          content="Add a new chart"
                          position="right center"
                          inverted
                        />
                        )}
                      {menuSize === "large" && <Icon name="plus" />}
                      {menuSize === "large" && "Add a new chart"}
                    </Menu.Item>
                    )}

                  {this._canAccess("editor")
                    && (
                    <Menu.Item
                      active={this._checkIfActive("connections")}
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

                  {this._canAccess("admin")
                    && (
                    <Menu.Item
                      active={this._checkIfActive("projectSettings")}
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
                    active={this._checkIfActive("public")}
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
                  <Menu.Item active={this._checkIfActive("members")} as={Link} to={`/${match.params.teamId}/${match.params.projectId}/members`}>
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

                  {this._canAccess("owner")
                    && (
                    <Menu.Item active={this._checkIfActive("settings")} as={Link} to={`/${match.params.teamId}/${match.params.projectId}/settings`}>
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
                {this._checkIfActive("dashboard") && (
                  <Popup
                    trigger={(
                      <Menu.Item onClick={() => this._setDraftsVisible(!showDrafts)}>
                        {menuSize === "small" && (
                          <>
                            <Header as="h6" inverted textAlign="center" style={styles.draftsHeader}>Drafts</Header>
                            <Icon name={showDrafts ? "toggle on" : "toggle off"} size="large" />
                          </>
                        )}
                        {menuSize === "large" && <Icon name={showDrafts ? "toggle on" : "toggle off"} size="large" />}
                        {menuSize === "large" && "Drafts toggle"}
                      </Menu.Item>
                    )}
                    content="Show or hide drafts"
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
                      onClick={() => this._setMenuSize(70)}
                      style={styles.absoluteCollapse}
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
                <Menu.Item onClick={() => this._setMenuSize(250)} style={styles.absoluteCollapse}>
                  <Popup
                    trigger={<Icon name="toggle right" size="large" />}
                    content="Expand menu"
                    position="right center"
                    inverted
                  />
                </Menu.Item>
                )}
              <Menu.Item header style={styles.absoluteLogo}>
                <Image size="mini" centered src={cbLogo} alt="bottle" />
              </Menu.Item>
            </Menu>
          </div>
          <div style={{ }}>
            <Grid columns={1} centered stackable>
              <Grid.Column width={16} computer={16} style={{ paddingLeft: 0 }}>
                <Container fluid>
                  <Switch>
                    <Route path="/:teamId/:projectId/dashboard" render={() => (<ProjectDashboard showDrafts={showDrafts} />)} />
                    {this._canAccess("editor") && <Route path="/:teamId/:projectId/connections" component={Connections} />}
                    {this._canAccess("editor") && <Route path="/:teamId/:projectId/chart/:chartId/edit" component={AddChart} />}
                    {this._canAccess("editor") && <Route path="/:teamId/:projectId/chart" component={AddChart} />}
                    {this._canAccess("admin") && <Route path="/:teamId/:projectId/projectSettings" render={() => (<ProjectSettings style={styles.teamSettings} />)} /> }
                    <Route path="/:teamId/:projectId/members" render={() => (<TeamMembers style={styles.teamSettings} />)} />
                    {this._canAccess("owner")
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
  },
  absoluteCollapse: {
    position: "absolute",
    bottom: 50,
    width: "100%",
  },
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
