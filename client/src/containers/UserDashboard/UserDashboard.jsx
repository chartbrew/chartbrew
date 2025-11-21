import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router";
import { useWindowSize } from "react-use";
import {
  Spacer, CircularProgress, Spinner,
} from "@heroui/react";

import { relog } from "../../slices/user";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getProjects } from "../../slices/project";
import { getTeamConnections } from "../../slices/connection";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import {
  selectTeam, selectTeams, getTeams, saveActiveTeam, getTeamMembers,
} from "../../slices/team";

import DashboardList from "./DashboardList";
import Sidebar from "../../components/Sidebar";
import { cn } from "../../modules/utils";
import TopNav from "../../components/TopNav";
import { selectSidebarCollapsed } from "../../slices/ui";
import { getDatasets } from "../../slices/dataset";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const { cleanErrors } = props;
  const collapsed = useSelector(selectSidebarCollapsed);

  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);

  const user = useSelector((state) => state.user);

  const teamsRef = useRef(null);
  const initRef = useRef(null);
  const { height } = useWindowSize();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();

    if (!initRef.current) {
      initRef.current = true;
      dispatch(relog())
        .then((data) => {
          if (data?.payload?.id) {
            return dispatch(getTeams());
          } else {
            throw new Error("No user");
          }
        })
        .catch(() => {
          navigate("/login");
        });
    }
  }, []);

  useEffect(() => {
    if (user.data.id && !user.loading) {
      _checkParameters();
    }
  }, [user]);

  useEffect(() => {
    if (teams && teams.length > 0 && !teamsRef.current) {
      teamsRef.current = true;
      let selectedTeam = teams.find((t) => t.TeamRoles.find((tr) => tr.role === "teamOwner" && tr.user_id === user.data.id));
      
      const storageActiveTeam = window.localStorage.getItem("__cb_active_team");
      if (storageActiveTeam) {
        const storageTeam = teams.find((t) => `${t.id}` === `${storageActiveTeam}`);
        if (storageTeam) selectedTeam = storageTeam;
      }
      
      if (selectedTeam) {
        dispatch(saveActiveTeam(selectedTeam));
        dispatch(getTeamMembers({ team_id: selectedTeam.id }));
        dispatch(getDatasets({ team_id: selectedTeam.id }));

        const welcome = new URLSearchParams(window.location.search).get("welcome");
        if (welcome) {
          navigate(`/${selectedTeam?.id}/connection/new`);
        }
      }        
    }
  }, [teams]);

  useEffect(() => {
    if (team?.id) {
      dispatch(getTeamMembers({ team_id: team.id }));
      dispatch(getTeamConnections({ team_id: team.id }));
      dispatch(getProjects({ team_id: team.id }));
    }
  }, [team]);

  const _checkParameters = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("__cb_goto")) {
      const gotoPage = params.get("__cb_goto");
      window.localStorage.removeItem("__cb_goto");
      navigate(gotoPage);
    }
  };

  if (!user.data.id) {
    return (
      <div style={styles.container(height)}>
        <Container sm>
          <Row justify="center" align="center">
            <CircularProgress aria-label="Loading" size="xl" />
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div className="dashboard bg-content2 min-h-screen">
      {team?.id && (
        <div className="min-h-screen">
          <Sidebar />

          <div
            className={cn(
              "min-h-screen transition-all duration-300",
              collapsed ? "ml-16" : "ml-64"
            )}
          >
            <TopNav />
            <div className="px-6 py-4">
              <Outlet />

              {window.location.pathname === "/user" && (
                <DashboardList />
              )}
            </div>
          </div>
        </div>
      )}

      <Spacer y={4} />

      {(teams && teams.length === 0) && (
        <div className="bg-content2 pt-10">
          <div className="flex justify-center items-center">
            <Spinner variant="simple" aria-label="Loading" />
          </div>
          <Spacer y={1} />
          <div className="flex justify-center items-center">
            <Text size="lg" className={"text-gray-400"}>Loading your space...</Text>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    // backgroundColor: "#103751",
    minHeight: height,
  }),
};

UserDashboard.propTypes = {
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
