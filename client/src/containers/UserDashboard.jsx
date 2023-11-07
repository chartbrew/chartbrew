import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Input, Spacer, Table, Tooltip, Link as LinkNext, Chip, Modal,
  CircularProgress, TableHeader, TableColumn, TableCell, TableBody, TableRow,
  ModalHeader, ModalBody, ModalFooter, ModalContent, DropdownTrigger, Dropdown,
  DropdownMenu, DropdownItem, Avatar, AvatarGroup, Listbox, ListboxItem,
} from "@nextui-org/react";
import {
  LuBarChart, LuChevronDown, LuDatabase, LuLayoutGrid, LuPencilLine, LuPlug, LuPlus, LuSearch, LuSettings,
  LuTrash, LuUsers2,
} from "react-icons/lu";

import { relog as relogAction } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import {
  getTemplates as getTemplatesAction
} from "../actions/template";
import {
  updateProject as updateProjectAction,
  removeProject as removeProjectAction,
} from "../actions/project";
import {
  getTeamConnections as getTeamConnectionsAction,
} from "../actions/connection";
import ProjectForm from "../components/ProjectForm";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import { secondary } from "../config/colors";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import connectionImages from "../config/connectionImages";
import useThemeDetector from "../modules/useThemeDetector";
import {
  selectTeam, selectTeams, getTeams, saveActiveTeam, getTeamMembers, selectTeamMembers,
} from "../slices/team";
import {
  getDatasets, selectDatasets,
} from "../slices/dataset";
import Segment from "../components/Segment";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const {
    relog, cleanErrors, user,
    teamLoading, getTemplates, updateProject, removeProject,
    connections, getTeamConnections,
  } = props;

  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const teamMembers = useSelector(selectTeamMembers);
  const datasets = useSelector(selectDatasets);

  const [addProject, setAddProject] = useState(false);
  const [search, setSearch] = useState({});
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [modifyingProject, setModifyingProject] = useState(false);
  const [activeMenu, setActiveMenu] = useState("projects");

  const initRef = useRef(null);
  const { height } = useWindowSize();
  const isDark = useThemeDetector();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();
    relog();
  }, []);

  useEffect(() => {
    if (user.data.id && !user.loading) {
      _checkParameters();
    }
  }, [user]);

  useEffect(() => {
    if (teams && teams.length > 0 && !initRef.current) {
      initRef.current = true;
      const owningTeam = teams.find((t) => t.TeamRoles.find((tr) => tr.role === "teamOwner" && tr.user_id === user.data.id));
      if (!owningTeam) return;
      dispatch(saveActiveTeam(owningTeam));
      dispatch(getTeamMembers({ team_id: owningTeam.id }));
      dispatch(getDatasets({ team_id: owningTeam.id }));
    }
  }, [teams]);

  useEffect(() => {
    if (team?.id) {
      dispatch(getTeamMembers({ team_id: team.id }));
      getTeamConnections(team.id);
    }
  }, [team]);

  const _checkParameters = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("__cb_goto")) {
      const gotoPage = params.get("__cb_goto");
      window.localStorage.removeItem("__cb_goto");
      navigate(gotoPage);
    }
  };

  const _onNewProject = (team) => {
    setAddProject(true);
    dispatch(saveActiveTeam(team));
    getTemplates(team.id);
  };

  const _onProjectCreated = (project, isNew = true) => {
    dispatch(getTeams(user.data.id));
    setAddProject(false);

    let url = `/${project.team_id}/${project.id}/dashboard`;
    if (isNew) url += "?new=true";
    window.location.href = url;
  };

  const directToProject = (projectId) => {
    dispatch(saveActiveTeam(team));
    window.location.href = `/${team.id}/${projectId}/dashboard`;
  };

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getTeamRole = (teamRoles) => {
    return teamRoles.filter((o) => o.user_id === user.data.id)[0].role;
  };

  const _getFilteredProjects = () => {
    if (!search[team.id]) return team.Projects;
    const filteredProjects = team.Projects.filter((p) => {
      return p.name.toLowerCase().indexOf(search[team.id].toLowerCase()) > -1;
    });

    // now add the team members to each project
    const formattedProjects = filteredProjects.map((p) => {
      const projectMembers = _getProjectMembers(p, teamMembers);
      return {
        ...p,
        members: projectMembers,
      };
    });

    return formattedProjects;
  };

  const _onEditProject = (project) => {
    setProjectToEdit(project);
  };

  const _onEditProjectSubmit = () => {
    if (projectToEdit && projectToEdit.id) {
      setModifyingProject(true);
      updateProject(projectToEdit.id, { name: projectToEdit.name })
        .then(() => {
          return dispatch(getTeams(user.data.id))
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
          return dispatch(getTeams(user.data.id))
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

  const _getProjectMembers = (project) => {
    if (!teamMembers) return [];
    const projectMembers = teamMembers.filter((tm) => {
      return tm.TeamRoles.find((tr) => tr?.projects?.length > 0 && tr.projects.includes(project.id));
    });

    return projectMembers;
  };

  const _onChangeTeam = (teamId) => {
    const team = teams.find((t) => `${t.id}` === `${teamId}`);
    dispatch(saveActiveTeam(team));
    dispatch(getTeamMembers({ team_id: team.id }));
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
      {newProjectModal()}
      <div className="container mx-auto">
        <Spacer y={4} />

        {team?.id && (
          <div className="grid grid-cols-12 gap-4 mt-4">
            <div className="col-span-12 sm:col-span-5 md:col-span-4 lg:col-span-3">
              <Row
                align={"center"}
                justify={"space-between"}
              >
                <Row justify="flex-start" align="center" className={"w-full"}>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        startContent={<LuUsers2 size={28} />}
                        variant="bordered"
                        className="bg-background"
                        endContent={<LuChevronDown />}
                        fullWidth
                      >
                        {team.name}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectedKeys={[`${team.id}`]}
                      onSelectionChange={(keys) => {
                        _onChangeTeam(keys.currentKey);
                      }}
                      selectionMode="single"
                    >
                      {teams.map((t) => (
                        <DropdownItem
                          key={t.id}
                          textValue={t.name}
                          endContent={(
                            <Chip size="sm" variant="flat" color="primary">
                              {_getTeamRole(t.TeamRoles)}
                            </Chip>
                          )}
                        >
                          {t.name}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </Row>
              </Row>

              <Spacer y={4} />
              <Segment className={"p-1 sm:p-1 md:p-1 bg-content1"}>
                <Listbox
                  aria-label="Actions"
                  onAction={(key) => setActiveMenu(key)}
                  variant="faded"
                >
                  <ListboxItem
                    key="projects"
                    startContent={<LuLayoutGrid size={24} />}
                    textValue="Projects"
                    color={activeMenu === "projects" ? "primary" : "default"}
                    className={activeMenu === "projects" ? "bg-content2 text-primary" : ""}
                  >
                    <span className="text-lg">Projects</span>
                  </ListboxItem>
                  <ListboxItem
                    key="connections"
                    startContent={<LuPlug size={24} />}
                    textValue="Connections"
                    color={activeMenu === "connections" ? "primary" : "default"}
                    className={activeMenu === "connections" ? "bg-content2 text-primary" : ""}
                  >
                    <span className="text-lg">Connections</span>
                  </ListboxItem>
                  <ListboxItem
                    key="datasets"
                    showDivider
                    startContent={<LuDatabase size={24} />}
                    textValue="Datasets"
                    color={activeMenu === "datasets" ? "primary" : "default"}
                    className={activeMenu === "datasets" ? "bg-content2 text-primary" : ""}
                  >
                    <span className="text-lg">Datasets</span>
                  </ListboxItem>
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      as={Link}
                      to={`/manage/${team.id}/settings`}
                      key="teamSettings"
                      startContent={<LuSettings size={24} />}
                      textValue="Team settings"
                      color={activeMenu === "teamSettings" ? "primary" : "default"}
                      className={activeMenu === "teamSettings" ? "bg-content2 text-primary" : "text-foreground"}
                    >
                      <span className="text-lg">Team settings</span>
                    </ListboxItem>
                  )}
                </Listbox>
              </Segment>
            </div>

            <div className="col-span-12 sm:col-span-7 md:col-span-8 lg:col-span-9">
              {activeMenu === "projects" && (
                <>
                  <Row className={"gap-2"} justify="flex-start" align="center">
                    {_canAccess("teamAdmin", team.TeamRoles) && (
                      <>
                        <Button
                          color="primary"
                          onClick={() => _onNewProject(team)}
                          endContent={<LuPlus />}
                        >
                          Create new project
                        </Button>
                      </>
                    )}
                    <Input
                      type="text"
                      placeholder="Search projects"
                      variant="bordered"
                      endContent={<LuSearch />}
                      onChange={(e) => setSearch({ ...search, [team.id]: e.target.value })}
                      className="max-w-[300px]"
                    />
                  </Row>
                  <Spacer y={4} />
                  {team.Projects && teamMembers?.length > 0 && (
                    <Table
                      aria-label="Projects list"
                      className="h-auto min-w-full border-2 border-solid border-content3 rounded-xl"
                      radius="md"
                      shadow="none"
                      isStriped
                    >
                      <TableHeader>
                        <TableColumn key="name">Project name</TableColumn>
                        <TableColumn key="members">
                          <Row align="end" justify="center" className={"gap-1"}>
                            <LuUsers2 />
                            <Text>Members</Text>
                          </Row>
                        </TableColumn>
                        <TableColumn key="connections">
                          <Row align="end" justify="center" className={"gap-1"}>
                            <LuPlug />
                            <Text>Connections</Text>
                          </Row>
                        </TableColumn>
                        <TableColumn key="charts">
                          <Row align="end" justify="center" className={"gap-1"}>
                            <LuBarChart />
                            <Text>Charts</Text>
                          </Row>
                        </TableColumn>
                        <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                      </TableHeader>
                      {_getFilteredProjects().length > 0 && (
                        <TableBody>
                          {_getFilteredProjects().map((project) => (
                            <TableRow key={project.id}>
                              <TableCell key="name">
                                <LinkNext onClick={() => directToProject(project.id)} className="cursor-pointer flex flex-col items-start">
                                  <Text b className={"text-foreground"}>{project.name}</Text>
                                </LinkNext>
                              </TableCell>
                              <TableCell key="members" className="hidden sm:block">
                                <Row justify="center" align="center">
                                  {_getProjectMembers(project)?.length > 0 && (
                                    <AvatarGroup max={3} isBordered size="sm">
                                      {_getProjectMembers(project)?.map((pr) => (
                                        <Avatar
                                          key={pr.id}
                                          name={pr.name}
                                        />
                                      ))}
                                    </AvatarGroup>
                                  )}
                                  {_getProjectMembers(project)?.length === 0 && (
                                    <Text i>-</Text>
                                  )}
                                </Row>
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
                                {_canAccess("projectAdmin", team.TeamRoles) && (
                                  <Row justify="flex-end" align="center">
                                    <Tooltip content="Rename the project">
                                      <Button
                                        startContent={<LuPencilLine />}
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
                                        startContent={<LuTrash />}
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
                          ))}
                        </TableBody>
                      )}
                      {_getFilteredProjects(team).length === 0 && (
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
                  {team.Projects && team.Projects.length === 0 && !_canAccess("projectAdmin", team.TeamRoles) && (
                    <Container>
                    <Text size="h3">
                        {"No project over here"}
                      </Text>
                    </Container>
                  )}
                </>
              )}

              {activeMenu === "connections" && (
                <div className="max-h-full overflow-y-auto">
                  <Row className={"gap-2"}>
                    <Button
                      color="primary"
                      endContent={<LuPlus />}
                    >
                      Add a connection
                    </Button>
                    <Input
                      type="text"
                      placeholder="Search connections"
                      variant="bordered"
                      endContent={<LuSearch />}
                      className="max-w-[300px]"
                    />
                  </Row>
                  <Spacer y={2} />
                  <Table shadow="none" className="border-2 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Connection name</TableColumn>
                      <TableColumn key="type">Type</TableColumn>
                      <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {connections.map((connection) => (
                        <TableRow key={connection.id}>
                          <TableCell key="name">
                            <Row align={"center"} className={"gap-2"}>
                              <Avatar
                                src={connectionImages(isDark)[connection.type]}
                                size="sm"
                                isBordered
                              />
                              <Text b>{connection.name}</Text>
                            </Row>
                          </TableCell>
                          <TableCell key="type">
                            <Text>{connection.type}</Text>
                          </TableCell>
                          <TableCell key="actions">
                            <Row justify="flex-end" align="center">
                              <Tooltip content="Edit connection">
                                <Button
                                  startContent={<LuPencilLine />}
                                  variant="light"
                                  size="sm"
                                  className={"min-w-fit"}
                                />
                              </Tooltip>
                              <Tooltip
                                content="Delete connection"
                                color="danger"
                              >
                                <Button
                                  color="danger"
                                  startContent={<LuTrash />}
                                  variant="light"
                                  size="sm"
                                  className={"min-w-fit"}
                                />
                              </Tooltip>
                            </Row>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Spacer y={2} />
                </div>
              )}

              {activeMenu === "datasets" && (
                <div className="max-h-full overflow-y-auto">
                  <Row className={"gap-2"}>
                    <Button
                      color="primary"
                      endContent={<LuPlus />}
                    >
                      Add a dataset
                    </Button>
                    <Input
                      type="text"
                      placeholder="Search datasets"
                      variant="bordered"
                      endContent={<LuSearch />}
                      className="max-w-[300px]"
                    />
                  </Row>
                  <Spacer y={2} />
                  <Table shadow="none" className="border-2 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Dataset name</TableColumn>
                      <TableColumn key="connections">Connections</TableColumn>
                      <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {datasets.map((dataset) => (
                        <TableRow key={dataset.id}>
                          <TableCell key="name">
                            <Text b>{dataset.legend}</Text>
                          </TableCell>
                          <TableCell key="connections">
                            <Row>
                              <AvatarGroup max={3} isBordered size="sm">
                                {dataset?.DataRequests?.map((dr) => (
                                  <Avatar
                                    src={connectionImages(isDark)[dr?.Connection.subType]}
                                    showFallback={<LuPlug />}
                                    size="sm"
                                    isBordered
                                    key={dr.id}
                                  />
                                ))}
                              </AvatarGroup>
                            </Row>
                          </TableCell>
                          <TableCell key="actions">
                            <Row justify="flex-end" align="center">
                              <Tooltip content="Edit dataset">
                                <Button
                                  isIconOnly
                                  variant="light"
                                  size="sm"
                                  as={Link}
                                  to={`/${team.id}/dataset/${dataset.id}`}
                                >
                                  <LuPencilLine />
                                </Button>
                              </Tooltip>
                              <Tooltip
                                content="Delete dataset"
                                color="danger"
                              >
                                <Button
                                  color="danger"
                                  isIconOnly
                                  variant="light"
                                  size="sm"
                                >
                                  <LuTrash />
                                </Button>
                              </Tooltip>
                            </Row>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

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
                endContent={<LuTrash />}
                onClick={() => _onDeleteProjectSubmit()}
                isLoading={modifyingProject}
              >
                Delete
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {(teamLoading || (teams && teams.length === 0)) && (
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
      </div>
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
  relog: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  teamLoading: PropTypes.bool.isRequired,
  getTemplates: PropTypes.func.isRequired,
  updateProject: PropTypes.func.isRequired,
  removeProject: PropTypes.func.isRequired,
  teamMembers: PropTypes.array.isRequired,
  connections: PropTypes.array.isRequired,
  getTeamConnections: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    teams: state.team.data,
    teamLoading: state.team.loading,
    teamMembers: state.team.teamMembers,
    connections: state.connection.data[state.team.active?.id] || [],
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    relog: () => dispatch(relogAction()),
    cleanErrors: () => dispatch(cleanErrorsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
    updateProject: (projectId, data) => dispatch(updateProjectAction(projectId, data)),
    removeProject: (projectId) => dispatch(removeProjectAction(projectId)),
    getTeamConnections: (teamId) => dispatch(getTeamConnectionsAction(teamId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
