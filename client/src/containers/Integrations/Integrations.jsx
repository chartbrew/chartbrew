import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import {
  Spacer,
} from "@nextui-org/react";


import WebhookIntegrations from "./components/WebhookIntegrations";
import {
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../actions/integration";
import Text from "../../components/Text";
import Row from "../../components/Row";

function Integrations(props) {
  const { integrations, getTeamIntegrations, match } = props;

  useEffect(() => {
    getTeamIntegrations(match.params.teamId);
  }, []);

  return (
    <div>
      <div className={"container mx-auto bg-content1 rounded-md p-4 md:p-8"}>
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
            teamId={match.params.teamId}
          />
        </Row>
        <Spacer y={4} />
      </div>
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
