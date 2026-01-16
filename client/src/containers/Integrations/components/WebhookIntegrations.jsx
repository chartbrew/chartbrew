import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Checkbox, Divider, Input, Link, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { formatRelative } from "date-fns";

import {
  createIntegration, deleteIntegration, updateIntegration, getTeamIntegrations,
  selectIntegrations,
} from "../../../slices/integration";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { LuInfo, LuPencilLine, LuPlus, LuSlack, LuTrash, LuWebhook } from "react-icons/lu";

const urlRegex = /^https?:\/\/.+/;

function WebhookIntegrations({ teamId }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({});
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [slackModalOpen, setSlackModalOpen] = useState(false);
  const [urlError, setUrlError] = useState(false);

  const integrations = useSelector(selectIntegrations);
  const webhookIntegrations = integrations.filter((i) => i.type === "webhook");
  const dispatch = useDispatch();

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
    dispatch(createIntegration({
      data: {
        team_id: teamId,
        name: newIntegration.name,
        type: "webhook",
        config: {
          url: newIntegration.url,
          slackMode: newIntegration.slackMode,
        },
      },
    }))
      .then((data) => {
        setCreateLoading(false);
        if (data?.error) {
          setError(true);
        } else {
          setCreateOpen(false);
          setNewIntegration({});
        }
      })
      .catch(() => {
        setCreateLoading(false);
        setError(true);
      });
  };

  const _onDelete = () => {
    setDeleteLoading(true);
    dispatch(deleteIntegration({
      team_id: teamId,
      integration_id: integrationToDelete,
    }))
      .then((data) => {
        setDeleteLoading(false);
        if (data?.error) {
          setDeleteError(true);
        } else {
          setIntegrationToDelete(false);
          dispatch(getTeamIntegrations({ team_id: teamId }));
        }
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
    dispatch(updateIntegration({
      team_id: teamId,
      integration_id: newIntegration.id,
      data: {
        name: newIntegration.name,
        config: {
        url: newIntegration.url,
        slackMode: newIntegration.slackMode,
        },
      },
    }))
      .then((data) => {
        setCreateLoading(false);
        if (data?.error) {
          setError(true);
        } else {
          setCreateOpen(false);
          setNewIntegration({});
          getTeamIntegrations(teamId);
        }
      })
      .catch(() => {
        setCreateLoading(false);
        setError(true);
      });
  };

  return (
    <div>
      <Row align="center" justify="space-between">
        <div className="flex items-center">
          <LuWebhook size={24} />
          <Spacer x={1} />
          <div className="text-lg font-semibold">Webhooks</div>
        </div>
        <Spacer x={2} />
        <Button
          auto
          onPress={() => {
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
          <Link onPress={() => setSlackModalOpen(true)} className="text-sm">
            <LuSlack size={16} />
            <Spacer x={1} />
            {"Want to send events to Slack? Check out how to do it here"}
          </Link>
        </div>
      </Row>
      <Spacer y={2} />
      <Table shadow={"none"} aria-label="Webhook integrations" className="border-1 border-divider rounded-lg">
        <TableHeader>
          <TableColumn key="name">Name</TableColumn>
          <TableColumn key="url">URL</TableColumn>
          <TableColumn key="created" align="flex-end">Date created</TableColumn>
          <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
        </TableHeader>

        <TableBody emptyContent={"No webhook integrations"}>
          {webhookIntegrations.map((i) => (
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
                    onPress={() => _onEditOpen(i)}
                    size="sm"
                  >
                    <LuPencilLine size={18} />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={() => setIntegrationToDelete(i.id)}
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
              <Link onPress={() => setSlackModalOpen(true)} className="text-sm cursor-pointer">
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
              onPress={() => setCreateOpen(false)}
              variant="bordered"
            >
              Close
            </Button>
            <Button
              auto
              onPress={!newIntegration.id ? _onCreate : _onEdit}
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
              onPress={() => setIntegrationToDelete(false)}
              variant="bordered"
            >
              Close
            </Button>
            <Button
              auto
              onPress={_onDelete}
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
              onPress={() => setSlackModalOpen(false)}
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
  teamId: PropTypes.string.isRequired,
};

export default WebhookIntegrations;
