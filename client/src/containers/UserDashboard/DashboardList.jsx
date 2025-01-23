import {
  Button, Card, CardHeader, Dropdown, DropdownTrigger, Input, Spacer,
  Link as LinkNext, DropdownMenu, DropdownItem, Divider, CardBody, AvatarGroup,
  Avatar, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tooltip
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import { LuChartNoAxesColumnIncreasing, LuEllipsis, LuLayoutGrid, LuPencilLine, LuPlus, LuSearch, LuTable, LuTrash, LuUsers } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { getTeams, saveActiveTeam, selectTeam, selectTeamMembers } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import { getTemplates } from "../../slices/template";
import { removeProject, selectProjects, updateProject } from "../../slices/project";
import ProjectForm from "../../components/ProjectForm";

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

  const _getProjectMembers = (project) => {
    if (!teamMembers) return [];
    const projectMembers = teamMembers.filter((tm) => {
      return tm.TeamRoles.find((tr) => tr?.projects?.length > 0 && tr.projects.includes(project.id) && tr.role !== "teamOwner" && tr.role !== "teamAdmin");
    });

    return projectMembers;
  };

  const directToProject = (projectId) => {
    dispatch(saveActiveTeam(team));
    // window.location.href = `/${team.id}/${projectId}/dashboard`;
    navigate(`/${team.id}/${projectId}/dashboard`);
  };

  const _onEditProject = (project) => {
    setProjectToEdit(project);
  };

  const _onEditProjectSubmit = () => {
    if (projectToEdit && projectToEdit.id) {
      setModifyingProject(true);
      dispatch(updateProject({ project_id: projectToEdit.id, data: { name: projectToEdit.name } }))
        .then(() => {
          return dispatch(getTeams(user.id))
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
          return dispatch(getTeams(user.id))
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
    dispatch(getTeams(user.id));
    setAddProject(false);

    let url = `/${project.team_id}/${project.id}/dashboard`;
    if (isNew) url += "?new=true";
    window.location.href = url;
  };

  return (
    <div className="flex flex-col">
      <ProjectForm
        onComplete={_onProjectCreated}
        open={addProject}
        onClose={() => setAddProject(false)}
      />
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center gap-2">
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
        </div>
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
      </div>
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
                        <LuEllipsis />
                      </LinkNext>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem
                        onClick={() => _onEditProject(project)}
                        startContent={<LuPencilLine />}
                        showDivider
                        textValue="Rename"
                      >
                        Rename
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => _onDeleteProject(project)}
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
              <Divider />
              <CardBody>
                <div className="flex flex-row justify-between items-center">
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
                    <LuChartNoAxesColumnIncreasing />
                    <span>{project?.Charts?.length || 0}</span>
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
              <TableRow key={project.id}>
                <TableCell key="name">
                  <LinkNext onClick={() => directToProject(project.id)} className="cursor-pointer flex flex-col items-start">
                    <span className={"text-foreground font-medium"}>{project.name}</span>
                  </LinkNext>
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
                          onClick={() => _onEditProject(project)}
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
                          onClick={() => _onDeleteProject(project)}
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
    </div>
  )
}

export default DashboardList
