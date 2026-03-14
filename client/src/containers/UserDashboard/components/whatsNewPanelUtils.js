import {
  LuBell,
  LuBookOpenText,
  LuBrainCircuit,
  LuChartNoAxesColumnIncreasing,
  LuDatabase,
  LuExternalLink,
  LuGauge,
  LuLayoutDashboard,
  LuWandSparkles,
  LuSlack,
  LuCalendar,
} from "react-icons/lu";

/**
 * @typedef {"newFeature"|"releaseHighlight"|"underusedCapability"|"tip"} WhatsNewItemType
 *
 * @typedef {Object} WhatsNewAction
 * @property {"internal"|"external"} type
 * @property {string=} target
 * @property {string=} label
 * @property {string=} actionKey
 * @property {boolean=} newTab
 *
 * @typedef {Object} WhatsNewItem
 * @property {string} id
 * @property {WhatsNewItemType} type
 * @property {string} title
 * @property {string} body
 * @property {string=} badge
 * @property {string=} icon
 * @property {string=} colorScheme
 * @property {string=} ctaLabel
 * @property {string=} timestampLabel
 * @property {string=} eyebrow
 * @property {"tip"=} variant
 * @property {WhatsNewAction=} action
 */

export const PANEL_GROUPS = [
  {
    key: "features",
    title: "New features",
    type: "newFeature",
  },
  {
    key: "releaseHighlights",
    title: "Release highlights",
    type: "releaseHighlight",
  },
  {
    key: "underusedCapabilities",
    title: "Underused capabilities",
    type: "underusedCapability",
  },
];

export const ICON_REGISTRY = {
  bell: LuBell,
  book: LuBookOpenText,
  brain: LuBrainCircuit,
  chart: LuChartNoAxesColumnIncreasing,
  dashboard: LuLayoutDashboard,
  data: LuDatabase,
  database: LuDatabase,
  external: LuExternalLink,
  gauge: LuGauge,
  sparkles: LuWandSparkles,
  wand: LuWandSparkles,
  slack: LuSlack,
  calendar: LuCalendar,
};

export const COLOR_SCHEMES = {
  default: {
    icon: "bg-content2 text-foreground-700",
    badge: "default",
    card: "border-divider",
  },
  primary: {
    icon: "bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300",
    badge: "primary",
    card: "border-divider/70",
  },
  secondary: {
    icon: "bg-secondary-50 text-secondary-600 dark:bg-secondary-500/15 dark:text-secondary-300",
    badge: "secondary",
    card: "border-divider/70",
  },
  success: {
    icon: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300",
    badge: "success",
    card: "border-divider/70",
  },
  warning: {
    icon: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300",
    badge: "warning",
    card: "border-divider/70",
  },
  tip: {
    icon: "bg-foreground/15 text-foreground",
    badge: "secondary",
    card: "border-transparent",
    tipCard: "border-0 bg-linear-to-br from-primary/20 via-background to-primary/10 text-foreground-700 shadow-lg",
    tipButton: "",
  },
};

function normalizeAction(action) {
  if (!action || typeof action !== "object") return null;
  const normalizedAction = {
    type: typeof action.type === "string" ? action.type : "",
    target: typeof action.target === "string" ? action.target : "",
    label: typeof action.label === "string" ? action.label : "",
    actionKey: typeof action.actionKey === "string" ? action.actionKey : "",
    newTab: typeof action.newTab === "boolean" ? action.newTab : undefined,
  };

  if (!["internal", "external"].includes(normalizedAction.type)) {
    return null;
  }

  if (!normalizedAction.target && !normalizedAction.actionKey) {
    return null;
  }

  return normalizedAction;
}

function normalizeItem(item, expectedType) {
  if (!item || typeof item !== "object") return null;

  const id = typeof item.id === "string" ? item.id.trim() : "";
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const body = typeof item.body === "string" ? item.body.trim() : "";
  const type = typeof item.type === "string" ? item.type : expectedType;

  if (!id || !title || !body || type !== expectedType) return null;

  return {
    id,
    type,
    title,
    body,
    badge: typeof item.badge === "string" ? item.badge.trim() : "",
    icon: typeof item.icon === "string" ? item.icon.trim() : "",
    colorScheme: typeof item.colorScheme === "string" ? item.colorScheme : "default",
    ctaLabel: typeof item.ctaLabel === "string" ? item.ctaLabel.trim() : "",
    timestampLabel: typeof item.timestampLabel === "string" ? item.timestampLabel.trim() : "",
    eyebrow: typeof item.eyebrow === "string" ? item.eyebrow.trim() : "",
    variant: item.variant === "tip" ? "tip" : undefined,
    action: normalizeAction(item.action),
  };
}

function normalizeGroup(items, expectedType) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeItem(item, expectedType))
    .filter(Boolean);
}

export function normalizeWhatsNewContent(rawContent) {
  const safeContent = rawContent && typeof rawContent === "object" ? rawContent : {};
  const groupedContent = PANEL_GROUPS.map((group) => ({
    ...group,
    items: normalizeGroup(safeContent[group.key], group.type),
  })).filter((group) => group.items.length > 0);

  const tip = normalizeItem(safeContent.tip, "tip");

  return {
    groups: groupedContent,
    tip,
  };
}

export function getTone(colorScheme) {
  return COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default;
}

export function getIconComponent(iconName) {
  return ICON_REGISTRY[iconName] || null;
}
