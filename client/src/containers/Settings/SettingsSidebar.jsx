import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Avatar } from "@heroui/react";
import { NavLink, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import {
  LuArrowLeft,
  LuBrainCircuit,
  LuBriefcaseBusiness,
  LuCode,
  LuSettings,
  LuShieldCheck,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import { VscMcp } from "react-icons/vsc";

import canAccess from "../../config/canAccess";
import { cn } from "../../modules/utils";
import { getBusinessProfileLogo, selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";

const ACCOUNT_ITEMS = [{
  icon: LuUser,
  label: "Profile",
  path: "/settings/profile",
}, {
  icon: VscMcp,
  label: "MCP",
  path: "/settings/mcp",
}];

const TEAM_ITEMS = [{
  icon: LuSettings,
  label: "Team settings",
  path: "/settings/team",
}, {
  icon: LuBriefcaseBusiness,
  label: "Business profile",
  path: "/settings/team/business-profile",
}, {
  icon: LuUsers,
  label: "Team members",
  path: "/settings/team/members",
}, {
  icon: LuBrainCircuit,
  label: "AI settings",
  path: "/settings/team/ai",
}, {
  icon: LuCode,
  label: "API keys",
  path: "/settings/team/api-keys",
}];

const PLATFORM_ITEMS = [{
  icon: LuShieldCheck,
  label: "Platform settings",
  path: "/settings/platform",
}];

function SettingsLink({ item }) {
  const Icon = item.icon;

  return (
    <NavLink
      className={({ isActive }) => cn(
        "flex min-h-9 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium !text-foreground transition-colors",
        "hover:bg-default-100 hover:!text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        isActive && "bg-default-100 !text-accent hover:!text-accent"
      )}
      end
      to={item.path}
    >
      <Icon aria-hidden className="shrink-0" size={18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

SettingsLink.propTypes = {
  item: PropTypes.shape({
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
  }).isRequired,
};

function SettingsGroup({ items, label }) {
  return (
    <div className="contents md:flex md:flex-col md:gap-1">
      <div className="mb-1 hidden px-3 text-[11px] font-medium uppercase tracking-wide text-default-400 md:block">
        {label}
      </div>
      {items.map((item) => <SettingsLink item={item} key={item.path} />)}
    </div>
  );
}

SettingsGroup.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
  })).isRequired,
  label: PropTypes.string.isRequired,
};

function SettingsSidebar() {
  const [logoUrl, setLogoUrl] = useState(null);
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const teamInitials = team?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "T";
  const canManageTeam = canAccess("teamAdmin", user.id, team.TeamRoles);

  useEffect(() => {
    let active = true;
    setLogoUrl(null);

    if (!team.TeamBusinessProfile?.logoMimeType) return () => { active = false; };

    getBusinessProfileLogo(team.id)
      .then((url) => {
        if (active) setLogoUrl(url);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [team.TeamBusinessProfile?.logoMimeType, team.id]);

  return (
    <aside className="relative z-40 w-full border-b border-divider bg-surface md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col">
        <button
          aria-label="Back to Chartbrew"
          className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-default-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent border-b border-divider cursor-pointer"
          onClick={() => navigate("/")}
          type="button"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar size="sm" className="rounded-lg bg-transparent w-6 h-6">
              {logoUrl ? <Avatar.Image alt="" src={logoUrl} /> : null}
              <Avatar.Fallback className="rounded-lg">{teamInitials}</Avatar.Fallback>
            </Avatar>
            <span className="truncate font-semibold text-sm">{team.name}</span>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-normal text-default-400 transition-colors group-hover:text-default-600">
            <LuArrowLeft aria-hidden size={16} />
            Back
          </span>
        </button>

        <nav
          aria-label="Settings"
          className="flex gap-1 overflow-x-auto p-2 mt-2 md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:px-3 md:py-2"
        >
          <SettingsGroup items={ACCOUNT_ITEMS} label="Account" />
          <SettingsGroup items={canManageTeam ? TEAM_ITEMS : TEAM_ITEMS.filter((item) => item.path === "/settings/team/ai")} label="Team" />
          {user.admin === true ? <SettingsGroup items={PLATFORM_ITEMS} label="Platform" /> : null}
        </nav>
      </div>
    </aside>
  );
}

export default SettingsSidebar;
