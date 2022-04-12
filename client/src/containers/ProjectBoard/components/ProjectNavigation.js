import React, { useState } from "react";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Button, Dropdown, Header, Icon, Input, Menu, Modal, Popup, TransitionablePortal,
} from "semantic-ui-react";
import ReactMarkdown from "react-markdown";

import {
  blue, dark, darkBlue, lightGray, primary
} from "../../../config/colors";
import { APP_VERSION } from "../../../config/settings";

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

  const [projectSearch, setProjectSearch] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);

  const { height } = useWindowSize();

  const _onVersionClicked = () => {
    if (update && update.tag_name) {
      setShowUpdate(true);
    }
  };

  if (mobile) {
    return (
      <Menu
        fixed="bottom"
        icon
        inverted
        secondary
        style={styles.mobileMenu}
        widths={5}
      >
        <Menu.Item
          active={_checkIfActive("dashboard")}
          as={Link}
          to={`/${teamId}/${projectId}/dashboard`}
        >
          <Icon name="line graph" size="large" />
        </Menu.Item>
        {canAccess("editor")
          && (
            <Menu.Item
              active={_checkIfActive("connections")}
              as={Link}
              to={`/${teamId}/${projectId}/connections`}
            >
              <Icon name="power cord" size="large" />
            </Menu.Item>
          )}
        <Menu.Item
          active={_checkIfActive("public")}
          as={Link}
          to={`/b/${project.brewName}`}
        >
          <Icon name="desktop" size="large" />
        </Menu.Item>
        {canAccess("editor")
          && (
            <Menu.Item
              active={_checkIfActive("members")}
              as={Link}
              to={`/${teamId}/${projectId}/members`}
            >
              <Icon name="users" size="large" />
            </Menu.Item>
          )}
        {canAccess("admin")
          && (
            <Menu.Item
              active={_checkIfActive("projectSettings")}
              as={Link}
              to={`/${teamId}/${projectId}/projectSettings`}
            >
              <Icon name="cog" size="large" />
            </Menu.Item>
          )}
      </Menu>
    );
  }

  return (
    <>
      <Menu
        size={menuSize === "small" ? "large" : "huge"}
        fluid
        inverted
        vertical
        icon={menuSize === "small"}
        style={styles.mainSideMenu(height)}
      >
        <Menu.Item header>
          <Dropdown
            text={menuSize === "large" ? project.name : null}
            button={menuSize === "small"}
            labeled={menuSize === "small"}
            icon={menuSize === "small"
              && (
                <Popup
                  trigger={<Icon name="list ul" size="large" />}
                  content="Switch projects"
                  position="right center"
                  inverted
                />
              )}
            item
            style={styles.centered}
            closeOnChange={false}
          >
            <Dropdown.Menu>
              <Input
                icon="search"
                iconPosition="left"
                className="search"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onChange={(e, data) => setProjectSearch(data.value)}
              />
              <Dropdown.Header>Select another project</Dropdown.Header>
              <Dropdown.Menu scrolling>
                <Dropdown.Divider />
                {projects.map((p) => {
                  if (projectSearch
                    && p.name.toLowerCase().indexOf(projectSearch.toLowerCase()) === -1
                  ) {
                    return (<span key={p.id} />);
                  }

                  return (
                    <Dropdown.Item
                      key={p.id}
                      onClick={() => onChangeProject(p.id)}
                    >
                      {p.name}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Menu>
          </Dropdown>
        </Menu.Item>

        {canAccess("editor")
          && (
            <Menu.Item
              active={_checkIfActive("chart")}
              style={styles.centered}
            >
              {menuSize === "small"
                && (
                  <Popup
                    trigger={(
                      <Button
                        primary
                        icon
                        as={Link}
                        to={`/${teamId}/${projectId}/chart`}
                        size="small"
                      >
                        <Icon name="plus" />
                      </Button>
                    )}
                    content="Create a new chart"
                    position="right center"
                    inverted
                  />
                )}
              {menuSize === "large" && (
                <Button
                  primary
                  icon
                  labelPosition="right"
                  as={Link}
                  to={`/${teamId}/${projectId}/chart`}
                  fluid
                >
                  <Icon name="plus" />
                  Create a chart
                </Button>
              )}
            </Menu.Item>
          )}

        <Menu.Item>
          {menuSize === "large"
            && (
              <Menu.Header>
                Project
              </Menu.Header>
            )}
          <Menu.Menu>
            <Menu.Item
              active={_checkIfActive("dashboard")}
              as={Link}
              to={`/${teamId}/${projectId}/dashboard`}
            >
              {menuSize === "small"
                && (
                  <Popup
                    trigger={<Icon name="line graph" size="large" />}
                    content="Dashboard"
                    position="right center"
                    inverted
                  />
                )}
              {menuSize === "large" && <Icon name="line graph" />}
              {menuSize === "large" && "Dashboard"}
            </Menu.Item>

            {canAccess("editor")
              && (
                <Menu.Item
                  active={_checkIfActive("connections")}
                  as={Link}
                  to={`/${teamId}/${projectId}/connections`}
                >
                  {menuSize === "small"
                    && (
                      <Popup
                        trigger={<Icon name="power cord" size="large" />}
                        content="Connections"
                        position="right center"
                        inverted
                      />
                    )}
                  {menuSize === "large" && <Icon name="power cord" />}
                  {menuSize === "large" && "Connections"}
                </Menu.Item>
              )}

            <Menu.Item
              active={_checkIfActive("public")}
              as={Link}
              to={`/b/${project.brewName}`}
            >
              {menuSize === "small"
                && (
                  <Popup
                    trigger={<Icon name="desktop" size="large" />}
                    content="Dashboard report"
                    position="right center"
                    inverted
                  />
                )}
              {menuSize === "large" && <Icon name="desktop" />}
              {menuSize === "large" && "Dashboard report"}
            </Menu.Item>

            {canAccess("admin")
              && (
                <Menu.Item
                  active={_checkIfActive("projectSettings")}
                  as={Link}
                  to={`/${teamId}/${projectId}/projectSettings`}
                >
                  {menuSize === "small"
                    && (
                      <Popup
                        trigger={<Icon name="cog" size="large" />}
                        content="Project settings"
                        position="right center"
                        inverted
                      />
                    )}
                  {menuSize === "large" && <Icon name="cog" />}
                  {menuSize === "large" && "Settings"}
                </Menu.Item>
              )}
          </Menu.Menu>
        </Menu.Item>

        {canAccess("editor") && (
          <Menu.Item>
            {menuSize === "large" && <Menu.Header>Team</Menu.Header>}
            <Menu.Menu>
              <Menu.Item active={_checkIfActive("members")} as={Link} to={`/${teamId}/${projectId}/members`}>
                {menuSize === "small"
                  && (
                    <Popup
                      trigger={<Icon name="user" size="large" />}
                      content="Members"
                      position="right center"
                      inverted
                    />
                  )}
                {menuSize === "large" && <Icon name="users" />}
                {menuSize === "large" && "Members"}
              </Menu.Item>

              {canAccess("owner")
                && (
                  <Menu.Item active={_checkIfActive("settings")} as={Link} to={`/${teamId}/${projectId}/settings`}>
                    {menuSize === "small"
                      && (
                        <Popup
                          trigger={<Icon name="settings" size="large" />}
                          content="Settings"
                          position="right center"
                          inverted
                        />
                      )}
                    {menuSize === "large" && <Icon name="settings" />}
                    {menuSize === "large" && "Settings"}
                  </Menu.Item>
                )}
            </Menu.Menu>
          </Menu.Item>
        )}
        <Menu.Menu style={styles.absoluteDrafts}>
          {_checkIfActive("dashboard") && canAccess("editor") && (
            <Popup
              trigger={(
                <Menu.Item onClick={() => onChangeDrafts(!showDrafts)}>
                  {menuSize === "small" && (
                    <>
                      <Icon name={showDrafts ? "toggle on" : "toggle off"} size="large" />
                    </>
                  )}
                  {menuSize === "large" && <Icon name={showDrafts ? "toggle on" : "toggle off"} />}
                  {menuSize === "large" && "Show drafts"}
                </Menu.Item>
              )}
              content={showDrafts ? "Hide drafts" : "Show drafts"}
              position="right center"
              inverted
            />
          )}
        </Menu.Menu>
        {menuSize === "large"
          && (
            <Popup
              trigger={(
                <Menu.Item
                  onClick={() => onSetMenuSize(70)}
                  style={styles.absoluteCollapse(menuSize)}
                >
                  <Icon name="toggle left" size="large" />
                </Menu.Item>
              )}
              content="Collapse menu"
              position="right center"
              inverted
            />
          )}
        {menuSize === "small"
          && (
            <Menu.Item
              onClick={() => onSetMenuSize(sideMaxSize)}
              style={styles.absoluteCollapse(menuSize)}
            >
              <Popup
                trigger={<Icon name="toggle right" size="large" />}
                content="Expand menu"
                position="right center"
                inverted
              />
            </Menu.Item>
          )}
        <Menu.Item style={styles.absoluteLogo}>
          <Header as="h6" inverted style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
            {menuSize !== "small" && (
              <a
                href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
                target={(!update || !update.tag_name) && "_blank"}
                rel="noopener noreferrer"
                onClick={_onVersionClicked}
                style={{ color: "white" }}
                title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
              >
                {update && update.tag_name && (
                  <Icon name="circle" color="olive" />
                )}
                Chartbrew
                { ` ${APP_VERSION}`}
              </a>
            )}
            {menuSize === "small" && (
              <a
                href={((!update || !update.tag_name) && `https://github.com/chartbrew/chartbrew/releases/tag/${APP_VERSION}`) || "#"}
                target={(!update || !update.tag_name) && "_blank"}
                rel="noopener noreferrer"
                onClick={_onVersionClicked}
                style={{ color: "white" }}
                title={(update && update.tag_name && "New version available") || "Current Chartbrew version"}
              >
                {update && update.tag_name && (
                  <Icon name="circle" color="olive" />
                )}
                {APP_VERSION}
              </a>
            )}
          </Header>
        </Menu.Item>
      </Menu>

      <TransitionablePortal open={showUpdate}>
        <Modal open={showUpdate} closeIcon onClose={() => setShowUpdate(false)}>
          <Modal.Header>{`${update.tag_name} is available`}</Modal.Header>
          <Modal.Content>
            <ReactMarkdown>{update.body}</ReactMarkdown>
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Close"
              onClick={() => setShowUpdate(false)}
            />
            <Button
              as="a"
              primary
              content="Check the release"
              href={`https://github.com/chartbrew/chartbrew/releases/tag/${update.tag_name}`}
              target="_blank"
              rel="noreferrer"
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </>
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
    backgroundColor: blue,
    position: "absolute",
    bottom: 0,
    width: "100%",
    boxShadow: "-5px 1px 10px #000",
    textAlign: "center",
    padding: 5,
    borderRadius: 0,
  },
  cbVersion: {
    verticalAlign: "center",
    padding: 7,
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
    backgroundColor: darkBlue,
    minHeight: height,
    borderRadius: 0,
  }),
  mobileMenu: {
    backgroundColor: dark,
    textAlign: "center",
  },
};

export default withRouter(ProjectNavigation);
