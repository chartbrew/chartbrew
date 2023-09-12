import React, { useState } from "react";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Link as LinkNext, Dropdown, Tooltip, Spacer, Button, Avatar, Modal, DropdownTrigger, DropdownMenu, DropdownItem, ModalHeader, ModalBody, ModalFooter,
} from "@nextui-org/react";
import {
  Activity, Category, ChevronLeftCircle, ChevronRightCircle, ChevronUpCircle,
  Graph, Hide, MoreSquare, Plus, Setting, Show, TwoUsers,
} from "react-iconly";
import { FaPlug } from "react-icons/fa";
import { MdExtension } from "react-icons/md";

import {
  dark, lightGray, primary, secondary
} from "../../../config/colors";
import { APP_VERSION } from "../../../config/settings";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

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
    case "projectSettings":
      if (window.location.pathname.indexOf("projectSettings") > -1) return true;
      break;
    case "inviteMembers":
      if (window.location.pathname.indexOf("inviteMembers") > -1) return true;
      break;
    case "members":
      if (window.location.pathname.indexOf("members") > -1) return true;
      break;
    case "settings":
      if (window.location.pathname.indexOf("settings") > -1) return true;
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
    menuSize, teamId, projectId, project, showDrafts, onSetMenuSize,
    canAccess, projects, onChangeDrafts, onChangeProject, mobile, update,
  } = props;

  const [showUpdate, setShowUpdate] = useState(false);

  const { height } = useWindowSize();

  const _onVersionClicked = () => {
    if (update && update.tag_name) {
      setShowUpdate(true);
    }
  };

  const _formatProjectName = (projectName) => {
    if (projectName && projectName.length > 18) {
      return `${project.name.substring(0, 15)}...`;
    }

    return projectName;
  };

  if (mobile) {
    return (
      <nav
        style={styles.mobileMenu}
      >
        <div className="flex items-center justify-center shadow-md bg-content1 w-full backdrop-blur-[10px] backdrop-saturate-[180%]">
          <Container className="flex flex-nowrap items-center justify-center w-full">
            <Row justify="space-between" align="center">
              <Link to={`/${teamId}/${projectId}/dashboard`}>
                <LinkNext>
                  <Category color={_checkIfActive("dashboard") ? secondary : "white"} />
                </LinkNext>
              </Link>
              {canAccess("editor") && (
                <Link to={`/${teamId}/${projectId}/connections`}>
                  <LinkNext>
                    <FaPlug size={22} color={_checkIfActive("connections") ? secondary : "white"} />
                  </LinkNext>
                </Link>
              )}
              <Link to={`/b/${project.brewName}`}>
                <LinkNext>
                  <Graph color={_checkIfActive("public") ? secondary : "white"} />
                </LinkNext>
              </Link>
              {canAccess("editor")
                && (
                  <Link to={`/${teamId}/${projectId}/members`}>
                    <LinkNext>
                      <TwoUsers color={_checkIfActive("members") ? secondary : "white"} />
                    </LinkNext>
                  </Link>
                )}
              {canAccess("admin")
                && (
                  <Link to={`/${teamId}/${projectId}/projectSettings`}>
                    <LinkNext>
                      <Setting color={_checkIfActive("projectSettings") ? secondary : "white"} />
                    </LinkNext>
                  </Link>
                )}
            </Row>
          </Container>
        </div>
      </nav>
    );
  }

  return (
    <div>
      <Container className={"bg-content2 flex justify-between"} style={styles.mainSideMenu(height)}>
        <Row justify="center" align="center" className={"pt-20"}>
          <Dropdown
            style={{ ...styles.centered, fontSize: 14 }}
            title={project.name}
          >
            <DropdownTrigger>
              <div>
                {menuSize === "small" && (
                  <Tooltip content="Switch project" placement="right">
                    <div>
                      <Text className={"text-default-800"}><Category size="large" /></Text>
                    </div>
                  </Tooltip>
                )}
                {menuSize === "large" && (
                  <Text b className={"text-blue-600"}>{_formatProjectName(project.name)}</Text>
                )}
              </div>
            </DropdownTrigger>
            <DropdownMenu
              onAction={(pId) => onChangeProject(pId)}
              selectedKeys={[projectId]}
              selectionMode="single"
            >
              {projects.map((p) => {
                return (
                  <DropdownItem key={p.id} className="text-sm">
                    {p.name}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          </Dropdown>
        </Row>
        <Spacer y={3} />
        {canAccess("editor")
          && (
            <Row justify="center" align="center">
              {menuSize === "small" && (
                <Tooltip content="Create a new chart" placement="right">
                  <div>
                    <Link to={`/${teamId}/${projectId}/chart`}>
                      <Text color="primary">
                        <Avatar icon={<Plus size="large" />} radius="sm" />
                      </Text>
                    </Link>
                  </div>
                </Tooltip>
              )}
              {menuSize === "large" && (
                <Link to={`/${teamId}/${projectId}/chart`}>
                  <Button
                    endContent={<Plus />}
                    auto
                    color="primary"
                  >
                    Create a chart
                  </Button>
                </Link>
              )}
            </Row>
          )}
        <Spacer y={3} />
        <Row justify={menuSize === "large" ? "flex-start" : "center"} align="center">
          <Link to={`/${teamId}/${projectId}/dashboard`}>
            {menuSize === "small" && (
              <Row className={`${_checkIfActive("dashboard") ? "text-blue-600" : "text-default-800" }`}>
                <Tooltip content="Dashboard" placement="right">
                  <Activity size="large" />
                </Tooltip>
              </Row>
            )}
            {menuSize === "large" && (
              <Row className={`${_checkIfActive("dashboard") ? "text-blue-600" : "text-default-800"}`}>
                <Activity />
                <Spacer x={0.5} />
                <Text h5 className={`${_checkIfActive("dashboard") ? "text-blue-600" : "text-default-800"}`}>
                  Dashboard
                </Text>
              </Row>
            )}
          </Link>
        </Row>
        {canAccess("editor") && (
          <>
            <Spacer y={1} />
            <Row justify={menuSize === "large" ? "flex-start" : "center"}>
              <Link to={`/${teamId}/${projectId}/connections`}>
                {menuSize === "small" && (
                  <Row className={`${_checkIfActive("connections") ? "text-blue-600" : "text-default-800"}`}>
                    <Tooltip content="Connections" placement="right">
                      <FaPlug size={28} />
                    </Tooltip>
                  </Row>
                )}
                {menuSize === "large" && (
                  <Row className={`${_checkIfActive("connections") ? "text-blue-600" : "text-default-800"}`}>
                    <FaPlug size={22} />
                    <Spacer x={0.5} />
                    <Text h5 className={`${_checkIfActive("connections") ? "text-blue-600" : "text-default-800"}`}>
                      Connections
                    </Text>
                  </Row>
                )}
              </Link>
            </Row>
          </>
        )}

        <Spacer y={1} />
        <Row justify={menuSize === "large" ? "flex-start" : "center"} align="center">
          <Link to={`/b/${project.brewName}`}>
            <LinkNext className={`${_checkIfActive("public") ? "text-blue-600" : "text-default-800"}`}>
              {menuSize === "small" && (
                <Row className={`${_checkIfActive("public") ? "text-blue-600" : "text-default-800"}`}>
                  <Tooltip content="Dashboard report" placement="right">
                    <Graph size="large" />
                  </Tooltip>
                </Row>
              )}
              {menuSize === "large" && (
                <Row className={`${_checkIfActive("public") ? "text-blue-600" : "text-default-800"}`}>
                  <Graph />
                  <Spacer x={0.5} />
                  <Text h5 className={`${_checkIfActive("public") ? "text-blue-600" : "text-default-800"}`}>
                    Dashboard report
                  </Text>
                </Row>
              )}
            </LinkNext>
          </Link>
        </Row>

        {canAccess("admin") && (
          <>
            <Spacer y={1} />
            <Row justify={menuSize === "large" ? "flex-start" : "center"}>
              <Link to={`/${teamId}/${projectId}/projectSettings`}>
                {menuSize === "small" && (
                  <Row className={`${_checkIfActive("projectSettings") ? "text-blue-600" : "text-default-800"}`}>
                    <Tooltip content="Project settings" placement="right">
                      <Setting size="large" />
                    </Tooltip>
                  </Row>
                )}
                {menuSize === "large" && (
                  <Row className={`${_checkIfActive("projectSettings") ? "text-blue-600" : "text-default-800"}`}>
                    <Setting />
                    <Spacer x={0.5} />
                    <Text h5 className={`${_checkIfActive("projectSettings") ? "text-blue-600" : "text-default-800"}`}>
                      Project settings
                    </Text>
                  </Row>
                )}
              </Link>
            </Row>
          </>
        )}
        <Spacer y={3} />
        {canAccess("editor") && (
          <>
            {menuSize === "large" && (
              <>
                <Row justify="flex-start" align="center">
                  <Text b className={"text-default-800"}>
                    Team
                  </Text>
                </Row>
                <Spacer y={1} />
              </>
            )}
            <Row justify={menuSize === "large" ? "flex-start" : "center"}>
              <Link to={`/${teamId}/${projectId}/members`}>
                {menuSize === "small" && (
                  <Row className={`${_checkIfActive("members") ? "text-blue-600" : "text-default-800"}`}>
                    <Tooltip content="Team members" placement="right">
                      <TwoUsers size="large" />
                    </Tooltip>
                  </Row>
                )}
                {menuSize === "large" && (
                  <Row className={`${_checkIfActive("members") ? "text-blue-600" : "text-default-800"}`}>
                    <TwoUsers />
                    <Spacer x={0.5} />
                    <Text h5 className={`${_checkIfActive("members") ? "text-blue-600" : "text-default-800"}`}>
                      Members
                    </Text>
                  </Row>
                )}
              </Link>
            </Row>
            <Spacer y={1} />
            <Row justify={menuSize === "large" ? "flex-start" : "center"}>
              <Link to={`/${teamId}/${projectId}/integrations`}>
                {menuSize === "small" && (
                  <Row className={`${_checkIfActive("integrations") ? "text-blue-600" : "text-default-800"}`}>
                    <Tooltip content="Integrations" placement="right">
                      <MdExtension size={28} />
                    </Tooltip>
                  </Row>
                )}
                {menuSize === "large" && (
                  <Row className={`${_checkIfActive("integrations") ? "text-blue-600" : "text-default-800"}`}>
                    <MdExtension size={24} />
                    <Spacer x={0.5} />
                    <Text h5 className={`${_checkIfActive("integrations") ? "text-blue-600" : "text-default-800"}`}>
                      Integrations
                    </Text>
                  </Row>
                )}
              </Link>
            </Row>
            <Spacer y={1} />
            {canAccess("owner") && (
              <Row justify={menuSize === "large" ? "flex-start" : "center"} align="center">
                <Link to={`/${teamId}/${projectId}/settings`}>
                  {menuSize === "small" && (
                    <Row className={`${_checkIfActive("settings") ? "text-blue-600" : "text-default-800"}`}>
                      <Tooltip content="Team settings" placement="right">
                        <MoreSquare size="large" />
                      </Tooltip>
                    </Row>
                  )}
                  {menuSize === "large" && (
                    <Row className={`${_checkIfActive("settings") ? "text-blue-600" : "text-default-800"}`}>
                      <MoreSquare />
                      <Spacer x={0.5} />
                      <Text h5 className={`${_checkIfActive("settings") ? "text-blue-600" : "text-default-800"}`}>
                        Settings
                      </Text>
                    </Row>
                  )}
                </Link>
              </Row>
            )}
          </>
        )}
        <Spacer y={3} />
        <Row justify={menuSize === "large" ? "flex-start" : "center"} align="center">
          {_checkIfActive("dashboard") && canAccess("editor") && (
            <LinkNext className={"text-default-800"} onClick={() => onChangeDrafts(!showDrafts)}>
              <Tooltip
                content={showDrafts ? "Click to hide drafts" : "Click to show drafts"}
                placement="right"
              >
                <Row>
                  {menuSize === "small" && (
                    showDrafts ? (<Show size="large" />) : (<Hide size="large" />)
                  )}
                  {menuSize === "large" && (showDrafts ? (<Show />) : (<Hide />))}
                  {menuSize === "large" && <Spacer x={0.5} />}
                  {menuSize === "large" && (
                    <Text h5 className={"text-default-800"}>
                      {showDrafts ? "Showing drafts" : "Hiding drafts"}
                    </Text>
                  )}
                </Row>
              </Tooltip>
            </LinkNext>
          )}
        </Row>
        {menuSize === "small" && <Spacer y={1} />}
        {menuSize === "large" && <Spacer y={3} />}
        {menuSize === "large" && (
          <Row justify="flex-end" align="center">
            <LinkNext className={"text-default-800"} onClick={() => onSetMenuSize(70)}>
              <Tooltip content="Click to collapse menu" placement="right">
                <ChevronLeftCircle size="large" />
              </Tooltip>
            </LinkNext>
          </Row>
        )}
        {menuSize === "small" && (
          <Row justify="center" align="center">
            <LinkNext className={"text-default-800"} onClick={() => onSetMenuSize(sideMaxSize)}>
              <Tooltip content="Click to expand menu" placement="right">
                <ChevronRightCircle size="large" />
              </Tooltip>
            </LinkNext>
          </Row>
        )}
        <Row style={styles.absoluteLogo} align="center" justify="center">
          {menuSize !== "small" && (
            <LinkNext
              href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
              target={(!update || !update.tag_name) && "_blank"}
              rel="noopener noreferrer"
              onClick={_onVersionClicked}
              style={{ color: "white" }}
              title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
            >
              <Text b className={"text-default-800 text-[12px]"} style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
                {update && update.tag_name && (
                  <ChevronUpCircle primaryColor={secondary} size="small" />
                )}
                Chartbrew
                { ` ${APP_VERSION}`}
              </Text>
            </LinkNext>
          )}
          {menuSize === "small" && (
            <LinkNext
              href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
              target={(!update || !update.tag_name) && "_blank"}
              rel="noopener noreferrer"
              onClick={_onVersionClicked}
              style={{ color: "white" }}
              title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
            >
              <Text b className={"text-default-800 text-[12px]"} style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
                {update && update.tag_name && (
                  <ChevronUpCircle primaryColor={secondary} size="small" />
                )}
                {APP_VERSION}
              </Text>
            </LinkNext>
          )}
        </Row>
      </Container>

      <Modal isOpen={showUpdate} closeButton onClose={() => setShowUpdate(false)}>
        <ModalHeader>
          <Text h4>{`${update.tag_name} is available`}</Text>
        </ModalHeader>
        <ModalBody>
          <ReactMarkdown>{update.body}</ReactMarkdown>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="flat"
            color="warning"
            auto
            onClick={() => setShowUpdate(false)}
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
      </Modal>
    </div>
  );
}

ProjectNavigation.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  project: PropTypes.object.isRequired,
  projects: PropTypes.array.isRequired,
  onSetMenuSize: PropTypes.func.isRequired,
  canAccess: PropTypes.func.isRequired,
  onChangeDrafts: PropTypes.func.isRequired,
  onChangeProject: PropTypes.func.isRequired,
  menuSize: PropTypes.string,
  showDrafts: PropTypes.bool,
  mobile: PropTypes.bool,
  update: PropTypes.object,
};

ProjectNavigation.defaultProps = {
  menuSize: "large",
  showDrafts: true,
  mobile: false,
  update: {},
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
    position: "absolute",
    bottom: 0,
    left: 0,
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
    zIndex: 9999,
    backgroundColor: dark,
  },
};

export default withRouter(ProjectNavigation);
