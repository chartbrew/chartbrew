import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useParams } from "react-router";
import {
  CircularProgress,
  Spacer,
} from "@heroui/react";

import "allotment/dist/style.css";

import { getProject, changeActiveProject, selectProject, getProjects } from "../../slices/project";
import {
  getTeam, getTeamMembers, selectTeam,
} from "../../slices/team";
import { getProjectCharts } from "../../slices/chart";
import canAccess from "../../config/canAccess";
import checkForUpdates from "../../modules/checkForUpdates";
import Container from "../../components/Container";
import Text from "../../components/Text";
import Row from "../../components/Row";
import { selectUser } from "../../slices/user";

/*
  The project screen where the dashboard, builder, etc. are
*/
function ProjectBoard() {
  const [loading, setLoading] = useState(true);
  const [setUpdate] = useState({});

  const team = useSelector(selectTeam);
  const project = useSelector(selectProject) || {};
  const user = useSelector(selectUser);

  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);

  useEffect(() => {
    if (params.projectId && !initRef.current && team?.id) {
      initRef.current = true;

      _init();

      checkForUpdates()
        .then((release) => {
          if (release && release.upToDate) return true;

          setUpdate(release);
          return release;
        });
    }
  }, [params, team]);

  const _init = (id) => {
    _getProject(id);
    dispatch(getProjectCharts({ project_id: id || params.projectId }));
    window.localStorage.setItem("__cb_active_team", team.id);
  };

  const _getProject = (id) => {
    let { projectId } = params;
    if (id) projectId = id;

    dispatch(getTeam(team.id))
      .then(() => {
        dispatch(getTeamMembers({ team_id: team.id }));
        dispatch(getProjects({ team_id: team.id }));
        window.localStorage.setItem("__cb_active_team", team.id);
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

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
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
      <div
        style={{ overflowY: "auto", height: "100%", overflowX: "hidden" }}
      >
        <div className="pl-0">
          <MainContent
            _canAccess={_canAccess}
          />
        </div>
      </div>
    </div>
  );
}

function MainContent() {
  return (
    <div className="w-full">
      <Outlet />
    </div>
  );
}

MainContent.propTypes = {
  onPrint: PropTypes.func.isRequired,
  _canAccess: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};

MainContent.defaultProps = {
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

export default ProjectBoard;
