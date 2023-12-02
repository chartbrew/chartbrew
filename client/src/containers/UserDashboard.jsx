import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useWindowSize } from "react-use";
import {
  Button, Input, Spacer, Table, Tooltip, Link as LinkNext, Chip, Modal,
  CircularProgress, TableHeader, TableColumn, TableCell, TableBody, TableRow,
  ModalHeader, ModalBody, ModalFooter, ModalContent, DropdownTrigger, Dropdown,
  DropdownMenu, DropdownItem, Avatar, AvatarGroup, Listbox, ListboxItem, Switch,
} from "@nextui-org/react";
import {
  LuBarChart, LuCalendarDays, LuChevronDown, LuDatabase, LuLayoutGrid, LuPencilLine, LuPlug, LuPlus, LuSearch, LuSettings,
  LuTag,
  LuTrash, LuUsers2,
} from "react-icons/lu";
import { Flip, ToastContainer } from "react-toastify";

import { relog as relogAction } from "../actions/user";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import {
  getTemplates as getTemplatesAction
} from "../actions/template";
import {
  updateProject, removeProject, selectProjects,
} from "../slices/project";
import {
  getTeamConnections, removeConnection, selectConnections,
} from "../slices/connection";
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
  deleteDataset,
  getDatasets, getRelatedCharts, selectDatasets,
} from "../slices/dataset";
import Segment from "../components/Segment";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const {
    relog, cleanErrors, user, teamLoading, getTemplates,
  } = props;

  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const teamMembers = useSelector(selectTeamMembers);
  const datasets = useSelector(selectDatasets);
  const connections = useSelector(selectConnections);
  const projects = useSelector(selectProjects);

  const [addProject, setAddProject] = useState(false);
  const [search, setSearch] = useState({});
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [modifyingProject, setModifyingProject] = useState(false);
  const [activeMenu, setActiveMenu] = useState("projects");
  
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [relatedCharts, setRelatedCharts] = useState([]);
  const [fetchingRelatedCharts, setFetchingRelatedCharts] = useState(false);
  const [deletingDataset, setDeletingDataset] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [showDatasetDrafts, setShowDatasetDrafts] = useState(false);

  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [deletingConnection, setDeletingConnection] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");

  const teamsRef = useRef(null);
  const initRef = useRef(null);
  const { height } = useWindowSize();
  const isDark = useThemeDetector();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();

    if (!initRef.current) {
      initRef.current = true;
      relog()
        .then((data) => {
          dispatch(getTeams(data.id));
        })
        .catch(() => {
          navigate("/login");
        });
    }
  }, []);

  useEffect(() => {
    if (user.data.id && !user.loading) {
      _checkParameters();
    }
  }, [user]);

  useEffect(() => {
    if (teams && teams.length > 0 && !teamsRef.current) {
      teamsRef.current = true;
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
      dispatch(getTeamConnections({ team_id: team.id }));
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
    if (!search[team.id]) return team.Projects.filter((p) => !p.ghost);
    const filteredProjects = team.Projects.filter((p) => {
      return p.name.toLowerCase().indexOf(search[team.id].toLowerCase()) > -1 && !p.ghost;
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
      dispatch(updateProject({ project_id: projectToEdit.id, data: { name: projectToEdit.name } }))
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
      dispatch(removeProject({ project_id: projectToDelete.id }))
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

  const _onPressDeleteDataset = (dataset) => {
    setFetchingRelatedCharts(true);
    setDatasetToDelete(dataset);
    setRelatedCharts([]);

    dispatch(getRelatedCharts({ team_id: team.id, dataset_id: dataset.id }))
      .then((charts) => {
        setRelatedCharts(charts.payload);
        setFetchingRelatedCharts(false);
      })
      .catch(() => {
        setFetchingRelatedCharts(false);
      });
  };

  const _onDeleteDataset = () => {
    setDeletingDataset(true);
    dispatch(deleteDataset({ team_id: team.id, dataset_id: datasetToDelete.id }))
      .then(() => {
        setDeletingDataset(false);
        setDatasetToDelete(null);
      })
      .catch(() => {
        setDeletingDataset(false);
      });
  };

  const _onCreateDataset = () => {
    navigate(`/${team.id}/dataset/new`);
  };

  const _getFilteredDatasets = () => {
    if (!datasetSearch) return datasets.filter((d) => !d.draft || showDatasetDrafts);

    const filteredDatasets = datasets.filter((d) => {
      return d.legend.toLowerCase().indexOf(datasetSearch.toLowerCase()) > -1 && (!d.draft || showDatasetDrafts);
    });

    return filteredDatasets;
  };

  const _getRelatedDatasets = (connectionId) => {
    return datasets.filter((d) => d.DataRequests.find((dr) => dr.connection_id === connectionId));
  };

  const _onDeleteConnection = () => {
    setDeletingConnection(true);
    dispatch(removeConnection({ team_id: team.id, connection_id: connectionToDelete.id }))
      .then(() => {
        setDeletingConnection(false);
        setConnectionToDelete(null);
      })
      .catch(() => {
        setDeletingConnection(false);
      });
  };

  const _getConnectionTags = (projectIds) => {
    const tags = [];
    if (!projects || !projectIds) return tags;
    projectIds.forEach((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        tags.push(project.name);
      }
    });

    return tags;
  };

  const _getFilteredConnections = () => {
    if (!connectionSearch) return connections;

    const filteredConnections = connections.filter((c) => {
      return c.name.toLowerCase().indexOf(connectionSearch.toLowerCase()) > -1;
    });

    return filteredConnections || [];
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
                      labelPlacement="outside"
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
                            <TableCell key="members" align="center" />
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
                  <Row className={"gap-4"}>
                    <Button
                      color="primary"
                      endContent={<LuPlus />}
                      onClick={() => navigate(`/${team.id}/connection/new`)}
                    >
                      Create new connection
                    </Button>
                    <Input
                      type="text"
                      placeholder="Search connections"
                      variant="bordered"
                      endContent={<LuSearch />}
                      className="max-w-[300px]"
                      labelPlacement="outside"
                      onChange={(e) => setConnectionSearch(e.target.value)}
                    />
                  </Row>
                  <Spacer y={4} />
                  <Table shadow="none" isStriped className="border-2 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Connection name</TableColumn>
                      <TableColumn key="tags">
                        <div className="flex flex-row items-center gap-1">
                          <LuTag />
                          <span>Tags</span>
                        </div>
                      </TableColumn>
                      <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {_getFilteredConnections()?.map((connection) => (
                        <TableRow key={connection.id}>
                          <TableCell key="name">
                            <Row align={"center"} className={"gap-4"}>
                              <Avatar
                                src={connectionImages(isDark)[connection.type]}
                                size="sm"
                                isBordered
                              />
                              <Link to={`/${team.id}/connection/${connection.id}`} className="cursor-pointer">
                                <Text b>{connection.name}</Text>
                              </Link>
                            </Row>
                          </TableCell>
                          <TableCell key="tags">
                            {_getConnectionTags(connection.project_ids).slice(0, 3).map((tag) => (
                              <Chip
                                key={tag}
                                size="sm"
                                variant="flat"
                                color="primary"
                              >
                                {tag}
                              </Chip>
                            ))}
                            {_getConnectionTags(connection.project_ids).length > 3 && (
                              <span className="text-xs">{`+${_getConnectionTags(connection.project_ids).length - 3} more`}</span>
                            )}
                          </TableCell>
                          <TableCell key="actions">
                            <Row justify="flex-end" align="center">
                              <Tooltip content="Edit connection">
                                <Button
                                  startContent={<LuPencilLine />}
                                  variant="light"
                                  size="sm"
                                  className={"min-w-fit"}
                                  onClick={() => navigate(`/${team.id}/connection/${connection.id}`)}
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
                                  onClick={() => setConnectionToDelete(connection)}
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
                  <Row className={"gap-4"} align="center">
                    <Button
                      color="primary"
                      endContent={<LuPlus />}
                      onClick={() => _onCreateDataset()}
                    >
                      Create new dataset
                    </Button>
                    <Input
                      type="text"
                      placeholder="Search datasets"
                      variant="bordered"
                      endContent={<LuSearch />}
                      className="max-w-[300px]"
                      labelPlacement="outside"
                      onChange={(e) => setDatasetSearch(e.target.value)}
                    />
                    <Switch
                      isSelected={showDatasetDrafts}
                      onChange={() => setShowDatasetDrafts(!showDatasetDrafts)}
                      size="sm"
                    >
                      <span className="text-sm">Show drafts</span>
                    </Switch>
                  </Row>
                  <Spacer y={4} />
                  <Table shadow="none" isStriped className="border-2 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Dataset name</TableColumn>
                      <TableColumn key="connections" textValue="Connections" align="center" justify="center">
                        <div className="flex flex-row items-center justify-center gap-1">
                          <LuPlug />
                          <span>Connections</span>
                        </div>
                      </TableColumn>
                      <TableColumn key="created" textValue="Created">
                        <div className="flex flex-row items-center gap-1">
                          <LuCalendarDays />
                          <span>Created</span>
                        </div>
                      </TableColumn>
                      <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {_getFilteredDatasets().map((dataset) => (
                        <TableRow key={dataset.id}>
                          <TableCell key="name">
                            <div className="flex flex-row items-center gap-2">
                              <Link to={`/${team.id}/dataset/${dataset.id}`} className="cursor-pointer">
                                <Text b>{dataset.legend}</Text>
                              </Link>
                              {dataset.draft && (
                                <Chip size="sm" variant="flat" color="secondary">
                                  Draft
                                </Chip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell key="connections">
                            <Row justify={"center"}>
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
                          <TableCell key="created">
                            <Text>{new Date(dataset.createdAt).toLocaleDateString()}</Text>
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
                                  onClick={() => _onPressDeleteDataset(dataset)}
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

        <Modal isOpen={datasetToDelete?.id} onClose={() => setDatasetToDelete(null)}>
          <ModalContent>
            <ModalHeader>
              <Text size="h4">Are you sure you want to delete this dataset?</Text>
            </ModalHeader>
            <ModalBody>
              <div>
                <Text>
                  {"Just a heads-up that all the charts that use this dataset will stop working. This action cannot be undone."}
                </Text>
              </div>
              {fetchingRelatedCharts && (
                <div className="flex flex-row items-center gap-1">
                  <CircularProgress size="sm" />
                  <Text className={"italic"}>Checking related charts...</Text>
                </div>
              )}
              {!fetchingRelatedCharts && relatedCharts.length === 0 && (
                <div className="flex flex-row items-center">
                  <Text className={"italic"}>No related charts found</Text>
                </div>
              )}
              {!fetchingRelatedCharts && relatedCharts.length > 0 && (
                <div className="flex flex-row items-center">
                  <Text>Related charts:</Text>
                </div>
              )}
              <div className="flex flex-row flex-wrap items-center gap-1">
                {relatedCharts.slice(0, 10).map((chart) => (
                  <Chip
                    key={chart.id}
                    size="sm"
                    variant="flat"
                    color="primary"
                  >
                    {chart.name}
                  </Chip>
                ))}
                {relatedCharts.length > 10 && (
                  <span className="text-xs">{`+${relatedCharts.length - 10} more`}</span>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setDatasetToDelete(null)}
                auto
              >
                Cancel
              </Button>
              <Button
                auto
                color="danger"
                endContent={<LuTrash />}
                onClick={() => _onDeleteDataset()}
                isLoading={deletingDataset}
              >
                Delete
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={connectionToDelete?.id} onClose={() => setConnectionToDelete(null)}>
          <ModalContent>
            <ModalHeader>
              <Text size="h4">Are you sure you want to delete this connection?</Text>
            </ModalHeader>
            <ModalBody>
              <div>
                <Text>
                  {"Just a heads-up that all the datasets and charts that use this connection will stop working. This action cannot be undone."}
                </Text>
              </div>
              {_getRelatedDatasets(connectionToDelete?.id).length === 0 && (
                <div className="flex flex-row items-center">
                  <Text className={"italic"}>No related datasets found</Text>
                </div>
              )}
              {_getRelatedDatasets(connectionToDelete?.id).length > 0 && (
                <div className="flex flex-row items-center">
                  <Text>Related datasets:</Text>
                </div>
              )}
              <div className="flex flex-row flex-wrap items-center gap-1">
                {_getRelatedDatasets(connectionToDelete?.id).slice(0, 10).map((dataset) => (
                  <Chip
                    key={dataset.id}
                    size="sm"
                    variant="flat"
                    color="primary"
                  >
                    {dataset.legend}
                  </Chip>
                ))}
                {_getRelatedDatasets(connectionToDelete?.id).length > 10 && (
                  <span className="text-xs">{`+${_getRelatedDatasets(connectionToDelete?.id).length - 10} more`}</span>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setConnectionToDelete(null)}
                auto
              >
                Cancel
              </Button>
              <Button
                auto
                color="danger"
                endContent={<LuTrash />}
                onClick={() => _onDeleteConnection()}
                isLoading={deletingConnection}
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

      <ToastContainer
        position="bottom-center"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={isDark ? "dark" : "light"}
      />
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
  teamMembers: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    teamLoading: state.team.loading,
    teamMembers: state.team.teamMembers,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    relog: () => dispatch(relogAction()),
    cleanErrors: () => dispatch(cleanErrorsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
