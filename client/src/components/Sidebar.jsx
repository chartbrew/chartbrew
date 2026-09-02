import React, { useEffect, useMemo, useState } from "react"
import { Avatar, Badge, Button, Chip, Dropdown, Separator, Tooltip } from "@heroui/react"
import { useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { LuActivity, LuCheck, LuChevronDown, LuCoffee, LuGrid2X2Plus, LuLayers, LuLayers2, LuLayoutGrid, LuLogOut, LuMonitor, LuMoon, LuPlug, LuPlus, LuPuzzle, LuSettings, LuSun, LuUnplug, LuUser, LuUserPlus } from "react-icons/lu"

import { cn } from "../modules/utils"
import { useTheme } from "../modules/ThemeContext"
import canAccess from "../config/canAccess"
import { getBusinessProfileLogo, getTeamMembers, saveActiveTeam, selectTeam, selectTeams } from "../slices/team"
import { clearConnections } from "../slices/connection"
import { clearDatasets, getDatasets } from "../slices/dataset"
import { selectSidebarCollapsed } from "../slices/ui"
import { logout } from "../slices/user"
import { getActivityCounts } from "../api/observations"
import { shouldResumeOnboarding } from "../containers/Onboarding/onboardingState"

const getInitials = (name, fallback = "T") => name
  ?.split(" ")
  .map((part) => part[0])
  .join("")
  .slice(0, 2)
  .toUpperCase() || fallback;


function Sidebar() {
  const { theme, setTheme } = useTheme()
  const collapsed = useSelector(selectSidebarCollapsed);

  const [activityCount, setActivityCount] = useState(0);
  const [teamLogos, setTeamLogos] = useState({});
  
  const user = useSelector((state) => state.user);
  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const orderedTeams = useMemo(() => (
    team?.id ? [team, ...teams.filter((item) => `${item.id}` !== `${team.id}`)] : teams
  ), [team, teams]);
  const teamLogoUrl = teamLogos[team?.id] || null;
  const teamInitials = getInitials(team?.name);
  const userInitials = getInitials(user?.data?.name, "U");
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;
    const loadActivityCount = () => {
      if (!team?.id) return;
      getActivityCounts(team.id)
        .then((counts) => {
          if (active) setActivityCount(counts.total || 0);
        })
        .catch(() => {
          if (active) setActivityCount(0);
        });
    };
    loadActivityCount();
    window.addEventListener("cb:activity-updated", loadActivityCount);
    return () => {
      active = false;
      window.removeEventListener("cb:activity-updated", loadActivityCount);
    };
  }, [team?.id]);

  useEffect(() => {
    let active = true;
    const teamsWithoutLoadedLogos = orderedTeams.filter((item) => (
      item?.id
      && item.TeamBusinessProfile?.logoMimeType
      && !Object.prototype.hasOwnProperty.call(teamLogos, item.id)
    ));

    if (!teamsWithoutLoadedLogos.length) return () => { active = false; };

    Promise.all(teamsWithoutLoadedLogos.map((item) => (
      getBusinessProfileLogo(item.id)
        .then((url) => [item.id, url])
        .catch(() => [item.id, null])
    )))
      .then((entries) => {
        if (active) {
          setTeamLogos((current) => ({ ...current, ...Object.fromEntries(entries) }));
        }
      })

    return () => { active = false; };
  }, [orderedTeams, teamLogos]);

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getActiveMenu = () => {
    return window.location.pathname.split("/")[1];
  };

  const pathMenu = _getActiveMenu();
  const isHomeActive = pathMenu === "";
  const isDashboardActive = pathMenu === "dashboards" || window.location.pathname.indexOf("dashboard") > -1;
  const isActivityActive = pathMenu === "activity";
  const isConnectionsActive = pathMenu === "connections";
  const isDatasetsActive = pathMenu === "datasets";
  const isIntegrationsActive = pathMenu === "integrations";
  const isSettingsActive = pathMenu === "settings";

  const _getTeamRole = (teamRoles) => {
    const role = teamRoles?.find((item) => item.user_id === user.data.id)?.role;
    if (role === "teamOwner") return "Team owner";
    if (role === "teamAdmin") return "Team admin";
    if (role === "projectAdmin") return "Project admin";
    if (role === "projectEditor") return "Project editor";
    if (role === "projectViewer") return "Project viewer";
    return "Guest";
  };

  const _onChangeTeam = (teamId) => {
    const team = teams.find((t) => `${t.id}` === `${teamId}`);
    if (!team) return;

    dispatch(saveActiveTeam(team));
    dispatch(clearConnections());
    dispatch(clearDatasets());
    dispatch(getTeamMembers({ team_id: team.id }));
    dispatch(getDatasets({ team_id: team.id }));

    if (shouldResumeOnboarding(team, user.data.id)) {
      navigate(`/start?team=${team.id}`);
      return;
    }
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

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-surface border-r border-divider transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex flex-col">
          <Dropdown>
            <Dropdown.Trigger
              aria-label={`Switch team from ${team?.name || "current team"}`}
              className={cn(
                "group flex min-h-12 w-full cursor-pointer items-center text-foreground transition-colors hover:bg-default-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                collapsed ? "justify-center px-2" : "justify-between gap-3 px-4",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar key={team?.id} size="sm" className="h-7 w-7 shrink-0 rounded-lg bg-transparent">
                  {teamLogoUrl ? <Avatar.Image alt="" src={teamLogoUrl} /> : null}
                  <Avatar.Fallback className="rounded-lg">{teamInitials}</Avatar.Fallback>
                </Avatar>
                {collapsed ? null : (
                  <span className="truncate text-sm font-semibold">{team?.name}</span>
                )}
              </div>
              {collapsed ? null : (
                <LuChevronDown
                  aria-hidden
                  className="shrink-0 text-default-400 transition-colors group-hover:text-default-600"
                  size={16}
                />
              )}
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="Switch team"
                onAction={(key) => {
                  if (key === "createTeam") {
                    navigate("/start?new=1");
                    return;
                  }

                  if (`${key}` === `${team?.id}`) return;
                  _onChangeTeam(key);
                }}
              >
                {orderedTeams.map((t) => {
                  const isSelected = `${t.id}` === `${team?.id}`;

                  return (
                    <Dropdown.Item
                      aria-current={isSelected ? "true" : undefined}
                      id={`${t.id}`}
                      key={t.id}
                      textValue={t.name}
                    >
                      <div className="flex w-full items-center gap-3">
                        <Avatar size="sm" className="h-7 w-7 shrink-0 rounded-lg bg-transparent">
                          {teamLogos[t.id] ? <Avatar.Image alt="" src={teamLogos[t.id]} /> : null}
                          <Avatar.Fallback className="rounded-lg">{getInitials(t.name)}</Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{t.name}</div>
                          <div className="text-xs text-default-400">{_getTeamRole(t.TeamRoles)}</div>
                        </div>
                        {isSelected ? (
                          <>
                            <LuCheck aria-hidden className="shrink-0 text-accent" size={17} />
                            <span className="sr-only">Selected</span>
                          </>
                        ) : null}
                      </div>
                    </Dropdown.Item>
                  );
                })}
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

          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-2")}>
            <div className="h-2" />

            <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
              {collapsed ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={isHomeActive ? "secondary" : "ghost"}
                      fullWidth
                      isIconOnly
                      size="sm"
                      className="justify-center"
                      onPress={() => navigate("/")}
                    >
                      <LuCoffee size={20} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right">Home</Tooltip.Content>
                </Tooltip>
              ) : (
                <Button
                  variant={isHomeActive ? "secondary" : "ghost"}
                  fullWidth
                  size="sm"
                  className="justify-start"
                  onPress={() => navigate("/")}
                >
                  <LuCoffee size={18} />
                  Home
                </Button>
              )}
              {collapsed ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={isDashboardActive ? "secondary" : "ghost"}
                      fullWidth
                      isIconOnly
                      size="sm"
                      className="justify-center"
                      onPress={() => navigate("/dashboards")}
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
                  onPress={() => navigate("/dashboards")}
                >
                  <LuLayoutGrid size={18} />
                  Dashboards
                </Button>
              )}
              {collapsed ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Badge.Anchor className="relative inline-flex">
                      <Button
                        variant={isActivityActive ? "secondary" : "ghost"}
                        fullWidth
                        isIconOnly
                        size="sm"
                        className="justify-center"
                        onPress={() => navigate("/activity")}
                      >
                        <LuActivity size={20} />
                      </Button>
                      {activityCount > 0 ? (
                        <Badge
                          aria-label={`${activityCount} activity items need attention`}
                          color="accent"
                          size="sm"
                          variant="soft"
                        >
                          {activityCount > 99 ? "99+" : activityCount}
                        </Badge>
                      ) : null}
                    </Badge.Anchor>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="right">Activity</Tooltip.Content>
                </Tooltip>
              ) : (
                <Button
                  variant={isActivityActive ? "secondary" : "ghost"}
                  fullWidth
                  size="sm"
                  className="justify-start"
                  onPress={() => navigate("/activity")}
                >
                  <LuActivity size={18} />
                  Activity
                  {activityCount > 0 ? (
                    <Chip
                      aria-label={`${activityCount} activity items need attention`}
                      className="ml-auto text-[10px] rounded-full"
                      color="accent"
                      size="sm"
                      variant="soft"
                    >
                      <Chip.Label>
                        {activityCount > 99 ? "99+" : activityCount}
                      </Chip.Label>
                    </Chip>
                  ) : null}
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
                        onPress={() => navigate("/settings/team")}
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
                    onPress={() => navigate("/settings/team")}
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
                        onPress={() => navigate("/dashboards?create=dashboard")}
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
                    onPress={() => navigate("/dashboards?create=dashboard")}
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
                        onPress={() => navigate("/settings/team/members")}
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
                    onPress={() => navigate("/settings/team/members")}
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
    </aside>
  );
}

export default Sidebar
