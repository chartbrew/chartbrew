import React, { useState } from "react"
import { Avatar, Button, Chip, Divider, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Image, Input, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer } from "@heroui/react"
import { Link, useNavigate } from "react-router"
import { useDispatch, useSelector } from "react-redux"
import { LuChevronDown, LuDatabase, LuLayoutGrid, LuLogOut, LuMonitor, LuMoon, LuPlug, LuPlus, LuPuzzle, LuSettings, LuSun, LuUser, LuUsers } from "react-icons/lu"

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
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getActiveMenu = () => {
    return window.location.pathname.split("/")[1];
  };

  const _getTeamRole = (teamRoles) => {
    if (!teamRoles) return "";
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
        "fixed left-0 top-0 z-40 h-screen bg-content1 border-r border-divider transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex flex-col">
          <Link to="/" className="flex items-center justify-start h-16 px-4">
            {collapsed ? (
              <Image src={isDark ? cbLogoSmallDark : cbLogoSmallLight} alt="Chartbrew Logo" width={40} radius="none" />
            ) : (
              <Image src={isDark ? cbLogoDark : cbLogoLight} alt="Chartbrew Logo" width={120} radius="none" />
            )}
          </Link>

          {collapsed && <Divider className="mb-4" />}

          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-2")}>
            <div className={cn(collapsed ? "" : "px-2")}>
              <Dropdown aria-label="Select a team option">
                <DropdownTrigger>
                  {collapsed ? (
                    <Avatar
                      name={team?.name}
                      radius="md"
                      className="cursor-pointer"
                      size="sm"
                      isBordered
                      showFallback={<LuUsers size={18} />}
                      color="primary"
                    />
                  ) : (
                    <Button
                      variant="bordered"
                      className="justify-between border-1"
                      endContent={<LuChevronDown />}
                      fullWidth
                    >
                      {team?.name}
                    </Button>
                  )}
                </DropdownTrigger>
                <DropdownMenu
                  selectedKeys={[`${team.id}`]}
                  onSelectionChange={(keys) => {
                    _onChangeTeam(keys.currentKey);
                  }}
                  selectionMode="single"
                >
                  {teams.map((t, index) => (
                    <DropdownItem
                      key={t.id}
                      textValue={t.name}
                      endContent={(
                        <Chip size="sm" variant="flat" color="primary">
                          {_getTeamRole(t.TeamRoles)}
                        </Chip>
                      )}
                      showDivider={index === teams.length - 1}
                    >
                      {t.name}
                    </DropdownItem>
                  ))}
                  <DropdownItem
                    key="createTeam"
                    textValue="Add new team"
                    onClick={() => setCreateTeamModal(true)}
                    color="primary"
                    endContent={<LuPlus size={18} />}
                  >
                    Add new team
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>

            <Spacer y={4} />
            <Divider />
            <Spacer y={2} />

            <Listbox aria-label="Actions" variant="flat" classNames={{ list: "flex flex-col items-center" }}>
              <ListboxItem
                key="projects"
                startContent={collapsed ? null : <LuLayoutGrid size={18} />}
                textValue="Dashboards"
                color={_getActiveMenu() === "" || window.location.pathname.indexOf("dashboard") > -1 ? "primary" : "default"}
                className={cn(collapsed && "max-w-min text-center", _getActiveMenu() === "" || window.location.pathname.indexOf("dashboard") > -1 ? "bg-content2 text-primary" : "text-foreground")}
                onClick={() => navigate("/")}
              >
                {collapsed ? <LuLayoutGrid size={20} /> : <span className="text-sm">Dashboards</span>}
              </ListboxItem>
              {_canAccess("teamAdmin", team.TeamRoles) && (
                <ListboxItem
                  key="connections"
                  startContent={collapsed ? null : <LuPlug size={18} />}
                  textValue="Connections"
                  color={_getActiveMenu() === "connections" ? "primary" : "default"}
                  className={cn(collapsed && "max-w-min text-center", _getActiveMenu() === "connections" ? "bg-content2 text-primary connection-tutorial" : "connection-tutorial")}
                  onClick={() => navigate("/connections")}
                >
                  {collapsed ? <LuPlug size={20} /> : <span className="text-sm">Connections</span>}
                </ListboxItem>
              )}
              {_canAccess("projectEditor", team.TeamRoles) && (
                <ListboxItem
                  key="datasets"
                  startContent={collapsed ? null : <LuDatabase size={18} />}
                  textValue="Datasets"
                  color={_getActiveMenu() === "datasets" ? "primary" : "default"}
                  className={cn(collapsed && "max-w-min text-center", _getActiveMenu() === "datasets" ? "bg-content2 text-primary dataset-tutorial" : "dataset-tutorial")}
                  onClick={() => navigate("/datasets")}
                >
                  {collapsed ? <LuDatabase size={20} /> : <span className="text-sm">Datasets</span>}
                </ListboxItem>
              )}
              {_canAccess("teamAdmin", team.TeamRoles) && (
                <ListboxItem
                  key="integrations"
                  startContent={collapsed ? null : <LuPuzzle size={18} />}
                  textValue="Integrations"
                  color={_getActiveMenu() === "integrations" ? "primary" : "default"}
                  className={cn(collapsed && "max-w-min text-center", _getActiveMenu() === "integrations" ? "bg-content2 text-primary dataset-tutorial" : "dataset-tutorial")}
                  onClick={() => navigate("/integrations")}
                >
                  {collapsed ? <LuPuzzle size={20} /> : <span className="text-sm">Integrations</span>}
                </ListboxItem>
              )}
              {_canAccess("teamAdmin", team.TeamRoles) && (
                <ListboxItem
                  key="teamSettings"
                  startContent={collapsed ? null : <LuSettings size={18} />}
                  textValue="Team settings"
                  color={_getActiveMenu() === "settings" ? "primary" : "default"}
                  className={cn(collapsed && "max-w-min text-center", "text-foreground team-settings-tutorial")}
                  onClick={() => navigate("/settings/members")}
                >
                  {collapsed ? <LuSettings size={20} /> : <span className="text-sm">Team settings</span>}
                </ListboxItem>
              )}
            </Listbox>
          </div>

          <Spacer y={4} />

          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-4 flex flex-col items-start justify-center")}>
            <div className="text-sm text-gray-500">
              {collapsed ? "" : "Quick actions"}
            </div>
            <Spacer y={2} />
            <Button
              variant="bordered"
              size="sm"
              color="default"
              startContent={collapsed ? null : <LuPlus size={18} />}
              onPress={() => navigate("/connections/new")}
              isIconOnly={collapsed}
              fullWidth
              className={cn(collapsed ? "justify-center" : "justify-start")}
            >
              {collapsed ? <LuPlus size={20} /> : "New dashboard"}
            </Button>
            <Spacer y={1} />
            <Button
              variant="bordered"
              size="sm"
              color="default"
              startContent={collapsed ? null : <LuPlug size={18} />}
              onPress={() => navigate("/connections/new")}
              isIconOnly={collapsed}
              fullWidth
              className={cn(collapsed ? "justify-center" : "justify-start")}
            >
              {collapsed ? <LuPlug size={20} /> : "New connection"}
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col">
          <div className={cn(collapsed ? "px-0 flex flex-col items-center" : "px-2")}>
            <Button
              variant="light"
              startContent={collapsed? null : _getTheme().icon}
              onPress={() => _onCycleTheme()}
              fullWidth
              className={cn(collapsed ? "justify-center" : "justify-start")}
              isIconOnly={collapsed}
            >
              {collapsed ? _getTheme().icon : _getTheme().name}
            </Button>
          </div>
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
          <Dropdown aria-label="Select a user option">
            <DropdownTrigger>
              <div className={cn("flex flex-row items-center gap-1 justify-start cursor-pointer", collapsed ? "px-0 justify-center" : "px-4")}>
                <Avatar
                  name={user?.data?.name}
                  size="sm"
                  isBordered
                  showFallback={<LuUser />}
                  className="cursor-pointer"
                />
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
            </DropdownTrigger>
            <DropdownMenu variant="faded">
              <DropdownItem startContent={<LuUser />} key="profile" textValue="Profile">
                <Link to="/settings/profile">
                  <div className="w-full text-foreground">
                    Profile
                  </div>
                </Link>
              </DropdownItem>

              <DropdownItem startContent={<LuLogOut />} onClick={() => dispatch(logout())} textValue="Sign out">
                Sign out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Spacer y={2} />
        </div>
      </div>

      <Modal isOpen={createTeamModal} onClose={() => setCreateTeamModal(false)}>
        <ModalContent>
          <ModalHeader>
            <span className="font-bold">Create a new team</span>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Team name"
              placeholder="Enter your new team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setCreateTeamModal(false)}>
              Close
            </Button>
            <Button
              color="primary"
              isLoading={creatingTeam}
              onPress={_onCreateTeam}
              isDisabled={!teamName}
            >
              Create team
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </aside>
  );
}

export default Sidebar
