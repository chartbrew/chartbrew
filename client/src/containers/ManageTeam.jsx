import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useNavigate, useParams } from "react-router";
import {
  CircularProgress, Listbox, ListboxSection, ListboxItem, Spacer,
  Select,
  SelectItem,
} from "@heroui/react";
import { LuCode, LuSettings, LuUsers } from "react-icons/lu";

import { getTeam, saveActiveTeam, selectTeam, selectTeams } from "../slices/team";
import Navbar from "../components/Navbar";
import canAccess from "../config/canAccess";
import Container from "../components/Container";
import Row from "../components/Row";
import { getProjects } from "../slices/project";
import { selectUser } from "../slices/user";

/*
  Description
*/
function ManageTeam() {
  const [loading, setLoading] = useState(true);

  const teams = useSelector(selectTeams);
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    _getTeam();
  }, []);

  const _getTeam = () => {
    dispatch(getTeam(params.teamId))
      .then((team) => {
        dispatch(saveActiveTeam(team.payload));
        dispatch(getProjects({ team_id: team.payload.id }));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const checkActive = () => {
    if (window.location.pathname.indexOf("members") > -1) return "members";
    if (window.location.pathname.indexOf("settings") > -1) return "settings";
    if (window.location.pathname.indexOf("payment") > -1) return "payment";
    if (window.location.pathname.indexOf("api-keys") > -1) return "api-keys";
      
    return false;
  };

  const _onMenuSelect = (key) => {
    if (key === "members") {
      navigate(`/manage/${params.teamId}/members`);
    }
    if (key === "settings") {
      navigate(`/manage/${params.teamId}/settings`);
    }
    if (key === "api-keys") {
      navigate(`/manage/${params.teamId}/api-keys`);
    }
  }

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _onTeamSelect = (teamId) => {
    const selectedTeam = teams.find((t) => t.id === parseInt(teamId, 10));
    if (selectedTeam) {
      dispatch(saveActiveTeam(selectedTeam));
      const path = window.location.pathname.split("/").pop();
      window.location.href = `/manage/${selectedTeam.id}/${path}`;
    }
  };

  if (!team.id || loading) {
    return (
      <Container size="sm" justify="center" style={{ paddingTop: 100 }}>
        <Row justify="center" align="center">
          <CircularProgress aria-label="Loading your team" size="lg">Loading your team</CircularProgress>
        </Row>
      </Container>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="grid grid-cols-12 gap-4 container mx-auto">
        <div className="col-span-12 sm:col-span-4 md:col-span-2">
          <div className="pt-4">
            <Select
              // label="Your selected team"
              selectedKeys={[`${team.id}`]}
              onSelectionChange={(keys) => _onTeamSelect(keys.currentKey)}
              selectionMode="single"
              variant="faded"
              className="p-0"
              aria-label="Select a team option"
              size="lg"
            >
              {teams.map((t) => (
                <SelectItem key={t.id} textValue={t.name}>{t.name}</SelectItem>
              ))}
            </Select>
            <Spacer y={4} />
            <Listbox
              selectedKeys={[checkActive()]}
              onSelectionChange={(keys) => _onMenuSelect(keys.currentKey) }
              selectionMode="single"
              variant="faded"
              className="p-0"
              aria-label="Select a team option"
            >
              <ListboxSection title="Manage the team" className="p-0" classNames={{ heading: "p-0 text-sm" }}>
                {_canAccess("teamOwner") && (
                  <ListboxItem key="settings" startContent={<LuSettings size={24} />} classNames={{ title: "text-lg" }}>
                    Settings
                  </ListboxItem>
                )}
                <ListboxItem key="members" startContent={<LuUsers size={24} />} classNames={{ title: "text-lg" }}>
                  Members
                </ListboxItem>
              </ListboxSection>
              {_canAccess("teamAdmin") && (
                <ListboxSection title="Developers" classNames={{ heading: "p-0 text-sm" }}>
                  <ListboxItem key="api-keys" startContent={<LuCode size={24} />} classNames={{ title: "text-lg" }}>
                    API Keys
                  </ListboxItem>
                </ListboxSection>
              )}
            </Listbox>
          </div>
        </div>

        <div className="col-span-12 sm:col-span-8 md:col-span-10">
          <div className="container mx-auto py-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManageTeam;
