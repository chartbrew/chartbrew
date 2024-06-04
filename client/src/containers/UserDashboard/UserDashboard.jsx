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
  Checkbox, Card, CardHeader, Divider, CardBody,
} from "@nextui-org/react";
import {
  LuBarChart, LuCalendarDays, LuChevronDown, LuDatabase, LuInfo, LuLayoutGrid, LuMoreHorizontal, LuPencilLine,
  LuPlug, LuPlus, LuSearch, LuSettings, LuTable, LuTags, LuTrash, LuUsers2,
} from "react-icons/lu";
import { Flip, ToastContainer } from "react-toastify";

import { relog } from "../../slices/user";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getTemplates } from "../../slices/template";
import {
  updateProject, removeProject, selectProjects, getProjects,
} from "../../slices/project";
import {
  clearConnections,
  getTeamConnections, removeConnection, saveConnection, selectConnections,
} from "../../slices/connection";
import ProjectForm from "../../components/ProjectForm";
import Navbar from "../../components/Navbar";
import canAccess from "../../config/canAccess";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import connectionImages from "../../config/connectionImages";
import useThemeDetector from "../../modules/useThemeDetector";
import {
  selectTeam, selectTeams, getTeams, saveActiveTeam, getTeamMembers, selectTeamMembers,
} from "../../slices/team";
import {
  clearDatasets,
  deleteDataset,
  getDatasets, getRelatedCharts, selectDatasets, updateDataset,
} from "../../slices/dataset";
import Segment from "../../components/Segment";
import NoticeBoard from "./components/NoticeBoard";

