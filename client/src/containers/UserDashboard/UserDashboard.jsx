import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router";

import LoadingScreen from "../../components/LoadingScreen";
import { relog } from "../../slices/user";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getProjects } from "../../slices/project";
import { getTeamConnections } from "../../slices/connection";
import {
  selectTeam, selectTeams, getTeams, saveActiveTeam, getTeamMembers,
} from "../../slices/team";

import DashboardList from "./DashboardList";
import Sidebar from "../../components/Sidebar";
import { cn } from "../../modules/utils";
import TopNav from "../../components/TopNav";
import { selectSidebarCollapsed } from "../../slices/ui";
import { getDatasets } from "../../slices/dataset";
import ChartbrewV5WelcomeModal from "./components/ChartbrewV5WelcomeModal";
import SettingsSidebar from "../Settings/SettingsSidebar";

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
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isSettings = location.pathname.startsWith("/settings");
  const isChartEditor = /^\/dashboard\/[^/]+\/chart\/[^/]+\/edit\/?$/.test(location.pathname);

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

        const welcome = new URLSearchParams(window.location.search).get("welcome");
        if (welcome) {
          navigate("/connections/new");
        }
      }        
    }
  }, [teams]);

  useEffect(() => {
    if (team?.id) {
      dispatch(getTeamMembers({ team_id: team.id }));
      dispatch(getTeamConnections({ team_id: team.id }));
      dispatch(getProjects({ team_id: team.id }));
      dispatch(getDatasets({ team_id: team.id }));
    }
  }, [team?.id]);

  const _checkParameters = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("__cb_goto")) {
      const gotoPage = params.get("__cb_goto");
      window.localStorage.removeItem("__cb_goto");
      navigate(gotoPage);
    }
  };

  if (!user.data.id || !team?.id) {
    return <LoadingScreen label="Loading your workspace" />;
  }

  return (
    <div className="dashboard bg-background" data-sidebar-collapsed={isChartEditor || collapsed}>
      {team?.id && (
        <div>
          {isSettings ? <SettingsSidebar /> : <Sidebar collapsed={isChartEditor || collapsed} />}

          <div
            className={cn(
              "min-h-screen transition-all duration-300",
              isSettings ? "md:ml-64" : (isChartEditor || collapsed ? "ml-16" : "ml-64")
            )}
          >
            {isSettings || isChartEditor ? null : <TopNav />}
            <div className={cn({
              "px-4 py-6 sm:px-8 md:px-10 md:py-10": isSettings,
              "p-0": !isSettings && isChartEditor,
              "px-6 py-4": !isSettings && !isChartEditor,
            })}>
              <Outlet />

              {window.location.pathname === "/user" && (
                <DashboardList />
              )}
            </div>
          </div>
        </div>
      )}

      {!isChartEditor && <div className="h-4" />}

      <ChartbrewV5WelcomeModal />
    </div>
  );
}

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
