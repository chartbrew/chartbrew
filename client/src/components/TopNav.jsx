import React, { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { TbBrandDiscord } from "react-icons/tb";
import { useNavigate, useLocation, useParams } from "react-router";
import { LuBell, LuBook, LuBookOpenText, LuBrainCircuit, LuFileCode2, LuGithub, LuHeartHandshake, LuPanelLeftClose, LuPanelLeftOpen, LuSmile, LuSquareKanban } from "react-icons/lu";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Breadcrumbs, BreadcrumbItem } from "@heroui/react";

import { selectSidebarCollapsed, showFeedbackModal, toggleAiModal, toggleSidebar } from "../slices/ui";
import canAccess from "../config/canAccess";
import { selectUser } from "../slices/user";
import { selectTeam } from "../slices/team";
import { selectProject } from "../slices/project";
import { selectChart } from "../slices/chart";

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

  useEffect(() => {
    try {
      const newHwConfig = {
        selector: ".changelog-trigger", // CSS selector where to inject the badge
        // trigger: ".changelog-trigger",
        account: "JVODWy",
      }
      Headway.init(newHwConfig);
    } catch (e) {
      // ---
    }
  }, []);

  const _canAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }
    return canAccess(role, user.id, team.TeamRoles);
  };

  const isOnDashboard = () => {
    return location.pathname.startsWith("/dashboard/");
  };

  const _onDropdownAction = (key) => {
    switch (key) {
      case "discord": {
        window.open("https://discord.gg/KwGEbFk", "_blank");
        break;
      }
      case "tutorials": {
        window.open("https://chartbrew.com/blog/tag/tutorial/", "_blank");
        break;
      }
      case "documentation": {
        window.open("https://docs.chartbrew.com", "_blank");
        break;
      }
      case "github": {
        window.open("https://github.com/chartbrew/chartbrew/discussions", "_blank");
        break;
      }
      case "feedback": {
        dispatch(showFeedbackModal());
        break;
      }
      case "profile": {
        navigate("/user/profile");
        break;
      }
      case "roadmap": {
        window.open("https://chartbrew.com/roadmap", "_blank");
        break;
      }
      case "api": {
        window.open("https://docs.chartbrew.com/api-reference/introduction", "_blank");
        break;
      }
      default: {
        break;
      }
    }
  }

  return (
    <div className="w-full bg-content1 border-b border-divider p-2 sticky top-0 z-50">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-3">
          {collapsed ? (
            <Button isIconOnly variant="light" color="default" onPress={() => dispatch(toggleSidebar())}>
              <LuPanelLeftOpen size={18} className="text-foreground" />
            </Button>
          ) : (
            <Button isIconOnly variant="light" color="default" onPress={() => dispatch(toggleSidebar())}>
              <LuPanelLeftClose size={18} className="text-foreground" />
            </Button>
          )}

          {isOnDashboard() && project?.name && (
            <Breadcrumbs>
              <BreadcrumbItem onPress={() => navigate("/")}>
                Dashboard
              </BreadcrumbItem>
              <BreadcrumbItem onPress={() => navigate(`/dashboard/${params.projectId}`)} isCurrent={!params.chartId}>{project.name}</BreadcrumbItem>
              {params.chartId && (
                <BreadcrumbItem isCurrent={true}>{chart?.name}</BreadcrumbItem>
              )}
            </Breadcrumbs>
          )}
        </div>
        <div className="flex flex-row items-center gap-4">
          {_canAccess("teamAdmin", team) && (
            <Button
              variant="solid"
              onPress={() => dispatch(toggleAiModal())}
              startContent={<LuBrainCircuit size={18} />}
              size="sm"
              className="from-primary-300 via-violet-200 to-secondary-300 dark:from-primary-500 dark:via-violet-500 dark:to-secondary-500 bg-linear-to-tr hover:bg-linear-to-br transition-all duration-300 shadow-md"
            >
              Ask Chartbrew AI
            </Button>
          )}

          <Dropdown aria-label="Select a help option">
            <DropdownTrigger>
              <Button
                variant="light"
                disableRipple
                className="p-0 bg-transparent data-[hover=true]:bg-transparent"
                startContent={<LuHeartHandshake size={18} />}
                radius="sm"
              >
                Resources
              </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" onAction={(key) => _onDropdownAction(key)}>
              <DropdownItem startContent={<TbBrandDiscord />} key="discord" textValue="Join our Discord">
                {"Join our Discord"}
              </DropdownItem>
              <DropdownItem startContent={<LuSquareKanban />} key="roadmap" textValue="Roadmap">
                {"Roadmap"}
              </DropdownItem>
              <DropdownItem startContent={<LuBook />} key="tutorials" textValue="Blog tutorials">
                {"Blog tutorials"}
              </DropdownItem>
              <DropdownItem startContent={<LuBookOpenText />} key="documentation" textValue="Documentation">
                {"Documentation"}
              </DropdownItem>
              <DropdownItem startContent={<LuFileCode2 />} key="api" textValue="API Reference">
                {"API Reference"}
              </DropdownItem>
              <DropdownItem startContent={<LuGithub />} key="github" textValue="GitHub">
                {"GitHub"}
              </DropdownItem>
              <DropdownItem startContent={<LuSmile />} key="feedback" textValue="Feedback">
                {"Feedback"}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button
            isIconOnly
            variant="light"
            className="changelog-trigger mr-2"
            title="Changelog"
            size="sm"
          >
            <LuBell size={18} className="text-foreground" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TopNav
