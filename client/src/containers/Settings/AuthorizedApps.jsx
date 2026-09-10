import React, { useEffect, useState } from "react";
import { Button, EmptyState, Spinner, Surface, Table } from "@heroui/react";
import { LuRefreshCw, LuShieldCheck } from "react-icons/lu";
import { SiCursor } from "react-icons/si";
import { VscClaude, VscMcp, VscOpenai } from "react-icons/vsc";

import { MCP_PERMISSIONS, mcpOAuthRequest } from "../../api/mcpOAuth";
import { getMcpClientType } from "./mcpSetup";

const CLIENT_ICONS = {
  openai: VscOpenai,
  claude: VscClaude,
  cursor: SiCursor,
  mcp: VscMcp,
};

export default function AuthorizedApps() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");

    mcpOAuthRequest("apps")
      .then(setApps)
      .catch(() => setError("Apps could not be loaded. Try again."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const revoke = async (id) => {
    setPending(id);
    setError("");

    try {
      await mcpOAuthRequest(`apps/${id}`, { method: "DELETE" });
      setApps((current) => current.filter((app) => app.id !== id));
    } catch {
      setError("Access could not be removed. Try again.");
    }
    setPending(null);
  };

  return (
    <Surface className="min-w-0 rounded-3xl border border-divider p-4 sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Connected clients</h2>
        <Button
          size="sm"
          variant="secondary"
          isPending={loading}
          isDisabled={Boolean(pending)}
          onPress={load}
        >
          <LuRefreshCw aria-hidden />
          Refresh
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted">
        Apps you approved across your teams. Remove access to disconnect a client. Your teammates’
        connections are not affected.
      </p>
      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-center gap-3"
        >
          <span className="text-danger">{error}</span>
          <Button
            variant="secondary"
            size="sm"
            onPress={load}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {!apps && !error ? (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center gap-3 text-muted"
        >
          <Spinner size="sm" />
          Loading apps…
        </div>
      ) : null}
      {apps ? (
        <Table className="shadow-none">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Connected clients"
              className={apps.length ? "min-w-[640px]" : "w-full"}
            >
              <Table.Header>
                <Table.Column
                  id="app"
                  isRowHeader
                >
                  App
                </Table.Column>
                <Table.Column id="team">Team</Table.Column>
                <Table.Column id="permissions">Permissions</Table.Column>
                <Table.Column id="actions">
                  <span className="sr-only">Actions</span>
                </Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <EmptyState className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <LuShieldCheck
                      aria-hidden="true"
                      size={28}
                      className="mb-2 text-muted"
                    />
                    <p className="font-medium text-foreground">No connected clients yet</p>
                    <p className="max-w-sm text-sm text-muted">
                      Choose an app above and approve access. Your connection will appear here.
                    </p>
                  </EmptyState>
                )}
              >
                {apps.map((app) => {
                  const clientType = getMcpClientType(app.name);
                  const ClientIcon = CLIENT_ICONS[clientType];

                  return (
                    <Table.Row
                      key={app.id}
                      id={app.id}
                    >
                      <Table.Cell className="max-w-64 py-4 whitespace-normal break-words">
                        <div className="flex items-center gap-3">
                          <ClientIcon
                            aria-hidden="true"
                            size={20}
                            className={`shrink-0 ${clientType === "claude" ? "text-[#D97757]" : "text-foreground"}`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{app.name}</p>
                            <p className="mt-1 text-xs text-muted">
                              Connected {new Date(app.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="max-w-48 py-4 whitespace-normal break-words">
                        {app.team}
                      </Table.Cell>
                      <Table.Cell className="max-w-72 py-4 text-sm text-muted whitespace-normal">
                        {app.scopes.map((scope) => MCP_PERMISSIONS[scope]).join(" · ")}
                      </Table.Cell>
                      <Table.Cell className="py-4 text-end">
                        <Button
                          variant="danger-soft"
                          size="sm"
                          isDisabled={loading || (Boolean(pending) && pending !== app.id)}
                          isPending={pending === app.id}
                          aria-label={`Remove ${app.name} access to ${app.team}`}
                          onPress={() => revoke(app.id)}
                        >
                          Remove access
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </Surface>
  );
}
