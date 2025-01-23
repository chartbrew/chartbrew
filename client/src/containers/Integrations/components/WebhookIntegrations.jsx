import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Divider, Input, Link, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { TbWebhook } from "react-icons/tb";
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
import { LuInfo, LuPencilLine, LuPlus, LuSlack, LuTrash } from "react-icons/lu";

const urlRegex = /^https?:\/\/.+/;

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
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    if (newIntegration.url?.indexOf("https://hooks.slack.com") > -1) {
      setNewIntegration({
        ...newIntegration,
        slackMode: true,
      });
    }
  }, [newIntegration.url]);

  const _onCreate = () => {
    setUrlError(false);

    if (newIntegration.name === "" || newIntegration.url === "") {
      return;
    }

    // Validate URL format
    if (!urlRegex.test(newIntegration.url)) {
      setUrlError(true);
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
    setUrlError(false);

    if (newIntegration.name === "" || newIntegration.url === "") {
      return;
    }

    // Validate URL format
    if (!urlRegex.test(newIntegration.url)) {
      setUrlError(true);
      return;
    }

    setCreateLoading(true);
    updateIntegration(teamId, {
      id: newIntegration.id,
      name: newIntegration.name,
      config: {
        url: newIntegration.url,
        slackMode: newIntegration.slackMode,
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
            <Spacer x={1} />
            <Text size="h4">Webhooks</Text>
          </div>
          <Spacer x={2} />
          <Button
            auto
            onClick={() => {
              setCreateOpen(true);
            }}
            startContent={<LuPlus />}
            variant="flat"
            color={"primary"}
            size="sm"
          >
            Add a new webhook
          </Button>
        </Row>
        <Spacer y={2} />
        <Row>
          <Divider />
        </Row>
        <Spacer y={2} />
        <Row>
          <div className="text-sm">
            <Link href="https://docs.chartbrew.com/integrations/webhooks" target="_blank" rel="noopener" className="text-sm">
              <LuInfo size={16} />
              <Spacer x={1} />
              {"Click to see what Chartbrew sends over the webhook"}
            </Link>
          </div>
        </Row>
        <Spacer y={1} />
        <Row>
          <div className="text-sm">
            <Link onClick={() => setSlackModalOpen(true)} className="text-sm">
              <LuSlack size={16} />
              <Spacer x={1} />
              {"Want to send events to Slack? Check out how to do it here"}
            </Link>
          </div>
        </Row>
        <Spacer y={2} />
        {integrations.length > 0 && (
          <Row>
            <Table shadow={"none"} aria-label="Webhook integrations" className="border-1 border-divider rounded-lg">
              <TableHeader>
                <TableColumn key="name">Name</TableColumn>
                <TableColumn key="url">URL</TableColumn>
                <TableColumn key="created" align="flex-end">Date created</TableColumn>
                <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
              </TableHeader>

              <TableBody emptyContent={"No integrations found"}>
                {integrations.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell key="name">
                      {i.name}
                    </TableCell>
                    <TableCell key="url" className="max-w-[300px] truncate">
                      <Text className={"truncate"}>
                        {i.config?.url || "No URL"}
                      </Text>
                    </TableCell>
                    <TableCell key="created">
                      {formatRelative(new Date(i.createdAt), new Date())}
                    </TableCell>
                    <TableCell key="actions">
                      <Row>
                        <Button
                          isIconOnly
                          variant="light"
                          onClick={() => _onEditOpen(i)}
                          size="sm"
                        >
                          <LuPencilLine size={18} />
                        </Button>
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          onClick={() => setIntegrationToDelete(i.id)}
                          size="sm"
                        >
                          <LuTrash size={18} />
                        </Button>
                      </Row>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Row>
        )}
      </Container>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">
              {!newIntegration.id && "Create a new webhook integration"}
              {newIntegration.id && "Update the webhook"}
            </Text>
          </ModalHeader>
          <ModalBody>
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
            <Row>
              <Input
                label="The URL where Chartbrew sends a POST request to"
                placeholder="Webhook URL"
                fullWidth
                value={newIntegration.url}
                onChange={(e) => setNewIntegration({ ...newIntegration, url: e.target.value })}
                variant="bordered"
                color={urlError ? "danger" : "default"}
              />
            </Row>
            <Row align={"center"}>
              <Checkbox
                checked={newIntegration.slackMode}
                onValueChange={(isSelected) => {
                  setNewIntegration({ ...newIntegration, slackMode: isSelected });
                }}
                size="sm"
                isSelected={newIntegration.slackMode}
              >
                {"This is a Slack webhook"}
              </Checkbox>
              <Spacer x={3} />
              <Link onClick={() => setSlackModalOpen(true)} className="text-sm cursor-pointer">
                <LuInfo size={16} />
                <Spacer x={1} />
                {"What is this?"}
              </Link>
            </Row>
            {error && (
              <Row>
                <Text color="danger">There was an error creating the integration. Please try again.</Text>
              </Row>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              auto
              onClick={() => setCreateOpen(false)}
              variant="bordered"
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
        </ModalContent>
      </Modal>

      <Modal isOpen={!!integrationToDelete} onClose={() => setIntegrationToDelete(false)} size="3xl">
      <ModalContent>
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
        </ModalContent>
      </Modal>

      <Modal isOpen={slackModalOpen} size="5xl" onClose={() => setSlackModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">How to set up Slack alerts</Text>
          </ModalHeader>
          <ModalBody>
            <div
              className="relative pb-[56.25%] min-h-full"
            >
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
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              auto
              onClick={() => setSlackModalOpen(false)}
              variant="bordered"
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
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
