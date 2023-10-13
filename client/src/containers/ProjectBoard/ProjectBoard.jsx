import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Outlet, Route, Routes, useNavigate, useParams } from "react-router";
import { Allotment } from "allotment";
import { createMedia } from "@artsy/fresnel";
import { useWindowSize } from "react-use";
import {
  CircularProgress,
  Spacer,
} from "@nextui-org/react";

import "allotment/dist/style.css";

import { getProject, changeActiveProject } from "../../actions/project";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import {
  getTeam as getTeamAction,
  getTeamMembers as getTeamMembersAction,
} from "../../actions/team";
import { getProjectCharts as getProjectChartsAction } from "../../actions/chart";
import { getProjectConnections } from "../../actions/connection";
import Connections from "../Connections/Connections";
import ProjectDashboard from "../ProjectDashboard/ProjectDashboard";
import AddChart from "../AddChart/AddChart";
import Navbar from "../../components/Navbar";
import TeamMembers from "../TeamMembers/TeamMembers";
import TeamSettings from "../TeamSettings";
import ProjectSettings from "../ProjectSettings";
import Integrations from "../Integrations/Integrations";
import canAccess from "../../config/canAccess";
import PrintView from "../PrintView/PrintView";
import ProjectNavigation from "./components/ProjectNavigation";
import checkForUpdates from "../../modules/checkForUpdates";
import Container from "../../components/Container";
import Text from "../../components/Text";
import Row from "../../components/Row";

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
    cleanErrors, getProjectCharts, getProjectConnections,
    getProject, changeActiveProject, getTeam, project, user, team, projects,
    getTeamMembers,
  } = props;

  const [loading, setLoading] = useState(true);
  const [menuSize, setMenuSize] = useState("small");
  const [showDrafts, setShowDrafts] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [update, setUpdate] = useState({});

  const { height } = useWindowSize();
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(document.location.search);
    if (params.has("new")) navigate("connections");

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
    getProjectCharts(id || params.projectId);
    getProjectConnections(id || params.projectId);
  };

  const _getProject = (id) => {
    let { projectId } = params;
    const { teamId } = params;
    if (id) projectId = id;

    getTeam(teamId)
      .then(() => {
        getTeamMembers(teamId);
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
    window.location.href = `/${params.teamId}/${id}/dashboard`;
  };

  if (!project.id && loading) {
    return (
      <Container style={styles.container}>
        <Spacer y={10} />
        <Row align="center" justify="center">
          <CircularProgress color="primary" size="xl" />
        </Row>
        <Spacer y={3} />
        <Row align="center" justify="center">
          <Text size="xl" className="text-gray-400">Loading the dashboard</Text>
        </Row>
      </Container>
    );
  }

  return (
    <div className="bg-content2">
      {isPrinting && (
        <Routes>
          <Route
            path="/:teamId/:projectId/dashboard"
            element={(
              <div style={{ textAlign: "center", width: "21cm" }}>
                <PrintView onPrint={_onPrint} isPrinting={isPrinting} />
              </div>
            )} />
        </Routes>
      )}

      {!isPrinting && (
        <>
          <Navbar />
          <Media greaterThan="mobile">
            {/* extract the navbar height from here */}
            <div style={{ height: height - 50 }}>
              <Allotment>
                <Allotment.Pane
                  minSize={_getDefaultMenuSize()}
                  maxSize={_getDefaultMenuSize()}
                  preferredSize={_getDefaultMenuSize()}
                  className="bg-content2"
                >
                  <div>
                    <ProjectNavigation
                      project={project}
                      projects={projects}
                      projectId={params.projectId}
                      teamId={params.teamId}
                      onChangeDrafts={_setDraftsVisible}
                      onSetMenuSize={(mSize) => _setMenuSize(mSize)}
                      canAccess={_canAccess}
                      menuSize={menuSize}
                      showDrafts={showDrafts}
                      onChangeProject={_onChangeProject}
                      update={update}
                    />
                  </div>
                </Allotment.Pane>
                <Allotment.Pane>
                  <div
                    style={{ overflowY: "auto", height: "100%", overflowX: "hidden" }}
                  >
                    <div className="pl-0">
                      <MainContent
                        showDrafts={showDrafts}
                        onPrint={_onPrint}
                        _canAccess={_canAccess}
                      />
                    </div>
                  </div>
                </Allotment.Pane>
              </Allotment>
            </div>
          </Media>

          <Media at="mobile">
            <div className="grid grid-cols-12">
              <div className="col-span-12">
                <MainContent
                  showDrafts={showDrafts}
                  onPrint={_onPrint}
                  _canAccess={_canAccess}
                  mobile
                />
              </div>
            </div>

            <Spacer y={8} />

            <ProjectNavigation
              project={project}
              projects={projects}
              projectId={params.projectId}
              teamId={params.teamId}
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
      <Outlet />
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
  page: {
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
  }
};

ProjectBoard.propTypes = {
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  getProject: PropTypes.func.isRequired,
  changeActiveProject: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  projects: PropTypes.array.isRequired,
  getProjectCharts: PropTypes.func.isRequired,
  getProjectConnections: PropTypes.func.isRequired,
  getTeam: PropTypes.func.isRequired,
  getTeamMembers: PropTypes.func.isRequired,
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
    getProjectCharts: (projectId) => dispatch(getProjectChartsAction(projectId)),
    getProjectConnections: (projectId) => dispatch(getProjectConnections(projectId)),
    getTeam: (teamId) => dispatch(getTeamAction(teamId)),
    getTeamMembers: (teamId) => dispatch(getTeamMembersAction(teamId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectBoard);
