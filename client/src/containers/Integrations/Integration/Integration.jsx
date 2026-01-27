import React, { useEffect, useRef } from "react"
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import { Spinner } from "@heroui/react";

import { getIntegration, selectIntegrations } from "../../../slices/integration";
import SlackIntegration from "./SlackIntegration";
import WebhookIntegration from "./WebhookIntegration";
import { selectTeam } from "../../../slices/team";

function Integration() {
  const integrations = useSelector(selectIntegrations);

  const params = useParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const integration = integrations.find((i) => i.id === params.integrationId);
  const initRef = useRef(false);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      initRef.current = true;
      dispatch(getIntegration({ team_id: team?.id, integration_id: params.integrationId }));
    }
  }, [team?.id]);

  if (!integration?.id) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full">
        <Spinner variant="simple" size="lg" />
        <div className="text-sm text-foreground-500">Loading integration...</div>
      </div>
    );
  }

  return (
    <>
      {integration?.type === "slack" && <SlackIntegration integration={integration} />}
      {integration?.type === "webhook" && <WebhookIntegration integration={integration} />}
    </>
  )
}

export default Integration
