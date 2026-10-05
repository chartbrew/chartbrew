import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import {
  LuActivity,
  LuBriefcaseBusiness,
  LuBuilding2,
  LuCalendarDays,
  LuChartNoAxesColumnIncreasing,
  LuChartLine,
  LuChartPie,
  LuCheck,
  LuDatabase,
  LuGlobe,
  LuLayoutGrid,
  LuMegaphone,
  LuMonitor,
  LuPackage,
  LuShieldCheck,
  LuShoppingBag,
  LuTarget,
  LuTrendingUp,
  LuUsers,
  LuWallet,
  LuZap,
} from "react-icons/lu";

import shortcutOptions from "../../../shared/dashboard/shortcut-options.json";
import { chartColors, neutral } from "../config/colors";
import { API_HOST } from "../config/settings";
import { cn } from "../modules/utils";

const icons = {
  grid: { label: "Grid", component: LuLayoutGrid },
  chart: { label: "Chart", component: LuChartNoAxesColumnIncreasing },
  pie: { label: "Pie chart", component: LuChartPie },
  briefcase: { label: "Work", component: LuBriefcaseBusiness },
  people: { label: "People", component: LuUsers },
  shop: { label: "Shop", component: LuShoppingBag },
  target: { label: "Target", component: LuTarget },
  database: { label: "Data", component: LuDatabase },
  activity: { label: "Activity", component: LuActivity },
  line: { label: "Line chart", component: LuChartLine },
  calendar: { label: "Calendar", component: LuCalendarDays },
  wallet: { label: "Finance", component: LuWallet },
  globe: { label: "World", component: LuGlobe },
  package: { label: "Products", component: LuPackage },
  megaphone: { label: "Marketing", component: LuMegaphone },
  trending: { label: "Growth", component: LuTrendingUp },
  building: { label: "Company", component: LuBuilding2 },
  monitor: { label: "Website", component: LuMonitor },
  shield: { label: "Security", component: LuShieldCheck },
  zap: { label: "Performance", component: LuZap },
};

const colorLabels = {
  neutral: "Neutral",
  blue: "Blue",
  orange: "Orange",
  green: "Green",
  purple: "Purple",
  rose: "Rose",
  slate: "Slate",
  teal: "Teal",
  amber: "Amber",
  fuchsia: "Fuchsia",
  deep_fuchsia: "Deep fuchsia",
  pink: "Pink",
  lime: "Lime",
};

const getShortcutColor = (id) => {
  if (id === "neutral") return "var(--foreground)";
  return id === "slate" ? neutral : (chartColors[id]?.hex || chartColors.blue.hex);
};

export function DashboardShortcutMark({ project, size = "sm" }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const large = size === "lg";
  const logo = project.logo ? `${API_HOST}/${project.logo}` : null;
  const showLogo = project.sidebarDisplay === "logo" && logo && !logoFailed;
  const Icon = icons[project.sidebarIcon]?.component || LuLayoutGrid;
  const color = getShortcutColor(project.sidebarColor);
  const backgroundColor = `color-mix(in srgb, ${color} 14%, transparent)`;

  useEffect(() => setLogoFailed(false), [logo]);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md", large ? "size-9" : "size-6")}
      style={showLogo ? undefined : { backgroundColor }}
    >
      {showLogo ? (
        <img src={logo} alt="" className={cn("object-contain", large ? "size-9" : "size-6")} onError={() => setLogoFailed(true)} />
      ) : (
        <Icon size={large ? 20 : 16} style={{ color: `color-mix(in srgb, ${color} 70%, var(--foreground))` }} />
      )}
    </span>
  );
}

DashboardShortcutMark.propTypes = {
  project: PropTypes.object.isRequired,
  size: PropTypes.oneOf(["sm", "lg"]),
};

function DashboardShortcutAppearance({ value, onChange, logo, disabled = false }) {
  const [showMoreIcons, setShowMoreIcons] = useState(() => shortcutOptions.icons.indexOf(value.sidebarIcon) >= 10);
  const select = (field, next) => onChange({ ...value, [field]: next });
  const availableColors = shortcutOptions.colors.filter((id) => id !== "slate" || value.sidebarColor === "slate");

  useEffect(() => {
    if (shortcutOptions.icons.indexOf(value.sidebarIcon) >= 10) setShowMoreIcons(true);
  }, [value.sidebarIcon]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Shortcut icon</span>
        <div role="group" aria-label="Shortcut icon" className="flex flex-wrap gap-1">
          {(showMoreIcons ? shortcutOptions.icons : shortcutOptions.icons.slice(0, 10)).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="secondary"
              isIconOnly
              isDisabled={disabled}
              aria-label={icons[id].label}
              aria-pressed={(value.sidebarIcon || "grid") === id}
              className={cn("size-8 rounded-md! bg-transparent! p-0", (value.sidebarIcon || "grid") === id && "ring-2 ring-accent")}
              onPress={() => select("sidebarIcon", id)}
            >
              <DashboardShortcutMark project={{ sidebarIcon: id, sidebarColor: value.sidebarColor }} />
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" className="self-start" onPress={() => setShowMoreIcons(!showMoreIcons)}>
            {showMoreIcons ? "Close" : "More"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Icon color</span>
        <div role="group" aria-label="Icon color" className="flex flex-wrap gap-2">
          {availableColors.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="secondary"
              isIconOnly
              isDisabled={disabled}
              aria-label={colorLabels[id]}
              aria-pressed={(value.sidebarColor || "blue") === id}
              className={cn("size-9", (value.sidebarColor || "blue") === id && "ring-2 ring-accent")}
              onPress={() => select("sidebarColor", id)}
            >
              <span className="flex size-6 items-center justify-center rounded-full" style={{ backgroundColor: getShortcutColor(id) }}>
                {(value.sidebarColor || "blue") === id && (
                  <LuCheck size={15} color={id === "neutral" ? "var(--background)" : "white"} aria-hidden="true" />
                )}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {logo && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Show in sidebar</span>
          <div role="group" aria-label="Show in sidebar" className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              aria-pressed={value.sidebarDisplay !== "logo"}
              className={cn(value.sidebarDisplay !== "logo" && "ring-2 ring-accent")}
              onPress={() => select("sidebarDisplay", "icon")}
            >
              <DashboardShortcutMark project={{ ...value, sidebarDisplay: "icon" }} />
              Icon
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              aria-pressed={value.sidebarDisplay === "logo"}
              className={cn(value.sidebarDisplay === "logo" && "ring-2 ring-accent")}
              onPress={() => select("sidebarDisplay", "logo")}
            >
              <DashboardShortcutMark project={{ ...value, logo, sidebarDisplay: "logo" }} />
              Logo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

DashboardShortcutAppearance.propTypes = {
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  logo: PropTypes.string,
  disabled: PropTypes.bool,
};

export default DashboardShortcutAppearance;
