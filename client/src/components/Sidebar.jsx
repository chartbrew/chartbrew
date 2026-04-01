import React, { useState } from "react"
import { Avatar, Button, Chip, Dropdown, Input, Modal, Separator, Tooltip } from "@heroui/react"
import { Link, useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { LuChevronDown, LuGrid2X2Plus, LuLayers, LuLayers2, LuLayoutGrid, LuLogOut, LuMonitor, LuMoon, LuPlug, LuPlus, LuPuzzle, LuSettings, LuSun, LuUnplug, LuUser, LuUserPlus, LuUsers } from "react-icons/lu"

import { cn } from "../modules/utils"
import { useTheme } from "../modules/ThemeContext"
import cbLogoDark from "../assets/cb_logo_dark.svg"
import cbLogoLight from "../assets/cb_logo_light.svg"
import cbLogoSmallDark from "../assets/logo_blue.png";
import cbLogoSmallLight from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess"
import { createTeam, getTeamMembers, saveActiveTeam, selectTeam, selectTeams } from "../slices/team"
import { clearConnections } from "../slices/connection"
import { clearDatasets, getDatasets } from "../slices/dataset"
import { selectSidebarCollapsed } from "../slices/ui"
import toast from "react-hot-toast"
import { logout } from "../slices/user"


function Sidebar() {
  const { isDark, theme, setTheme } = useTheme()
  const collapsed = useSelector(selectSidebarCollapsed);

  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  
  const user = useSelector((state) => state.user);
  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const teamInitials = team?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
  const userInitials = user?.data?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getActiveMenu = () => {
    return window.location.pathname.split("/")[1];
  };

  const pathMenu = _getActiveMenu();
  const isDashboardActive = pathMenu === "" || window.location.pathname.indexOf("dashboard") > -1;
  const isConnectionsActive = pathMenu === "connections";
  const isDatasetsActive = pathMenu === "datasets";
  const isIntegrationsActive = pathMenu === "integrations";
  const isSettingsActive = pathMenu === "settings";

  const _getTeamRole = (teamRoles) => {
    if (!teamRoles) return "";
    let role = teamRoles.filter((o) => o.user_id === user.data.id)[0];
    if (role.role === "teamOwner") {
      return {
        role: "Team Owner",
        color: "accent",
      };
    } else if (role.role === "teamAdmin") {
      return {
        role: "Team Admin",
        color: "success",
      };
    } else if (role.role === "projectAdmin") {
      return {
        role: "Project Admin",
        color: "warning",
      };
    } else if (role.role === "projectEditor") {
      return {
        role: "Project Editor",
        color: "default",
      };
    } else if (role.role === "projectViewer") {
      return {
        role: "Project Viewer",
        color: "default",
      };
    }

    return {
      role: "Guest",
      color: "default",
    };
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

  const _getTheme = () => {
    if (theme === "system") {
      return {
        name: "System",
        icon: <LuMonitor size={18} />,
      };
    } else if (theme === "light") {
      return {
        name: "Light",
        icon: <LuSun size={18} />,
      };
    } else if (theme === "dark") {
      return {
        name: "Dark",
        icon: <LuMoon size={18} />,
      };
    }
  }

  const _onCycleTheme = () => {
    if (theme === "system") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    }
  };

  const _onCreateTeam = async () => {
    setCreatingTeam(true);
    const teamData = await dispatch(createTeam({ name: teamName }));
    if (teamData.error) {
      toast.error(teamData.error);
    }

    setCreateTeamModal(false);
    setTeamName("");
    setCreatingTeam(false);
  };


  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-surface border-r border-divider transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex flex-col">
          <Link to="/" className="flex items-center justify-center h-16 px-4">
            {collapsed ? (
              <img src={isDark ? cbLogoSmallDark : cbLogoSmallLight} alt="Chartbrew Logo" width={40} />
            ) : (
              <img src={isDark ? cbLogoDark : cbLogoLight} alt="Chartbrew Logo" width={150} />
            )}
          </Link>

          {collapsed && <Separator className="mb-4" />}

          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-2")}>
            <div className={cn(collapsed ? "" : "px-2")}>
              <Dropdown>
                <Dropdown.Trigger className="w-full">
                  {collapsed ? (
                    <Avatar size="sm" className="cursor-pointer rounded-md" color="accent">
                      <Avatar.Fallback>{teamInitials || <LuUsers size={18} />}</Avatar.Fallback>
                    </Avatar>
                  ) : (
                    <Button
                      variant="outline"
                      className="justify-between border"
                      fullWidth
                    >
                      <span>{team?.name}</span>
                      <LuChevronDown />
                    </Button>
                  )}
                </Dropdown.Trigger>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    onAction={(key) => {
                      if (key === "createTeam") {
                        setCreateTeamModal(true);
                        return;
                      }

                      _onChangeTeam(key);
                    }}
                  >
                  {teams.map((t) => (
                    <Dropdown.Item
                      id={`${t.id}`}
                      key={t.id}
                      textValue={t.name}
                    >
                      <div className="flex w-full flex-row items-center justify-between gap-2">
                        <span>{t.name}</span>
                        <Chip size="sm" variant="secondary" color={_getTeamRole(t.TeamRoles).color}>
                          {_getTeamRole(t.TeamRoles).role}
                        </Chip>
                      </div>
                    </Dropdown.Item>
                  ))}
                  <Dropdown.Item
                    id="createTeam"
                    key="createTeam"
                    textValue="Add new team"
                  >
                    <div className="flex w-full flex-row items-center justify-between gap-2">
                      <span>Add new team</span>
                      <LuPlus size={18} />
                    </div>
                  </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>

            <div className="h-4" />
            <Separator />
            <div className="h-2" />

            <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
              {collapsed ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={isDashboardActive ? "secondary" : "ghost"}
                      fullWidth
                      isIconOnly
                      size="sm"
                      className="justify-center"
                      onPress={() => navigate("/")}
                    >
                      <LuLayoutGrid size={20} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right">Dashboards</Tooltip.Content>
                </Tooltip>
              ) : (
                <Button
                  variant={isDashboardActive ? "secondary" : "ghost"}
                  fullWidth
                  size="sm"
                  className="justify-start"
                  onPress={() => navigate("/")}
                >
                  <LuLayoutGrid size={18} />
                  Dashboards
                </Button>
              )}
              {_canAccess("teamAdmin", team.TeamRoles) && (
                collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={isConnectionsActive ? "secondary" : "ghost"}
                        fullWidth
                        isIconOnly
                        size="sm"
                        className={cn("justify-center", "connection-tutorial")}
                        onPress={() => navigate("/connections")}
                      >
                        <LuPlug size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Connections</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant={isConnectionsActive ? "secondary" : "ghost"}
                    fullWidth
                    size="sm"
                    className={cn("justify-start", "connection-tutorial")}
                    onPress={() => navigate("/connections")}
                  >
                    <LuPlug size={18} />
                    Connections
                  </Button>
                )
              )}
              {_canAccess("projectAdmin", team.TeamRoles) && (
                collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={isDatasetsActive ? "secondary" : "ghost"}
                        fullWidth
                        isIconOnly
                        size="sm"
                        className={cn("justify-center", "dataset-tutorial")}
                        onPress={() => navigate("/datasets")}
                      >
                        <LuLayers size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Datasets</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant={isDatasetsActive ? "secondary" : "ghost"}
                    fullWidth
                    size="sm"
                    className={cn("justify-start", "dataset-tutorial")}
                    onPress={() => navigate("/datasets")}
                  >
                    <LuLayers size={18} />
                    Datasets
                  </Button>
                )
              )}
              {_canAccess("teamAdmin", team.TeamRoles) && (
                collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={isIntegrationsActive ? "secondary" : "ghost"}
                        fullWidth
                        isIconOnly
                        size="sm"
                        className={cn("justify-center", "dataset-tutorial")}
                        onPress={() => navigate("/integrations")}
                      >
                        <LuPuzzle size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Integrations</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant={isIntegrationsActive ? "secondary" : "ghost"}
                    fullWidth
                    size="sm"
                    className={cn("justify-start", "dataset-tutorial")}
                    onPress={() => navigate("/integrations")}
                  >
                    <LuPuzzle size={18} />
                    Integrations
                  </Button>
                )
              )}
              {_canAccess("teamAdmin", team.TeamRoles) && (
                collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={isSettingsActive ? "secondary" : "ghost"}
                        fullWidth
                        isIconOnly
                        size="sm"
                        className={cn("justify-center", "team-settings-tutorial")}
                        onPress={() => navigate("/settings/members")}
                      >
                        <LuSettings size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Settings</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant={isSettingsActive ? "secondary" : "ghost"}
                    fullWidth
                    size="sm"
                    className={cn("justify-start", "team-settings-tutorial")}
                    onPress={() => navigate("/settings/members")}
                  >
                    <LuSettings size={18} />
                    Settings
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="h-4" />

          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-4 flex flex-col items-start justify-center")}>
            {_canAccess("teamAdmin", team.TeamRoles) && (
              <>
                <div className="text-sm text-gray-500">
                  {collapsed ? "" : "Quick actions"}
                </div>
                <div className="h-2" />
                {collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onPress={() => navigate("/?create=dashboard")}
                        isIconOnly
                        fullWidth
                        className="justify-center"
                      >
                        <LuGrid2X2Plus size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Create a new dashboard</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => navigate("/?create=dashboard")}
                    fullWidth
                    className="justify-start"
                  >
                    <LuGrid2X2Plus size={18} />New dashboard
                  </Button>
                )}
                <div className="h-1" />
                {collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onPress={() => navigate("/datasets/new")}
                        isIconOnly
                        fullWidth
                        className="justify-center"
                      >
                        <LuLayers2 size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Create a new dataset</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => navigate("/datasets/new")}
                    fullWidth
                    className="justify-start"
                  >
                    <LuLayers2 size={18} />New dataset
                  </Button>
                )}
                <div className="h-1" />
                {collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onPress={() => navigate("/connections/new")}
                        isIconOnly
                        fullWidth
                        className="justify-center"
                      >
                        <LuUnplug size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Create a new connection</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => navigate("/connections/new")}
                    fullWidth
                    className="justify-start"
                  >
                    <LuUnplug size={18} />New connection
                  </Button>
                )}
                <div className="h-1" />
                {collapsed ? (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onPress={() => navigate("/settings/members")}
                        isIconOnly
                        fullWidth
                        className="justify-center"
                      >
                        <LuUserPlus size={20} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">Add a team member</Tooltip.Content>
                  </Tooltip>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() => navigate("/settings/members")}
                    fullWidth
                    className="justify-start"
                  >
                    <LuUserPlus size={18} />Add team member
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-2")}>
            {collapsed ? (
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    onPress={() => _onCycleTheme()}
                    variant="tertiary"
                    size="sm"
                    isIconOnly
                    fullWidth
                    className="justify-center"
                  >
                    {_getTheme().icon}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="right">Change theme</Tooltip.Content>
              </Tooltip>
            ) : (
              <Button
                variant="tertiary"
                onPress={() => _onCycleTheme()}
                fullWidth
                className="justify-start"
              >
                {_getTheme().icon}{_getTheme().name}
              </Button>
            )}
          </div>
          <div className="h-2" />
          <Separator />
          <div className="h-2" />
          <Dropdown>
            <Dropdown.Trigger>
              <div className={cn("flex flex-row items-center gap-1 justify-start cursor-pointer", collapsed ? "px-0 justify-center" : "px-4")}>
                <Avatar size="sm">
                  <Avatar.Fallback>{userInitials || <LuUser />}</Avatar.Fallback>
                </Avatar>
                {collapsed ? null : (
                  <div className="flex flex-col items-start pl-2">
                    <div className="text-sm text-foreground">
                      {user?.data?.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user?.data?.email}
                    </div>
                  </div>
                )}
              </div>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === "profile") {
                    navigate("/settings/profile");
                    return;
                  }

                  if (key === "logout") {
                    dispatch(logout());
                  }
                }}
              >
                <Dropdown.Item id="profile" textValue="Profile">
                  <div className="flex flex-row items-center gap-2">
                    <LuUser size={18} />
                    <span>Profile</span>
                  </div>
                </Dropdown.Item>

                <Dropdown.Item id="logout" textValue="Sign out" variant="danger">
                  <div className="flex flex-row items-center gap-2">
                    <LuLogOut size={18} />
                    <span>Sign out</span>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <div className="h-2" />
        </div>
      </div>

      <Modal.Backdrop isOpen={createTeamModal} onOpenChange={setCreateTeamModal}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Create a new team</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
            <Input
              label="Team name"
              placeholder="Enter your new team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              variant="secondary"
            />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={() => setCreateTeamModal(false)}>
              Close
            </Button>
            <Button
              isPending={creatingTeam}
              onPress={_onCreateTeam}
              isDisabled={!teamName}
            >
              Create team
            </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </aside>
  );
}

export default Sidebar
