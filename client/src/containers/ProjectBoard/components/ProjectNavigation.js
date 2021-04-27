import React from "react";
import PropTypes from "prop-types";
import { useWindowSize } from "react-use";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Button, Dropdown, Header, Icon, Menu, Popup,
} from "semantic-ui-react";
import { blue, lightGray, primary } from "../../../config/colors";
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
    canAccess, projects, onChangeDrafts, onChangeProject, mobile,
  } = props;

  const { height } = useWindowSize();

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
        {canAccess("editor")
         && (
         <Menu.Item
           active={_checkIfActive("members")}
           as={Link}
           to={`/${teamId}/${projectId}/members`}
            >
           <Icon name="user" size="large" />
         </Menu.Item>
         )}
        <Menu.Item
          active={_checkIfActive("public")}
          as={Link}
          to={`/${teamId}/${projectId}/public`}
        >
          <Icon name="world" size="large" />
        </Menu.Item>
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
        >
          <Dropdown.Menu>
            <Dropdown.Header>Select another project</Dropdown.Header>
            <Dropdown.Divider />
            {projects.map((p) => {
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

      <Menu.Item>
        <Menu.Menu>
          <Menu.Item
            active={_checkIfActive("public")}
            as={Link}
            to={`/${teamId}/${projectId}/public`}
          >
            {menuSize === "small"
              && (
                <Popup
                  trigger={<Icon name="world" size="large" />}
                  content="Public dashboard"
                  position="right center"
                  inverted
                />
              )}
            {menuSize === "large" && <Icon name="world" />}
            {menuSize === "large" && "Public dashboard"}
          </Menu.Item>
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
              {menuSize === "large" && <Icon name="user" />}
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
        {/* <Image size="mini" centered src={cbLogo} alt="bottle" /> */}
        <Header as="h6" inverted style={menuSize !== "small" ? styles.cbVersion : styles.cbVersionCollapsed}>
          {menuSize !== "small" && (
            <span>
              Chartbrew
              { ` ${APP_VERSION}`}
            </span>
          )}
          {menuSize === "small" && (
            <span>{APP_VERSION}</span>
          )}
        </Header>
      </Menu.Item>
    </Menu>
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
};

ProjectNavigation.defaultProps = {
  menuSize: "large",
  showDrafts: true,
  mobile: false,
};

const styles = {
  container: {
  },
  sideMenu: {
    backgroundColor: primary,
  },
  mainContent: {
    backgroundColor: lightGray,
  },
  absoluteLogo: {
    backgroundColor: primary,
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
    backgroundColor: blue,
    minHeight: height,
    borderRadius: 0,
  }),
  mobileMenu: {
    backgroundColor: blue,
    textAlign: "center",
  },
};

export default withRouter(ProjectNavigation);
