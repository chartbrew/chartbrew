import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Spacer, Chip, CircularProgress,
  DropdownTrigger, Dropdown, DropdownMenu, DropdownItem, Listbox, ListboxItem,
} from "@heroui/react";
import {
  LuChevronDown, LuDatabase, LuLayoutGrid, LuPlug, LuPuzzle, LuSettings, LuUsers,
} from "react-icons/lu";

import { relog } from "../../slices/user";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getProjects } from "../../slices/project";
import { clearConnections, getTeamConnections } from "../../slices/connection";
import Navbar from "../../components/Navbar";
import canAccess from "../../config/canAccess";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import {
  selectTeam, selectTeams, getTeams, saveActiveTeam, getTeamMembers,
} from "../../slices/team";
import { clearDatasets, getDatasets } from "../../slices/dataset";
import Segment from "../../components/Segment";
import NoticeBoard from "./components/NoticeBoard";
import DashboardList from "./DashboardList";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const { cleanErrors } = props;

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
            return dispatch(getTeams(data.payload.id));
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
      
      if (!selectedTeam) return;
      dispatch(saveActiveTeam(selectedTeam));
      dispatch(getTeamMembers({ team_id: selectedTeam.id }));
      dispatch(getDatasets({ team_id: selectedTeam.id }));

      const welcome = new URLSearchParams(window.location.search).get("welcome");
      if (welcome) {
        navigate(`/${selectedTeam?.id}/connection/new`);
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

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getTeamRole = (teamRoles) => {
    return teamRoles.filter((o) => o.user_id === user.data.id)[0].role;
  };

  const _onChangeTeam = (teamId) => {
    const team = teams.find((t) => `${t.id}` === `${teamId}`);
    if (!team) return;

    dispatch(saveActiveTeam(team));
    dispatch(clearConnections());
    dispatch(clearDatasets());
    dispatch(getTeamMembers({ team_id: team.id }));
    dispatch(getDatasets({ team_id: team.id }));

    navigate("/");
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

  const _getActiveMenu = () => {
    return window.location.pathname.split("/")[1];
  };

  return (
    <div className="dashboard bg-content2 flex flex-col min-h-screen h-full">
      <Navbar hideTeam transparent />
      <div className="container mx-auto px-4">
        <Spacer y={4} />

        {team?.id && (
          <div className="grid grid-cols-12 gap-4 mt-4">
            <div className="col-span-12 sm:col-span-5 md:col-span-4 lg:col-span-3">
              <Row
                align={"center"}
                justify={"space-between"}
              >
                <Row justify="flex-start" align="center" className={"w-full"}>
                  <Dropdown aria-label="Select a team option">
                    <DropdownTrigger>
                      <Button
                        startContent={<LuUsers size={28} />}
                        variant="bordered"
                        className="bg-background"
                        endContent={<LuChevronDown />}
                        fullWidth
                      >
                        {team.name}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectedKeys={[`${team.id}`]}
                      onSelectionChange={(keys) => {
                        _onChangeTeam(keys.currentKey);
                      }}
                      selectionMode="single"
                    >
                      {teams.map((t) => (
                        <DropdownItem
                          key={t.id}
                          textValue={t.name}
                          endContent={(
                            <Chip size="sm" variant="flat" color="primary">
                              {_getTeamRole(t.TeamRoles)}
                            </Chip>
                          )}
                        >
                          {t.name}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </Row>
              </Row>

              <Spacer y={4} />
              <Segment className={"p-1 sm:p-1 md:p-1 bg-content1 rounded-xl"}>
                <Listbox aria-label="Actions" variant="faded">
                  <ListboxItem
                    key="projects"
                    startContent={<LuLayoutGrid size={24} />}
                    textValue="Dashboards"
                    color={_getActiveMenu() === "" ? "primary" : "default"}
                    className={_getActiveMenu() === "" ? "bg-content2 text-primary" : "text-foreground"}
                    onClick={() => navigate("/")}
                  >
                    <span className="text-lg">Dashboards</span>
                  </ListboxItem>
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      key="connections"
                      startContent={<LuPlug size={24} />}
                      textValue="Connections"
                      color={_getActiveMenu() === "connections" ? "primary" : "default"}
                      className={_getActiveMenu() === "connections" ? "bg-content2 text-primary connection-tutorial" : "connection-tutorial"}
                      onClick={() => navigate("/connections")}
                    >
                      <span className="text-lg">Connections</span>
                    </ListboxItem>
                  )}
                  {_canAccess("projectEditor", team.TeamRoles) && (
                    <ListboxItem
                      key="datasets"
                      startContent={<LuDatabase size={24} />}
                      textValue="Datasets"
                      color={_getActiveMenu() === "datasets" ? "primary" : "default"}
                      className={_getActiveMenu() === "datasets" ? "bg-content2 text-primary dataset-tutorial" : "dataset-tutorial"}
                      onClick={() => navigate("/datasets")}
                    >
                      <span className="text-lg">Datasets</span>
                    </ListboxItem>
                  )}
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      key="integrations"
                      showDivider={_canAccess("teamAdmin", team.TeamRoles)}
                      startContent={<LuPuzzle size={24} />}
                      textValue="Integrations"
                      color={_getActiveMenu() === "integrations" ? "primary" : "default"}
                      className={_getActiveMenu() === "integrations" ? "bg-content2 text-primary dataset-tutorial" : "dataset-tutorial"}
                      onClick={() => navigate("/integrations")}
                    >
                      <span className="text-lg">Integrations</span>
                    </ListboxItem>
                  )}
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      key="teamSettings"
                      startContent={<LuSettings size={24} />}
                      textValue="Team settings"
                      color={"default"}
                      className={"text-foreground team-settings-tutorial"}
                      onClick={() => navigate(`/manage/${team.id}/settings`)}
                    >
                      <span className="text-lg">Team settings</span>
                    </ListboxItem>
                  )}
                </Listbox>
              </Segment>

              <NoticeBoard />
            </div>

            <div className="col-span-12 sm:col-span-7 md:col-span-8 lg:col-span-9">
              <Outlet />

              {window.location.pathname === "/user" && (
                <DashboardList />
              )}
            </div>
          </div>
        )}

        <Spacer y={4} />

        {(teams && teams.length === 0) && (
          <>
            <Row align="center" justify="center">
              <CircularProgress aria-label="Loading" size="xl" />
            </Row>
            <Spacer y={1} />
            <Row align="center" justify="center">
              <Text size="lg" className={"text-gray-400"}>Loading your space</Text>
            </Row>
          </>
        )}
      </div>
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
