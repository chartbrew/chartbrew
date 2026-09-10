import React, { useEffect, useState } from "react";
import { Accordion, Button, Link, Spinner, Surface } from "@heroui/react";
import { LuCheck, LuCopy, LuExternalLink } from "react-icons/lu";
import { SiCursor } from "react-icons/si";
import { useSelector } from "react-redux";
import { VscClaude, VscMcp, VscOpenai } from "react-icons/vsc";
import toast from "react-hot-toast";

import { API_HOST } from "../../config/settings";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import canAccess from "../../config/canAccess";
import AuthorizedApps from "./AuthorizedApps";
import { getMcpSetup } from "./mcpSetup";

export default function McpSettings() {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");

    fetch(`${API_HOST}/.well-known/oauth-protected-resource/mcp`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error();
        }

        const metadata = await response.json();
        if (!controller.signal.aborted) {
          setSetup(getMcpSetup(metadata.resource));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("The server URL could not load. Try again.");
        }
      });

    return () => controller.abort();
  }, [retry]);

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied({ value });
    } catch {
      setCopied(null);
      toast.error("Could not copy. Select and copy the text instead.");
    }
  };

  const clients = [
    {
      name: "Codex",
      icon: VscOpenai,
      color: "text-indigo-500 dark:text-indigo-400",
      command: setup?.codex,
      steps: [
        "Run this command in your terminal.",
        "Sign in to Chartbrew when the browser opens. Start a new Codex task after you approve access.",
      ],
      docs: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
    },
    {
      name: "ChatGPT",
      icon: VscOpenai,
      color: "text-foreground",
      cloud: true,
      steps: [
        "Enable Developer mode in Settings → Security and login, if your workspace allows it.",
        "Open Plugins, select the plus button, and add Chartbrew with the server URL above. Connect and approve access.",
      ],
      docs: "https://developers.openai.com/plugins/deploy/connect-chatgpt",
    },
    {
      name: "Claude Code",
      icon: VscClaude,
      color: "text-[#D97757]",
      command: setup?.claudeCode,
      steps: [
        "Run this command in your terminal.",
        "Open Claude Code, run /mcp, and select Chartbrew to sign in.",
      ],
      docs: "https://code.claude.com/docs/en/mcp",
    },
    {
      name: "Claude",
      icon: VscClaude,
      color: "text-[#D97757]",
      cloud: true,
      steps: [
        "Open Customize → Connectors and add a custom connector. Your organization may require an owner to add it first.",
        "Name it Chartbrew, paste the server URL above, and connect. Sign in to approve access.",
      ],
      docs: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    },
    {
      name: "Cursor",
      icon: SiCursor,
      command: setup?.cursor,
      steps: [
        "Add this entry to .cursor/mcp.json in your project. Keep any servers already in the file.",
        "Open Cursor’s MCP settings and connect Chartbrew. If sign-in is not supported by your client version, use an API key instead.",
      ],
      docs: "https://cursor.com/docs/mcp",
    },
    {
      name: "Other clients",
      icon: VscMcp,
      steps: [
        "Add a remote MCP server with the URL above and Streamable HTTP transport.",
        "Choose OAuth and sign in. If your client asks for a registration method, choose dynamic registration (DCR).",
      ],
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Surface className="min-w-0 rounded-3xl border border-divider p-4 sm:p-6">
        <div className="flex flex-wrap gap-8">
          <section className="min-w-0 flex-1 basis-64">
            <h2 className="text-lg font-semibold">What you can do</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                "Find dashboards, charts, and datasets",
                "Read and refresh data to answer questions",
                "Explore connected sources and create datasets",
                "Create chart previews to review in Chartbrew",
                "Review recent changes and metric updates",
              ].map((capability) => (
                <li key={capability} className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">
              Available actions depend on the permissions you approve.
            </p>
          </section>

          <section className="min-w-0 flex-1 basis-72">
            <h3 className="text-sm font-semibold">Try asking your AI app</h3>
            <ul className="mt-4 divide-y divide-divider">
              {[
                "Find my website traffic dataset and create a horizontal bar chart preview of the top 10 countries by visitors.",
                "Show me recent changes to my dashboards and summarize which metrics need attention.",
              ].map((prompt, index) => (
                <li key={prompt} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <p className="min-w-0 flex-1 text-sm leading-relaxed">“{prompt}”</p>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="secondary"
                    aria-label={
                      copied?.value === prompt ? "Prompt copied" : `Copy example prompt ${index + 1}`
                    }
                    onPress={() => copy(prompt)}
                  >
                    {copied?.value === prompt ? <LuCheck aria-hidden /> : <LuCopy aria-hidden />}
                    <span className="sr-only" aria-live="polite">
                      {copied?.value === prompt ? "Prompt copied" : ""}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Surface>

      <Surface className="min-w-0 rounded-3xl border border-divider p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Connect an app</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Sign in, choose one team, and approve the permissions you need. Each connection stays with
          that team, even when you switch teams in Chartbrew.
        </p>
        <div className="my-6">
          <p className="mb-2 text-sm font-medium">Server URL</p>
          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3"
            >
              <span className="text-sm text-danger">{error}</span>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setRetry((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : !setup ? (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted"
            >
              <Spinner size="sm" />
              Loading server URL…
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-surface-secondary p-3">
              <code className="min-w-0 flex-1 break-all text-sm select-all">{setup.url}</code>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => copy(setup.url)}
              >
                {copied?.value === setup.url ? <LuCheck aria-hidden /> : <LuCopy aria-hidden />}
                <span aria-live="polite">
                  {copied?.value === setup.url ? "Copied" : "Copy URL"}
                </span>
              </Button>
            </div>
          )}
        </div>
        <Accordion className="rounded-3xl border border-divider">
          {clients.map(({ name, icon: Icon, color, steps, command, docs, cloud }) => (
            <Accordion.Item
              key={name}
              id={name}
            >
              <Accordion.Heading>
                <Accordion.Trigger className="gap-3 py-4 text-sm font-medium">
                  <Icon
                    aria-hidden
                    className={`size-5 shrink-0 ${color || "text-muted"}`}
                  />
                  {name}
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="flex flex-col gap-4 pb-5 text-sm">
                  {cloud && setup?.local ? (
                    <p className="text-warning">
                      This URL is local to your computer. Use a public HTTPS address for this app;
                      it cannot connect to localhost directly.
                    </p>
                  ) : null}
                  <ol className="list-decimal space-y-2 pl-5 text-muted">
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {command ? (
                    <div className="flex min-w-0 flex-col items-start gap-3">
                      <pre className="w-full whitespace-pre-wrap break-all rounded-xl bg-surface-secondary p-3 text-xs select-all">
                        <code>{command}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => copy(command)}
                      >
                        {copied?.value === command ? (
                          <LuCheck aria-hidden />
                        ) : (
                          <LuCopy aria-hidden />
                        )}
                        <span aria-live="polite">
                          {copied?.value === command
                            ? "Copied"
                            : name === "Cursor"
                              ? "Copy configuration"
                              : "Copy command"}
                        </span>
                      </Button>
                    </div>
                  ) : null}
                  {docs ? (
                    <Link
                      className="w-fit gap-1 text-sm"
                      href={docs}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {name} setup guide
                      <LuExternalLink
                        aria-hidden
                        size={14}
                      />
                    </Link>
                  ) : null}
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Surface>
      <AuthorizedApps />
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div>
          <h2 className="font-medium">Need an API key?</h2>
          <p className="mt-1 text-sm text-muted">
            Use one for clients without OAuth. API keys are managed separately for each team.
          </p>
        </div>
        {canAccess("teamAdmin", user.id, team.TeamRoles) ? (
          <Link href="/settings/team/api-keys">Manage API keys</Link>
        ) : (
          <p className="text-sm text-muted">Ask a team admin to create a key.</p>
        )}
      </div>
    </div>
  );
}