/*
  The user dashboard with all the teams and projects
*/
function UserDashboard(props) {
  const { cleanErrors } = props;

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
  const [datasetToEdit, setDatasetToEdit] = useState(null);
  const [modifyingDataset, setModifyingDataset] = useState(false);

  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [deletingConnection, setDeletingConnection] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [deleteRelatedDatasets, setDeleteRelatedDatasets] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState(null);
  const [modifyingConnection, setModifyingConnection] = useState(false);
  
  const [viewMode, setViewMode] = useState("grid");

  const user = useSelector((state) => state.user);

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
      dispatch(relog())
        .then((data) => {
          if (data?.payload?.id) {
            return dispatch(getTeams(data.payload.id));
          } else {
            throw new Error("No user");
          }
        })
        .catch(() => {
          navigate("/login");
        });
    }

    const storageViewMode = window.localStorage.getItem("__cb_view_mode");
    if (storageViewMode) setViewMode(storageViewMode);
  }, []);

  useEffect(() => {
    if (user.data.id && !user.loading) {
      _checkParameters();
    }
  }, [user]);

  useEffect(() => {
    if (teams && teams.length > 0 && !teamsRef.current) {
      teamsRef.current = true;
      let selectedTeam = teams.find((t) => t.TeamRoles.find((tr) => tr.role === "teamOwner" && tr.user_id === user.data.id));
      
      const storageActiveTeam = window.localStorage.getItem("__cb_active_team");
      if (storageActiveTeam) {
        const storageTeam = teams.find((t) => `${t.id}` === `${storageActiveTeam}`);
        if (storageTeam) selectedTeam = storageTeam;
      }
      
      if (!selectedTeam) return;
      dispatch(saveActiveTeam(selectedTeam));
      dispatch(getTeamMembers({ team_id: selectedTeam.id }));
      dispatch(getDatasets({ team_id: selectedTeam.id }));

      const welcome = new URLSearchParams(window.location.search).get("welcome");
      if (welcome) {
        navigate(`/${selectedTeam?.id}/connection/new`);
      }
    }
  }, [teams]);

  useEffect(() => {
    if (team?.id) {
      dispatch(getTeamMembers({ team_id: team.id }));
      dispatch(getTeamConnections({ team_id: team.id }));
      dispatch(getProjects({ team_id: team.id }));
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
    dispatch(getTemplates(team.id));
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
    // window.location.href = `/${team.id}/${projectId}/dashboard`;
    navigate(`/${team.id}/${projectId}/dashboard`);
  };

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.data.id, teamRoles);
  };

  const _getTeamRole = (teamRoles) => {
    return teamRoles.filter((o) => o.user_id === user.data.id)[0].role;
  };

  const _getFilteredProjects = () => {
    if (!search[team.id]) return projects.filter((p) => !p.ghost && p.team_id === team.id);
    const filteredProjects = projects.filter((p) => {
      return p.name.toLowerCase().indexOf(search[team.id].toLowerCase()) > -1 && !p.ghost && p.team_id === team.id;
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
      return tm.TeamRoles.find((tr) => tr?.projects?.length > 0 && tr.projects.includes(project.id) && tr.role !== "teamOwner" && tr.role !== "teamAdmin");
    });

    return projectMembers;
  };

  const _onChangeTeam = (teamId) => {
    const team = teams.find((t) => `${t.id}` === `${teamId}`);
    if (!team) return;

    setActiveMenu("projects");
    dispatch(saveActiveTeam(team));
    dispatch(clearConnections());
    dispatch(clearDatasets());
    dispatch(getTeamMembers({ team_id: team.id }));
    dispatch(getDatasets({ team_id: team.id }));

    window.localStorage.setItem("__cb_active_team", team.id);
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
    return datasets.filter((d) => d.DataRequests?.find((dr) => dr.connection_id === connectionId));
  };

  const _onDeleteConnection = () => {
    setDeletingConnection(true);
    dispatch(removeConnection({
      team_id: team.id,
      connection_id: connectionToDelete.id,
      removeDatasets: deleteRelatedDatasets
    }))
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

  const _getDatasetTags = (projectIds) => {
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
    if (!connectionSearch) return connections || [];

    const filteredConnections = connections.filter((c) => {
      return c.name.toLowerCase().indexOf(connectionSearch.toLowerCase()) > -1;
    });

    return filteredConnections || [];
  };

  const _onEditConnectionTags = async () => {
    setModifyingConnection(true);

    const projectIds = connectionToEdit.project_ids || [];

    await dispatch(saveConnection({
      team_id: team.id,
      connection: { id: connectionToEdit.id, project_ids: projectIds },
    }));

    setModifyingConnection(false);
    setConnectionToEdit(null);
  };

  const _onEditDatasetTags = async () => {
    setModifyingDataset(true);

    const projectIds = datasetToEdit.project_ids || [];

    await dispatch(updateDataset({
      team_id: team.id,
      dataset_id: datasetToEdit.id,
      data: { project_ids: projectIds },
    }));

    setModifyingDataset(false);
    setDatasetToEdit(null);
  };

  const _changeViewMode = (mode) => {
    setViewMode(mode);
    window.localStorage.setItem("__cb_view_mode", mode);
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
    <div className="dashboard bg-content2" style={styles.container(height)}>
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
              <Segment className={"p-1 sm:p-1 md:p-1 bg-content1 rounded-xl"}>
                <Listbox
                  aria-label="Actions"
                  onAction={(key) => setActiveMenu(key)}
                  variant="faded"
                >
                  <ListboxItem
                    key="projects"
                    startContent={<LuLayoutGrid size={24} />}
                    textValue="Dashboards"
                    color={activeMenu === "projects" ? "primary" : "default"}
                    className={activeMenu === "projects" ? "bg-content2 text-primary" : ""}
                  >
                    <span className="text-lg">Dashboards</span>
                  </ListboxItem>
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      key="connections"
                      startContent={<LuPlug size={24} />}
                      textValue="Connections"
                      color={activeMenu === "connections" ? "primary" : "default"}
                      className={activeMenu === "connections" ? "bg-content2 text-primary connection-tutorial" : "connection-tutorial"}
                    >
                      <span className="text-lg">Connections</span>
                    </ListboxItem>
                  )}
                  {_canAccess("projectEditor", team.TeamRoles) && (
                    <ListboxItem
                      key="datasets"
                      showDivider={_canAccess("teamAdmin", team.TeamRoles)}
                      startContent={<LuDatabase size={24} />}
                      textValue="Datasets"
                      color={activeMenu === "datasets" ? "primary" : "default"}
                      className={activeMenu === "datasets" ? "bg-content2 text-primary dataset-tutorial" : "dataset-tutorial"}
                    >
                      <span className="text-lg">Datasets</span>
                    </ListboxItem>
                  )}
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <ListboxItem
                      as={Link}
                      to={`/manage/${team.id}/settings`}
                      key="teamSettings"
                      startContent={<LuSettings size={24} />}
                      textValue="Team settings"
                      color={activeMenu === "teamSettings" ? "primary" : "default"}
                      className={activeMenu === "teamSettings" ? "bg-content2 text-primary team-settings-tutorial" : "text-foreground team-settings-tutorial"}
                    >
                      <span className="text-lg">Team settings</span>
                    </ListboxItem>
                  )}
                </Listbox>
              </Segment>

              <NoticeBoard />
            </div>

            <div className="col-span-12 sm:col-span-7 md:col-span-8 lg:col-span-9">
              {activeMenu === "projects" && (
                <>
                  <Row justify="space-between" align="center">
                    <Row className={"gap-2"} justify="flex-start" align="center">
                      {_canAccess("teamAdmin", team.TeamRoles) && (
                        <div>
                          <Button
                            color="primary"
                            onClick={() => _onNewProject(team)}
                            endContent={<LuPlus />}
                            className="create-dashboard-tutorial"
                          >
                            <span className="hidden md:block">Create dashboard</span>
                            <span className="md:hidden">Create</span>
                          </Button>
                        </div>
                      )}
                      <Input
                        type="text"
                        placeholder="Search dashboards"
                        variant="bordered"
                        endContent={<LuSearch />}
                        onChange={(e) => setSearch({ ...search, [team.id]: e.target.value })}
                        className="max-w-[300px]"
                        labelPlacement="outside"
                      />
                    </Row>
                    <div className="flex flex-row">
                      <Button
                        variant="light"
                        isIconOnly
                        color={viewMode === "grid" ? "primary" : "default"}
                        onClick={() => _changeViewMode("grid")}
                      >
                        <LuLayoutGrid />
                      </Button>
                      <Button
                        variant="light"
                        isIconOnly
                        color={viewMode === "table" ? "primary" : "default"}
                        onClick={() => _changeViewMode("table")}
                      >
                        <LuTable />
                      </Button>
                    </div>
                  </Row>
                  <Spacer y={4} />
                  {projects && viewMode === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {_getFilteredProjects().map((project) => (
                        <Card
                          key={project.id}
                          isPressable
                          shadow="none"
                          className="border-1 border-solid border-content3"
                          radius="sm"
                          onClick={() => directToProject(project.id)}
                        >
                          <CardHeader className="flex flex-row justify-between items-center">
                            <span className="text-sm font-medium">{project.name}</span>
                            {_canAccess("teamAdmin", team.TeamRoles) && (
                              <Dropdown size="sm">
                                <DropdownTrigger>
                                  <LinkNext className="text-foreground-400">
                                    <LuMoreHorizontal />
                                  </LinkNext>
                                </DropdownTrigger>
                                <DropdownMenu>
                                  <DropdownItem
                                    onClick={() => _onEditProject(project)}
                                    startContent={<LuPencilLine />}
                                    showDivider
                                  >
                                    Rename
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() => _onDeleteProject(project)}
                                    startContent={<LuTrash />}
                                    color="danger"
                                  >
                                    Delete
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            )}
                          </CardHeader>
                          <Divider />
                          <CardBody>
                            <Row justify="space-between" align="center">
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
                                <Chip variant="flat" size="sm">
                                  Team only
                                </Chip>
                              )}
                              <div className="flex flex-row items-center gap-1 text-sm">
                                <LuBarChart />
                                <span>{project?.Charts?.length || 0}</span>
                              </div>
                            </Row>
                          </CardBody>
                        </Card>
                      ))}

                      {_getFilteredProjects().length === 0 && (
                        <div>
                          <span className="text-foreground-400 italic">
                            {"No dashboards here"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {projects && viewMode === "table" && (
                    <Table
                      aria-label="Dashboard list"
                      className="h-auto min-w-full border-1 border-solid border-content3 rounded-xl"
                      radius="md"
                      shadow="none"
                      isStriped
                    >
                      <TableHeader>
                        <TableColumn key="name">Dashboard name</TableColumn>
                        <TableColumn key="members">
                          <Row align="end" justify="center" className={"gap-1"}>
                            <LuUsers2 />
                            <Text>Dashboard members</Text>
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
                      <TableBody>
                        {_getFilteredProjects().map((project) => (
                          <TableRow key={project.id}>
                            <TableCell key="name">
                              <LinkNext onClick={() => directToProject(project.id)} className="cursor-pointer flex flex-col items-start">
                                <span className={"text-foreground font-medium"}>{project.name}</span>
                              </LinkNext>
                            </TableCell>
                            <TableCell key="members">
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
                                  <Chip variant="flat" size="sm">
                                    Team only
                                  </Chip>
                                )}
                              </Row>
                            </TableCell>
                            <TableCell key="charts">
                              <Row justify="center" align="center">
                                <Text b>
                                  {project?.Charts?.length || 0}
                                </Text>
                              </Row>
                            </TableCell>
                            <TableCell key="actions">
                              {_canAccess("teamAdmin", team.TeamRoles) && (
                                <Row justify="flex-end" align="center">
                                  <Tooltip content="Rename the dashboard">
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
                      {_getFilteredProjects().length === 0 && (
                        <TableBody>
                          <TableRow>
                            <TableCell key="name" className="p-0 pt-2">
                              <span className="italic text-default-500">No dashboards here</span>
                            </TableCell>
                            <TableCell key="members" align="center" />
                            <TableCell key="charts" align="center" />
                            <TableCell key="actions" align="center" />
                          </TableRow>
                        </TableBody>
                      )}
                    </Table>
                  )}
                  {projects && projects.length === 0 && !_canAccess("projectEditor", team.TeamRoles) && (
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
                    {_canAccess("teamAdmin", team.TeamRoles) && (
                      <Button
                        color="primary"
                        endContent={<LuPlus />}
                        onClick={() => navigate(`/${team.id}/connection/new`)}
                      >
                        Create connection
                      </Button>
                    )}
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
                  <Table shadow="none" isStriped className="border-1 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Connection</TableColumn>
                      <TableColumn key="tags" className="tutorial-tags">
                        <div className="flex flex-row items-center gap-1">
                          <LuTags />
                          <span>Tags</span>
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
                      {_getFilteredConnections()?.map((connection) => (
                        <TableRow key={connection.id}>
                          <TableCell key="name">
                            <Row align={"center"} className={"gap-4"}>
                              <Avatar
                                src={connectionImages(isDark)[connection.subType]}
                                size="sm"
                                isBordered
                              />
                              <Link to={`/${team.id}/connection/${connection.id}`} className="cursor-pointer">
                                <span className="text-foreground font-medium">{connection.name}</span>
                              </Link>
                            </Row>
                          </TableCell>
                          <TableCell key="tags">
                            {_getConnectionTags(connection.project_ids).length > 0 && (
                              <div
                                className="flex flex-row flex-wrap items-center gap-1 cursor-pointer hover:saturate-200 transition-all"
                                onClick={() => setConnectionToEdit(connection)}
                              >
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
                              </div>
                            )}
                            {_getConnectionTags(connection.project_ids).length === 0 && (
                              <Button
                                variant="light"
                                startContent={<LuPlus size={18} />}
                                size="sm"
                                className="opacity-0 hover:opacity-100"
                                onClick={() => setConnectionToEdit(connection)}
                              >
                                Add tag
                              </Button>
                            )}
                          </TableCell>
                          <TableCell key="created">
                            <Text>{new Date(connection.createdAt).toLocaleDateString()}</Text>
                          </TableCell>
                          <TableCell key="actions">
                            {_canAccess("teamAdmin", team.TeamRoles) && (
                              <Row justify="flex-end" align="center">
                                <Dropdown>
                                  <DropdownTrigger>
                                    <Button
                                      isIconOnly
                                      variant="light"
                                      size="sm"
                                    >
                                      <LuMoreHorizontal />
                                    </Button>
                                  </DropdownTrigger>
                                  <DropdownMenu variant="flat">
                                    <DropdownItem
                                      onClick={() => navigate(`/${team.id}/connection/${connection.id}`)}
                                      startContent={<LuPencilLine />}
                                    >
                                      Edit connection
                                    </DropdownItem>
                                    <DropdownItem
                                      onClick={() => setConnectionToEdit(connection)}
                                      startContent={<LuTags />}
                                      showDivider
                                    >
                                      Edit tags
                                    </DropdownItem>
                                    <DropdownItem
                                      onClick={() => setConnectionToDelete(connection)}
                                      startContent={<LuTrash />}
                                      color="danger"
                                    >
                                      Delete
                                    </DropdownItem>
                                  </DropdownMenu>
                                </Dropdown>
                              </Row>
                            )}
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
                    {connections.length > 0 && (
                      <Button
                        color="primary"
                        endContent={<LuPlus />}
                        onClick={() => _onCreateDataset()}
                      >
                        Create dataset
                      </Button>
                    )}
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
                  <Table shadow="none" isStriped className="border-1 border-solid border-content3 rounded-xl">
                    <TableHeader>
                      <TableColumn key="name">Dataset name</TableColumn>
                      <TableColumn key="connections" textValue="Connections" align="center" justify="center">
                        <div className="flex flex-row items-center justify-center gap-1">
                          <LuPlug />
                          <span>Connections</span>
                        </div>
                      </TableColumn>
                      <TableColumn key="tags" textValue="Tags">
                        <div className="flex flex-row items-center gap-1">
                          <LuTags />
                          <span>Tags</span>
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
                                <span className="text-foreground font-medium">{dataset.legend}</span>
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
                                    src={connectionImages(isDark)[dr?.Connection?.subType]}
                                    showFallback={<LuPlug />}
                                    size="sm"
                                    isBordered
                                    key={dr.id}
                                  />
                                ))}
                              </AvatarGroup>
                            </Row>
                          </TableCell>
                          <TableCell key="tags">
                            {_getDatasetTags(dataset.project_ids).length > 0 && (
                              <div
                                className="flex flex-row flex-wrap items-center gap-1 cursor-pointer hover:saturate-200 transition-all"
                                onClick={() => {
                                  if (_canAccess("teamAdmin", team.TeamRoles)) {
                                    setDatasetToEdit(dataset);
                                  }
                                }}
                              >
                                {_getDatasetTags(dataset.project_ids).slice(0, 3).map((tag) => (
                                  <Chip
                                    key={tag}
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                  >
                                    {tag}
                                  </Chip>
                                ))}
                                {_getDatasetTags(dataset.project_ids).length > 3 && (
                                  <span className="text-xs">{`+${_getDatasetTags(dataset.project_ids).length - 3} more`}</span>
                                )}
                              </div>
                            )}
                            {_getDatasetTags(dataset.project_ids).length === 0 && (
                              <Button
                                variant="light"
                                startContent={<LuPlus size={18} />}
                                size="sm"
                                className="opacity-0 hover:opacity-100"
                                onClick={() => {
                                  if (_canAccess("teamAdmin", team.TeamRoles)) {
                                    setDatasetToEdit(dataset);
                                  }
                                }}
                              >
                                Add tag
                              </Button>
                            )}
                          </TableCell>
                          <TableCell key="actions">
                            <Row justify="flex-end" align="center">
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                  >
                                    <LuMoreHorizontal />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                  variant="flat"
                                  disabledKeys={!_canAccess("teamAdmin", team.TeamRoles) ? ["tags", "delete"] : []}
                                >
                                  <DropdownItem
                                    onClick={() => navigate(`/${team.id}/dataset/${dataset.id}`)}
                                    startContent={<LuPencilLine />}
                                    key="dataset"
                                  >
                                    Edit dataset
                                  </DropdownItem>
                                  <DropdownItem
                                    key="tags"
                                    onClick={() => setDatasetToEdit(dataset)}
                                    startContent={<LuTags />}
                                    showDivider
                                  >
                                    Edit tags
                                  </DropdownItem>
                                  <DropdownItem
                                    key="delete"
                                    onClick={() => _onPressDeleteDataset(dataset)}
                                    startContent={<LuTrash />}
                                    color="danger"
                                  >
                                    Delete
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
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
              <Text size="h3">Rename your dashboard</Text>
            </ModalHeader>
            <ModalBody>
              <Input
                label="Dashboard name"
                placeholder="Enter the dashboard name"
                value={projectToEdit?.name || ""}
                onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
                variant="bordered"
                fullWidth
              />
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setProjectToEdit(null)}
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
              <Text size="h4">Are you sure you want to delete the dashboard?</Text>
            </ModalHeader>
            <ModalBody>
              <Text>
                {"Deleting a dashboard will delete all the charts and make the report unavailable. This action cannot be undone."}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setProjectToDelete(null)}
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
            <ModalFooter className="justify-between">
              <Checkbox
                onChange={() => setDeleteRelatedDatasets(!deleteRelatedDatasets)}
                isSelected={deleteRelatedDatasets}
                size="sm"
              >
                Delete related datasets
              </Checkbox>
              <div className="flex flex-row items-center gap-1">
                <Button
                  variant="bordered"
                  onClick={() => setConnectionToDelete(null)}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  endContent={<LuTrash />}
                  onClick={() => _onDeleteConnection()}
                  isLoading={deletingConnection}
                >
                  Delete
                </Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={!!connectionToEdit} onClose={() => setConnectionToEdit(null)} size="xl">
          <ModalContent>
            <ModalHeader>
              <Text size="h3">Edit tags</Text>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-row flex-wrap items-center gap-2">
                {projects.filter((p) => !p.ghost).map((project) => (
                  <Chip
                    key={project.id}
                    radius="sm"
                    variant={connectionToEdit?.project_ids?.includes(project.id) ? "solid" : "flat"}
                    color="primary"
                    className="cursor-pointer"
                    onClick={() => {
                      if (connectionToEdit?.project_ids?.includes(project.id)) {
                        setConnectionToEdit({ ...connectionToEdit, project_ids: connectionToEdit?.project_ids?.filter((p) => p !== project.id) });
                      }
                      else {
                        setConnectionToEdit({ ...connectionToEdit, project_ids: [...connectionToEdit?.project_ids || [], project.id] });
                      }
                    }}
                  >
                    {project.name}
                  </Chip>
                ))}
              </div>
              <Spacer y={1} />
              <div className="flex gap-1 bg-content2 p-2 mb-2 rounded-lg text-foreground-500 text-sm">
                <div>
                  <LuInfo />
                </div>
                {"Use tags to grant dashboard members access to these connections. Tagged connections can be used by members to create their own datasets within the associated dashboards."}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setConnectionToEdit(null)}
              >
                Close
              </Button>
              <Button
                color="primary"
                onClick={() => _onEditConnectionTags()}
                isLoading={modifyingConnection}
              >
                Save
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={!!datasetToEdit} onClose={() => setDatasetToEdit(null)} size="xl">
          <ModalContent>
            <ModalHeader>
              <Text size="h3">Edit tags</Text>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-row flex-wrap items-center gap-2">
                {projects.filter((p) => !p.ghost).map((project) => (
                  <Chip
                    key={project.id}
                    radius="sm"
                    variant={datasetToEdit?.project_ids?.includes(project.id) ? "solid" : "flat"}
                    color="primary"
                    className="cursor-pointer"
                    onClick={() => {
                      if (datasetToEdit?.project_ids?.includes(project.id)) {
                        setDatasetToEdit({ ...datasetToEdit, project_ids: datasetToEdit?.project_ids?.filter((p) => p !== project.id) });
                      } else {
                        setDatasetToEdit({ ...datasetToEdit, project_ids: [...datasetToEdit?.project_ids || [], project.id] });
                      }
                    }}
                  >
                    {project.name}
                  </Chip>
                ))}
              </div>
              <Spacer y={1} />
              <div className="flex gap-1 bg-content2 p-2 mb-2 rounded-lg text-foreground-500 text-sm">
                <div>
                  <LuInfo />
                </div>
                {"Assign tags to datasets to control which dashboards can use them. Members can create charts from these datasets within dashboards associated with the selected tags."}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onClick={() => setDatasetToEdit(null)}
              >
                Close
              </Button>
              <Button
                color="primary"
                onClick={() => _onEditDatasetTags()}
                isLoading={modifyingDataset}
              >
                Save
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {(teams && teams.length === 0) && (
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
};

UserDashboard.propTypes = {
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(UserDashboard);
