import React, { useState } from "react";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import { Link, useNavigate } from "react-router";
import ReactMarkdown from "react-markdown";
import {
  Link as LinkNext, Tooltip, Spacer, Button, Modal, ModalHeader, ModalBody,ModalFooter,
  ModalContent, Popover, PopoverTrigger, PopoverContent, Listbox, ListboxItem, Input,
} from "@heroui/react";
import {
  LuChevronsUp, LuLayoutGrid, LuMenu, LuPanelLeftClose,
  LuPanelLeftOpen, LuPin, LuPuzzle, LuSettings,
  LuTvMinimal, LuUser, LuSearch,
} from "react-icons/lu";
import { useSelector } from "react-redux";

import {
  dark, lightGray, primary, secondary
} from "../../../config/colors";
import { APP_VERSION } from "../../../config/settings";
import Text from "../../../components/Text";
import { selectProject, selectProjects } from "../../../slices/project";
import { selectTeam } from "../../../slices/team";

const sideMaxSize = 220;

const _checkIfActive = (path) => {
  switch (path) {
    case "dashboard":
      if (window.location.pathname.indexOf("dashboard") > -1) return true;
      break;
    case "chart":
      if (window.location.pathname.indexOf("chart") > -1) return true;
      break;
    case "connections":
      if (window.location.pathname.indexOf("connections") > -1) return true;
      break;
    case "settings":
      if (window.location.pathname.indexOf("settings") > -1) return true;
      break;
    case "inviteMembers":
      if (window.location.pathname.indexOf("inviteMembers") > -1) return true;
      break;
    case "members":
      if (window.location.pathname.indexOf("members") > -1) return true;
      break;
    case "public":
      if (window.location.pathname.indexOf("public") > -1) return true;
      break;
    case "integrations":
      if (window.location.pathname.indexOf("integrations") > -1) return true;
      break;
    default:
      return false;
  }

  return false;
};

