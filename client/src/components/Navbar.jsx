import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Modal, Link as LinkNext, Spacer, Dropdown, Button, Navbar, Card,
  ModalBody, CircularProgress, NavbarBrand, NavbarContent, NavbarItem,
  DropdownTrigger, DropdownMenu, DropdownItem, CardBody, ModalFooter, ModalHeader, ModalContent, Avatar,
} from "@nextui-org/react";
import { createMedia } from "@artsy/fresnel";
import useDarkMode from "@fisch0920/use-dark-mode";
import { useLocalStorage } from "react-use";
import {
  LuBook, LuCheck, LuChevronDown, LuCompass, LuContrast, LuGithub, LuHeartHandshake, LuLogOut,
  LuMoon, LuSettings, LuSmile, LuSun, LuUser, LuWallpaper,
} from "react-icons/lu";
import { TbBrandDiscord } from "react-icons/tb";

import { getTeam } from "../actions/team";
import { logout } from "../actions/user";
import { getProject, changeActiveProject } from "../actions/project";
import { getProjectCharts } from "../actions/chart";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/logo_blue.png";
import cbLogoInverted from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess";
import { DOCUMENTATION_HOST } from "../config/settings";
import useThemeDetector from "../modules/useThemeDetector";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const { Media } = AppMedia;

