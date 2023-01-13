import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Container, Input, Link, Loading, Modal, Row, Spacer, Table, Text
} from "@nextui-org/react";
import {
  Delete, Edit, InfoCircle, Plus
} from "react-iconly";
import { TbWebhook } from "react-icons/tb";
import { formatRelative } from "date-fns";

import {
  createIntegration as createIntegrationAction,
  deleteIntegration as deleteIntegrationAction,
  updateIntegration as updateIntegrationAction,
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../../actions/integration";

function WebhookIntegrations(props) {
  const {
    integrations, teamId, createIntegration, deleteIntegration, updateIntegration,
    getTeamIntegrations,
  } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({});
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

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

  const _onDelete = () => {
    setDeleteLoading(true);
    deleteIntegration(teamId, integrationToDelete)
      .then(() => {
        setDeleteLoading(false);
        setIntegrationToDelete(false);
        getTeamIntegrations(teamId);
      })
      .catch(() => {
        setDeleteLoading(false);
        setDeleteError(true);
      });
  };

  const _onEditOpen = (integration) => {
    setNewIntegration({
      id: integration.id,
      name: integration.name,
      url: integration.config.url,
    });
    setCreateOpen(true);
  };

  const _onEdit = () => {
    if (newIntegration.name === "" || newIntegration.url === "") {
      return;
    }

    setCreateLoading(true);
    updateIntegration(teamId, {
      id: newIntegration.id,
      name: newIntegration.name,
      config: {
        url: newIntegration.url,
      },
    })
      .then(() => {
        setCreateLoading(false);
        setCreateOpen(false);
        setNewIntegration({});
        getTeamIntegrations(teamId);
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
        <Row>
          <Text>
            <Link href="https://docs.chartbrew.com/integrations/webhooks" target="_blank" rel="noopener">
              <InfoCircle />
              <Spacer x={0.3} />
              {"Find out more about what Chartbrew sends through webhook integrations here"}
            </Link>
          </Text>
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
                    <Table.Cell key="url" css={{ maxWidth: 300 }}>
                      <Text css={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                        {i.config?.url || "No URL"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell key="created">
                      {formatRelative(new Date(i.createdAt), new Date())}
                    </Table.Cell>
                    <Table.Cell key="actions">
                      <Container>
                        <Row>
                          <Button
                            icon={<Edit />}
                            light
                            color="secondary"
                            onClick={() => _onEditOpen(i)}
                            css={{ minWidth: "fit-content" }}
                          />
                          <Button
                            icon={<Delete />}
                            light
                            color="error"
                            onClick={() => setIntegrationToDelete(i.id)}
                            css={{ minWidth: "fit-content" }}
                          />
                        </Row>
                      </Container>
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
          <Text h4>
            {!newIntegration.id && "Create a new webhook integration"}
            {newIntegration.id && "Update the webhook"}
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Input
                label="A name to recognize this integration"
                placeholder="Webhook name"
                fullWidth
                value={newIntegration.name}
                onChange={(e) => {
                  setNewIntegration({ ...newIntegration, name: e.target.value.slice(0, 20) });
                }}
                bordered
                required
                helperText={`${newIntegration.name?.length || 0}/20 characters`}
              />
            </Row>
            <Spacer y={2} />
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
            onClick={!newIntegration.id ? _onCreate : _onEdit}
            color="primary"
            disabled={createLoading}
            icon={createLoading ? <Loading type="spinner" /> : null}
          >
            {!newIntegration.id && "Create"}
            {newIntegration.id && "Update"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={!!integrationToDelete} onClose={() => setIntegrationToDelete(false)} width="500px">
        <Modal.Header>
          <Text h4>Are you sure you want to delete this integration?</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            <Row>
              <Text>
                All alerts that are configured to use this integration will be disabled.
              </Text>
            </Row>
            {deleteError && (
              <>
                <Spacer y={1} />
                <Row>
                  <Text color="error">There was an error deleting the integration. Please try again.</Text>
                </Row>
              </>
            )}
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            auto
            onClick={() => setIntegrationToDelete(false)}
            color="warning"
            flat
          >
            Close
          </Button>
          <Button
            auto
            onClick={_onDelete}
            color="error"
            disabled={deleteLoading}
            icon={deleteLoading ? <Loading type="spinner" /> : null}
          >
            Delete
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
  deleteIntegration: PropTypes.func.isRequired,
  updateIntegration: PropTypes.func.isRequired,
  getTeamIntegrations: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({
});

const mapDispatchToProps = (dispatch) => ({
  createIntegration: (teamId, integration) => (
    dispatch(createIntegrationAction(teamId, integration))
  ),
  deleteIntegration: (teamId, integrationId) => (
    dispatch(deleteIntegrationAction(teamId, integrationId))
  ),
  updateIntegration: (teamId, data) => (
    dispatch(updateIntegrationAction(teamId, data))
  ),
  getTeamIntegrations: (teamId) => (
    dispatch(getTeamIntegrationsAction(teamId))
  ),
});

export default connect(mapStateToProps, mapDispatchToProps)(WebhookIntegrations);
