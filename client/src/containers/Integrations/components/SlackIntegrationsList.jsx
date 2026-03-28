import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Button, Chip, Modal, Table,
  EmptyState,
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
          <Chip variant="secondary" size="sm" color="accent">
            New!
          </Chip>
        </div>
        <div className="w-2" />
        <Button
          onPress={() => {
            setCreateOpen(true);
          }}
          variant="primary"
          size="sm"
        >
          <LuPlus />
          Add a new Slack integration
        </Button>
      </div>
      <div className="text-sm text-foreground-500">
        {"Add Chartbrew's AI assistant to your Slack workspaces"}
      </div>
      <div className="h-4" />
      <Table className="border border-divider shadow-none">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Slack integrations"
            className="min-w-full even:[&_tbody>tr]:bg-content2/30"
          >
            <Table.Header>
              <Table.Column id="name" isRowHeader textValue="Name">
                Name
              </Table.Column>
              <Table.Column id="slack_team_name" textValue="Slack workspace">
                Slack workspace
              </Table.Column>
              <Table.Column id="installer_slack_user_id" textValue="Channels access">
                Channels access
              </Table.Column>
              <Table.Column id="created" className="text-end" textValue="Date created">
                Date created
              </Table.Column>
              <Table.Column id="actions" className="w-12 text-end" textValue="Actions" />
            </Table.Header>

            <Table.Body renderEmptyState={() => (
              <EmptyState className="flex h-auto min-h-[160px] w-full flex-col items-center justify-center gap-4 text-center">
                <LuSlack size={24} className="text-muted" />
                <span className="text-sm text-muted">No Slack integrations</span>
              </EmptyState>
            )}>
              {slackIntegrations.map((i) => (
                <Table.Row key={i.id} id={String(i.id)}>
                  <Table.Cell>
                    <Link
                      to={`/integrations/${i.id}`}
                      className="hover:underline hover:decoration-2 cursor-pointer"
                    >
                      <div className="text-foreground-700">{i.name}</div>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    {i.config?.slack_team_name || "No Slack workspace"}
                  </Table.Cell>
                  <Table.Cell className="max-w-[300px] truncate">
                    <div className="truncate">
                      {i.config?.allowedChannels?.length ? `${i.config?.allowedChannels?.length} ${i.config?.allowedChannels?.length === 1 ? "channel" : "channels"}` : "No channels"}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {formatRelative(new Date(i.createdAt), new Date())}
                  </Table.Cell>
                  <Table.Cell>
                    <Link to={`/integrations/${i.id}`}>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="pointer-events-none"
                      >
                        <LuSettings size={18} />
                      </Button>
                    </Link>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Modal>
        <Modal.Backdrop isOpen={createOpen} onOpenChange={setCreateOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.Header className="font-bold">
                {"Install Chartbrew in your Slack workspace"}
              </Modal.Header>
              {SLACK_CLIENT_ID && (
                <Modal.Body className="flex flex-col gap-4">
                  <div>
                    1. Click the install button below to install Chartbrew in your Slack workspace.
                  </div>
                  <div>
                    <a href={`${API_HOST}/apps/slack/oauth/start`}><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>
                  </div>
                  <div>
                    2. Once installed, you can use the <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">/chartbrew</code> command in your Slack workspace to start using Chartbrew.
                  </div>
                  <div>
                    3. Use <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">/chartbrew connect</code> to connect your Slack workspace to a Chartbrew team.
                  </div>
                  <div>
                    4. Mention <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">@Chartbrew</code> in a channel and ask any question about your data.
                  </div>
                </Modal.Body>
              )}
              {!SLACK_CLIENT_ID && (
                <Modal.Body>
                  <EmptyState className="flex h-auto min-h-[160px] w-full flex-col items-center justify-center gap-4 text-center">
                    <LuSlack size={24} className="text-muted" />
                    <span className="text-sm text-muted">No Slack client ID found. Have a look at our docs to learn how to set up the Slack integration.</span>
                    <a href="https://docs.chartbrew.com/integrations/slack" target="_blank" rel="noopener noreferrer" className="font-bold underline">Set up the Slack integration</a>
                  </EmptyState>
                </Modal.Body>
              )}
              <Modal.Footer>
                <Button onPress={() => setCreateOpen(false)} variant="secondary" size="sm">Close</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default SlackIntegrations;
