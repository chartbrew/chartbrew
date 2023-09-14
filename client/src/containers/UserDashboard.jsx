import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Input, Spacer, Table, Tooltip, Link as LinkNext, Chip, Modal, CircularProgress, TableHeader, TableColumn, TableCell, TableBody, TableRow, ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import {
  Chart, Delete, Edit, People, Search, Setting, Swap, User
} from "react-iconly";

import {
  getTeams as getTeamsAction,
  saveActiveTeam as saveActiveTeamAction,
} from "../actions/team";
import { relog as relogAction } from "../actions/user";
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
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import { HiPlus } from "react-icons/hi";

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
      _checkParameters();
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

  const _checkParameters = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("__cb_goto")) {
      const gotoPage = params.get("__cb_goto");
      window.localStorage.removeItem("__cb_goto");
      history.push(gotoPage);
    }
  };

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
            <CircularProgress aria-label="Loading" size="xl" />
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div className="bg-content2" style={styles.container(height)}>
      <Navbar hideTeam transparent />
      <Container size="md">
        <Spacer y={4} />
        {newProjectModal()}

        {teams && teams.map((key) => {
          return (
            <>
              <Container
                key={key.id}
                size="md"
                className={"flex flex-row justify-center align-middle"}
              >
                <Row justify="flex-start" align="center">
                  {key.TeamRoles.length > 1 && <People />}
                  {key.TeamRoles.length < 2 && <User />}
                  <Spacer x={1} />
                  <Text
                    size={"xl"}
                    b
                    className={"inline"}
                    title={`${key.TeamRoles.length} member${key.TeamRoles.length > 1 ? "s" : ""}`}
                  >
                    {key.name}
                  </Text>
                  <Spacer x={2} />
                  {key.TeamRoles[0] && (
                    <Chip color="secondary" size="sm">
                      {_getTeamRole(key.TeamRoles)}
                    </Chip>
                  )}
                </Row>
                {_canAccess("admin", key.TeamRoles)
                  && (
                    <Row justify="flex-end" align="center">
                      <Tooltip content="Team settings">
                        <div>
                          <Link to={`/manage/${key.id}/settings`}>
                            <Button
                              style={width >= 768 ? styles.settingsBtn : {}}
                              className={"min-w-fit"}
                              size="sm"
                              isIconOnly
                            >
                              <Setting />
                            </Button>
                          </Link>
                        </div>
                      </Tooltip>
                    </Row>
                  )}
              </Container>
              <Container>
                <Spacer y={2} />
                <Row className={"gap-2"} justify="flex-start" align="center">
                  {_canAccess("admin", key.TeamRoles) && (
                    <>
                      <Button
                        color="primary"
                        onClick={() => _onNewProject(key)}
                        endContent={<HiPlus />}
                      >
                        Create new project
                      </Button>
                    </>
                  )}
                  <Input
                    type="text"
                    placeholder="Search projects"
                    variant="bordered"
                    endContent={<Search set="light" />}
                    onChange={(e) => setSearch({ ...search, [key.id]: e.target.value })}
                    className="max-w-[300px]"
                  />
                </Row>
                <Spacer y={2} />
                {key.Projects && (
                  <Table
                    aria-label="Projects list"
                    className="h-auto min-w-full bg-content2"
                  >
                    <TableHeader>
                      <TableColumn key="name">Project name</TableColumn>
                      <TableColumn key="connections" align="center">
                        <Row align="center" justify="center">
                          <Swap size="small" />
                          <Spacer x={0.2} />
                          Connections
                        </Row>
                      </TableColumn>
                      <TableColumn key="charts" align="center">
                        <Row align="center" justify="center">
                          <Chart size="small" />
                          <Spacer x={0.2} />
                          Charts
                        </Row>
                      </TableColumn>
                      <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                    </TableHeader>
                    {_getFilteredProjects(key).length > 0 && (
                      <TableBody items={_getFilteredProjects(key)}>
                        {(project) => (
                          <TableRow key={project.id}>
                            <TableCell key="name">
                              <LinkNext onClick={() => directToProject(key, project.id)}>
                                <Text b className={"text-default-foreground"}>{project.name}</Text>
                              </LinkNext>
                            </TableCell>
                            <TableCell key="connections">
                              <Row justify="center" align="center">
                                <Text b>
                                  {project.Connections && project.Connections.length}
                                </Text>
                              </Row>
                            </TableCell>
                            <TableCell key="charts">
                              <Row justify="center" align="center">
                                <Text b>
                                  {project.Charts.length}
                                </Text>
                              </Row>
                            </TableCell>
                            <TableCell key="actions">
                              {_canAccess("admin", key.TeamRoles) && (
                                <Row justify="flex-end" align="center">
                                  <Tooltip content="Rename the project">
                                    <Button
                                      startContent={<Edit set="light" />}
                                      variant="light"
                                      size="sm"
                                      className={"min-w-fit"}
                                      onClick={() => _onEditProject(project)}
                                    />
                                  </Tooltip>
                                  <Tooltip
                                    content="Delete project"
                                    color="danger"
                                  >
                                    <Button
                                      color="danger"
                                      startContent={<Delete set="light" />}
                                      variant="light"
                                      size="sm"
                                      className={"min-w-fit"}
                                      onClick={() => _onDeleteProject(project)}
                                    />
                                  </Tooltip>
                                  <Spacer x={0.5} />
                                </Row>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    )}
                    {_getFilteredProjects(key).length === 0 && (
                      <TableBody>
                        <TableRow>
                          <TableCell key="name">
                            <Text i>No projects found</Text>
                          </TableCell>
                          <TableCell key="connections" align="center" />
                          <TableCell key="charts" align="center" />
                          <TableCell key="actions" align="center" />
                        </TableRow>
                      </TableBody>
                    )}
                  </Table>
                )}
                {key.Projects && key.Projects.length === 0 && !_canAccess("admin", key.TeamRoles)
                  && (
                    <Container>
                    <Text size="h3">
                        {"No project over here"}
                      </Text>
                    </Container>
                  )}
              </Container>
              <Spacer y={4} />

              <Modal isOpen={!!projectToEdit} onClose={() => setProjectToEdit(null)}>
                <ModalContent>
                  <ModalHeader>
                    <Text size="h3">Rename your project</Text>
                  </ModalHeader>
                  <ModalBody>
                    <Input
                      label="Project name"
                      placeholder="Enter the project name"
                      value={projectToEdit?.name || ""}
                      onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
                      variant="bordered"
                      fullWidth
                    />
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      variant="flat"
                      color="warning"
                      onClick={() => setProjectToEdit(null)}
                      auto
                    >
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      onClick={() => _onEditProjectSubmit()}
                      disabled={!projectToEdit?.name || modifyingProject}
                      isLoading={modifyingProject}
                    >
                      Save
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>

              <Modal isOpen={!!projectToDelete} onClose={() => setProjectToDelete(null)}>
                <ModalContent>
                  <ModalHeader>
                    <Text size="h4">Are you sure you want to delete the project?</Text>
                  </ModalHeader>
                  <ModalBody>
                    <Text>
                      {"Deleting a project will delete all the charts and connections associated with it. This action cannot be undone."}
                    </Text>
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      variant="flat"
                      color="warning"
                      onClick={() => setProjectToDelete(null)}
                      auto
                    >
                      Cancel
                    </Button>
                    <Button
                      auto
                      color="danger"
                      endContent={<Delete />}
                      onClick={() => _onDeleteProjectSubmit()}
                      isLoading={modifyingProject}
                    >
                      Delete
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </>
          );
        })}

        {(loading || teamLoading || (teams && teams.length === 0)) && (
          <>
            <Row align="center" justify="center">
              <CircularProgress aria-label="Loading" size="xl" />
            </Row>
            <Spacer y={1} />
            <Row align="center" justify="center">
              <Text size="lg" className={"text-gray-400"}>Loading your space</Text>
            </Row>
          </>
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
