import React, { useState } from "react"
import { Alert, Button, Select, SelectItem, Spacer } from "@heroui/react"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import { selectTeams, saveActiveTeam, selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import { API_HOST } from "../../../config/settings";
import { getAuthToken } from "../../../modules/auth";

function SlackAuth() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  const dispatch = useDispatch();
  const teams = useSelector(selectTeams);
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const navigate = useNavigate();

  const _getAdminTeams = () => {
    return teams.filter((team) => team.TeamRoles.some((role) => role.user_id === user.id && (role.role === "teamOwner" || role.role === "teamAdmin")));
  };

  const _onConnectSlack = async () => {
    const stateToken = new URLSearchParams(window.location.search).get("state");
    if (!stateToken) {
      toast.error("No state token found. Please try generating a new link in Slack.");
      return;
    }

    const response = await fetch(`${API_HOST}/apps/slack/auth/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        state_token: stateToken,
        team_id: selectedTeam.id,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to connect to Slack. Please try generating a new link in Slack.");
      return;
    }
    const result = await response.json();

    if (team?.id !== selectedTeam?.id) {
      dispatch(saveActiveTeam(selectedTeam));
    }

    toast.success("Successfully connected to Slack workspace");

    setTimeout(() => {
      setSelectedTeam(null);
      if (result?.integration_id) {
        navigate(`/integrations/${result.integration_id}`);
      } else {
        navigate("/integrations");
      }
    }, 1500);

  };

  return (
    <div>
      <div className="text-lg font-semibold font-tw">
        Authenticate Slack
      </div>
      <div className="text-sm text-foreground-500">
        {"Connect your Slack workspace to your Chartbrew team"}
      </div>

      <Spacer y={2} />

      {_getAdminTeams().length === 0 && (
        <Alert
          color="warning"
          variant="flat"
          title="You are not an admin of any teams"
          description="Please contact your administrator to authenticate this action."
        />
      )}

      {_getAdminTeams().length > 0 && (
        <>
          <Select
            label="Select a team to connect to Slack"
            placeholder="Click to select a team"
            selectedKeys={[`${selectedTeam?.id}`]}
            onSelectionChange={(keys) => setSelectedTeam(teams.find((team) => team.id == keys.currentKey))}
            selectionMode="single"
            className="p-0"
            aria-label="Select a team option"
            size="lg"
            description="Only the teams you are an admin of will be shown"
          >
            {_getAdminTeams().map((team) => (
              <SelectItem key={team.id} textValue={team.name}>{team.name}</SelectItem>
            ))}
          </Select>

          <Spacer y={4} />

          <Button
            color="primary"
            onPress={() => _onConnectSlack()}
            isDisabled={!selectedTeam}
          >
            Connect to Slack
          </Button>
        </>
      )}
    </div>
  )
}

export default SlackAuth