/*
  The navbar component used throughout the app
*/
function NavbarContainer(props) {
  const [changelogPadding, setChangelogPadding] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState();
  const [teamOwned, setTeamOwned] = useState({});
  const [showAppearance, setShowAppearance] = useState(false);
  const [isOsTheme, setIsOsTheme] = useLocalStorage("osTheme", "false");

  const {
    team, teams, user, logout, projectProp, match, history,
  } = props;

  const darkMode = useDarkMode(false);
  const isSystemDark = useThemeDetector();

  useEffect(() => {
    // _onTeamChange(match.params.teamId, match.params.projectId);
    setTimeout(() => {
      try {
        Headway.init(HW_config);
        setChangelogPadding(false);
      } catch (e) {
        // ---
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (teams.length > 0) {
      teams.map((t) => {
        t.TeamRoles.map((tr) => {
          if (tr.user_id === user.id && tr.role === "teamOwner") {
            setTeamOwned(t);
          }
          return tr;
        });
        return t;
      });
    }
  }, [teams]);

  const _canAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _setOSTheme = () => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      darkMode.enable();
    } else {
      darkMode.disable();
    }

    window.localStorage.removeItem("darkMode");
    setIsOsTheme(true);
  };

  const _setTheme = (mode) => {
    setIsOsTheme(false);
    if (mode === "dark") {
      darkMode.enable();
    } else {
      darkMode.enable();
      setTimeout(() => {
        darkMode.disable();
      }, 100);
    }
  };

  const _onDropdownAction = (key) => {
    switch (key) {
      case "discord": {
        window.open("https://discord.gg/KwGEbFk", "_blank");
        break;  
      }
      case "tutorials": {
        window.open("https://chartbrew.com/blog/tag/tutorial/", "_blank");
        break;
      }
      case "documentation": {
        window.open(DOCUMENTATION_HOST, "_blank");
        break;
      }
      case "github": {
        window.open("https://github.com/chartbrew/chartbrew/discussions", "_blank");
        break;
      }
      case "feedback": {
        setFeedbackModal(true);
        break;
      }
      case "profile": {
        history.push("/edit");
        break;
      }
      case "account": {
        history.push(`/manage/${team.id || teamOwned.id}/settings`);
        break;
      }
      case "theme": {
        setShowAppearance(true);
        break;
      }
    }
  }

  if (!team?.id && !teams) {
    return (
      <Modal open blur>
        <ModalBody>
          <Container md>
            <Row justify="center" align="center">
              <CircularProgress aria-label="Loading" size="lg" />
            </Row>
          </Container>
        </ModalBody>
      </Modal>
    );
  }
  return (
    <>
      <Navbar isBordered maxWidth="full" height={"3rem"} style={{ zIndex: 999 }}>
        <NavbarBrand>
          <Link to="/user">
            <img src={isSystemDark ? cbLogoInverted : cbLogo} alt="Chartbrew Logo" width={30}  />
          </Link>
          <Spacer x={4} />
          <Row align="center" className={"gap-1"}>
            <Link to="/user" className="text-default-foreground">
                {!match.params.teamId && (
                  <Media greaterThan="mobile">
                    <Row align="center" className={"gap-1"}>
                      <Text>{"Home"}</Text>
                    </Row>
                  </Media>
                )}
                {match.params.teamId && (
                  <Media greaterThan="mobile">
                    <Row align="center" className={"gap-1"}>
                      <Text>{team.name}</Text>
                    </Row>
                  </Media>
                )}
            </Link>
            {match.params.projectId && (
              <Link to={`/${match.params.teamId}/${match.params.projectId}/dashboard`}>
                <Media greaterThan="mobile">
                  <Row align={"center"} className={"gap-1"}>
                    <Text>{"/"}</Text>
                    <Text>{projectProp.name}</Text>
                  </Row>
                </Media>
              </Link>
            )}
          </Row>
        </NavbarBrand>
        <NavbarContent justify="end">
          <NavbarItem>
            <LinkNext
              className="changelog-trigger items-center text-foreground"
              title="Changelog"
            >
              <Media greaterThan="mobile">
                <Text>Updates</Text>
              </Media>
              <span className="changelog-badge">
                {changelogPadding && <span style={{ paddingLeft: 16, paddingRight: 16 }} />}
              </span>
            </LinkNext>
          </NavbarItem>
          <Dropdown>
            <NavbarItem>
              <DropdownTrigger>
                <Button
                  variant="light"
                  disableRipple
                  className="p-0 bg-transparent data-[hover=true]:bg-transparent"
                  startContent={<LuHeartHandshake />}
                  radius="sm"
                >
                  Help
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu variant="faded" onAction={(key) => _onDropdownAction(key)}>
              <DropdownItem startContent={<TbBrandDiscord />} key="discord">
                <Text>{"Join our Discord"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<LuCompass />} key="tutorials">
                <Text>{"Tutorials"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<LuBook />} key="documentation">
                <Text>{"Documentation"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<LuGithub />} key="github">
                <Text>{"GitHub"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<LuSmile />} key="feedback">
                <Text>{"Feedback"}</Text>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <NavbarItem>
              <DropdownTrigger>
                <div>
                  <Row className={"gap-1"} align={"center"}>
                    <Avatar
                      name={user.name}
                      size="sm"
                      isBordered
                      showFallback={<LuUser />}
                    />
                    <LuChevronDown />
                  </Row>
                </div>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu variant="faded">
              <DropdownItem startContent={<LuUser />} key="profile" textValue="Profile">
                <Link to="/edit">
                  <div className="w-full text-foreground">
                    Profile
                  </div>
                </Link>
              </DropdownItem>
              {_canAccess("teamAdmin", teamOwned) && (
                <DropdownItem startContent={<LuSettings />} key="account" textValue="Account settings">
                  <Link to={`/manage/${team?.id || teamOwned.id}/settings`}>
                    <div className="w-full text-foreground">
                      Account settings
                    </div>
                  </Link>
                </DropdownItem>
              )}

              <DropdownItem
                startContent={<LuWallpaper />}
                showDivider
                key="theme"
                onClick={() => setShowAppearance(true)}
                textValue="UI Theme"
              >
                <div className="w-full text-foreground">
                  UI Theme
                </div>
              </DropdownItem>

              <DropdownItem startContent={<LuLogOut />} onClick={logout}>
                Sign out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </Navbar>

      <Modal
        isOpen={feedbackModal}
        onClose={() => setFeedbackModal(false)}
      >
        <ModalContent>
          <ModalBody>
            <FeedbackForm />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" color="warning" onClick={() => setFeedbackModal(false)} auto>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={showAppearance} onClose={() => setShowAppearance(false)} width="500px">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Chartbrew UI Appearance</Text>
          </ModalHeader>
          <ModalBody>
            <div className="flex justify-between gap-2">
              <Card
                isPressable
                borderWeight={!isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                onClick={() => _setTheme("light")}
                className={`bg-white ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
                variant={"bordered"}
              >
                <CardBody>
                  <LuSun size={24} color="black" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className={"text-[#000000]"}>Light</Text>
                    {!isSystemDark && !isOsTheme && (
                      <LuCheck className={"text-[#000000]"} />
                    )}
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                className={`bg-black ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
                borderWeight={isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                onClick={() => _setTheme("dark")}
                variant={"bordered"}
              >
                <CardBody>
                  <LuMoon size={24} color="white" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className="text-[#FFFFFF]">Dark</Text>
                    {isSystemDark && !isOsTheme && (
                      <LuCheck className="text-[white]" />
                    )}
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                variant={"bordered"}
                onClick={_setOSTheme}
                borderWeight={isOsTheme ? "extrabold" : "normal"}
                className={`bg-content3 ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
              >
                <CardBody>
                  <LuContrast size={24} color={isSystemDark ? "white" : "black"} />
                  <Row align={"center"} className={"gap-2"}>
                    <Text h5 className={isSystemDark ? "text-white" : "text-black"}>System</Text>
                    {isOsTheme && (
                      <LuCheck />
                    )}
                  </Row>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setShowAppearance(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

NavbarContainer.propTypes = {
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  logout: PropTypes.func.isRequired,
  projectProp: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team.active,
    teams: state.team.data,
    projectProp: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeam: id => dispatch(getTeam(id)),
    getProject: id => dispatch(getProject(id)),
    changeActiveProject: id => dispatch(changeActiveProject(id)),
    logout: () => dispatch(logout()),
    getProjectCharts: (projectId) => dispatch(getProjectCharts(projectId)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(NavbarContainer));
