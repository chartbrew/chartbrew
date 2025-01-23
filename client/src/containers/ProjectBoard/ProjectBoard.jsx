import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Outlet, Route, Routes, useParams } from "react-router";
import { Allotment } from "allotment";
import { useWindowSize } from "react-use";
import {
  CircularProgress,
  Spacer,
} from "@heroui/react";

import "allotment/dist/style.css";

import { getProject, changeActiveProject, selectProjects, selectProject, getProjects } from "../../slices/project";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import {
  getTeam, getTeamMembers, selectTeam,
} from "../../slices/team";
import { getProjectCharts } from "../../slices/chart";
import Navbar from "../../components/Navbar";
import canAccess from "../../config/canAccess";
import PrintView from "../PrintView/PrintView";
import ProjectNavigation from "./components/ProjectNavigation";
import checkForUpdates from "../../modules/checkForUpdates";
import Container from "../../components/Container";
import Text from "../../components/Text";
import Row from "../../components/Row";

const sideMaxSize = 220;
const sideMinSize = 70;
/*
  The project screen where the dashboard, builder, etc. are
*/
function ProjectBoard(props) {
  const {
    cleanErrors, user,
  } = props;

  const [loading, setLoading] = useState(true);
  const [menuSize, setMenuSize] = useState("small");
  const [showDrafts, setShowDrafts] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [update, setUpdate] = useState({});

  const team = useSelector(selectTeam);
  const projects = useSelector(selectProjects);
  const project = useSelector(selectProject) || {};

  const { height } = useWindowSize();
  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);

  useEffect(() => {
    if (params.projectId && !initRef.current) {
      initRef.current = true;

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
    }
  }, [params]);

  const _init = (id) => {
    _getProject(id);
    dispatch(getProjectCharts({ project_id: id || params.projectId }));
    window.localStorage.setItem("__cb_active_team", team.id);
  };

  const _getProject = (id) => {
    let { projectId } = params;
    const { teamId } = params;
    if (id) projectId = id;

    dispatch(getTeam(teamId))
      .then(() => {
        dispatch(getTeamMembers({ team_id: teamId }));
        dispatch(getProjects({ team_id: teamId }));
        window.localStorage.setItem("__cb_active_team", teamId);
        return dispatch(getProject({ project_id: projectId }));
      })
      .then(() => {
        return dispatch(changeActiveProject(projectId));
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

  if (!project && loading) {
    return (
      <Container style={styles.container}>
        <Spacer y={10} />
        <Row align="center" justify="center">
          <CircularProgress color="primary" size="xl" aria-label="Loading the dashboard" />
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
          {/* extract the navbar height from here */}
          <div style={{ height: height - 50 }} className="hidden sm:block">
            <Allotment>
              <Allotment.Pane
                minSize={_getDefaultMenuSize()}
                maxSize={_getDefaultMenuSize()}
                preferredSize={_getDefaultMenuSize()}
                className="bg-content2 transition-all"
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
              <Allotment.Pane className="transition-all">
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

          <div className="block sm:hidden">
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
          </div>
        </>
      )}
    </div>
  );
}

function MainContent() {
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
  user: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectBoard);
