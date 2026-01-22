import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Code, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { formatRelative } from "date-fns";
import toast from "react-hot-toast";
import { LuPencilLine, LuPlus, LuSlack, LuTrash } from "react-icons/lu";

import {
  deleteIntegration, updateIntegration, getTeamIntegrations,
  selectIntegrations,
} from "../../../slices/integration";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { API_HOST } from "../../../config/settings";

const SLACK_CLIENT_ID = import.meta.env.VITE_APP_SLACK_CLIENT_ID;

function SlackIntegrations({ teamId }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const integrations = useSelector(selectIntegrations);
  const slackIntegrations = integrations.filter((i) => i.type === "slack");
  const dispatch = useDispatch();

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
    setEditOpen(true);
  };

  const _onEdit = () => {
    if (newIntegration.name === "") {
      return;
    }

    setEditLoading(true);
    dispatch(updateIntegration({
      team_id: teamId,
      integration_id: newIntegration.id,
      data: {
        name: newIntegration.name,
      },
    }))
      .then((data) => {
        setEditLoading(false);
        if (data?.error) {
          toast.error("There was an error updating the integration. Please try again.");
        } else {
          setEditOpen(false);
          setNewIntegration({});
          getTeamIntegrations(teamId);
        }
      })
      .catch(() => {
        setEditLoading(false);
        toast.error("There was an error updating the integration. Please try again.");
      });
  };

  return (
    <div>
      <Row align="center" justify="space-between">
        <div className="flex items-center">
          <LuSlack size={24} />
          <Spacer x={1} />
          <div className="text-lg font-semibold">Slack</div>
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
          Add a new Slack integration
        </Button>
      </Row>
      <Spacer y={2} />
      <Row>
        <Divider />
      </Row>
      <Spacer y={2} />
      <Table shadow={"none"} aria-label="Slack integrations" className="border-1 border-divider rounded-lg">
        <TableHeader>
          <TableColumn key="name">Name</TableColumn>
          <TableColumn key="slack_team_name">Slack workspace</TableColumn>
          <TableColumn key="installer_slack_user_id">Slack user ID</TableColumn>
          <TableColumn key="created" align="flex-end">Date created</TableColumn>
          <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
        </TableHeader>

        <TableBody emptyContent={"No Slack integrations"}>
          {slackIntegrations.map((i) => (
            <TableRow key={i.id}>
              <TableCell key="name">
                {i.name}
              </TableCell>
              <TableCell key="slack_team_name">
                {i.config?.slack_team_name || "No Slack workspace"}
              </TableCell>
              <TableCell key="installer_slack_user_id" className="max-w-[300px] truncate">
                <Text className={"truncate"}>
                  {i.config?.installer_slack_user_id || "No Slack user ID"}
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

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} size="xl">
        <ModalContent>
          <ModalHeader className="font-bold">
            {"Update the Slack integration"}
          </ModalHeader>
          <ModalBody>
            <Input
              label="A name to recognize this integration"
              placeholder="Slack integration name"
              fullWidth
              value={newIntegration.name}
              onChange={(e) => {
                setNewIntegration({ ...newIntegration, name: e.target.value.slice(0, 20) });
              }}
              variant="bordered"
              required
              description={`${newIntegration.name?.length || 0}/20 characters`}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => setEditOpen(false)}
              variant="bordered"
              size="sm"
            >
              Close
            </Button>
            <Button
              size="sm"
              onPress={_onEdit}
              color="primary"
              isLoading={editLoading}
            >
              Update
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
              <div>
                All alerts that are configured to use this integration will be disabled.
              </div>
              {deleteError && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Text color="danger">There was an error deleting the integration. Please try again.</Text>
                  </Row>
                </>
              )}
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

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="xl">
        <ModalContent>
          <ModalHeader className="font-bold">
            {"Install Chartbrew in your Slack workspace"}
          </ModalHeader>
          {SLACK_CLIENT_ID && (
            <ModalBody>
              <div>
                1. Click the install button below to install Chartbrew in your Slack workspace.
              </div>
              <div>
                <a href={`${API_HOST}/apps/slack/oauth/start`}><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>
              </div>
              <div>
                2. Once installed, you can use the <Code size="sm">/chartbrew</Code> command in your Slack workspace to start using Chartbrew.
              </div>
              <div>
                3. Use <Code size="sm">/chartbrew connect</Code> to connect your Slack workspace to a Chartbrew team.
              </div>
              <div>
                4. Mention <Code size="sm">@Chartbrew</Code> in a channel and ask any question about your data.
              </div>
            </ModalBody>
          )}
          {!SLACK_CLIENT_ID && (
            <ModalBody>
              <div>
                No Slack client ID found. Have a look at our docs to learn how to set up the Slack integration.
              </div>
              <a href="https://docs.chartbrew.com/integrations/slack" target="_blank" rel="noopener noreferrer" className="font-bold underline">Set up the Slack integration</a>
            </ModalBody>
          )}
          <ModalFooter>
            <Button onPress={() => setCreateOpen(false)} variant="bordered" size="sm">Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

SlackIntegrations.propTypes = {
  teamId: PropTypes.string.isRequired,
};

export default SlackIntegrations;
