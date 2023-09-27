import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Modal, Link as LinkNext, Spacer, Dropdown, Button, Navbar, Card,
  ModalBody, CircularProgress, NavbarBrand, NavbarContent, NavbarItem,
  DropdownTrigger, DropdownMenu, DropdownItem, CardBody, ModalFooter, ModalHeader, ModalContent,
} from "@nextui-org/react";
import { FaDiscord } from "react-icons/fa";
import {
  IoBook, IoChatboxEllipses, IoCompass, IoContrastSharp, IoHeartCircleOutline,
  IoLogOut, IoLogoGithub, IoMoon, IoPerson, IoPlay, IoSettings, IoSunny,
} from "react-icons/io5";
import { createMedia } from "@artsy/fresnel";
import useDarkMode from "@fisch0920/use-dark-mode";
import { useLocalStorage } from "react-use";

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
  const [isOsTheme, setIsOsTheme] = useLocalStorage("osTheme", false);

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
          if (tr.user_id === user.id && tr.role === "owner") {
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
      case "project-starter": {
        history.push("/start");
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

  if (!team.id && !teams) {
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
                  startContent={<IoHeartCircleOutline size={24} />}
                  radius="sm"
                >
                  Help
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu variant="faded" onAction={(key) => _onDropdownAction(key)}>
              <DropdownItem startContent={<FaDiscord />} key="discord">
                <Text>{"Join our Discord"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<IoCompass />} key="tutorials">
                <Text>{"Tutorials"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<IoBook />} key="documentation">
                <Text>{"Documentation"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<IoLogoGithub />} key="github">
                <Text>{"GitHub"}</Text>
              </DropdownItem>
              <DropdownItem showDivider startContent={<IoChatboxEllipses />} key="feedback">
                <Text>{"Feedback"}</Text>
              </DropdownItem>
              <DropdownItem startContent={<IoPlay />} key="project-starter">
                <Text>{"Project starter"}</Text>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <NavbarItem>
              <DropdownTrigger>
                <Button
                  variant="light"
                  disableRipple
                  style={{ minWidth: "fit-content" }}
                  isIconOnly
                >
                  <IoPerson />
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu variant="faded">
              <DropdownItem startContent={<IoPerson />} key="profile" textValue="Profile">
                <Link to="/edit">
                  <div className="w-full text-foreground">
                    Profile
                  </div>
                </Link>
              </DropdownItem>
              {_canAccess("admin", teamOwned) && (
                <DropdownItem startContent={<IoSettings />} key="account">
                  <Link to={`/manage/${team.id || teamOwned.id}/settings`}>
                    <div className="w-full text-foreground">
                      Account settings
                    </div>
                  </Link>
                </DropdownItem>
              )}

              <DropdownItem
                startContent={isSystemDark
                  ? <IoSunny style={{ marginLeft: 3 }} size={20} />
                  : <IoMoon style={{ marginLeft: 3 }} size={20} />}
                showDivider
                key="theme"
                onClick={() => setShowAppearance(true)}
              >
                {isSystemDark && "Light mode"}
                {!isSystemDark && "Dark mode"}
              </DropdownItem>

              <DropdownItem startContent={<IoLogOut />} onClick={logout}>
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
            <div className="w-full">
              <Row>
                <Text b>Choose the theme</Text>
              </Row>
              <Spacer y={4} />
              <div className="flex justify-between gap-2">
                <Card
                  isHoverable
                  isPressable
                  borderWeight={!isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                  onClick={() => _setTheme("light")}
                  className={`bg-background ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
                  variant={"bordered"}
                >
                  <CardBody>
                    <IoSunny size={24} color="black" />
                    <Text h5 className={"text-black"}>Light</Text>
                  </CardBody>
                </Card>

                <Card
                  isPressable
                  isHoverable
                  className={`bg-foreground ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
                  borderWeight={isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                  onClick={() => _setTheme("dark")}
                  variant={"bordered"}
                >
                  <CardBody>
                    <IoMoon size={24} color="white" />
                    <Text h5 className="text-white">Dark</Text>
                  </CardBody>
                </Card>

                <Card
                  isHoverable
                  isPressable
                  variant={"bordered"}
                  onClick={_setOSTheme}
                  borderWeight={isOsTheme ? "extrabold" : "normal"}
                  className={`${isSystemDark ? "bg-foreground" : "bg-background"} ${!isSystemDark && !isOsTheme ? "border-secondary-500" : ""} min-w-[100px]`}
                >
                  <CardBody>
                    <IoContrastSharp size={24} color={isSystemDark ? "white" : "black"} />
                    <Text h5 className={isSystemDark ? "text-white" : "text-black"}>System</Text>
                  </CardBody>
                </Card>
              </div>
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
