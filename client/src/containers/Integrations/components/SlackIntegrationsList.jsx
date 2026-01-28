import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Button, Chip, Code, Divider, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@heroui/react";
import { formatRelative } from "date-fns";
import { LuPlus, LuSettings, LuSlack } from "react-icons/lu";
import { Link } from "react-router";

import {
  selectIntegrations,
} from "../../../slices/integration";
import { API_HOST } from "../../../config/settings";

const SLACK_CLIENT_ID = import.meta.env.VITE_APP_SLACK_CLIENT_ID;

function SlackIntegrations() {
  const [createOpen, setCreateOpen] = useState(false);

  const integrations = useSelector(selectIntegrations);
  const slackIntegrations = integrations.filter((i) => i.type === "slack");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <LuSlack size={24} />
          <div className="text-lg font-semibold">Slack</div>
          <Chip color="secondary" variant="flat" size="sm" radius="sm">
            New!
          </Chip>
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
      </div>
      <div className="text-sm text-foreground-500">
        {"Add Chartbrew's AI assistant to your Slack workspaces"}
      </div>
      <Spacer y={2} />
      <Divider />
      <Spacer y={2} />
      <Table shadow={"none"} aria-label="Slack integrations" className="border-1 border-divider rounded-lg">
        <TableHeader>
          <TableColumn key="name">Name</TableColumn>
          <TableColumn key="slack_team_name">Slack workspace</TableColumn>
          <TableColumn key="installer_slack_user_id">Channels access</TableColumn>
          <TableColumn key="created" align="flex-end">Date created</TableColumn>
          <TableColumn key="actions" hideHeader align="flex-end">Actions</TableColumn>
        </TableHeader>

        <TableBody emptyContent={"No Slack integrations"}>
          {slackIntegrations.map((i) => (
            <TableRow key={i.id}>
              <TableCell key="name">
                <Link
                  to={`/integrations/${i.id}`}
                  className="hover:underline hover:decoration-2 cursor-pointer"
                >
                  <div className="text-foreground-700">{i.name}</div>
                </Link>
              </TableCell>
              <TableCell key="slack_team_name">
                {i.config?.slack_team_name || "No Slack workspace"}
              </TableCell>
              <TableCell key="installer_slack_user_id" className="max-w-[300px] truncate">
                <div className="truncate">
                  {i.config?.allowedChannels?.length ? `${i.config?.allowedChannels?.length} ${i.config?.allowedChannels?.length === 1 ? "channel" : "channels"}` : "No channels"}
                </div>
              </TableCell>
              <TableCell key="created">
                {formatRelative(new Date(i.createdAt), new Date())}
              </TableCell>
              <TableCell key="actions">
                <Link to={`/integrations/${i.id}`}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    className="pointer-events-none"
                  >
                    <LuSettings size={18} />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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

export default SlackIntegrations;
