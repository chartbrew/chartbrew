import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Link, Separator, Table } from "@heroui/react";
import { LuArrowLeft, LuRefreshCw } from "react-icons/lu";

import AiMarkdown from "../../Ai/AiMarkdown";
import { API_HOST } from "../../../config/settings";
import { getAuthToken } from "../../../modules/auth";

const actions = {
  slack_refresh: "Refresh chart", slack_data: "View data", slack_share: "Share chart",
  slack_confirm: "Confirm change", slack_change: "Request a change",
  slack_place_submit: "Add chart to dashboard", slack_period_submit: "Change period",
};

function SlackConversations({ integrationId, channels }) {
  const [thread, setThread] = useState(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    fetch(`${API_HOST}/apps/slack/${integrationId}/conversations${thread ? `/${thread.id}` : ""}?offset=${offset}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` }, signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [integrationId, thread, offset, refresh]);

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-divider bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <Button variant="secondary" size="sm" aria-label="Refresh conversations" isIconOnly onPress={() => setRefresh((value) => value + 1)}>
          <LuRefreshCw size={16} aria-hidden="true" />
        </Button>
      </div>
      {thread && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onPress={() => { setThread(null); setOffset(0); }}>
            <LuArrowLeft size={16} aria-hidden="true" />
            All conversations
          </Button>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>{thread.tokens.toLocaleString()} tokens total{thread.incomplete ? " · Count incomplete" : ""}</span>
            <Link href={thread.url} target="_blank" rel="noopener noreferrer">Open thread in Slack</Link>
          </div>
        </div>
      )}
      {error && <p role="alert">Conversations could not load. Use Refresh to try again.</p>}
      {!error && !data && <p role="status">Loading conversations…</p>}
      {thread && data?.total === 0 && <p>No conversations yet.</p>}
      {data?.conversations && (
        <Table className="shadow-none">
          <Table.ScrollContainer>
            <Table.Content aria-label="Slack conversations" className="min-w-full">
              <Table.Header>
                <Table.Column id="channel" isRowHeader>Channel</Table.Column>
                <Table.Column id="started">Started</Table.Column>
                <Table.Column id="active">Last active</Table.Column>
                <Table.Column id="tokens" className="text-end">Tokens</Table.Column>
                <Table.Column id="actions" className="text-end">Actions</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="py-6 text-center text-muted">No conversations yet.</p>}>
                {data.conversations.map((item) => (
                  <Table.Row key={item.id} id={item.id}>
                    <Table.Cell className="font-medium">
                      #{channels.find((channel) => channel.id === item.channel)?.name || item.channel}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">{new Date(item.startedAt).toLocaleString()}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap">{new Date(item.updatedAt).toLocaleString()}</Table.Cell>
                    <Table.Cell className="text-end tabular-nums">
                      {item.tokens.toLocaleString()}
                      {item.incomplete && <span className="block text-xs text-muted">Count incomplete</span>}
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      <Button variant="secondary" size="sm" onPress={() => { setThread(item); setOffset(0); }}>
                        View conversation
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
      {data?.requests?.map((item) => (
        <article key={item.id} className="flex flex-col gap-3 border-t border-divider pt-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
            <span>
              <Link href={item.requesterUrl} target="_blank" rel="noopener noreferrer">{item.requester}</Link>
              {` · ${new Date(item.createdAt).toLocaleString()}`}
            </span>
            <span>{item.tokens === null ? "Token count unavailable" : `${item.tokens.toLocaleString()} tokens${item.incomplete ? " · Count incomplete" : ""}`}</span>
          </div>
          <p className="whitespace-pre-wrap break-words font-medium">{item.question || actions[item.action] || "Suggested reply"}</p>
          {item.answer && <AiMarkdown>{item.answer}</AiMarkdown>}
          {item.charts.map((chart) => (
            <Link key={chart.id} href={`/previews/${chart.id}`}>{chart.name}</Link>
          ))}
          {item.error && <p className="text-sm text-danger">{item.error}</p>}
          {!item.error && !item.delivered && <p className="text-sm text-muted">Reply not yet delivered.</p>}
        </article>
      ))}
      {data?.total > 25 && (
        <>
          <Separator />
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" isDisabled={offset === 0} onPress={() => setOffset((value) => value - 25)}>Previous</Button>
            <span className="text-sm">{offset + 1}–{Math.min(offset + 25, data.total)} of {data.total}</span>
            <Button variant="secondary" size="sm" isDisabled={offset + 25 >= data.total} onPress={() => setOffset((value) => value + 25)}>Next</Button>
          </div>
        </>
      )}
    </section>
  );
}

SlackConversations.propTypes = { integrationId: PropTypes.string.isRequired, channels: PropTypes.array.isRequired };

export default SlackConversations;
