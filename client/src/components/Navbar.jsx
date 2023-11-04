import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Modal, Link as LinkNext, Spacer, Dropdown, Button, Navbar, Card,
  ModalBody, CircularProgress, NavbarBrand, NavbarContent, NavbarItem,
  DropdownTrigger, DropdownMenu, DropdownItem, CardBody, ModalFooter, ModalHeader, ModalContent, Avatar,
} from "@nextui-org/react";
import { createMedia } from "@artsy/fresnel";
import useDarkMode from "@fisch0920/use-dark-mode";
import { useLocalStorage } from "react-use";
import {
  LuBook, LuChevronDown, LuCompass, LuContrast, LuGithub, LuHeartHandshake, LuLogOut,
  LuMoon, LuSettings, LuSmile, LuSun, LuUser, LuWallpaper,
} from "react-icons/lu";
import { TbBrandDiscord } from "react-icons/tb";

import { logout } from "../actions/user";
import { getProject, changeActiveProject } from "../actions/project";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/logo_blue.png";
import cbLogoInverted from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess";
import { DOCUMENTATION_HOST } from "../config/settings";
import useThemeDetector from "../modules/useThemeDetector";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";
import { selectTeam, selectTeams } from "../slices/team";

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
    user, logout, projectProp,
  } = props;

  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);

  const darkMode = useDarkMode(false);
  const isSystemDark = useThemeDetector();
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
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
        navigate("/user/profile");
        break;
      }
      case "account": {
        navigate(`/manage/${team.id || teamOwned.id}/settings`);
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
                {!params.teamId && (
                  <Media greaterThan="mobile">
                    <Row align="center" className={"gap-1"}>
                      <Text>{"Home"}</Text>
                    </Row>
                  </Media>
                )}
                {params.teamId && (
                  <Media greaterThan="mobile">
                    <Row align="center" className={"gap-1"}>
                      <Text>{team.name}</Text>
                    </Row>
                  </Media>
                )}
            </Link>
            {params.projectId && (
              <Link to={`/${params.teamId}/${params.projectId}/dashboard`}>
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
                <Link to="/user/profile">
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
            <div className="flex flex-row justify-between gap-2">
              <Card
                isPressable
                borderWeight={!isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                onClick={() => _setTheme("light")}
                className={`bg-white ${!isSystemDark && !isOsTheme ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
                variant={"bordered"}
              >
                <CardBody>
                  <LuSun size={24} color="black" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className={"!text-black"}>Light</Text>
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                className={`bg-black ${isSystemDark && !isOsTheme ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
                borderWeight={isSystemDark && !isOsTheme ? "extrabold" : "normal"}
                onClick={() => _setTheme("dark")}
                variant={"bordered"}
              >
                <CardBody>
                  <LuMoon size={24} color="white" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className="!text-[#FFFFFF]">Dark</Text>
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                variant={"bordered"}
                onClick={_setOSTheme}
                borderWeight={isOsTheme ? "extrabold" : "normal"}
                className={`bg-content3 ${isOsTheme ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
              >
                <CardBody>
                  <LuContrast size={24} color={isSystemDark ? "white" : "black"} />
                  <Row align={"center"} className={"gap-2"}>
                    <Text h5 className={isSystemDark ? "text-white" : "text-black"}>System</Text>
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
  logout: PropTypes.func.isRequired,
  projectProp: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    projectProp: state.project.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getProject: id => dispatch(getProject(id)),
    changeActiveProject: id => dispatch(changeActiveProject(id)),
    logout: () => dispatch(logout()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(NavbarContainer);
