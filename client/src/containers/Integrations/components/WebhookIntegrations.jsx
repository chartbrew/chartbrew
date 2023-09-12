import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Divider, Input, Link, Modal, ModalBody, ModalFooter,
  ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@nextui-org/react";
import {
  Delete, Edit, InfoCircle, Plus
} from "react-iconly";
import { TbWebhook } from "react-icons/tb";
import { FaSlack } from "react-icons/fa";
import { formatRelative } from "date-fns";

import {
  createIntegration as createIntegrationAction,
  deleteIntegration as deleteIntegrationAction,
  updateIntegration as updateIntegrationAction,
  getTeamIntegrations as getTeamIntegrationsAction,
} from "../../../actions/integration";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

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
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  useEffect(() => {
    if (newIntegration.url?.indexOf("https://hooks.slack.com") > -1) {
      setNewIntegration({
        ...newIntegration,
        slackMode: true,
      });
    }
  }, [newIntegration.url]);

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
        slackMode: newIntegration.slackMode,
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
      slackMode: integration.config.slackMode,
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
        <Row align="center" justify="space-between">
          <div className="flex items-center">
            <Text><TbWebhook size={24} /></Text>
            <Spacer x={0.6} />
            <Text size="h4">Webhooks</Text>
          </div>
          <Spacer x={2} />
          <Button
            auto
            onClick={() => {
              setCreateOpen(true);
            }}
            startContent={<Plus />}
            variant="light"
            color={"primary"}
          >
            Add a new webhook
          </Button>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Divider />
        </Row>
        <Spacer y={1} />
        <Row>
          <Text>
            <Link href="https://docs.chartbrew.com/integrations/webhooks" target="_blank" rel="noopener">
              <InfoCircle />
              <Spacer x={0.6} />
              {"Click to see what Chartbrew sends over the webhook"}
            </Link>
          </Text>
        </Row>
        <Spacer y={1} />
        <Row>
          <Text>
            <Link onClick={() => setSlackModalOpen(true)}>
              <FaSlack size={24} />
              <Spacer x={0.6} />
              {"Want to send events to Slack? Check out how to do it here"}
            </Link>
          </Text>
        </Row>
        <Spacer y={1} />
        {integrations.length > 0 && (
          <Row>
            <Table shadow={"none"}>
              <TableHeader>
                <TableColumn key="name">Name</TableColumn>
                <TableColumn key="url">URL</TableColumn>
                <TableColumn key="created" align="flex-end">Date created</TableColumn>
                <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
              </TableHeader>

              <TableBody>
                {integrations.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell key="name">
                      {i.name}
                    </TableCell>
                    <TableCell key="url" className="max-w-[300px]">
                      <Text className={"overflow-hidden text-ellipsis whitespace-nowrap"}>
                        {i.config?.url || "No URL"}
                      </Text>
                    </TableCell>
                    <TableCell key="created">
                      {formatRelative(new Date(i.createdAt), new Date())}
                    </TableCell>
                    <TableCell key="actions">
                      <Container>
                        <Row>
                          <Button
                            isIconOnly
                            variant="light"
                            color="secondary"
                            onClick={() => _onEditOpen(i)}
                          >
                            <Edit />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            onClick={() => setIntegrationToDelete(i.id)}
                          >
                            <Delete />
                          </Button>
                        </Row>
                      </Container>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Row>
        )}
      </Container>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} className="w-[500px]">
        <ModalHeader>
          <Text size="h4">
            {!newIntegration.id && "Create a new webhook integration"}
            {newIntegration.id && "Update the webhook"}
          </Text>
        </ModalHeader>
        <ModalBody>
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
                variant="bordered"
                required
                description={`${newIntegration.name?.length || 0}/20 characters`}
              />
            </Row>
            <Spacer y={4} />
            <Row>
              <Input
                label="The URL where Chartbrew sends a POST request to"
                placeholder="Webhook URL"
                fullWidth
                value={newIntegration.url}
                onChange={(e) => setNewIntegration({ ...newIntegration, url: e.target.value })}
                variant="bordered"
                required
              />
            </Row>
            <Spacer y={1} />
            <Row>
              <Checkbox
                checked={newIntegration.slackMode}
                onChange={(isSelected) => {
                  setNewIntegration({ ...newIntegration, slackMode: isSelected });
                }}
                size="sm"
                isSelected={newIntegration.slackMode}
                label="Slack webhook"
              />
              <Spacer x={1} />
              <Text size="small">
                <Link onClick={() => setSlackModalOpen(true)}>
                  <InfoCircle />
                  <Spacer x={0.5} />
                  {"What is this?"}
                </Link>
              </Text>
            </Row>
            {error && (
              <Row>
                <Text color="danger">There was an error creating the integration. Please try again.</Text>
              </Row>
            )}
          </Container>
        </ModalBody>
        <ModalFooter>
          <Button
            auto
            onClick={() => setCreateOpen(false)}
            color="warning"
            variant="flat"
          >
            Close
          </Button>
          <Button
            auto
            onClick={!newIntegration.id ? _onCreate : _onEdit}
            color="primary"
            isLoading={createLoading}
          >
            {!newIntegration.id && "Create"}
            {newIntegration.id && "Update"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={!!integrationToDelete} onClose={() => setIntegrationToDelete(false)} className="w-[500px]">
        <ModalHeader>
          <Text size="h4">Are you sure you want to delete this integration?</Text>
        </ModalHeader>
        <ModalBody>
          <Container>
            <Row>
              <Text>
                All alerts that are configured to use this integration will be disabled.
              </Text>
            </Row>
            {deleteError && (
              <>
                <Spacer y={2} />
                <Row>
                  <Text color="danger">There was an error deleting the integration. Please try again.</Text>
                </Row>
              </>
            )}
          </Container>
        </ModalBody>
        <ModalFooter>
          <Button
            auto
            onClick={() => setIntegrationToDelete(false)}
            color="warning"
            variant="flat"
          >
            Close
          </Button>
          <Button
            auto
            onClick={_onDelete}
            color="danger"
            isLoading={deleteLoading}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={slackModalOpen} className="w-[800px]" onClose={() => setSlackModalOpen(false)}>
        <ModalHeader>
          <Text size="h3">How to set up Slack alerts</Text>
        </ModalHeader>
        <ModalBody className={"p-0 m-0"}>
          <Container className={"p-0 m-0"}>
            <Row style={{
              position: "relative", paddingBottom: "56.25%", height: 0,
            }}>
              <iframe
                title="Chartbrew Slack alerts"
                src="https://www.loom.com/embed/84e390c2e9b844748cb30812dc0591e1"
                frameBorder="0"
                webkitallowfullscreen
                mozallowfullscreen
                allowFullScreen
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 20,
                }}
              />
            </Row>
          </Container>
        </ModalBody>
        <ModalFooter>
          <Button
            auto
            onClick={() => setSlackModalOpen(false)}
            color="warning"
            variant="flat"
          >
            Close
          </Button>
        </ModalFooter>
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
