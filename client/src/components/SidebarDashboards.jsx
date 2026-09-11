import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Popover, SearchField, Tooltip } from "@heroui/react";
import { LuGrid2X2Plus, LuLayers2, LuLayoutGrid, LuPin, LuPinOff, LuPlus, LuUnplug } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";

import canAccess from "../config/canAccess";
import { cn } from "../modules/utils";
import { getSidebarDashboards, readDashboardVisits } from "../modules/sidebarDashboards";
import { getProjects, selectProjects } from "../slices/project";
import { selectTeam } from "../slices/team";
import { pinDashboard, selectUser, unpinDashboard } from "../slices/user";
import { selectSidebarCollapsed } from "../slices/ui";

function SidebarDashboards() {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const projects = useSelector(selectProjects);
  const loading = useSelector((state) => state.project.loading);
  const loadError = useSelector((state) => state.project.error);
  const collapsed = useSelector(selectSidebarCollapsed);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const storageKey = `__cb_dashboard_visits_${user.id}_${team.id}`;
  const [visits, setVisits] = useState(() => {
    try {
      return readDashboardVisits(window.localStorage, storageKey);
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { dashboards, items, mode } = useMemo(() => (
    getSidebarDashboards(projects, user.PinnedDashboards || [], visits, team.id)
  ), [projects, user.PinnedDashboards, visits, team.id]);
  const dashboardId = pathname.match(/^\/dashboard\/(\d+)(?:\/|$)/)?.[1];

  useEffect(() => {
    if (!dashboardId || visits[0] === dashboardId
      || !dashboards.some((dashboard) => `${dashboard.id}` === dashboardId)) return;
    const next = [dashboardId, ...visits.filter((id) => id !== dashboardId)].slice(0, 20);
    setVisits(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep recent dashboards available for this session when storage is blocked.
    }
  }, [dashboardId, dashboards, storageKey, visits]);

  const togglePin = async (dashboard) => {
    if (saving) return;
    const pin = user.PinnedDashboards?.find((item) => `${item.project_id}` === `${dashboard.id}`);
    setSaving(true);
    try {
      await dispatch(pin
        ? unpinDashboard({ user_id: user.id, pin_id: pin.id })
        : pinDashboard({ user_id: user.id, project_id: dashboard.id })).unwrap();
    } catch {
      toast.error(pin ? "Could not unpin the dashboard. Try again." : "Could not pin the dashboard. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const choices = [...dashboards].sort((left, right) => (
    (visits.indexOf(`${left.id}`) < 0 ? Infinity : visits.indexOf(`${left.id}`))
    - (visits.indexOf(`${right.id}`) < 0 ? Infinity : visits.indexOf(`${right.id}`))
    || left.name.localeCompare(right.name)
  )).filter((dashboard) => dashboard.name.toLowerCase().includes(search.trim().toLowerCase()));
  const quickActions = [
    { label: "New dashboard", icon: LuGrid2X2Plus, path: "/dashboards?create=dashboard", role: "teamAdmin" },
    { label: "New dataset", icon: LuLayers2, path: "/datasets/new", role: "projectAdmin" },
    { label: "New connection", icon: LuUnplug, path: "/connections/new", role: "teamAdmin" },
  ].filter((action) => canAccess(action.role, user.id, team.TeamRoles));
  const showQuickActions = mode === "Quick actions" && quickActions.length > 0;
  const empty = !items.length && !showQuickActions;

  return (
    <section aria-label="Dashboard shortcuts" className={cn("mt-5 px-2", collapsed && "flex flex-col items-center")}>
      <div className={cn("mb-1 flex items-center justify-between", !collapsed && "pl-3")}>
        {!collapsed && (
          <h2 className="text-xs font-medium text-muted">{showQuickActions ? "Quick actions" : (mode === "Pinned" ? "Pinned" : "Recent")}</h2>
        )}
        <Popover
          isOpen={open}
          onOpenChange={(value) => {
            setOpen(value);
            setSearch("");
          }}
        >
          <Button aria-label="Pin dashboards" isIconOnly isDisabled={loading && !dashboards.length} size="sm" variant="ghost">
            <LuPlus aria-hidden size={16} />
          </Button>
          <Popover.Content placement="right top" className="w-72 max-w-[calc(100vw-80px)]">
            <Popover.Dialog>
              <Popover.Heading className="mb-3">Pin dashboards</Popover.Heading>
              <SearchField aria-label="Search dashboards" value={search} onChange={setSearch}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input autoFocus placeholder="Search dashboards" className="min-w-0 w-full" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {choices.map((dashboard) => (
                  <Checkbox
                    key={dashboard.id}
                    variant="secondary"
                    aria-label={`Pin ${dashboard.name}`}
                    isSelected={!!user.PinnedDashboards?.some((pin) => `${pin.project_id}` === `${dashboard.id}`)}
                    isDisabled={saving}
                    onChange={() => togglePin(dashboard)}
                    className="w-full rounded-lg px-2 py-2 hover:bg-default-50"
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="min-w-0 break-words text-sm">{dashboard.name}</span>
                    </Checkbox.Content>
                  </Checkbox>
                ))}
                {!choices.length && (
                  <p className="px-2 py-3 text-sm text-muted">
                    {search ? "No dashboards match. Try another name." : "No dashboards available."}
                  </p>
                )}
                {!dashboards.length && (
                  canAccess("teamAdmin", user.id, team.TeamRoles) ? (
                    <Button size="sm" variant="secondary" onPress={() => navigate("/dashboards?create=dashboard")}>
                      New dashboard
                    </Button>
                  ) : (
                    <p className="px-2 text-sm text-muted">Ask your team owner for dashboard access.</p>
                  )
                )}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      {loading && !dashboards.length ? (
        <p role="status" className="px-3 text-xs text-muted">{collapsed ? "…" : "Loading dashboards…"}</p>
      ) : loadError && !dashboards.length ? (
        <Button size="sm" variant="ghost" aria-label="Retry loading dashboards" onPress={() => dispatch(getProjects({ team_id: team.id }))}>
          {collapsed ? "Retry" : "Retry loading dashboards"}
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((dashboard) => (
            <div key={dashboard.id} className="group flex min-w-0 items-center">
              <NavLink
                to={`/dashboard/${dashboard.id}`}
                aria-label={dashboard.name}
                title={dashboard.name}
                className={({ isActive }) => cn(
                  "flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-sm !text-foreground hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-accent",
                  collapsed && "justify-center px-2",
                  isActive && "bg-default-100 font-medium",
                )}
              >
                <LuLayoutGrid aria-hidden className="shrink-0" size={18} />
                {!collapsed && <span className="truncate">{dashboard.name}</span>}
              </NavLink>
              {!collapsed && (
                <Button
                  aria-label={`${mode === "Pinned" ? "Unpin" : "Pin"} ${dashboard.name}`}
                  isIconOnly
                  isDisabled={saving}
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                  onPress={() => togglePin(dashboard)}
                >
                  {mode === "Pinned" ? <LuPinOff aria-hidden size={14} /> : <LuPin aria-hidden size={14} />}
                </Button>
              )}
            </div>
          ))}
          {showQuickActions && quickActions.map(({ label, icon: Icon, path }) => (
            <Tooltip key={path} isDisabled={!collapsed}>
              <Button
                aria-label={label}
                size="sm"
                variant="ghost"
                isIconOnly={collapsed}
                fullWidth={!collapsed}
                className={collapsed ? "justify-center" : "justify-start"}
                onPress={() => navigate(path)}
              >
                <Icon aria-hidden size={18} />
                {!collapsed && label}
              </Button>
              <Tooltip.Content placement="right">{label}</Tooltip.Content>
            </Tooltip>
          ))}
          {empty && !collapsed && (
            <Button size="sm" variant="ghost" className="justify-start" onPress={() => setOpen(true)}>
              Choose dashboards
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export default SidebarDashboards;
