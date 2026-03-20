import {
  Avatar,
  AvatarGroup,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spacer,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tooltip,
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import {
  LuChartColumn,
  LuChartNoAxesColumnIncreasing,
  LuEllipsis,
  LuLayoutGrid,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPencilLine,
  LuPin,
  LuPinOff,
  LuPlus,
  LuSearch,
  LuTable,
  LuTrash,
  LuUsers,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router";

import ProjectForm from "../../components/ProjectForm";
import canAccess from "../../config/canAccess";
import { cn } from "../../modules/utils";
import { removeProject, selectProjects, updateProject } from "../../slices/project";
import { getTeams, saveActiveTeam, selectTeam, selectTeamMembers } from "../../slices/team";
import { getTemplates } from "../../slices/template";
import { pinDashboard, selectUser, unpinDashboard } from "../../slices/user";
import WhatsNewPanel from "./components/WhatsNewPanel";

const WHATS_NEW_PANEL_STORAGE_KEY = "__cb_whats_new_panel_collapsed";

const getInitialWhatsNewPanelState = () => {
  try {
    return window.localStorage.getItem(WHATS_NEW_PANEL_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
};

function DashboardList() {
  const [addProject, setAddProject] = useState(false);
  const [search, setSearch] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [modifyingProject, setModifyingProject] = useState(false);
  const [whatsNewPanelCollapsed, setWhatsNewPanelCollapsed] = useState(getInitialWhatsNewPanelState);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "dashboard") {
      setAddProject(true);
      navigate("/");
    }
  }, [navigate]);

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.id, teamRoles);
  };

  const _onNewProject = (activeTeam) => {
    setAddProject(true);
    dispatch(saveActiveTeam(activeTeam));
    dispatch(getTemplates(activeTeam.id));
  };

  const _changeViewMode = (mode) => {
    setViewMode(mode);
    window.localStorage.setItem("__cb_view_mode", mode);
  };

  const _toggleWhatsNewPanel = () => {
    setWhatsNewPanelCollapsed((currentValue) => {
      const nextValue = !currentValue;
      try {
        window.localStorage.setItem(WHATS_NEW_PANEL_STORAGE_KEY, String(nextValue));
      } catch (error) {
        // Keep the UI responsive even if storage is unavailable.
      }
      return nextValue;
    });
  };

  const _getProjectMembers = (project) => {
    if (!teamMembers) return [];
    return teamMembers.filter((teamMember) => {
      return teamMember.TeamRoles.find((teamRole) => {
        return teamRole?.projects?.length > 0
          && teamRole.projects.includes(project.id)
          && teamRole.role !== "teamOwner"
          && teamRole.role !== "teamAdmin";
      });
    });
  };

  const _getFilteredProjects = () => {
    if (!team?.id || !projects) return [];

    const teamSearch = search[team.id]?.toLowerCase();
    const filteredProjects = projects.filter((project) => {
      if (project.ghost || project.team_id !== team.id) return false;
      if (!teamSearch) return true;
      return project.name.toLowerCase().includes(teamSearch);
    });

    return filteredProjects
      .map((project) => ({
        ...project,
        members: _getProjectMembers(project),
      }))
      .sort((projectA, projectB) => {
        const aPinned = pinnedDashboards.find((pin) => pin.project_id === projectA.id);
        const bPinned = pinnedDashboards.find((pin) => pin.project_id === projectB.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
      });
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
        .then(() => dispatch(getTeams()))
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
        .then(() => dispatch(getTeams()))
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

    let url = `/dashboard/${project.id}`;
    if (isNew) url += "?new=true";
    window.location.href = url;
  };

  const _onPinDashboard = (projectId) => {
    const pin = pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === projectId);

    if (pin) {
      dispatch(unpinDashboard({ pin_id: pin.id }));
    } else {
      dispatch(pinDashboard({ project_id: projectId, user_id: user.id }));
    }
  };

  const canManageDashboards = _canAccess("teamAdmin", team?.TeamRoles);
  const canCreateCharts = _canAccess("projectEditor", team?.TeamRoles);
  const filteredProjects = _getFilteredProjects();
  const showWhatsNewRail = canManageDashboards && !whatsNewPanelCollapsed;
  const gridClassName = showWhatsNewRail
    ? "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
    : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col">
      <ProjectForm
        onComplete={_onProjectCreated}
        open={addProject}
        onClose={() => setAddProject(false)}
      />
      <div className={cn("flex flex-col gap-4", showWhatsNewRail && "xl:flex-row xl:items-start xl:gap-6")}>
        <div className={cn("min-w-0", showWhatsNewRail && "xl:flex-1")}>
          <div className="flex flex-row justify-between items-center gap-4">
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
              {canCreateCharts && (
                <Button
                  variant="bordered"
                  onPress={() => navigate("/charts/new")}
                  startContent={<LuChartColumn />}
                >
                  <span className="hidden md:block">New chart</span>
                  <span className="md:hidden">Chart</span>
                </Button>
              )}
              {canManageDashboards && (
                <Button
                  color="primary"
                  onPress={() => _onNewProject(team)}
                  endContent={<LuPlus />}
                  className="create-dashboard-tutorial"
                >
                  <span className="hidden md:block">Create dashboard</span>
                  <span className="md:hidden">Create</span>
                </Button>
              )}

              {canManageDashboards && (
                <Tooltip content={whatsNewPanelCollapsed ? "Show discover panel" : "Hide discover panel"}>
                  <Button
                    isIconOnly
                    variant="bordered"
                    className="hidden xl:inline-flex"
                    onPress={_toggleWhatsNewPanel}
                    aria-label={whatsNewPanelCollapsed ? "Show discover panel" : "Hide discover panel"}
                  >
                    {whatsNewPanelCollapsed ? <LuPanelLeftClose size={18} /> : <LuPanelLeftOpen size={18} />}
                  </Button>
                </Tooltip>
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
            <div className={gridClassName}>
              {filteredProjects.map((project) => {
                const projectMembers = _getProjectMembers(project);
                const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);

                return (
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
                        {isPinned && (
                          <LuPin className="text-secondary" size={18} fill="currentColor" />
                        )}
                        <Link to={`/dashboard/${project.id}`} className="cursor-pointer text-foreground! hover:underline">
                          <span className="font-tw font-semibold">{project.name}</span>
                        </Link>
                      </div>
                      {canManageDashboards && (
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
                              onPress={() => _onPinDashboard(project.id)}
                              startContent={isPinned ? <LuPinOff /> : <LuPin />}
                              textValue={isPinned ? "Unpin" : "Pin"}
                              showDivider
                            >
                              {isPinned ? "Unpin" : "Pin"}
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
                        {projectMembers.length > 0 ? (
                          <div className="flex flex-row items-center gap-1 text-sm text-foreground-500">
                            <LuUsers size={16} />
                            <span>{projectMembers.length} {projectMembers.length === 1 ? "member" : "members"}</span>
                          </div>
                        ) : (
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
                );
              })}

              {filteredProjects.length === 0 && (
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
                {filteredProjects.map((project) => {
                  const projectMembers = _getProjectMembers(project);
                  const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);

                  return (
                    <TableRow key={project.id} className="group">
                      <TableCell key="name">
                        <div className="flex flex-row items-center gap-2">
                          {isPinned ? (
                            <Tooltip content="Unpin dashboard" placement="left-start">
                              <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="light">
                                <LuPin className="text-secondary" size={18} fill="currentColor" />
                              </Button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Pin dashboard" placement="left-start">
                              <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <LuPin className="text-secondary" size={18} />
                              </Button>
                            </Tooltip>
                          )}
                          <Link to={`/dashboard/${project.id}`} className="cursor-pointer flex flex-row items-center select-none">
                            <span className="text-foreground font-medium">{project.name}</span>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell key="members">
                        <div className="flex flex-row items-center justify-center">
                          {projectMembers.length > 0 ? (
                            <AvatarGroup max={3} isBordered size="sm">
                              {projectMembers.map((projectMember) => (
                                <Avatar
                                  key={projectMember.id}
                                  name={projectMember.name}
                                />
                              ))}
                            </AvatarGroup>
                          ) : (
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
                        {canManageDashboards && (
                          <div className="flex flex-row items-center justify-end gap-1">
                            <Tooltip content="Rename dashboard">
                              <Button
                                isIconOnly
                                variant="light"
                                size="sm"
                                className="min-w-fit"
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
                                className="min-w-fit"
                                onPress={() => _onDeleteProject(project)}
                              >
                                <LuTrash />
                              </Button>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {filteredProjects.length === 0 && (
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
        </div>

        {canManageDashboards && (
          <div className={cn("hidden xl:block xl:w-[360px] xl:shrink-0", whatsNewPanelCollapsed && "xl:hidden")}>
            <WhatsNewPanel onCollapse={_toggleWhatsNewPanel} />
          </div>
        )}
      </div>

      {projects && projects.length === 0 && !_canAccess("projectEditor", team?.TeamRoles) && (
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
  );
}

export default DashboardList;
