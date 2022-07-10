import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
// import {
//   Divider, Dimmer, Loader, Form, Modal, Header, Message, Container,
//   Button, Icon, Grid, Card, TransitionablePortal,
// } from "semantic-ui-react";
import { useWindowSize } from "react-use";
import {
  Button, Card, Col, Container, Grid, Loading, Modal, Row, Spacer, Text
} from "@nextui-org/react";
import {
  Chart, People, Plus, Setting, Swap, User
} from "react-iconly";
import { motion } from "framer-motion/dist/framer-motion";

import {
  getTeams as getTeamsAction,
  saveActiveTeam as saveActiveTeamAction,
} from "../actions/team";
import { getUser, relog as relogAction } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import {
  getTemplates as getTemplatesAction
} from "../actions/template";
import ProjectForm from "../components/ProjectForm";
import Invites from "../components/Invites";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import { secondary } from "../config/colors";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const {
    relog, cleanErrors, user, getTeams, saveActiveTeam,
    teams, teamLoading, getTemplates, history,
  } = props;

  const [loading, setLoading] = useState(false);
  const [addProject, setAddProject] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [retried, setRetried] = useState(false);

  const { width, height } = useWindowSize();

  useEffect(() => {
    cleanErrors();
    relog();
    _getTeams();
  }, []);

  useEffect(() => {
    if (!fetched && user.data.id && !user.loading) {
      _getTeams();
    }
  }, [user]);

  useEffect(() => {
    if (teams.length > 0) {
      let shouldOpenNewProject = true;
      teams.forEach((team) => {
        if (team && team.Projects && team.Projects.length > 0) {
          shouldOpenNewProject = false;
        }

        return team;
      });

      if (shouldOpenNewProject) {
        history.push("/start");
      }
    }
  }, [teams]);

  const _getTeams = () => {
    setFetched(true);
    setLoading(true);
    getTeams(user.data.id)
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        if (!retried) {
          _getTeams();
        }
        setLoading(false);
        setRetried(true);
      });
  };

  const _onNewProject = (team) => {
    setAddProject(true);
    saveActiveTeam(team);
    getTemplates(team.id);
  };

  const _onProjectCreated = (project, isNew = true) => {
    getTeams(user.data.id);
    setAddProject(false);

    let url = `/${project.team_id}/${project.id}/dashboard`;
    if (isNew) url += "?new=true";
    window.location.href = url;
  };

  const directToProject = (team, projectId) => {
    saveActiveTeam(team);
    window.location.href = `/${team.id}/${projectId}/dashboard`;
  };

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getTeamRole = (teamRoles) => {
    return teamRoles.filter((o) => o.user_id === user.data.id)[0].role;
  };

  const newProjectModal = () => {
    return (
      <Modal
        open={addProject}
        onClose={() => setAddProject(false)}
        closeButton
      >
        <Modal.Body>
          <ProjectForm onComplete={_onProjectCreated} />
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => setAddProject(false)}
            color="warning"
            flat
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  if (!user.data.id) {
    return (
      <div style={styles.container(height)}>
        <Container sm>
          <Row justify="center" align="center">
            <Loading size="xl" />
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div style={styles.container(height)}>
      <Navbar hideTeam transparent />
      <Container style={styles.mainContent}>
        <Spacer y={1} />

        <Invites />
        {newProjectModal()}

        {teams && teams.length === 0 && !teamLoading && !loading && (
          <>
            <Row justify="center" align="center">
              <Text h2 style={{ marginTop: 100 }}>
                You are not part of any team yet
              </Text>
            </Row>
            <Row justify="center" align="center">
              <Text h3>
                You can join a team when you receive and accept an invitation
              </Text>
            </Row>
          </>
        )}

        {loading && (
          <Row justify="center" align="center">
            <Loading>
              Loading teams
            </Loading>
          </Row>
        )}

        {teams && teams.map((key) => {
          return (
            <>
              <Container
                justify="space-between"
                key={key.id}
                fluid
                display="flex"
                wrap="nowrap"
                alignItems="center"
              >
                <Col>
                  <Row justify="flex-start" align="center">
                    {key.TeamRoles.length > 1 && <People />}
                    {key.TeamRoles.length < 2 && <User />}
                    <Spacer x={0.2} />
                    <Text
                      h3
                      style={styles.teamHeader}
                      title={`${key.TeamRoles.length} member${key.TeamRoles.length > 1 ? "s" : ""}`}
                    >
                      {key.name}
                    </Text>
                    <Spacer x={0.5} />
                    {key.TeamRoles[0] && (
                      <Text style={styles.roleBanner} size="small">
                        {_getTeamRole(key.TeamRoles)}
                      </Text>
                    )}
                  </Row>
                </Col>
                {_canAccess("admin", key.TeamRoles)
                  && (
                    <Col>
                      <Row justify="flex-end" align="center">
                        <Link to={`/manage/${key.id}/settings`}>
                          <Button
                            style={width >= 768 ? styles.settingsBtn : {}}
                            ghost
                            icon={<Setting />}
                            auto
                          >
                            Team settings
                          </Button>
                        </Link>
                      </Row>
                    </Col>
                  )}
              </Container>
              <Container>
                <Grid.Container justify="flex-start" gap={2}>
                  {key.Projects && key.Projects.map((project) => {
                    return (
                      <Grid xs={12} sm={4} md={3} key={project.id}>
                        <Card
                          isHoverable
                          isPressable
                          onClick={() => directToProject(key, project.id)}
                        >
                          <Card.Header>
                            {project.name}
                          </Card.Header>
                          <Card.Body>
                            <Row justify="space-around" align="center">
                              <Text>
                                <Swap />
                                {project.Connections && project.Connections.length}
                              </Text>
                              <Spacer x={1} />
                              <Text>
                                <Chart />
                                {project.Charts.length}
                              </Text>
                            </Row>
                          </Card.Body>
                        </Card>
                      </Grid>
                    );
                  })}
                  {_canAccess("admin", key.TeamRoles) && (
                    <Grid xs={12} sm={4} md={3}>
                      <motion.div whileHover={{ opacity: 1 }} style={styles.addProjectCard}>
                        <Card
                          isHoverable
                          isPressable
                          onClick={() => _onNewProject(key)}
                        >
                          <Card.Body>
                            <Row justify="center" align="center">
                              <Plus size="large" />
                            </Row>
                            <Row justify="center" align="center">
                              <Text>Create a new project</Text>
                            </Row>
                          </Card.Body>
                        </Card>
                      </motion.div>
                    </Grid>
                  )}
                </Grid.Container>
                {key.Projects && key.Projects.length === 0 && !_canAccess("admin", key.TeamRoles)
                  && (
                    <Container>
                      <Text h3>
                        {"No project over here"}
                      </Text>
                    </Container>
                  )}
              </Container>
            </>
          );
        })}
      </Container>
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    // backgroundColor: "#103751",
    minHeight: height,
  }),
  listContent: {
    cursor: "pointer",
  },
  listItem: {
    margin: "4em",
  },
  listRole: {
    color: "white",
    fontSize: "13px"
  },
  card: {
    backgroundColor: "white",
  },
  mainContent: {
    paddingTop: 50,
    paddingBottom: 50,
  },
  violetSection: {
    backgroundColor: "#1a7fa0",
    borderColor: "#1a7fa0",
  },
  teamContainer: {
    marginTop: 50,
  },
  projectContainer: {
    textAlign: "center",
    cursor: "pointer",
  },
  cardsContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  cardHeader: {
    paddingTop: 10,
    color: "black",
  },
  teamHeader: {
    display: "inline",
  },
  settingsBtn: {
    marginLeft: 20,
  },
  addProjectCard: {
    opacity: 0.5,
    display: "flex",
    width: "100%"
  },
  iconColumn: {
    color: "black",
  },
  roleBanner: {
    backgroundColor: secondary,
    paddingRight: 8,
    paddingLeft: 8,
    borderRadius: 10,
  },
};

UserDashboard.propTypes = {
  user: PropTypes.object.isRequired,
  teams: PropTypes.array.isRequired,
  getTeams: PropTypes.func.isRequired,
  saveActiveTeam: PropTypes.func.isRequired,
  relog: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  teamLoading: PropTypes.bool.isRequired,
  getTemplates: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    teams: state.team.data,
    teamLoading: state.team.loading,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getUser: (id) => dispatch(getUser(id)),
    getTeams: (userId) => dispatch(getTeamsAction(userId)),
    saveActiveTeam: (team) => dispatch(saveActiveTeamAction(team)),
    relog: () => dispatch(relogAction()),
    cleanErrors: () => dispatch(cleanErrorsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
