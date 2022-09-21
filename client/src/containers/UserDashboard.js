import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Col, Container, Input, Loading, Row,
  Spacer, Table, Text, Tooltip, Link as LinkNext, Badge, Modal,
} from "@nextui-org/react";
import {
  Chart, Delete, Edit, People, Plus, Search, Setting, Swap, User
} from "react-iconly";

import {
  getTeams as getTeamsAction,
  saveActiveTeam as saveActiveTeamAction,
} from "../actions/team";
import { getUser, relog as relogAction } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import {
  getTemplates as getTemplatesAction
} from "../actions/template";
import {
  updateProject as updateProjectAction,
  removeProject as removeProjectAction,
} from "../actions/project";
import ProjectForm from "../components/ProjectForm";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import { secondary } from "../config/colors";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const {
    relog, cleanErrors, user, getTeams, saveActiveTeam,
    teams, teamLoading, getTemplates, history, updateProject, removeProject,
  } = props;

  const [loading, setLoading] = useState(false);
  const [addProject, setAddProject] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [retried, setRetried] = useState(false);
  const [search, setSearch] = useState({});
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [modifyingProject, setModifyingProject] = useState(false);

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
    return getTeams(user.data.id)
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

  const _getFilteredProjects = (team) => {
    if (!search[team.id]) return team.Projects;
    return team.Projects.filter((p) => {
      return p.name.toLowerCase().indexOf(search[team.id].toLowerCase()) > -1;
    });
  };

  const _onEditProject = (project) => {
    setProjectToEdit(project);
  };

  const _onEditProjectSubmit = () => {
    if (projectToEdit && projectToEdit.id) {
      setModifyingProject(true);
      updateProject(projectToEdit.id, { name: projectToEdit.name })
        .then(() => {
          return _getTeams();
        })
        .then(() => {
          setModifyingProject(false);
          setProjectToEdit(null);
        })
        .catch(() => {
          setModifyingProject(false);
        });
    }
  };

  const _onDeleteProject = (project) => {
    setProjectToDelete(project);
  };

  const _onDeleteProjectSubmit = () => {
    if (projectToDelete && projectToDelete.id) {
      setModifyingProject(true);
      removeProject(projectToDelete.id)
        .then(() => {
          return _getTeams();
        })
        .then(() => {
          setProjectToDelete(null);
          setModifyingProject(false);
        })
        .catch(() => {
          setModifyingProject(false);
        });
    }
  };

  const newProjectModal = () => {
    return (
      <ProjectForm
        onComplete={_onProjectCreated}
        open={addProject}
        onClose={() => setAddProject(false)}
      />
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
        {newProjectModal()}

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
                      size={24}
                      b
                      style={styles.teamHeader}
                      title={`${key.TeamRoles.length} member${key.TeamRoles.length > 1 ? "s" : ""}`}
                    >
                      {key.name}
                    </Text>
                    <Spacer x={0.5} />
                    {key.TeamRoles[0] && (
                      <Badge color="secondary">
                        {_getTeamRole(key.TeamRoles)}
                      </Badge>
                    )}
                  </Row>
                </Col>
                {_canAccess("admin", key.TeamRoles)
                  && (
                    <Col>
                      <Row justify="flex-end" align="center">
                        <Tooltip content="Team settings">
                          <Link to={`/manage/${key.id}/settings`}>
                            <Button
                              style={width >= 768 ? styles.settingsBtn : {}}
                              ghost
                              icon={<Setting />}
                              css={{ minWidth: "fit-content" }}
                              size="sm"
                            />
                          </Link>
                        </Tooltip>
                      </Row>
                    </Col>
                  )}
              </Container>
              <Container>
                <Spacer y={1} />
                <Row justify="flex-start" align="center">
                  {_canAccess("admin", key.TeamRoles) && (
                    <>
                      <Button
                        onClick={() => _onNewProject(key)}
                        iconRight={<Plus />}
                        auto
                      >
                        Create new project
                      </Button>
                      <Spacer x={0.5} />
                    </>
                  )}
                  <Input
                    type="text"
                    placeholder="Search projects"
                    clearable
                    bordered
                    contentRight={<Search set="light" />}
                    onChange={(e) => setSearch({ ...search, [key.id]: e.target.value })}
                  />
                </Row>
                <Spacer y={1} />
                {key.Projects && (
                  <Table
                    aria-label="Projects list"
                    css={{
                      height: "auto",
                      minWidth: "100%",
                      backgroundColor: "$backgroundContrast"
                    }}
                    sticked
                    striped
                    headerLined
                  >
                    <Table.Header>
                      <Table.Column key="name">Project name</Table.Column>
                      <Table.Column key="connections" align="center">
                        <Row align="center" justify="center">
                          <Swap size="small" />
                          <Spacer x={0.2} />
                          Connections
                        </Row>
                      </Table.Column>
                      <Table.Column key="charts" align="center">
                        <Row align="center" justify="center">
                          <Chart size="small" />
                          <Spacer x={0.2} />
                          Charts
                        </Row>
                      </Table.Column>
                      <Table.Column key="actions" align="center" hideHeader>Actions</Table.Column>
                    </Table.Header>
                    {_getFilteredProjects(key).length > 0 && (
                      <Table.Body items={_getFilteredProjects(key)}>
                        {(project) => (
                          <Table.Row key={project.id}>
                            <Table.Cell key="name">
                              <LinkNext onClick={() => directToProject(key, project.id)}>
                                <Text b css={{ color: "$text" }}>{project.name}</Text>
                              </LinkNext>
                            </Table.Cell>
                            <Table.Cell key="connections">
                              <Row justify="center" align="center">
                                <Text b>
                                  {project.Connections && project.Connections.length}
                                </Text>
                              </Row>
                            </Table.Cell>
                            <Table.Cell key="charts">
                              <Row justify="center" align="center">
                                <Text b>
                                  {project.Charts.length}
                                </Text>
                              </Row>
                            </Table.Cell>
                            <Table.Cell key="actions">
                              {_canAccess("admin", key.TeamRoles) && (
                                <Row justify="flex-end" align="center">
                                  <Tooltip content="Rename the project">
                                    <Button
                                      icon={<Edit set="light" />}
                                      light
                                      size="sm"
                                      css={{ minWidth: "fit-content" }}
                                      onClick={() => _onEditProject(project)}
                                    />
                                  </Tooltip>
                                  <Tooltip
                                    content="Delete project"
                                    color="error"
                                  >
                                    <Button
                                      color="error"
                                      icon={<Delete set="light" />}
                                      light
                                      size="sm"
                                      css={{ minWidth: "fit-content" }}
                                      onClick={() => _onDeleteProject(project)}
                                    />
                                  </Tooltip>
                                  <Spacer x={0.5} />
                                </Row>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </Table.Body>
                    )}
                    {_getFilteredProjects(key).length === 0 && (
                      <Table.Body>
                        <Table.Row>
                          <Table.Cell key="name">
                            <Text i>No projects found</Text>
                          </Table.Cell>
                          <Table.Cell key="connections" align="center" />
                          <Table.Cell key="charts" align="center" />
                          <Table.Cell key="actions" align="center" />
                        </Table.Row>
                      </Table.Body>
                    )}
                  </Table>
                )}
                {key.Projects && key.Projects.length === 0 && !_canAccess("admin", key.TeamRoles)
                  && (
                    <Container>
                      <Text h3>
                        {"No project over here"}
                      </Text>
                    </Container>
                  )}
              </Container>
              <Spacer y={3} />

              <Modal open={!!projectToEdit} onClose={() => setProjectToEdit(null)}>
                <Modal.Header>
                  <Text h3>Rename your project</Text>
                </Modal.Header>
                <Modal.Body>
                  <Input
                    label="Project name"
                    placeholder="Enter the project name"
                    value={projectToEdit?.name || ""}
                    onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
                    bordered
                    fullWidth
                  />
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    flat
                    color="warning"
                    onClick={() => setProjectToEdit(null)}
                    auto
                  >
                    Cancel
                  </Button>
                  <Button
                    auto
                    onClick={() => _onEditProjectSubmit()}
                    disabled={!projectToEdit?.name || modifyingProject}
                    iconRight={modifyingProject ? <Loading size="xs" /> : null}
                  >
                    Save
                  </Button>
                </Modal.Footer>
              </Modal>

              <Modal open={!!projectToDelete} onClose={() => setProjectToDelete(null)}>
                <Modal.Header>
                  <Text h4>Are you sure you want to delete the project?</Text>
                </Modal.Header>
                <Modal.Body>
                  <Text>
                    {"Deleting a project will delete all the charts and connections associated with it. This action cannot be undone."}
                  </Text>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    flat
                    color="warning"
                    onClick={() => setProjectToDelete(null)}
                    auto
                  >
                    Cancel
                  </Button>
                  <Button
                    auto
                    color="error"
                    iconRight={modifyingProject ? <Loading size="xs" /> : <Delete />}
                    onClick={() => _onDeleteProjectSubmit()}
                    disabled={modifyingProject}
                  >
                    Delete
                  </Button>
                </Modal.Footer>
              </Modal>
            </>
          );
        })}

        {(loading || teamLoading || (teams && teams.length === 0)) && (
          <Row justify="center" align="center">
            <Loading type="points" size="lg">
              Loading your team
            </Loading>
          </Row>
        )}
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
  updateProject: PropTypes.func.isRequired,
  removeProject: PropTypes.func.isRequired,
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
    updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
    removeProject: (projectId) => dispatch(removeProjectAction(projectId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
