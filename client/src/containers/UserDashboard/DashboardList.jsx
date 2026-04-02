import {
  Avatar,
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  InputGroup,
  Label,
  Modal,
  Separator,
  Table,
  Tabs,
  TextField,
  Tooltip
} from "@heroui/react";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  LuCalendarClock,
  LuChartNoAxesColumnIncreasing,
  LuClock3,
  LuEllipsis,
  LuLayoutGrid,
  LuMapPin,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPencilLine,
  LuPin,
  LuPinOff,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuTable,
  LuTrash,
  LuUsers,
  LuCoffee,
  LuSettings,
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

const hasScheduleConfigured = (schedule) => {
  return !!schedule?.frequency;
};

const capitalizeWord = (value = "") => {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const formatRelativeUpdateTime = (dateValue) => {
  if (!dateValue) {
    return "Not updated";
  }

  const updatedMoment = moment(dateValue);
  const minutesSinceUpdate = Math.max(moment().diff(updatedMoment, "minutes"), 0);

  if (minutesSinceUpdate < 60) {
    return `${Math.max(minutesSinceUpdate, 1)}m ago`;
  }

  const hoursSinceUpdate = moment().diff(updatedMoment, "hours");
  if (hoursSinceUpdate < 24) {
    return `${hoursSinceUpdate}h ago`;
  }

  const daysSinceUpdate = moment().diff(updatedMoment, "days");
  if (daysSinceUpdate < 7) {
    return `${daysSinceUpdate}d ago`;
  }

  if (daysSinceUpdate < 30) {
    return `${Math.floor(daysSinceUpdate / 7)}w ago`;
  }

  return updatedMoment.format("MMM D");
};

const getLastUpdatedChipColor = (dateValue) => {
  if (!dateValue) return "default";

  const hoursSinceUpdate = moment().diff(moment(dateValue), "hours");

  if (hoursSinceUpdate < 24) return "success";
  if (hoursSinceUpdate < 24 * 7) return "default";
  return "warning";
};

const formatScheduleFrequency = (schedule) => {
  if (!hasScheduleConfigured(schedule)) {
    return null;
  }

  switch (schedule.frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return schedule.dayOfWeek ? `Weekly on ${capitalizeWord(schedule.dayOfWeek)}` : "Weekly";
    case "every_x_days":
      return `Every ${schedule.frequencyNumber || 1} day${`${schedule.frequencyNumber}` === "1" ? "" : "s"}`;
    case "every_x_hours":
      return `Every ${schedule.frequencyNumber || 1} hour${`${schedule.frequencyNumber}` === "1" ? "" : "s"}`;
    case "every_x_minutes":
      return `Every ${schedule.frequencyNumber || 1} minute${`${schedule.frequencyNumber}` === "1" ? "" : "s"}`;
    default:
      return null;
  }
};

const getProjectTimezoneLabel = (project) => {
  const timezone = project.timezone || project?.updateSchedule?.timezone || project?.snapshotSchedule?.timezone;

  if (!timezone) {
    return "Default timezone";
  }

  try {
    const timeZoneName = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;

    return timeZoneName ? `${timezone} (${timeZoneName})` : timezone;
  } catch (error) {
    return timezone;
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
                      variant="outline"
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

          <div className="flex flex-row items-center gap-2">
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
                const projectMembers = project.members || _getProjectMembers(project);
                const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);
                const updateScheduleLabel = formatScheduleFrequency(project.updateSchedule);
                const snapshotScheduleLabel = formatScheduleFrequency(project.snapshotSchedule);
                const timezoneLabel = getProjectTimezoneLabel(project);

                return (
                  <Card
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer gap-0 border border-divider shadow-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-default-300 hover:bg-default-50/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-soft-hover"
                    onClick={() => directToProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        directToProject(project.id);
                      }
                    }}
                  >
                    <Card.Header className="flex flex-row justify-between items-start gap-3 pb-2">
                      <div className="min-w-0 flex flex-row items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-row items-center gap-2">
                            {isPinned && (
                              <LuPin className="shrink-0 text-secondary" size={16} fill="currentColor" />
                            )}
                            <Link to={`/dashboard/${project.id}`} className="min-w-0 cursor-pointer text-foreground! hover:underline">
                              <Card.Title className="truncate font-tw text-lg font-semibold">
                                {project.name}
                              </Card.Title>
                            </Link>
                          </div>
                        </div>
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
                                id="settings"
                                onPress={() => navigate(`/dashboard/${project.id}/settings`)}
                                textValue="Dashboard settings"
                              >
                                <div className="flex flex-row items-center gap-2">
                                  <LuSettings />
                                  <span>Dashboard settings</span>
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
                      <div className="flex flex-col gap-3 pb-2">
                        <Card.Description className="line-clamp-2 text-sm leading-5 text-foreground-500">
                          {project.description || ""}
                        </Card.Description>

                        <div className="flex flex-wrap items-center gap-2">
                          <Tooltip delay={0}>
                            <Tooltip.Trigger className="pt-0.5">
                              <Chip color={getLastUpdatedChipColor(project.lastUpdatedAt)} size="sm" variant="soft">
                                <LuClock3 size={12} />
                                <Chip.Label>{formatRelativeUpdateTime(project.lastUpdatedAt)}</Chip.Label>
                              </Chip>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              {project.lastUpdatedAt
                                ? `Last dashboard refresh ${moment(project.lastUpdatedAt).calendar()}`
                                : "This dashboard has not been refreshed yet"}
                            </Tooltip.Content>
                          </Tooltip>
                          {updateScheduleLabel && (
                            <Chip color="accent" size="sm" variant="soft">
                              <LuRefreshCw size={12} />
                              <Chip.Label>{`${updateScheduleLabel} refresh`}</Chip.Label>
                            </Chip>
                          )}
                          {snapshotScheduleLabel && (
                            <Chip color="default" size="sm" variant="soft">
                              <LuCalendarClock size={12} />
                              <Chip.Label>{`${snapshotScheduleLabel} snapshot`}</Chip.Label>
                            </Chip>
                          )}
                          {!updateScheduleLabel && !snapshotScheduleLabel && (
                            <Chip color="default" size="sm" variant="soft">
                              <LuRefreshCw size={12} />
                              <Chip.Label>No schedule</Chip.Label>
                            </Chip>
                          )}
                        </div>

                        {timezoneLabel && (updateScheduleLabel || snapshotScheduleLabel) && (
                          <div className="flex flex-row items-center gap-2 text-xs text-foreground-500">
                            <LuMapPin size={14} />
                            <span className="truncate">{timezoneLabel}</span>
                          </div>
                        )}
                      </div>
                    </Card.Content>
                    <Separator variant="secondary" />
                    <Card.Footer className="flex flex-row items-center justify-between gap-3 pt-3">
                      {projectMembers.length > 0 ? (
                        <div className="flex min-w-0 flex-row items-center gap-2">
                          <LuUsers size={16} />
                          <span className="truncate text-sm text-foreground-500">
                            {projectMembers.length} {projectMembers.length === 1 ? "member" : "members"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex min-w-0 flex-row items-center gap-2 text-sm text-foreground-500">
                          <LuCoffee size={16} />
                          <span>Team only</span>
                        </div>
                      )}
                      <div className="flex shrink-0 flex-row items-center gap-1 text-sm text-foreground-500">
                        <LuChartNoAxesColumnIncreasing size={16} />
                        <span>{project?.Charts?.length || 0} {project?.Charts?.length === 1 ? "chart" : "charts"}</span>
                      </div>
                    </Card.Footer>
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
            <Table className="h-auto min-w-full border border-content3 rounded-xl shadow-none">
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
                        <LuUsers size={16} />
                        <span>Dashboard members</span>
                      </div>
                    </Table.Column>
                    <Table.Column id="charts" className="text-center" textValue="Charts">
                      <div className="flex flex-row items-end justify-center gap-1">
                        <LuChartNoAxesColumnIncreasing size={16} />
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
                      const projectMembers = project.members || _getProjectMembers(project);
                      const isPinned = !!pinnedDashboards.find((pinnedDashboard) => pinnedDashboard.project_id === project.id);
                      const updateScheduleLabel = formatScheduleFrequency(project.updateSchedule);
                      const snapshotScheduleLabel = formatScheduleFrequency(project.snapshotSchedule);
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
                            <div className="flex min-w-0 flex-col gap-2 py-1">
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
                                <Link to={`/dashboard/${project.id}`} className="min-w-0 cursor-pointer flex flex-row items-center select-none">
                                  <span className="truncate text-foreground font-medium">{project.name}</span>
                                </Link>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pl-10">
                                <Tooltip delay={0}>
                                  <Tooltip.Trigger>
                                    <Chip color={getLastUpdatedChipColor(project.lastUpdatedAt)} size="sm" variant="soft">
                                      <LuClock3 size={14} />
                                      <span>{formatRelativeUpdateTime(project.lastUpdatedAt)}</span>
                                    </Chip>
                                  </Tooltip.Trigger>
                                  <Tooltip.Content>
                                    {project.lastUpdatedAt
                                      ? `Last dashboard refresh ${moment(project.lastUpdatedAt).calendar()}`
                                      : "This dashboard has not been refreshed yet"}
                                  </Tooltip.Content>
                                </Tooltip>
                                {updateScheduleLabel && (
                                  <Chip color="accent" size="sm" variant="soft">
                                    <LuRefreshCw size={14} />
                                    <span>{`${updateScheduleLabel} refresh`}</span>
                                  </Chip>
                                )}
                                {snapshotScheduleLabel && (
                                  <Chip color="default" size="sm" variant="soft">
                                    <LuCalendarClock size={14} />
                                    <span>{`${snapshotScheduleLabel} snapshot`}</span>
                                  </Chip>
                                )}
                              </div>
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
              <Modal.Body className="p-1">
                <TextField name="dashboard-name">
                  <Label>Dashboard name</Label>
                  <Input
                    placeholder="Enter the dashboard name"
                    value={projectToEdit?.name || ""}
                    onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
                    variant="secondary"
                    fullWidth
                  />
                </TextField>
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
