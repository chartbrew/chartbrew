import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Spacer,
} from "@heroui/react";


import WebhookIntegrations from "./components/WebhookIntegrations";
import {
  getTeamIntegrations,
  selectIntegrations,
} from "../../slices/integration";
import Text from "../../components/Text";
import Row from "../../components/Row";
import Segment from "../../components/Segment";
import { selectTeam } from "../../slices/team";

function Integrations() {
  const integrations = useSelector(selectIntegrations);
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
    <div>
      <Segment className="container mx-auto bg-background">
        <Row>
          <Text size="h3">Integrations</Text>
        </Row>
        <Spacer y={1} />
        <Row>
          <Text>
            {"Create new integrations that you can use across your team's projects. Currently, the integrations are mainly used for chart alerts and notifications."}
          </Text>
        </Row>
        <Spacer y={4} />

        <Row>
          <WebhookIntegrations
            integrations={integrations ? integrations.filter((i) => i.type === "webhook") : []}
            teamId={team?.id}
          />
        </Row>
        <Spacer y={4} />
      </Segment>
    </div>
  );
}

export default Integrations;
