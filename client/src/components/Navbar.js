import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Loading, Modal, Row, Container, Link as LinkNext, Image, Spacer,
  Dropdown, Button, Navbar, Text, Grid, Card, useTheme, Tooltip,
} from "@nextui-org/react";
import {
  Category, Discovery, Document, Edit, Heart, Logout, Send, Setting, User
} from "react-iconly";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { BsSun, BsMoonFill } from "react-icons/bs";
import { IoContrastSharp } from "react-icons/io5";
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
import { DOCUMENTATION_HOST, SITE_HOST } from "../config/settings";
import { dark, darkBlue } from "../config/colors";
import useThemeDetector from "../modules/useThemeDetector";

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
    team, teams, user, logout,
  } = props;

  const darkMode = useDarkMode(false);
  const { isDark } = useTheme();
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

  if (!team.id && !teams) {
    return (
      <Modal open blur>
        <Modal.Body>
          <Container md>
            <Row justify="center" align="center">
              <Loading size="lg" />
            </Row>
          </Container>
        </Modal.Body>
      </Modal>
    );
  }
  return (
    <Navbar variant="sticky" disableShadow isBordered isCompact maxWidth="fluid" css={{ zIndex: 999 }}>
      <Navbar.Brand>
        <Link to="/user">
          <Image src={isDark ? cbLogoInverted : cbLogo} alt="Chartbrew Logo" style={styles.logo} />
        </Link>
        <Spacer x={1} />
        <Link to="/user">
          <LinkNext href="/user" css={{ color: "$text" }}>
            <Row align="center">
              <Category size="small" />
              <Spacer x={0.2} />
              <Text>{"Home"}</Text>
            </Row>
          </LinkNext>
        </Link>
      </Navbar.Brand>
      <Navbar.Content>
        <Navbar.Item>
          <LinkNext
            className="changelog-trigger"
            title="Changelog"
            css={{ ai: "center", color: "$text" }}
          >
            <Media greaterThan="mobile">
              <span>Updates</span>
            </Media>
            <span className="changelog-badge">
              {changelogPadding && <span style={{ paddingLeft: 16, paddingRight: 16 }} />}
            </span>
          </LinkNext>
        </Navbar.Item>

        <Dropdown isBordered>
          <Navbar.Item>
            <Dropdown.Button
              light
              ripple={false}
              css={{
                px: 0,
                dflex: "center",
                svg: { pe: "none" },
              }}
              icon={<Heart set="curved" size={20} />}
            >
              Help
            </Dropdown.Button>
          </Navbar.Item>
          <Dropdown.Menu>
            <Dropdown.Item icon={<FaDiscord size={24} />}>
              <LinkNext
                href="https://discord.gg/KwGEbFk"
                target="_blank"
                rel="noopener noreferrer"
                css={{ color: "$text", minWidth: "100%" }}
              >
                <Text>{"Join our Discord"}</Text>
              </LinkNext>
            </Dropdown.Item>
            <Dropdown.Item icon={<Discovery />}>
              <LinkNext
                href="https://chartbrew.com/blog/tag/tutorial/"
                target="_blank"
                rel="noopener noreferrer"
                css={{ color: "$text", minWidth: "100%" }}
              >
                <Text>{"Tutorials"}</Text>
              </LinkNext>
            </Dropdown.Item>
            <Dropdown.Item icon={<Document />}>
              <LinkNext
                href={DOCUMENTATION_HOST}
                target="_blank"
                rel="noopener noreferrer"
                css={{ color: "$text", minWidth: "100%" }}
              >
                <Text>{"Documentation"}</Text>
              </LinkNext>
            </Dropdown.Item>
            <Dropdown.Item icon={<FaGithub size={24} />}>
              <LinkNext
                href="https://github.com/chartbrew/chartbrew/discussions"
                target="_blank"
                rel="noopener noreferrer"
                css={{ color: "$text", minWidth: "100%" }}
              >
                <Text>{"GitHub"}</Text>
              </LinkNext>
            </Dropdown.Item>
            <Dropdown.Item icon={<Edit />}>
              <LinkNext onClick={() => setFeedbackModal(true)} css={{ color: "$text", minWidth: "100%" }}>
                <Text>{"Feedback"}</Text>
              </LinkNext>
            </Dropdown.Item>
            <Dropdown.Item withDivider icon={<Send />}>
              <LinkNext href={`${SITE_HOST}/start`} css={{ color: "$text", minWidth: "100%" }}>
                <Text>{"Project starter"}</Text>
              </LinkNext>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown>
          <Navbar.Item>
            <Dropdown.Button light ripple={false} css={{ minWidth: "fit-content" }} icon={<User />} />
          </Navbar.Item>
          <Dropdown.Menu>
            <Dropdown.Item icon={<User />}>
              <Link to="/edit">
                <Text>
                  Profile
                </Text>
              </Link>
            </Dropdown.Item>

            {_canAccess("admin", teamOwned) && (
              <Dropdown.Item icon={<Setting />}>
                <Link to={`/manage/${team.id || teamOwned.id}/settings`}>
                  <Text
                    css={{ color: "$text", width: "100%" }}
                  >
                    Account settings
                  </Text>
                </Link>
              </Dropdown.Item>
            )}

            <Dropdown.Item
              icon={isDark
                ? <BsSun style={{ marginLeft: 3 }} size={20} />
                : <BsMoonFill style={{ marginLeft: 3 }} size={20} />}
              command={(
                <Tooltip content="Theme settings" css={{ zIndex: 999999 }} placement="leftEnd">
                  <div>
                    <LinkNext onClick={() => setShowAppearance(true)} color="primary">
                      <Setting />
                    </LinkNext>
                  </div>
                </Tooltip>
              )}
            >
              <LinkNext onClick={() => _setTheme(isDark ? "light" : "dark")}>
                <Text css={{ color: "$text" }}>
                  {isDark && "Light mode"}
                  {!isDark && "Dark mode"}
                </Text>
              </LinkNext>
            </Dropdown.Item>

            <Dropdown.Item withDivider icon={<Logout />}>
              <LinkNext onClick={logout} css={{ color: "$text", width: "100%" }}>
                Sign out
              </LinkNext>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Navbar.Content>

      <Modal
        open={feedbackModal}
        onClose={() => setFeedbackModal(false)}
      >
        <Modal.Body>
          <FeedbackForm />
        </Modal.Body>
        <Modal.Footer>
          <Button flat color="warning" onClick={() => setFeedbackModal(false)} auto>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={showAppearance} onClose={() => setShowAppearance(false)} width="500px">
        <Modal.Header>
          <Text h4>Chartbrew UI Appearance</Text>
        </Modal.Header>
        <Modal.Body>
          <Container css={{ pt: 20, pb: 20 }}>
            <Row>
              <Text b>Choose the theme</Text>
            </Row>
            <Grid.Container gap={2}>
              <Grid xs={6} sm={4}>
                <Card
                  isHoverable
                  isPressable
                  borderWeight={!isDark && !isOsTheme ? "extrabold" : "normal"}
                  onClick={() => _setTheme("light")}
                  css={{
                    backgroundColor: "white",
                    borderColor: !isDark && !isOsTheme ? "$secondary" : "$neutralBorder"
                  }}
                  variant={"bordered"}
                >
                  <Card.Body>
                    <BsSun size={24} color="black" />
                    <Spacer x={0.2} />
                    <Text h5 color="black">Light</Text>
                  </Card.Body>
                </Card>
              </Grid>
              <Grid xs={6} sm={4}>
                <Card
                  isPressable
                  isHoverable
                  css={{
                    backgroundColor: darkBlue,
                    borderColor: isDark && !isOsTheme ? "$secondary" : "$neutralBorder"
                  }}
                  borderWeight={isDark && !isOsTheme ? "extrabold" : "normal"}
                  onClick={() => _setTheme("dark")}
                  variant={"bordered"}
                >
                  <Card.Body>
                    <BsMoonFill size={24} color="white" />
                    <Spacer x={0.2} />
                    <Text h5 color="white">Dark</Text>
                  </Card.Body>
                </Card>
              </Grid>
              <Grid xs={6} sm={4}>
                <Card
                  isHoverable
                  isPressable
                  variant={"bordered"}
                  onClick={_setOSTheme}
                  borderWeight={isOsTheme ? "extrabold" : "normal"}
                  css={{
                    backgroundColor: isSystemDark ? darkBlue : "white",
                    borderColor: isOsTheme ? "$secondary" : "$neutralBorder"
                  }}
                >
                  <Card.Body>
                    <IoContrastSharp size={24} color={isSystemDark ? "white" : "black"} />
                    <Spacer x={0.2} />
                    <Text h5 css={{ color: isSystemDark ? "white" : "black" }}>System</Text>
                  </Card.Body>
                </Card>
              </Grid>
            </Grid.Container>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setShowAppearance(false)}
            auto
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Navbar>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  navContainer: {
    top: 0,
    height: 40,
    position: "sticky",
    background: "transparent",
    zIndex: 999,
  },
  centeredDropdown: {
    display: "block",
    textAlign: "center",
    // width: 250,
  },
  transparentMenu: {
    backgroundColor: dark,
  },
  logo: {
    width: 30,
  },
  logoContainer: {
    paddingTop: 1,
    paddingBottom: 1,
    minWidth: 70,
  },
};

NavbarContainer.propTypes = {
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  logout: PropTypes.func.isRequired,
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
