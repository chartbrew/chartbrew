import {
  Button, Card, CardHeader, Dropdown, DropdownTrigger, Input, Spacer,
  DropdownMenu, DropdownItem, CardBody, AvatarGroup,
  Avatar, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tooltip,
  Tabs,
  Tab
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import { LuChartNoAxesColumnIncreasing, LuEllipsis, LuLayoutGrid, LuPencilLine, LuPin, LuPinOff, LuPlus, LuSearch, LuTable, LuTrash, LuUsers } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { getTeams, saveActiveTeam, selectTeam, selectTeamMembers } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { pinDashboard, selectUser, unpinDashboard } from "../../slices/user";
import { getTemplates } from "../../slices/template";
import { removeProject, selectProjects, updateProject } from "../../slices/project";
import ProjectForm from "../../components/ProjectForm";
import { Link } from "react-router";

function DashboardList() {
  const [addProject, setAddProject] = useState(false);
  const [search, setSearch] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [modifyingProject, setModifyingProject] = useState(false);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const projects = useSelector(selectProjects);
  const teamMembers = useSelector(selectTeamMembers);
  const pinnedDashboards = user?.PinnedDashboards || [];

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const storageViewMode = window.localStorage.getItem("__cb_view_mode");
    if (storageViewMode) setViewMode(storageViewMode);
  }, []);

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.id, teamRoles);
  };

  const _onNewProject = (team) => {
    setAddProject(true);
    dispatch(saveActiveTeam(team));
    dispatch(getTemplates(team.id));
  };

  const _changeViewMode = (mode) => {
    setViewMode(mode);
    window.localStorage.setItem("__cb_view_mode", mode);
  };

  const _getFilteredProjects = () => {
    let filteredProjects = [];
    if (!search[team.id]) {
      filteredProjects = projects.filter((p) => !p.ghost && p.team_id === team.id);
    } else {
      filteredProjects = projects.filter((p) => {
        return p.name.toLowerCase().indexOf(search[team.id].toLowerCase()) > -1 && !p.ghost && p.team_id === team.id;
      });
    }

    // now add the team members to each project
    const formattedProjects = filteredProjects.map((p) => {
      const projectMembers = _getProjectMembers(p, teamMembers);
      return {
        ...p,
        members: projectMembers,
      };
    });

    // Sort pinned dashboards to the top
    const sortedProjects = formattedProjects.sort((a, b) => {
      const aPinned = pinnedDashboards.find((p) => p.project_id === a.id);
      const bPinned = pinnedDashboards.find((p) => p.project_id === b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    return sortedProjects;
  };

  const _getProjectMembers = (project) => {
    if (!teamMembers) return [];
    const projectMembers = teamMembers.filter((tm) => {
      return tm.TeamRoles.find((tr) => tr?.projects?.length > 0 && tr.projects.includes(project.id) && tr.role !== "teamOwner" && tr.role !== "teamAdmin");
    });

    return projectMembers;
  };

  const directToProject = (projectId) => {
    navigate(`/dashboard/${projectId}`);
  };

  const _onEditProject = (project) => {
    setProjectToEdit(project);
  };

  const _onEditProjectSubmit = () => {
    if (projectToEdit && projectToEdit.id) {
      setModifyingProject(true);
      dispatch(updateProject({ project_id: projectToEdit.id, data: { name: projectToEdit.name } }))
        .then(() => {
          return dispatch(getTeams())
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
          return dispatch(getTeams())
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

  const _onProjectCreated = (project, isNew = true) => {
    dispatch(getTeams());
    setAddProject(false);

    let url = `/${project.team_id}/${project.id}/dashboard`;
    if (isNew) url += "?new=true";
    window.location.href = url;
  };

  const _onPinDashboard = (projectId) => {
    if (pinnedDashboards.find((p) => p.project_id === projectId)) {
      dispatch(unpinDashboard({ pin_id: pinnedDashboards.find((p) => p.project_id === projectId).id }));
    } else {
      dispatch(pinDashboard({ project_id: projectId, user_id: user.id }));
    }
  };

  return (
    <div className="flex flex-col">
      <ProjectForm
        onComplete={_onProjectCreated}
        open={addProject}
        onClose={() => setAddProject(false)}
      />
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center">
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-semibold font-tw">
              Dashboards
            </div>
            <div className="text-sm text-foreground-500">
              {"Create and manage your dashboards"}
            </div>
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          {_canAccess("teamAdmin", team.TeamRoles) && (
            <div>
              <Button
                color="primary"
                onPress={() => _onNewProject(team)}
                endContent={<LuPlus />}
                className="create-dashboard-tutorial"
              >
                <span className="hidden md:block">Create dashboard</span>
                <span className="md:hidden">Create</span>
              </Button>
            </div>
          )}
        </div>
      </div>
      <Spacer y={2} />
      <div className="flex flex-row items-center gap-2">
        <Input
          type="text"
          placeholder="Search dashboards"
          variant="bordered"
          endContent={<LuSearch />}
          onChange={(e) => setSearch({ ...search, [team.id]: e.target.value })}
          className="max-w-md"
          labelPlacement="outside"
        />
        <Tabs selectedKey={viewMode} onSelectionChange={(key) => _changeViewMode(key)}>
          <Tab key="grid" title={<LuLayoutGrid />} />
          <Tab key="table" title={<LuTable />} />
        </Tabs>
      </div>
      <Spacer y={4} />
      {projects && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {_getFilteredProjects().map((project) => (
            <Card
              key={project.id}
              isPressable
              shadow="none"
              className="border-1 border-solid border-divider p-2"
              radius="sm"
              onPress={() => directToProject(project.id)}
            >
              <CardHeader className="flex flex-row justify-between items-center">
                <div className="flex flex-row items-center gap-2">
                  {pinnedDashboards.find((p) => p.project_id === project.id) && (
                    <LuPin className="text-secondary" size={18} fill="currentColor" />
                  )}
                  <Link to={`/dashboard/${project.id}`} className="cursor-pointer text-foreground! hover:underline">
                    <span className="font-tw font-semibold">{project.name}</span>
                  </Link>
                </div>
                {_canAccess("teamAdmin", team.TeamRoles) && (
                  <Dropdown size="sm">
                    <DropdownTrigger>
                      <Button isIconOnly variant="flat" size="sm">
                        <LuEllipsis className="text-foreground-400" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem
                        onPress={() => _onEditProject(project)}
                        startContent={<LuPencilLine />}
                        textValue="Rename"
                      >
                        Rename
                      </DropdownItem>
                      <DropdownItem
                        onPress={() => _onPinDashboard(project?.id)}
                        startContent={pinnedDashboards.find((p) => p.project_id === project.id) ? <LuPinOff /> : <LuPin />}
                        textValue={pinnedDashboards.find((p) => p.project_id === project.id) ? "Unpin" : "Pin"}
                        showDivider
                      >
                        {pinnedDashboards.find((p) => p.project_id === project.id) ? "Unpin" : "Pin"}
                      </DropdownItem>
                      <DropdownItem
                        onPress={() => _onDeleteProject(project)}
                        startContent={<LuTrash />}
                        color="danger"
                        textValue="Delete"
                      >
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                )}
              </CardHeader>
              <CardBody>
                <div className="flex flex-row justify-between items-center">
                  {_getProjectMembers(project)?.length > 0 && (
                    <div className="flex flex-row items-center gap-1 text-sm text-foreground-500">
                      <LuUsers size={16} />
                      <span>{_getProjectMembers(project)?.length} {_getProjectMembers(project)?.length === 1 ? "member" : "members"}</span>
                    </div>
                  )}
                  {_getProjectMembers(project)?.length === 0 && (
                    <div className="flex flex-row items-center gap-1 text-sm text-foreground-500">
                      <LuUsers size={16} />
                      Team only
                    </div>
                  )}
                  <div className="flex flex-row items-center gap-1 text-sm text-foreground-500">
                    <LuChartNoAxesColumnIncreasing size={16} />
                    <span>{project?.Charts?.length || 0} {project?.Charts?.length === 1 ? "chart" : "charts"}</span>
                  </div>
                </div>
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
              <div className="flex flex-row items-end gap-1">
                <LuUsers />
                <span>Dashboard members</span>
              </div>
            </TableColumn>
            <TableColumn key="charts">
              <div className="flex flex-row items-end justify-center gap-1">
                <LuChartNoAxesColumnIncreasing />
                <span>Charts</span>
              </div>
            </TableColumn>
            <TableColumn key="actions" align="center" hideHeader />
          </TableHeader>
          <TableBody>
            {_getFilteredProjects().map((project) => (
              <TableRow key={project.id} className="group">
                <TableCell key="name">
                  <div className="flex flex-row items-center gap-2">
                    {pinnedDashboards.find((p) => p.project_id === project.id) ? (
                      <Tooltip content="Unpin dashboard" placement="left-start">
                        <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="light">
                          <LuPin className="text-gray-500" size={18} />
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Pin dashboard" placement="left-start">
                        <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <LuPin className="text-gray-500" size={18} />
                        </Button>
                      </Tooltip>
                    )}
                    <Link to={`/${team.id}/${project.id}/dashboard`} className="cursor-pointer flex flex-row items-center select-none">
                      <span className={"text-foreground font-medium"}>{project.name}</span>
                    </Link>
                  </div>
                </TableCell>
                <TableCell key="members">
                  <div className="flex flex-row items-center justify-center">
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
                  </div>
                </TableCell>
                <TableCell key="charts">
                  <div className="flex flex-row items-center justify-center">
                    <span className="font-bold">
                      {project?.Charts?.length || 0}
                    </span>
                  </div>
                </TableCell>
                <TableCell key="actions">
                  {_canAccess("teamAdmin", team.TeamRoles) && (
                    <div className="flex flex-row items-center justify-end gap-1">
                      <Tooltip content="Rename dashboard">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className={"min-w-fit"}
                          onPress={() => _onEditProject(project)}
                        >
                          <LuPencilLine />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete dashboard">
                        <Button
                          isIconOnly
                          color="danger"
                          variant="light"
                          size="sm"
                          className={"min-w-fit"}
                          onPress={() => _onDeleteProject(project)}
                        >
                          <LuTrash />
                        </Button>
                      </Tooltip>
                    </div>
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
        <div className="container mx-auto">
          <h3 className="text-lg font-medium">
            {"No project over here"}
          </h3>
        </div>
      )}

      <Modal isOpen={!!projectToEdit} onClose={() => setProjectToEdit(null)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Rename your dashboard</div>
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
              onPress={() => setProjectToEdit(null)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={() => _onEditProjectSubmit()}
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
            <div className="font-bold">Are you sure you want to delete the dashboard?</div>
          </ModalHeader>
          <ModalBody>
            <p>
              {"Deleting a dashboard will delete all the charts and make the report unavailable. This action cannot be undone."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setProjectToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              auto
              color="danger"
              endContent={<LuTrash />}
              onPress={() => _onDeleteProjectSubmit()}
              isLoading={modifyingProject}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default DashboardList
