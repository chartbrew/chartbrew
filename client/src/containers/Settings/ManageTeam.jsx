import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import {
  ProgressCircle,
  Tabs
} from "@heroui/react";
import { LuCode, LuSettings, LuShieldCheck, LuUser } from "react-icons/lu";

import { selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import Container from "../../components/Container";
import Row from "../../components/Row";
import { selectUser } from "../../slices/user";
import ManageUser from "./ManageUser";
import TeamSettings from "./TeamSettings";
import ApiKeys from "../ApiKeys/ApiKeys";
import PlatformSettings from "./PlatformSettings";

/*
  Manage team settings and members
*/
function ManageTeam() {
  const [activeMenu, setActiveMenu] = useState("profile");

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const navigate = useNavigate();

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  useEffect(() => {
    setActiveMenu(window.location.pathname.split("/").pop());
  }, [window.location.pathname]);

  const _onMenuChange = (key) => {
    navigate(`/settings/${key}`);
  };

  if (!team.id) {
    return (
      <Container size="sm" justify="center" style={{ paddingTop: 100 }}>
        <Row justify="center" align="center">
          <ProgressCircle aria-label="Loading your team" size="lg">Loading your team</ProgressCircle>
        </Row>
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-semibold font-tw">
          Settings
        </div>
        <div className="text-sm text-gray-500">
          Manage your account and team settings
        </div>
      </div>
      <div className="h-8" />
      <Tabs
        className="w-fit self-start"
        onSelectionChange={_onMenuChange}
        selectedKey={activeMenu}
      >
        <Tabs.ListContainer className="w-fit">
          <Tabs.List
            aria-label="Settings sections"
            className="w-fit flex-nowrap *:w-fit *:shrink-0 *:whitespace-nowrap"
          >
            <Tabs.Tab id="profile">
              <Tabs.Indicator />
              <div className="flex flex-row items-center gap-2">
                <LuUser />
                <div>Profile</div>
              </div>
            </Tabs.Tab>
            {_canAccess("teamAdmin") && (
              <Tabs.Tab id="team">
                <Tabs.Indicator />
                <div className="flex flex-row items-center gap-2">
                  <LuSettings />
                  <div>Team</div>
                </div>
              </Tabs.Tab>
            )}
            {_canAccess("teamAdmin") && (
              <Tabs.Tab id="api-keys">
                <Tabs.Indicator />
                <div className="flex flex-row items-center gap-2">
                  <LuCode />
                  <div>API Keys</div>
                </div>
              </Tabs.Tab>
            )}
            {user.admin === true && (
              <Tabs.Tab id="platform">
                <Tabs.Indicator />
                <div className="flex flex-row items-center gap-2">
                  <LuShieldCheck />
                  <div>Platform</div>
                </div>
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="mt-4">
        <Routes>
          <Route path="profile" element={<ManageUser />} />
          <Route
            path="team"
            element={_canAccess("teamAdmin")
              ? <TeamSettings />
              : <Navigate replace to="/settings/profile" />}
          />
          <Route
            path="members"
            element={<Navigate replace to={_canAccess("teamAdmin")
              ? "/settings/team"
              : "/settings/profile"} />}
          />
          <Route path="api-keys" element={<ApiKeys />} />
          {user.admin === true && (
            <Route path="platform" element={<PlatformSettings />} />
          )}
        </Routes>
      </div>
    </div>
  );
}

export default ManageTeam;
