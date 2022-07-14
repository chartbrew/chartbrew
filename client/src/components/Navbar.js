import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Loading, Modal, Row, Container, Link as LinkNext, Col, Image, Spacer,
  Dropdown, Button, Tooltip,
} from "@nextui-org/react";
import {
  Category, Discovery, Document, Edit, Heart, Logout, Send, User
} from "react-iconly";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { createMedia } from "@artsy/fresnel";

import { getTeam } from "../actions/team";
import { logout } from "../actions/user";
import { getProject, changeActiveProject } from "../actions/project";
import { getProjectCharts } from "../actions/chart";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess";
import { DOCUMENTATION_HOST, SITE_HOST } from "../config/settings";
import { blue, dark } from "../config/colors";
import StyledNavContainer from "./StyledNavContainer";

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
function Navbar(props) {
  const [changelogPadding, setChangelogPadding] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState();
  const [teamOwned, setTeamOwned] = useState({});
  const [scrollPosition, setScrollPosition] = useState(0);

  const {
    color, team, teams, user, logout,
  } = props;

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

    setScrollPosition(
      (typeof window !== "undefined" && window.pageYOffset) || 0
    );
    window.addEventListener("scroll", onScroll.bind(this));
    return () => {
      window.removeEventListener("scroll", onScroll.bind(this));
    };
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

  const onScroll = () => {
    window.requestAnimationFrame(() => {
      setScrollPosition(window.pageYOffset);
    });
  };

  const _canAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }
    return canAccess(role, user.id, team.TeamRoles);
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
    <nav style={{ ...styles.navContainer, backgroundColor: color }}>
      <StyledNavContainer detached={scrollPosition > 50} showBlur={scrollPosition > 50}>
        <Container
          fluid
          as="nav"
          display="flex"
          wrap="nowrap"
          alignItems="center"
        >
          <Col
            css={{
              "@mdMax": {
                width: "100%"
              }
            }}
          >
            <Row justify="flex-start" align="center">
              <Link to="/user">
                <LinkNext href="/user">
                  <Image src={cbLogo} alt="Chartbrew Logo" style={styles.logo} />
                </LinkNext>
              </Link>
              <Spacer x={1} />
              <Link to="/user">
                <LinkNext href="/user" css={{ color: "white" }}>
                  <Row align="center">
                    <Category size="small" />
                    <Spacer x={0.2} />
                    {"Home"}
                  </Row>
                </LinkNext>
              </Link>
            </Row>
          </Col>
          <Col className="navbar__search-container">
            <Row
              className="navbar__search-row"
              justify="flex-end"
              align="center"
              css={{
                position: "initial",
                "@xsMax": {
                  jc: "flex-end",
                }
              }}
            >
              <Tooltip content={"Chartbrew updates"}>
                <LinkNext
                  href="#"
                  className="changelog-trigger"
                  title="Changelog"
                  css={{ color: "white" }}
                >
                  <span className="changelog-badge">
                    {changelogPadding && <span style={{ paddingLeft: 16, paddingRight: 16 }} />}
                  </span>
                </LinkNext>
              </Tooltip>
              <Spacer x={1} />

              <Dropdown>
                <Dropdown.Trigger>
                  <LinkNext css={{ color: "white" }}>
                    <Row align="center">
                      <Heart set="bold" size={"small"} />
                      <Spacer x={0.2} />
                      <Media greaterThan="mobile">
                        {"Help"}
                      </Media>
                    </Row>
                  </LinkNext>
                </Dropdown.Trigger>
                <Dropdown.Menu>
                  <Dropdown.Item icon={<FaDiscord size={24} />}>
                    <LinkNext
                      href="https://discord.gg/KwGEbFk"
                      target="_blank"
                      rel="noopener noreferrer"
                      css={{ color: "$text" }}
                    >
                      {"Join our Discord"}
                    </LinkNext>
                  </Dropdown.Item>
                  <Dropdown.Item icon={<Discovery />}>
                    <LinkNext
                      href="https://chartbrew.com/blog/tag/tutorial/"
                      target="_blank"
                      rel="noopener noreferrer"
                      css={{ color: "$text" }}
                    >
                      {"Tutorials"}
                    </LinkNext>
                  </Dropdown.Item>
                  <Dropdown.Item icon={<Document />}>
                    <LinkNext
                      href={DOCUMENTATION_HOST}
                      target="_blank"
                      rel="noopener noreferrer"
                      css={{ color: "$text" }}
                    >
                      {"Documentation"}
                    </LinkNext>
                  </Dropdown.Item>
                  <Dropdown.Item icon={<FaGithub size={24} />}>
                    <LinkNext
                      href="https://github.com/chartbrew/chartbrew/discussions"
                      target="_blank"
                      rel="noopener noreferrer"
                      css={{ color: "$text" }}
                    >
                      {"GitHub"}
                    </LinkNext>
                  </Dropdown.Item>
                  <Dropdown.Item icon={<Edit />}>
                    <LinkNext onClick={() => setFeedbackModal(true)} css={{ color: "$text" }}>
                      {"Feedback"}
                    </LinkNext>
                  </Dropdown.Item>
                  <Dropdown.Item withDivider icon={<Send />}>
                    <LinkNext href={`${SITE_HOST}/start`} css={{ color: "$text" }}>
                      {"Project starter"}
                    </LinkNext>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Spacer x={1} />

              <Dropdown>
                <Dropdown.Trigger>
                  <LinkNext css={{ color: "white" }}>
                    <User primaryColor="white" size="normal" />
                  </LinkNext>
                </Dropdown.Trigger>
                <Dropdown.Menu>
                  <Dropdown.Item>
                    <Link to="/edit">
                      <LinkNext href="/edit" css={{ color: "$text" }}>
                        Profile
                      </LinkNext>
                    </Link>
                  </Dropdown.Item>

                  {_canAccess("admin", teamOwned) && (
                    <Dropdown.Item>
                      <Link to={`/manage/${team.id || teamOwned.id}/settings`}>
                        <LinkNext href={`/manage/${team.id || teamOwned.id}/settings`} css={{ color: "$text" }}>
                          Account settings
                        </LinkNext>
                      </Link>
                    </Dropdown.Item>
                  )}

                  <Dropdown.Item withDivider icon={<Logout />} onClick={logout}>
                    Sign out
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Row>
          </Col>

          <Modal
            open={feedbackModal}
            onClose={() => setFeedbackModal(false)}
          >
            <Modal.Body>
              <FeedbackForm />
            </Modal.Body>
            <Modal.Footer>
              <Button flat color="warning" onClick={() => setFeedbackModal(false)}>
                Cancel
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </StyledNavContainer>
    </nav>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  navContainer: {
    top: 0,
    height: "50px",
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

Navbar.defaultProps = {
  color: blue,
};

Navbar.propTypes = {
  user: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  logout: PropTypes.func.isRequired,
  color: PropTypes.string,
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Navbar));
