import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { TbBrandDiscord } from "react-icons/tb";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  LuInbox,
  LuBook,
  LuBookOpenText,
  LuBrainCircuit,
  LuFileCode2,
  LuExternalLink,
  LuGithub,
  LuHeartHandshake,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuSmile,
  LuSquareKanban,
} from "react-icons/lu";
import { Badge, Breadcrumbs, Button, Chip, Dropdown, Popover, Separator } from "@heroui/react";

import { selectSidebarCollapsed, showFeedbackModal, toggleAiModal, toggleSidebar } from "../slices/ui";
import canAccess from "../config/canAccess";
import { selectUser } from "../slices/user";
import { selectTeam } from "../slices/team";
import { selectProject } from "../slices/project";
import { selectChart } from "../slices/chart";
import { selectIntegrations } from "../slices/integration";
import getDatasetDisplayName from "../modules/getDatasetDisplayName";
import {
  getNewsFeedUrl,
  getSeenNewsIds,
  getUnreadNewsItems,
  normalizeNewsFeed,
  saveSeenNewsIds,
} from "../modules/newsFeed";

const newsDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatNewsDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return newsDateFormatter.format(date);
}

function formatContentType(value) {
  const label = String(value || "blog").trim().replace(/[-_]+/g, " ");

  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getContentTypeChipColor(value) {
  const type = String(value || "").toLowerCase();

  if (type.includes("update")) return "accent";
  if (type.includes("tutorial") || type.includes("guide")) return "success";
  if (type.includes("release")) return "warning";

  return "default";
}

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
  const [newsItems, setNewsItems] = useState([]);
  const [seenNewsIds, setSeenNewsIds] = useState(() => getSeenNewsIds());
  const [newsOpen, setNewsOpen] = useState(false);

  useEffect(() => {
    const newsFeedUrl = getNewsFeedUrl();

    if (!newsFeedUrl) return undefined;

    const controller = new AbortController();

    fetch(newsFeedUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((feed) => {
        const normalizedItems = normalizeNewsFeed(feed);
        setNewsItems(normalizedItems);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setNewsItems([]);
        }
      });

    return () => controller.abort();
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
    const datasetName = getDatasetDisplayName(dataset);

    if (isOnDashboard() && project?.name) {
      items.push({ label: "Dashboards", onPress: () => navigate("/") });
      items.push({ label: project.name, onPress: () => navigate(`/dashboard/${params.projectId}`) });
      if (location.pathname.includes("chart") && !params.chartId) items.push({ label: "New chart", onPress: null });
      if (params.chartId) items.push({ label: chart?.name || "Chart", onPress: null });
      if (location.pathname.includes("settings")) items.push({ label: "Settings", onPress: null });
    } else if (isOnConnections()) {
      items.push({ label: "Connections", onPress: () => navigate("/connections") });
      if (connection?.name) items.push({ label: connection.name, onPress: () => navigate(`/connections/${params.connectionId}`) });
      if (params.connectionId === "new") items.push({ label: "New connection", onPress: null });
      if (location.pathname.includes("templates")) items.push({ label: "Templates", onPress: null });
    } else if (isOnDatasets()) {
      items.push({ label: "Datasets", onPress: () => navigate("/datasets") });
      if (datasetName) items.push({ label: datasetName, onPress: null });
      if (params.datasetId === "new") items.push({ label: "New dataset", onPress: null });
    } else if (isOnIntegrations()) {
      items.push({ label: "Integrations", onPress: () => navigate("/integrations") });
      if (params.integrationId) {
        items.push({ label: integrations?.find((item) => item.id === params.integrationId)?.name || "Integration", onPress: null });
      }
    }

    if (!items.length) return null;

    return (
      <Breadcrumbs
        aria-label="Breadcrumb"
        className="text-sm"
      >
        {items.map((item, index) => (
          <Breadcrumbs.Item
            key={`${item.label}-${index}`}
            onPress={item.onPress || undefined}
          >
            {item.label}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
    );
  };

  const askDataButtonClassName = "relative overflow-hidden border border-white/55 bg-linear-to-br from-primary-200/80 via-white/72 to-secondary-200/72 text-foreground shadow-[0_10px_22px_-18px_rgba(4,139,222,0.28)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow,transform,background] duration-200 hover:border-white/70 hover:shadow-[0_12px_24px_-18px_rgba(4,139,222,0.3)] active:scale-[0.99] dark:border-white/10 dark:bg-linear-to-br dark:from-primary-500/28 dark:via-content1/82 dark:to-secondary-500/22";
  const unreadNewsItems = getUnreadNewsItems(newsItems, seenNewsIds);

  const onNewsOpenChange = (open) => {
    setNewsOpen(open);

    if (!open || unreadNewsItems.length < 1) return;

    const nextSeenIds = Array.from(new Set([...seenNewsIds, ...newsItems.map((item) => item.id)]));
    saveSeenNewsIds(nextSeenIds);
    setSeenNewsIds(nextSeenIds);
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b border-divider bg-surface p-2">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-3">
          <Button isIconOnly onPress={() => dispatch(toggleSidebar())} variant="ghost">
            {collapsed ? <LuPanelLeftOpen className="text-foreground" size={18} /> : <LuPanelLeftClose className="text-foreground" size={18} />}
          </Button>
          {renderBreadcrumbs()}
        </div>

        <div className="flex flex-row items-center">
          {canUserAccess("teamAdmin", team) ? (
            <Button
              className={askDataButtonClassName}
              onPress={() => dispatch(toggleAiModal())}
              size="sm"
              variant="primary"
            >
              <LuBrainCircuit size={18} />
              Ask your data
            </Button>
          ) : null}

          <Dropdown aria-label="Select a help option">
            <Dropdown.Trigger>
              <Button className="bg-transparent" variant="ghost">
                <LuHeartHandshake size={18} />
                Resources
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => onDropdownAction(key)}>
                <Dropdown.Item id="discord" textValue="Join our Discord">
                  <div className="flex flex-row items-center gap-2">
                    <TbBrandDiscord />
                    <span>Join our Discord</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="roadmap" textValue="Roadmap">
                  <div className="flex flex-row items-center gap-2">
                    <LuSquareKanban />
                    <span>Roadmap</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="tutorials" textValue="Blog tutorials">
                  <div className="flex flex-row items-center gap-2">
                    <LuBook />
                    <span>Blog tutorials</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="documentation" textValue="Documentation">
                  <div className="flex flex-row items-center gap-2">
                    <LuBookOpenText />
                    <span>Documentation</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="api" textValue="API Reference">
                  <div className="flex flex-row items-center gap-2">
                    <LuFileCode2 />
                    <span>API Reference</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="github" textValue="GitHub">
                  <div className="flex flex-row items-center gap-2">
                    <LuGithub />
                    <span>GitHub</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="feedback" textValue="Feedback">
                  <div className="flex flex-row items-center gap-2">
                    <LuSmile />
                    <span>Feedback</span>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {newsItems.length > 0 ? (
            <Popover isOpen={newsOpen} onOpenChange={onNewsOpenChange}>
              <Badge.Anchor>
                <Button
                  aria-label={unreadNewsItems.length ? `${unreadNewsItems.length} unread Chartbrew update${unreadNewsItems.length === 1 ? "" : "s"}` : "Chartbrew updates"}
                  className="p-0 mr-2"
                  isIconOnly
                  variant="ghost"
                  size="sm"
                >
                  <LuInbox size={18} />
                </Button>
                <Badge
                  color="danger"
                  hidden={unreadNewsItems.length === 0}
                  size="sm"
                >
                  <Badge.Label>{unreadNewsItems.length > 9 ? "9+" : unreadNewsItems.length}</Badge.Label>
                </Badge>
              </Badge.Anchor>
              <Popover.Content
                className="w-[calc(100vw-24px)] max-w-lg p-0"
                offset={10}
                placement="bottom end"
                shouldFlip
              >
                <Popover.Dialog>
                  <div className="flex max-h-[min(720px,calc(100vh-96px))] flex-col overflow-hidden">
                    <div className="px-4 py-3">
                      <p className="font-semibold text-foreground">Latest from Chartbrew</p>
                      <p className="mt-1 text-xs text-muted">Recent posts, tutorials, and updates.</p>
                    </div>
                    <Separator />
                    <div className="min-h-0 overflow-y-auto p-3">
                      <div className="flex flex-col gap-3">
                        {newsItems.map((item) => (
                          <article
                            key={item.id}
                            className="overflow-hidden rounded-3xl border border-divider bg-content1"
                          >
                            {item.coverImage ? (
                              <a
                                href={item.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <img
                                  alt={item.coverImageAlt}
                                  className="aspect-video w-full bg-content2 object-cover transition-opacity hover:opacity-90"
                                  loading="lazy"
                                  src={item.coverImage}
                                />
                              </a>
                            ) : null}
                            <div className="p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Chip
                                  color={getContentTypeChipColor(item.category)}
                                  size="sm"
                                  variant="soft"
                                >
                                  <Chip.Label>{formatContentType(item.category)}</Chip.Label>
                                </Chip>
                                {item.tags.map((tag) => (
                                  <Chip
                                    key={`${item.id}-${tag}`}
                                    size="sm"
                                    variant="soft"
                                  >
                                    <Chip.Label>{formatContentType(tag)}</Chip.Label>
                                  </Chip>
                                ))}
                                {formatNewsDate(item.publishedAt) ? (
                                  <span className="text-xs text-foreground-400">{formatNewsDate(item.publishedAt)}</span>
                                ) : null}
                              </div>

                              <h3 className="mt-3 text-base font-semibold leading-6 text-foreground">
                                <a
                                  className="transition-colors hover:text-accent"
                                  href={item.url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {item.title}
                                </a>
                              </h3>
                              <p className="mt-2 text-sm leading-6 text-foreground-600">
                                {item.excerpt}
                              </p>

                              {item.url ? (
                                <Button
                                  className="mt-4"
                                  size="sm"
                                  variant="tertiary"
                                  onPress={() => window.open(item.url, "_blank")}
                                >
                                  Read more
                                  <LuExternalLink size={14} />
                                </Button>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default TopNav;
