import React from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { ProgressCircle } from "@heroui/react";

import { selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import { cn } from "../../modules/utils";
import ManageUser from "./ManageUser";
import TeamSettings from "./TeamSettings";
import ApiKeys from "../ApiKeys/ApiKeys";
import PlatformSettings from "./PlatformSettings";
import BusinessProfileSettings from "./BusinessProfileSettings";
import TeamMembers from "./TeamMembers";
import TeamAiSettings from "./TeamAiSettings";
import AiMemorySettings from "./AiMemorySettings";

function SettingsPage({ children, title, wide = false }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-6", wide ? "max-w-5xl" : "max-w-3xl")}>
      <h1 className="font-tw text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

SettingsPage.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  wide: PropTypes.bool,
};

function RedirectWithSearch({ to }) {
  const location = useLocation();
  return <Navigate replace to={`${to}${location.search}`} />;
}

RedirectWithSearch.propTypes = {
  to: PropTypes.string.isRequired,
};

function TeamSettingsRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  if (params.get("enableAi") === "team") {
    return <Navigate replace to={`/settings/team/ai${location.search}`} />;
  }

  return (
    <SettingsPage title="Team settings">
      <TeamSettings />
    </SettingsPage>
  );
}

function ManageTeam() {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  if (!team.id) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <ProgressCircle aria-label="Loading your team" size="lg" />
      </div>
    );
  }

  const canManageTeam = canAccess("teamAdmin", user.id, team.TeamRoles);
  const defaultPath = canManageTeam ? "/settings/team" : "/settings/profile";

  return (
    <Routes>
      <Route index element={<Navigate replace to={defaultPath} />} />
      <Route
        path="profile"
        element={(
          <SettingsPage title="Profile">
            <ManageUser />
          </SettingsPage>
        )}
      />

      <Route
        path="team"
        element={canManageTeam ? <TeamSettingsRoute /> : <Navigate replace to="/settings/profile" />}
      />
      <Route
        path="team/business-profile"
        element={canManageTeam ? (
          <SettingsPage title="Business profile">
            <section className="rounded-3xl border border-divider bg-surface p-4">
              <BusinessProfileSettings />
            </section>
          </SettingsPage>
        ) : <Navigate replace to="/settings/profile" />}
      />
      <Route
        path="team/members"
        element={canManageTeam ? (
          <SettingsPage title="Team members" wide>
            <TeamMembers />
          </SettingsPage>
        ) : <Navigate replace to="/settings/profile" />}
      />
      <Route
        path="team/ai"
        element={(
          <SettingsPage title="AI settings">
            {canManageTeam && <TeamAiSettings />}
            <AiMemorySettings key={`${team.id}:${user.id}`} />
          </SettingsPage>
        )}
      />
      <Route
        path="team/api-keys"
        element={canManageTeam ? (
          <SettingsPage title="API keys" wide>
            <ApiKeys />
          </SettingsPage>
        ) : <Navigate replace to="/settings/profile" />}
      />

      <Route path="members" element={<RedirectWithSearch to="/settings/team/members" />} />
      <Route path="api-keys" element={<RedirectWithSearch to="/settings/team/api-keys" />} />

      <Route
        path="platform"
        element={user.admin === true ? (
          <SettingsPage title="Platform settings" wide>
            <PlatformSettings />
          </SettingsPage>
        ) : <Navigate replace to={defaultPath} />}
      />
      <Route path="*" element={<Navigate replace to={defaultPath} />} />
    </Routes>
  );
}

export default ManageTeam;
