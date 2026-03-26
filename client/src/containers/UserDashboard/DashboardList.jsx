import {
  Avatar,
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  InputGroup,
  Modal,
  Table,
  Tabs,
  Tooltip
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import {
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
import { cn, displayInitials } from "../../modules/utils";
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
              {canManageDashboards && (
                <Button onPress={() => _onNewProject(team)}
                  className="create-dashboard-tutorial"
                >
                  <span className="hidden md:block">Create dashboard</span>
                  <span className="md:hidden">Create</span>
                  <LuPlus />
                </Button>
              )}

              {canManageDashboards && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      variant="secondary"
                      className="hidden xl:inline-flex"
                      onPress={_toggleWhatsNewPanel}
                      aria-label={whatsNewPanelCollapsed ? "Show discover panel" : "Hide discover panel"}
                    >
                      {whatsNewPanelCollapsed ? <LuPanelLeftClose size={18} /> : <LuPanelLeftOpen size={18} />}
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    {whatsNewPanelCollapsed ? "Show discover panel" : "Hide discover panel"}
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="h-2" />

          <div className="flex flex-row items-center justify-between gap-2">
            <InputGroup fullWidth className="max-w-lg">
              <InputGroup.Input
                type="text"
                placeholder="Search dashboards"
                onChange={(e) => setSearch({ ...search, [team.id]: e.target.value })}
              />
              <InputGroup.Suffix className="pr-2">
                <LuSearch className="size-4 text-muted" aria-hidden />
              </InputGroup.Suffix>
            </InputGroup>
            <Tabs selectedKey={viewMode} onSelectionChange={(key) => _changeViewMode(key)}>
              <Tabs.ListContainer>
                <Tabs.List>
                  <Tabs.Tab id="grid">
                    <LuLayoutGrid size={16} />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="table">
                    <LuTable size={16} />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </div>

          <div className="h-4" />

          {projects && viewMode === "grid" && (
            <div className={gridClassName}>
              {filteredProjects.map((project) => {
                const projectMembers = _getProjectMembers(project);
                const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);

                return (
                  <Card
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-default-50/60 shadow-none border border-divider"
                    onClick={() => directToProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        directToProject(project.id);
                      }
                    }}
                  >
                    <Card.Header className="flex flex-row justify-between items-center">
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
                          <Dropdown.Trigger>
                            <Button isIconOnly variant="tertiary" size="sm">
                              <LuEllipsis className="text-foreground-400" />
                            </Button>
                          </Dropdown.Trigger>
                          <Dropdown.Popover>
                            <Dropdown.Menu>
                              <Dropdown.Item
                                id="rename"
                                onPress={() => _onEditProject(project)}
                                textValue="Rename"
                              >
                                <div className="flex flex-row items-center gap-2">
                                  <LuPencilLine />
                                  <span>Rename</span>
                                </div>
                              </Dropdown.Item>
                              <Dropdown.Item
                                id="pin"
                                onPress={() => _onPinDashboard(project.id)}
                                textValue={isPinned ? "Unpin" : "Pin"}
                                showDivider
                              >
                                <div className="flex flex-row items-center gap-2">
                                  {isPinned ? <LuPinOff /> : <LuPin />}
                                  <span>{isPinned ? "Unpin" : "Pin"}</span>
                                </div>
                              </Dropdown.Item>
                              <Dropdown.Item
                                id="delete"
                                onPress={() => _onDeleteProject(project)}
                                variant="danger"
                                textValue="Delete"
                              >
                                <div className="flex flex-row items-center gap-2">
                                  <LuTrash />
                                  <span>Delete</span>
                                </div>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      )}
                    </Card.Header>
                    <Card.Content>
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
                    </Card.Content>
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
            <Table className="h-auto min-w-full border-1 border-solid border-content3 rounded-xl shadow-none">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Dashboard list"
                  className="min-w-full even:[&_tbody>tr]:bg-content2/30"
                >
                  <Table.Header>
                    <Table.Column id="name" isRowHeader textValue="Dashboard name">
                      Dashboard name
                    </Table.Column>
                    <Table.Column id="members" className="text-center" textValue="Dashboard members">
                      <div className="flex flex-row items-end justify-center gap-1">
                        <LuUsers />
                        <span>Dashboard members</span>
                      </div>
                    </Table.Column>
                    <Table.Column id="charts" className="text-center" textValue="Charts">
                      <div className="flex flex-row items-end justify-center gap-1">
                        <LuChartNoAxesColumnIncreasing />
                        <span>Charts</span>
                      </div>
                    </Table.Column>
                    <Table.Column id="actions" className="w-12 text-center" textValue="Actions" />
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <span className="italic text-default-500">No dashboards here</span>
                    )}
                  >
                    {filteredProjects.map((project) => {
                  const projectMembers = _getProjectMembers(project);
                  const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);
                  const memberStackMax = 3;
                  const memberStackOverflow = projectMembers.length > memberStackMax
                    ? projectMembers.length - (memberStackMax - 1)
                    : 0;
                  const memberStackVisible = memberStackOverflow > 0
                    ? projectMembers.slice(0, memberStackMax - 1)
                    : projectMembers.slice(0, memberStackMax);

                  return (
                    <Table.Row key={project.id} id={String(project.id)} className="group">
                      <Table.Cell>
                        <div className="flex flex-row items-center gap-2">
                          {isPinned ? (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="ghost">
                                  <LuPin className="text-secondary" size={18} fill="currentColor" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content placement="left start">Unpin dashboard</Tooltip.Content>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button isIconOnly size="sm" onPress={() => _onPinDashboard(project.id)} variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <LuPin className="text-secondary" size={18} />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content placement="left start">Pin dashboard</Tooltip.Content>
                            </Tooltip>
                          )}
                          <Link to={`/dashboard/${project.id}`} className="cursor-pointer flex flex-row items-center select-none">
                            <span className="text-foreground font-medium">{project.name}</span>
                          </Link>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-row items-center justify-center">
                          {projectMembers.length > 0 ? (
                            <div className="flex flex-row -space-x-2 rtl:space-x-reverse">
                              {memberStackVisible.map((projectMember, idx) => (
                                <Avatar
                                  key={projectMember.id}
                                  size="sm"
                                  className="ring-2 ring-background shrink-0"
                                  style={{ zIndex: idx }}
                                >
                                  <Avatar.Fallback>{displayInitials(projectMember.name)}</Avatar.Fallback>
                                </Avatar>
                              ))}
                              {memberStackOverflow > 0 && (
                                <Avatar size="sm" className="ring-2 ring-background shrink-0" style={{ zIndex: memberStackVisible.length }}>
                                  <Avatar.Fallback>{`+${memberStackOverflow}`}</Avatar.Fallback>
                                </Avatar>
                              )}
                            </div>
                          ) : (
                            <Chip variant="soft" size="sm">
                              Team only
                            </Chip>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-row items-center justify-center">
                          <span className="font-bold">
                            {project?.Charts?.length || 0}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {canManageDashboards && (
                          <div className="flex flex-row items-center justify-end gap-1">
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly
                                  variant="ghost"
                                  size="sm"
                                  className="min-w-fit"
                                  onPress={() => _onEditProject(project)}
                                >
                                  <LuPencilLine />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Rename dashboard</Tooltip.Content>
                            </Tooltip>
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly variant="ghost"
                                  size="sm"
                                  className="min-w-fit"
                                  onPress={() => _onDeleteProject(project)}
                                >
                                  <LuTrash />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Delete dashboard</Tooltip.Content>
                            </Tooltip>
                          </div>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
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

      <Modal>
        <Modal.Backdrop isOpen={!!projectToEdit} onOpenChange={(nextOpen) => { if (!nextOpen) setProjectToEdit(null); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Rename your dashboard
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Input
                  label="Dashboard name"
                  placeholder="Enter the dashboard name"
                  value={projectToEdit?.name || ""}
                  onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
                  variant="secondary"
                  fullWidth
                />
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => _onEditProjectSubmit()}
                  isDisabled={!projectToEdit?.name || modifyingProject}
                  isPending={modifyingProject}
                >
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={!!projectToDelete} onOpenChange={(nextOpen) => { if (!nextOpen) setProjectToDelete(null); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Are you sure you want to delete the dashboard?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>
                  {"Deleting a dashboard will delete all the charts and make the report unavailable. This action cannot be undone."}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={() => _onDeleteProjectSubmit()}
                  isPending={modifyingProject}
                >
                  Delete
                  <LuTrash />
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default DashboardList;