function ProjectNavigation(props) {
  const {
    menuSize = "large", update = {},
    onSetMenuSize, canAccess, onChangeProject,
  } = props;

  const [showUpdate, setShowUpdate] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const projects = useSelector(selectProjects);
  const project = useSelector(selectProject) || {};
  const team = useSelector(selectTeam);
  const pinnedDashboards = useSelector((state) => state.user?.data?.PinnedDashboards);

  const { height } = useWindowSize();
  const navigate = useNavigate();

  const _onVersionClicked = () => {
    if (update && update.tag_name) {
      setShowUpdate(true);
    }
  };

  const _formatProjectName = (projectName) => {
    if (projectName && projectName.length > 25) {
      return `${project.name.substring(0, 25)}...`;
    }

    return projectName;
  };

  const _getFilteredProjects = () => {
    if (!projects) return [];

    const filteredProjects = projects.filter((p) => {
      return p.name.toLowerCase().includes(projectSearch.toLowerCase());
    });

    // Sort pinned projects to the top
    return filteredProjects.sort((a, b) => {
      const aPinned = pinnedDashboards.find((p) => p.project_id === a.id);
      const bPinned = pinnedDashboards.find((p) => p.project_id === b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  };

  return (
    <div>
      <div className={"hidden md:flex bg-content1 flex-col justify-between"} style={styles.mainSideMenu(height)}>
        <div className="p-2">
          <div className="flex justify-center items-center">
            <Popover>
              <PopoverTrigger>
                <Button variant="bordered" isIconOnly={menuSize === "small"} isLoading={!project.name} fullWidth>
                  {menuSize === "small" && <LuMenu size={24} />}
                  {menuSize === "large" && _formatProjectName(project.name)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-[200px] max-h-[400px] px-2 py-4">
                <div className="flex flex-col gap-2 overflow-y-auto">
                  <Input
                    placeholder="Search"
                    fullWidth
                    size="small"
                    variant="bordered"
                    endContent={<LuSearch />}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="px-2"
                  />
                  <Listbox aria-label="Dashboard switch list">
                    {_getFilteredProjects().map((p) => (
                      <ListboxItem
                        key={p.id}
                        onPress={() => onChangeProject(p.id)}
                        startContent={pinnedDashboards.find((pd) => pd.project_id === p.id) && <LuPin className="text-gray-500" size={18} />}
                        textValue={p.name}
                      >
                        {p.name}
                      </ListboxItem>
                    ))}
                  </Listbox>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Spacer y={4} />

          <Listbox
            aria-label="Project navigation"
            variant="flat"
            color="default"
            className="p-0"
          >
            <ListboxItem
              key="dashboard"
              startContent={menuSize === "large" ? <LuLayoutGrid size={24} /> : null}
              onPress={() => navigate(`/${team.id}/${project.id}/dashboard`)}
              className={`${_checkIfActive("dashboard") ? "text-primary" : "text-foreground"}`}
              classNames={{
                title: menuSize === "small" ? "flex flex-row justify-center" : "",
              }}
              textValue="Dashboard report"
            >
              {menuSize === "large" ? "Dashboard" : (
                <Tooltip content="Dashboard" placement="right">
                  <div className=""><LuLayoutGrid size={24} /></div>
                </Tooltip>
              )}
            </ListboxItem>

            <ListboxItem
              key="public"
              startContent={menuSize === "large" ? <LuTvMinimal size={24} /> : null}
              onPress={() => navigate(`/report/${project.brewName}/edit`)}
              className={_checkIfActive("public") ? "text-primary" : "text-foreground"}
              classNames={{
                title: menuSize === "small" ? "flex flex-row justify-center" : "",
              }}
              textValue="Dashboard report"
            >
              {menuSize === "large" ? "Dashboard report" : (
                <Tooltip content="Dashboard report" placement="right">
                  <div className=""><LuTvMinimal size={24} /></div>
                </Tooltip>
              )}
            </ListboxItem>

            {canAccess("projectEditor") && (
              <ListboxItem
                key="members"
                startContent={menuSize === "large" ? <LuUser size={24} /> : null}
                onPress={() => navigate(`/${team.id}/${project.id}/members`)}
                className={_checkIfActive("members") ? "text-primary" : "text-foreground"}
                classNames={{
                  title: menuSize === "small" ? "flex flex-row justify-center" : "",
                }}
                textValue="Members"
              >
                {menuSize === "large" ? "Members" : (
                  <Tooltip content="Members" placement="right">
                    <div className=""><LuUser size={24} /></div>
                  </Tooltip>
                )}
              </ListboxItem>
            )}

            {canAccess("projectAdmin", project.TeamRoles) && (
              <>
                <ListboxItem
                  key="settings"
                  startContent={menuSize === "large" ? <LuSettings size={24} /> : null}
                  onPress={() => navigate(`/${team.id}/${project.id}/settings`)}
                  className={_checkIfActive("settings") ? "text-primary" : "text-foreground"}
                  classNames={{
                    title: menuSize === "small" ? "flex flex-row justify-center" : "",
                  }}
                  textValue="Settings"
                >
                  {menuSize === "large" ? "Settings" : (
                    <Tooltip content="Dashboard settings" placement="right">
                      <div className=""><LuSettings size={24} /></div>
                    </Tooltip>
                  )}
                </ListboxItem>
              </>
            )}

            {canAccess("teamAdmin") && (
              <ListboxItem
                key="integrations"
                startContent={menuSize === "large" ? <LuPuzzle size={24} /> : null}
                onPress={() => navigate(`/${team.id}/${project.id}/integrations`)}
                className={_checkIfActive("integrations") ? "text-primary" : "text-foreground"}
                classNames={{
                  title: menuSize === "small" ? "flex flex-row justify-center" : "",
                }}
                textValue="Integrations"
              >
                {menuSize === "large" ? "Integrations" : (
                  <Tooltip content="Integrations" placement="right">
                    <div className=""><LuPuzzle size={24} /></div>
                  </Tooltip>
                )}
              </ListboxItem>
            )}
          </Listbox>
        </div>
        <div className="translate-y-[-50px]">
          {menuSize === "large" && (
            <div className="flex justify-end items-center mr-5">
              <Tooltip content="Click to collapse menu" placement="right">
                <Button
                  isIconOnly
                  variant="light"
                  color="default"
                  onPress={() => onSetMenuSize(70)}
                >
                  <LuPanelLeftClose size={24} />
                </Button>
              </Tooltip>
            </div>
          )}
          {menuSize === "small" && (
            <div className="flex justify-center items-center">
              <Tooltip content="Click to expand menu" placement="right">
                <Button
                  isIconOnly
                  variant="light"
                  color="default"
                  onPress={() => onSetMenuSize(sideMaxSize)}
                >
                  <LuPanelLeftOpen size={24} />
                </Button>
              </Tooltip>
            </div>
          )}
          <Spacer y={4} />
          <div style={styles.absoluteLogo} className="flex justify-center items-center">
            {menuSize !== "small" && (
              <LinkNext
                href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
                target={(!update || !update.tag_name) && "_blank"}
                rel="noopener noreferrer"
                onPress={_onVersionClicked}
                style={{ color: "white" }}
                title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
              >
                <div className={"text-default-600 text-xs font-tw font-bold"} style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
                  {update && update.tag_name && (
                    <LuChevronsUp color={secondary} />
                  )}
                  Chartbrew
                  { ` ${APP_VERSION || "v3.0.0"}`}
                </div>
              </LinkNext>
            )}
            {menuSize === "small" && (
              <LinkNext
                href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
                target={(!update || !update.tag_name) && "_blank"}
                rel="noopener noreferrer"
                onPress={_onVersionClicked}
                style={{ color: "white" }}
                title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
              >
                <div className={"text-default-600 text-xs font-tw font-bold"} style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
                  {update && update.tag_name && (
                    <LuChevronsUp color={secondary} />
                  )}
                  {APP_VERSION || "v3.0.0"}
                </div>
              </LinkNext>
            )}
          </div>
        </div>
      </div>

      <nav className="flex md:hidden fixed bottom-0 z-10 h-12 w-full items-center justify-center shadow-md bg-content1 backdrop-blur-[10px] backdrop-saturate-180">
        <div className="flex flex-row flex-nowrap justify-around w-full p-2">
          <Link to={`/${team.id}/${project.id}/dashboard`}>
            <LinkNext className="pointer-events-none">
              <LuLayoutGrid className={_checkIfActive("dashboard") ? "text-foreground" : "text-gray-500"} size={24} />
            </LinkNext>
          </Link>
          <Link to={`/report/${project.brewName}/edit`}>
            <LinkNext className="pointer-events-none">
              <LuTvMinimal className={_checkIfActive("public") ? "text-foreground" : "text-gray-500"} size={24} />
            </LinkNext>
          </Link>
          {canAccess("projectEditor")
            && (
              <Link to={`/${team.id}/${project.id}/members`}>
                <LinkNext className="pointer-events-none">
                  <LuUser className={_checkIfActive("members") ? "text-foreground" : "text-gray-500"} size={24} />
                </LinkNext>
              </Link>
            )}
          {canAccess("projectEditor")
            && (
              <Link to={`/${team.id}/${project.id}/settings`}>
                <LinkNext className="pointer-events-none">
                  <LuSettings className={_checkIfActive("settings") ? "text-foreground" : "text-gray-500"} size={24} />
                </LinkNext>
              </Link>
            )}
        </div>
      </nav>

      <Modal isOpen={showUpdate} closeButton onClose={() => setShowUpdate(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">{`${update.tag_name} is available`}</Text>
          </ModalHeader>
          <ModalBody>
            <ReactMarkdown>{update.body}</ReactMarkdown>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              auto
              onPress={() => setShowUpdate(false)}
            >
              Close
            </Button>
            <LinkNext
              href={`https://github.com/chartbrew/chartbrew/releases/tag/${update.tag_name}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                auto
              >
                Check the release
              </Button>
            </LinkNext>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

ProjectNavigation.propTypes = {
  onSetMenuSize: PropTypes.func.isRequired,
  canAccess: PropTypes.func.isRequired,
  onChangeProject: PropTypes.func.isRequired,
  menuSize: PropTypes.string,
  mobile: PropTypes.bool,
  update: PropTypes.object,
};

const styles = {
  container: {
    zIndex: 10,
  },
  sideMenu: {
    backgroundColor: primary,
  },
  mainContent: {
    backgroundColor: lightGray,
  },
  absoluteLogo: {
    // position: "absolute",
    // bottom: 0,
    // left: 0,
    width: "100%",
    textAlign: "center",
    padding: 5,
    borderRadius: 0,
  },
  cbVersion: {
    verticalAlign: "center",
    padding: 4,
  },
  cbVersionCollapsed: {
    verticalAlign: "center",
  },
  absoluteCollapse: (menuSize) => ({
    position: "absolute",
    bottom: menuSize === "small" ? 35 : 35,
    width: "100%",
  }),
  absoluteDrafts: {
    position: "absolute",
    bottom: 110,
    width: "100%",
  },
  teamSettings: {
    padding: 20,
    paddingLeft: 30,
  },
  draftsHeader: {
    color: "#91A3A2",
    fontSize: 12,
  },
  centered: {
    textAlign: "center",
  },
  mainSideMenu: (height) => ({
    minHeight: height,
    borderRadius: 0,
  }),
  mobileMenu: {
    bottom: 0,
    height: "60px",
    position: "sticky",
    zIndex: 10,
    backgroundColor: dark,
  },
};

export default ProjectNavigation;
