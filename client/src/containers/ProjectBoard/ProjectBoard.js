import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";
import { Allotment } from "allotment";
import { createMedia } from "@artsy/fresnel";
import { useWindowSize } from "react-use";
import {
  Container, Grid, Loading, Row, Spacer, Text
} from "@nextui-org/react";

import "allotment/dist/style.css";

import { getProject, changeActiveProject } from "../../actions/project";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getTeam } from "../../actions/team";
import { getProjectCharts as getProjectChartsAction } from "../../actions/chart";
import { getProjectConnections } from "../../actions/connection";
import Connections from "../Connections/Connections";
import ProjectDashboard from "../ProjectDashboard/ProjectDashboard";
import AddChart from "../AddChart/AddChart";
import Navbar from "../../components/Navbar";
import TeamMembers from "../TeamMembers/TeamMembers";
import TeamSettings from "../TeamSettings";
import ProjectSettings from "../ProjectSettings";
import canAccess from "../../config/canAccess";
import PrintView from "../PrintView/PrintView";
import ProjectNavigation from "./components/ProjectNavigation";
import checkForUpdates from "../../modules/checkForUpdates";

const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
};
const AppMedia = createMedia({
  breakpoints,
});
const { Media } = AppMedia;

const sideMaxSize = 220;
const sideMinSize = 70;
/*
  The project screen where the dashboard, builder, etc. are
*/
function ProjectBoard(props) {
  const {
    cleanErrors, history, getProjectCharts, getProjectConnections, match,
    getProject, changeActiveProject, getTeam, project, user, team, projects,
  } = props;

  const [loading, setLoading] = useState(true);
  const [menuSize, setMenuSize] = useState("small");
  const [showDrafts, setShowDrafts] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [update, setUpdate] = useState({});

  const { height } = useWindowSize();

  useEffect(() => {
    const params = new URLSearchParams(document.location.search);
    if (params.has("new")) history.push("connections");

    cleanErrors();
    _init();
    if (window.localStorage.getItem("_cb_menu_size")) {
      _setMenuSize(window.localStorage.getItem("_cb_menu_size"), true);
    }
    if (window.localStorage.getItem("_cb_drafts")) {
      _setDraftsVisible(window.localStorage.getItem("_cb_drafts") === "true");
    }

    checkForUpdates()
      .then((release) => {
        if (release && release.upToDate) return true;

        setUpdate(release);
        return release;
      });
  }, []);

  const _init = (id) => {
    _getProject(id);
    getProjectCharts(id || match.params.projectId);
    getProjectConnections(id || match.params.projectId);
  };

  const _getProject = (id) => {
    let { projectId } = match.params;
    const { teamId } = match.params;
    if (id) projectId = id;

    getTeam(teamId)
      .then(() => {
        return getProject(projectId);
      })
      .then(() => {
        return changeActiveProject(projectId);
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _setMenuSize = (size, init) => {
    if (init) {
      setMenuSize(size);
      return;
    }
    let newMenuSize = "small";
    if (size > sideMinSize) {
      newMenuSize = "large";
    }
    setMenuSize(newMenuSize);
    window.localStorage.setItem("_cb_menu_size", newMenuSize);
  };

  const _setDraftsVisible = (isShowing) => {
    setShowDrafts(isShowing);
    window.localStorage.setItem("_cb_drafts", isShowing);
  };

  const _getDefaultMenuSize = () => {
    if (menuSize === "small") return sideMinSize;
    if (menuSize === "large") return sideMaxSize;
    if (window.localStorage.getItem("_cb_menu_size") === "small") {
      return sideMinSize;
    } else {
      return sideMaxSize;
    }
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _onPrint = () => {
    setIsPrinting(!isPrinting);
  };

  const _onChangeProject = (id) => {
    window.location.href = `/${match.params.teamId}/${id}/dashboard`;
  };

  if (!project.id && loading) {
    return (
      <Container style={styles.container}>
        <Spacer y={4} />
        <Row align="center" justify="center">
          <Loading type="points" color="currentColor" size="xl" />
        </Row>
        <Spacer y={1} />
        <Row align="center" justify="center">
          <Text size="1.4em" css={{ color: "$accents7" }}>Loading the dashboard...</Text>
        </Row>
      </Container>
    );
  }

  return (
    <div>
      {isPrinting && (
        <Switch>
          <Route
            path="/:teamId/:projectId/dashboard"
            render={() => (
              <div style={{ textAlign: "center", width: "21cm" }}>
                <PrintView onPrint={_onPrint} isPrinting={isPrinting} />
              </div>
            )} />
        </Switch>
      )}
      <Navbar />
      {!isPrinting && (
        <>
          <Media greaterThan="mobile">
            {/* extract the navbar height from here */}
            <div style={{ height: height - 50 }}>
              <Allotment
                defaultSizes={[sideMinSize, sideMaxSize]}
              >
                <Allotment.Pane
                  minSize={_getDefaultMenuSize()}
                  maxSize={_getDefaultMenuSize()}
                  preferredSize={_getDefaultMenuSize()}
                >
                  <ProjectNavigation
                    project={project}
                    projects={projects}
                    projectId={match.params.projectId}
                    teamId={match.params.teamId}
                    onChangeDrafts={_setDraftsVisible}
                    onSetMenuSize={(mSize) => _setMenuSize(mSize)}
                    canAccess={_canAccess}
                    menuSize={menuSize}
                    showDrafts={showDrafts}
                    onChangeProject={_onChangeProject}
                    update={update}
                  />
                </Allotment.Pane>
                <Allotment.Pane>
                  <div
                    style={{ overflowY: "auto", height: "100%", overflowX: "hidden" }}
                  >
                    <Grid.Container>
                      <Grid xs={12} style={{ paddingLeft: 0 }}>
                        <MainContent
                          showDrafts={showDrafts}
                          onPrint={_onPrint}
                          _canAccess={_canAccess}
                        />
                      </Grid>
                    </Grid.Container>
                  </div>
                </Allotment.Pane>
              </Allotment>
            </div>
          </Media>

          <Media at="mobile">
            <Grid.Container>
              <Grid xs={12}>
                <MainContent
                  showDrafts={showDrafts}
                  onPrint={_onPrint}
                  _canAccess={_canAccess}
                  mobile
                    />
              </Grid>
            </Grid.Container>

            <Spacer y={4} />

            <ProjectNavigation
              project={project}
              projects={projects}
              projectId={match.params.projectId}
              teamId={match.params.teamId}
              onChangeDrafts={_setDraftsVisible}
              onSetMenuSize={(mSize) => _setMenuSize(mSize)}
              canAccess={_canAccess}
              menuSize={menuSize}
              showDrafts={showDrafts}
              onChangeProject={_onChangeProject}
              mobile
            />
          </Media>
        </>
      )}
    </div>
  );
}

function MainContent(props) {
  const {
    showDrafts, onPrint, _canAccess, mobile
  } = props;

  return (
    <div style={{ width: "100%" }}>
      <Switch>
        <Route
          exact
          path="/:teamId/:projectId/dashboard"
          render={() => (
            <ProjectDashboard showDrafts={showDrafts} onPrint={onPrint} mobile={mobile} />
          )}
        />
        {_canAccess("editor") && <Route path="/:teamId/:projectId/connections" component={Connections} />}
        {_canAccess("editor") && <Route path="/:teamId/:projectId/chart/:chartId/edit" component={AddChart} />}
        {_canAccess("editor") && <Route path="/:teamId/:projectId/chart" component={AddChart} />}
        {_canAccess("admin") && <Route path="/:teamId/:projectId/projectSettings" render={() => (<ProjectSettings style={styles.teamSettings} />)} />}
        <Route
          path="/:teamId/:projectId/members"
          render={() => (
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
              <TeamMembers style={styles.teamSettings} />
            </Container>
          )}
        />
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
      </Switch>
    </div>
  );
}

MainContent.propTypes = {
  showDrafts: PropTypes.bool,
  onPrint: PropTypes.func.isRequired,
  _canAccess: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};

MainContent.defaultProps = {
  showDrafts: true,
  mobile: false,
};

const styles = {
  // center the div in the middle of the screen
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    overflow: "hidden",
  },
  teamSettings: {
    padding: 20,
    paddingLeft: 30,
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
    getProjectCharts: (projectId) => dispatch(getProjectChartsAction(projectId)),
    getProjectConnections: (projectId) => dispatch(getProjectConnections(projectId)),
    getTeam: (teamId) => dispatch(getTeam(teamId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ProjectBoard));
