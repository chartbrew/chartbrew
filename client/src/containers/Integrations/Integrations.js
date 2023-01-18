import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import {
  Container, Row, Spacer, Text
} from "@nextui-org/react";

import WebhookIntegrations from "./components/WebhookIntegrations";
import {
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../actions/integration";

function Integrations(props) {
  const { integrations, getTeamIntegrations, match } = props;

  useEffect(() => {
    getTeamIntegrations(match.params.teamId);
  }, []);

  return (
    <div>
      <Container
        css={{
          background: "$backgroundContrast", p: "$6", br: "$md"
        }}
      >
        <Row>
          <Text h3>Integrations</Text>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Text>
            {"Create new integrations that you can use across your team's projects. Currently, the integrations are mainly used for chart alerts and notifications."}
          </Text>
        </Row>
        <Spacer y={1} />

        <Row>
          <WebhookIntegrations
            integrations={integrations ? integrations.filter((i) => i.type === "webhook") : []}
            teamId={match.params.teamId}
          />
        </Row>
        <Spacer y={2} />
      </Container>
    </div>
  );
}

Integrations.propTypes = {
  integrations: PropTypes.arrayOf(PropTypes.object).isRequired,
  getTeamIntegrations: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  integrations: state.integration.data,
});

const mapDispatchToProps = (dispatch) => ({
  getTeamIntegrations: (teamId) => dispatch(getTeamIntegrationsAction(teamId)),
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Integrations));
