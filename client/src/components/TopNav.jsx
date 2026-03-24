import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { TbBrandDiscord } from "react-icons/tb";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  LuBell,
  LuBook,
  LuBookOpenText,
  LuBrainCircuit,
  LuFileCode2,
  LuGithub,
  LuHeartHandshake,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuSmile,
  LuSquareKanban,
} from "react-icons/lu";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";

import { selectSidebarCollapsed, showFeedbackModal, toggleAiModal, toggleSidebar } from "../slices/ui";
import canAccess from "../config/canAccess";
import { selectUser } from "../slices/user";
import { selectTeam } from "../slices/team";
import { selectProject } from "../slices/project";
import { selectChart } from "../slices/chart";
import { selectIntegrations } from "../slices/integration";
import getDatasetDisplayName from "../modules/getDatasetDisplayName";

function TopNav() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const collapsed = useSelector(selectSidebarCollapsed);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const project = useSelector(selectProject);
  const chart = useSelector((state) => selectChart(state, params.chartId));
  const connection = useSelector((state) => state.connection.data.find((item) => `${item.id}` === `${params.connectionId}`));
  const dataset = useSelector((state) => state.dataset.data.find((item) => `${item.id}` === `${params.datasetId}`));
  const integrations = useSelector(selectIntegrations);

  useEffect(() => {
    try {
      Headway.init({
        selector: ".changelog-trigger",
        account: "JVODWy",
      });
    } catch (e) {
      // ---
    }
  }, []);

  const canUserAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }

    return canAccess(role, user.id, team.TeamRoles);
  };

  const isOnDashboard = () => location.pathname.startsWith("/dashboard/");
  const isOnConnections = () => location.pathname.startsWith("/connections");
  const isOnDatasets = () => location.pathname.startsWith("/datasets");
  const isOnIntegrations = () => location.pathname.startsWith("/integrations");

  const onDropdownAction = (key) => {
    switch (key) {
      case "discord":
        window.open("https://discord.gg/KwGEbFk", "_blank");
        break;
      case "tutorials":
        window.open("https://chartbrew.com/blog/tag/tutorial/", "_blank");
        break;
      case "documentation":
        window.open("https://docs.chartbrew.com", "_blank");
        break;
      case "github":
        window.open("https://github.com/chartbrew/chartbrew/discussions", "_blank");
        break;
      case "feedback":
        dispatch(showFeedbackModal());
        break;
      case "profile":
        navigate("/user/profile");
        break;
      case "roadmap":
        window.open("https://chartbrew.com/roadmap", "_blank");
        break;
      case "api":
        window.open("https://docs.chartbrew.com/api-reference/introduction", "_blank");
        break;
      default:
        break;
    }
  };

  const renderBreadcrumbs = () => {
    const items = [];

    if (isOnDashboard() && project?.name) {
      items.push({ label: "Dashboards", onPress: () => navigate("/") });
      items.push({ label: project.name, onPress: params.chartId ? () => navigate(`/dashboard/${params.projectId}`) : null });
      if (params.chartId) items.push({ label: chart?.name || "Chart", onPress: null });
    } else if (isOnConnections()) {
      items.push({ label: "Connections", onPress: () => navigate("/connections") });
      if (connection?.name) items.push({ label: connection.name, onPress: null });
      if (params.connectionId === "new") items.push({ label: "New connection", onPress: null });
    } else if (isOnDatasets()) {
      items.push({ label: "Datasets", onPress: () => navigate("/datasets") });
      if (getDatasetDisplayName(dataset)) items.push({ label: getDatasetDisplayName(dataset), onPress: null });
      if (params.datasetId === "new") items.push({ label: "New dataset", onPress: null });
    } else if (isOnIntegrations()) {
      items.push({ label: "Integrations", onPress: () => navigate("/integrations") });
      if (params.integrationId) {
        items.push({ label: integrations?.find((item) => item.id === params.integrationId)?.name || "Integration", onPress: null });
      }
    }

    if (!items.length) return null;

    return (
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <span className="text-default-400">/</span> : null}
            {item.onPress ? (
              <button className="hover:text-primary" onClick={item.onPress} type="button">
                {item.label}
              </button>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    );
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b border-divider bg-content1 p-2">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-3">
          <Button isIconOnly onPress={() => dispatch(toggleSidebar())} variant="ghost">
            {collapsed ? <LuPanelLeftOpen className="text-foreground" size={18} /> : <LuPanelLeftClose className="text-foreground" size={18} />}
          </Button>
          {renderBreadcrumbs()}
        </div>

        <div className="flex flex-row items-center gap-4">
          {canUserAccess("teamAdmin", team) ? (
            <Button
              className="bg-linear-to-tr from-primary-300 via-violet-200 to-secondary-300 shadow-md transition-all duration-300 hover:bg-linear-to-br dark:from-primary-500 dark:via-violet-500 dark:to-secondary-500"
              onPress={() => dispatch(toggleAiModal())}
              size="sm"
              startContent={<LuBrainCircuit size={18} />}
              variant="primary"
            >
              Ask your data
            </Button>
          ) : null}

          <Dropdown aria-label="Select a help option">
            <DropdownTrigger>
              <Button className="bg-transparent p-0" startContent={<LuHeartHandshake size={18} />} variant="ghost">
                Resources
              </Button>
            </DropdownTrigger>
            <DropdownMenu onAction={(key) => onDropdownAction(key)} variant="faded">
              <DropdownItem id="discord" key="discord" startContent={<TbBrandDiscord />} textValue="Join our Discord">
                Join our Discord
              </DropdownItem>
              <DropdownItem id="roadmap" key="roadmap" startContent={<LuSquareKanban />} textValue="Roadmap">
                Roadmap
              </DropdownItem>
              <DropdownItem id="tutorials" key="tutorials" startContent={<LuBook />} textValue="Blog tutorials">
                Blog tutorials
              </DropdownItem>
              <DropdownItem id="documentation" key="documentation" startContent={<LuBookOpenText />} textValue="Documentation">
                Documentation
              </DropdownItem>
              <DropdownItem id="api" key="api" startContent={<LuFileCode2 />} textValue="API Reference">
                API Reference
              </DropdownItem>
              <DropdownItem id="github" key="github" startContent={<LuGithub />} textValue="GitHub">
                GitHub
              </DropdownItem>
              <DropdownItem id="feedback" key="feedback" startContent={<LuSmile />} textValue="Feedback">
                Feedback
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button className="changelog-trigger mr-2" isIconOnly size="sm" title="Changelog" variant="ghost">
            <LuBell className="text-foreground" size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TopNav;
