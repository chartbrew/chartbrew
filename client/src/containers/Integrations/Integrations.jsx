import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Spacer,
} from "@heroui/react";


import WebhookIntegrations from "./components/WebhookIntegrations";
import {
  getTeamIntegrations,
} from "../../slices/integration";
import { selectTeam } from "../../slices/team";
import SlackIntegrations from "./components/SlackIntegrations";

function Integrations() {
  const dispatch = useDispatch();

  const team = useSelector(selectTeam);
  const initRef = useRef(false);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      dispatch(getTeamIntegrations({ team_id: team?.id }));
      initRef.current = true;
    }
  }, [team]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            Integrations
          </div>
          <div className="text-sm text-foreground-500">
            {"Create and manage your integrations with external services"}
          </div>
        </div>
      </div>

      <Spacer y={4} />

      <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
        <WebhookIntegrations
          teamId={team?.id}
        />
        <Spacer y={4} />
        <SlackIntegrations
          teamId={team?.id}
        />
      </div>
    </div>
  );
}

export default Integrations;
