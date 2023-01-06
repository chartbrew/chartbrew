import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Container, Input, Loading, Modal, Row, Spacer, Table, Text
} from "@nextui-org/react";
import { Delete, Plus } from "react-iconly";
import { TbWebhook } from "react-icons/tb";
import { formatRelative } from "date-fns";

import {
  createIntegration as createIntegrationAction,
} from "../../../actions/integration";

function WebhookIntegrations(props) {
  const { integrations, teamId, createIntegration } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({});
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(false);

  const _onCreate = () => {
    if (newIntegration.name === "" || newIntegration.url === "") {
      return;
    }

    setCreateLoading(true);
    createIntegration(teamId, {
      name: newIntegration.name,
      team_id: teamId,
      type: "webhook",
      config: {
        url: newIntegration.url,
      },
    })
      .then(() => {
        setCreateLoading(false);
        setCreateOpen(false);
        setNewIntegration({});
      })
      .catch(() => {
        setCreateLoading(false);
        setError(true);
      });
  };

  return (
    <div>
      <Container>
        <Row align="center">
          <Text><TbWebhook size={24} /></Text>
          <Spacer x={0.3} />
          <Text h4>Webhooks</Text>
        </Row>
        <Spacer y={0.5} />
        {integrations.length > 0 && (
          <Row>
            <Table shadow={false}>
              <Table.Header>
                <Table.Column key="name">Name</Table.Column>
                <Table.Column key="url">URL</Table.Column>
                <Table.Column key="created" align="flex-end">Date created</Table.Column>
                <Table.Column key="actions" hideHeader align="flex-end">Actions</Table.Column>
              </Table.Header>

              <Table.Body>
                {integrations.map((i) => (
                  <Table.Row key={i.id}>
                    <Table.Cell key="name">
                      {i.name}
                    </Table.Cell>
                    <Table.Cell key="url">
                      {i.config?.url || "No URL"}
                    </Table.Cell>
                    <Table.Cell key="created">
                      {formatRelative(new Date(i.createdAt), new Date())}
                    </Table.Cell>
                    <Table.Cell key="actions">
                      <Button
                        icon={<Delete />}
                        light
                        color="error"
                        onClick={() => {}}
                        css={{ minWidth: "fit-content" }}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Row>
        )}
        <Spacer y={0.5} />
        <Row>
          <Button
            auto
            onClick={() => {
              setCreateOpen(true);
            }}
            icon={<Plus />}
            light
            color={"primary"}
          >
            Create a new webhook
          </Button>
        </Row>
      </Container>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} width="500px">
        <Modal.Header>
          <Text h4>Create a new webhook integration</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Input
                label="A name to recognize this integration"
                placeholder="Webhook name"
                fullWidth
                value={newIntegration.name}
                onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                bordered
                required
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Input
                label="The URL where Chartbrew sends a POST request to"
                placeholder="Webhook URL"
                fullWidth
                value={newIntegration.url}
                onChange={(e) => setNewIntegration({ ...newIntegration, url: e.target.value })}
                bordered
                required
              />
            </Row>
            <Spacer y={0.5} />
            {error && (
              <Row>
                <Text color="error">There was an error creating the integration. Please try again.</Text>
              </Row>
            )}
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            auto
            onClick={() => setCreateOpen(false)}
            color="warning"
            flat
          >
            Close
          </Button>
          <Button
            auto
            onClick={_onCreate}
            color="primary"
            disabled={createLoading}
            icon={createLoading ? <Loading type="spinner" /> : null}
          >
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

WebhookIntegrations.propTypes = {
  integrations: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamId: PropTypes.string.isRequired,
  createIntegration: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({
});

const mapDispatchToProps = (dispatch) => ({
  createIntegration: (teamId, integration) => (
    dispatch(createIntegrationAction(teamId, integration))
  ),
});

export default connect(mapStateToProps, mapDispatchToProps)(WebhookIntegrations);
