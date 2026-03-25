import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Route, Routes, useNavigate } from "react-router";
import {
  ProgressCircle,
  Tabs
} from "@heroui/react";
import { LuCode, LuSettings, LuUser, LuUsers } from "react-icons/lu";

import { selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import Container from "../../components/Container";
import Row from "../../components/Row";
import { selectUser } from "../../slices/user";
import ManageUser from "./ManageUser";
import TeamSettings from "./TeamSettings";
import TeamMembers from "./TeamMembers";
import ApiKeys from "../ApiKeys/ApiKeys";

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
        onSelectionChange={_onMenuChange}
        selectedKey={activeMenu}
      >
        <Tabs.ListContainer>
          <Tabs.List className="border-1 border-divider">
            <Tabs.Tab id="profile">
              <div className="flex flex-row items-center gap-2">
                <LuUser />
                <div>Profile</div>
              </div>
            </Tabs.Tab>
            {_canAccess("teamOwner") && (
              <Tabs.Tab id="team">
                <div className="flex flex-row items-center gap-2">
                  <LuSettings />
                  <div>Team</div>
                </div>
              </Tabs.Tab>
            )}
            <Tabs.Tab id="members">
              <div className="flex flex-row items-center gap-2">
                <LuUsers />
                <div>Members</div>
              </div>
            </Tabs.Tab>
            {_canAccess("teamAdmin") && (
              <Tabs.Tab id="api-keys">
                <div className="flex flex-row items-center gap-2">
                  <LuCode />
                  <div>API Keys</div>
                </div>
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="mt-4">
        <Routes>
          <Route path="profile" element={<ManageUser />} />
          <Route path="team" element={<TeamSettings />} />
          <Route path="members" element={<TeamMembers />} />
          <Route path="api-keys" element={<ApiKeys />} />
        </Routes>
      </div>
    </div>
  );
}

export default ManageTeam;
