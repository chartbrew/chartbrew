import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Accordion,
  FieldError,
  Input,
  Label,
  Link,
  ListBox,
  SearchField,
  Select,
  Separator,
  Switch,
  TextField,
  Tooltip,
} from "@heroui/react";
import {
  LuCircleCheck,
  LuInfo,
  LuPlus,
  LuRefreshCw,
  LuTrash2,
  LuTriangleAlert,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import {
  runSourceAction,
  testRequest,
  testSavedConnection,
} from "../../slices/connection";
import { selectTeam } from "../../slices/team";

const AUTH_OPTIONS = [
  { id: "none", label: "No authentication" },
  { id: "bearer", label: "Bearer token" },
  { id: "headers", label: "Custom headers" },
  { id: "oauth", label: "OAuth" },
];

const markdownComponents = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-medium first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-muted">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  a: ({ href, children }) => {
    if (!href || !/^https?:/i.test(href)) return <span>{children}</span>;
    return <Link href={href} rel="noreferrer" target="_blank">{children}</Link>;
  },
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-divider pl-3 text-muted">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <Separator className="my-3" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs">{children}</pre>
  ),
  code: ({ className, children }) => {
    const text = Array.isArray(children) ? children.join("") : String(children || "");
    if (className || text.includes("\n")) {
      return <code className="text-[0.9em]">{children}</code>;
    }
    return <code className="rounded bg-surface-secondary px-1 py-0.5 text-[0.9em]">{children}</code>;
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-divider px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-divider px-2 py-1.5 align-top">{children}</td>,
  img: () => null,
};

function McpMarkdown({ children }) {
  if (!children) return null;
  return (
    <div className="max-h-80 overflow-auto text-sm text-foreground-500">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

McpMarkdown.propTypes = {
  children: PropTypes.string,
};

function LabelWithTip({ label, tip }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <Tooltip delay={0}>
        <Tooltip.Trigger>
          <span className="flex text-muted">
            <LuInfo size={14} />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content className="max-w-xs">{tip}</Tooltip.Content>
      </Tooltip>
    </span>
  );
}

LabelWithTip.propTypes = {
  label: PropTypes.string.isRequired,
  tip: PropTypes.string.isRequired,
};

function parseConnectionTestBody(raw) {
  if (!raw) return { message: "", details: "" };
  try {
    const body = JSON.parse(raw);
    if (typeof body === "string") return { message: body, details: "" };
    const message = body.error || body.message || "";
    const details = body.details ? String(body.details) : "";
    return {
      message,
      details: details && details !== message ? details : "",
    };
  } catch (error) {
    return { message: raw, details: "" };
  }
}

function getInitialConnection(editConnection) {
  const authentication = editConnection?.authentication || {};
  return {
    ...(editConnection || {}),
    type: "mcp",
    subType: "mcp",
    name: editConnection?.name || "MCP server",
    host: editConnection?.host || "",
    authentication: {
      type: authentication.type || "none",
      token: "",
      headers: (authentication.headerNames || []).reduce((result, name) => {
        result[name] = "";
        return result;
      }, {}),
    },
    options: {
      ...(editConnection?.options || {}),
      mcp: { ...(editConnection?.options?.mcp || {}) },
    },
    schema: {
      ...(editConnection?.schema || {}),
      mcp: { ...(editConnection?.schema?.mcp || {}) },
    },
  };
}

function McpToolRow({ tool, approval, needsReview, onChangeApproval }) {
  const isDestructive = tool.annotations?.destructiveHint === true;
  const isReadOnlyHint = tool.annotations?.readOnlyHint === true;
  const required = tool.inputSchema?.required || [];
  const hasOutputSchema = tool.outputSchema && Object.keys(tool.outputSchema).length > 0;

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl border border-divider p-0 shadow-none">
      <Card.Content className="gap-4 px-6 pt-6 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Card.Title className="text-base font-semibold leading-6">
                {tool.title || tool.name}
              </Card.Title>
              {!isDestructive && !isReadOnlyHint && (
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span
                      aria-label="This server did not mark this tool as read-only"
                      className="flex text-warning"
                    >
                      <LuTriangleAlert size={16} />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-xs">
                    This server did not mark this tool as read-only
                  </Tooltip.Content>
                </Tooltip>
              )}
              {isReadOnlyHint && (
                <Chip size="sm" variant="soft" color="success">Read-only</Chip>
              )}
              {isDestructive && (
                <Chip size="sm" variant="soft" color="danger">Not available</Chip>
              )}
              {needsReview && !isDestructive && (
                <Chip size="sm" variant="soft" color="warning">Needs review</Chip>
              )}
            </div>
            {!isDestructive && (
              <div className="flex shrink-0 flex-wrap items-center gap-5">
                <Switch
                  aria-label={`Allow ${tool.name} in datasets`}
                  isSelected={approval?.datasets === true}
                  onChange={(selected) => onChangeApproval(tool, { datasets: selected })}
                >
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <LabelWithTip
                      label="Datasets"
                      tip="Use this tool when building charts."
                    />
                  </Switch.Content>
                </Switch>
                <Switch
                  aria-label={`Allow ${tool.name} in Ask`}
                  isSelected={approval?.ask === true}
                  onChange={(selected) => onChangeApproval(tool, { ask: selected })}
                >
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <LabelWithTip
                      label="Ask"
                      tip="Let Ask use this tool to answer questions."
                    />
                  </Switch.Content>
                </Switch>
              </div>
            )}
          </div>
          <p className="font-mono text-xs leading-5 text-muted">{tool.name}</p>
        </div>

        {required.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Required</span>
            {required.map((name) => <Chip key={name} size="sm" variant="secondary">{name}</Chip>)}
          </div>
        )}

        {isDestructive && (
          <Alert className="shadow-none" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>This tool cannot be used in Chartbrew</Alert.Title>
              <Alert.Description>It can change data, so it stays unavailable.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>

      <Accordion allowsMultipleExpanded className="border-t border-divider">
        {tool.description && (
          <Accordion.Item id={`${tool.name}-about`} textValue="About this tool">
            <Accordion.Heading>
              <Accordion.Trigger className="px-6 py-3.5">
                <span className="flex-1 text-start text-sm font-medium">About this tool</span>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="px-6 pb-5 pt-0">
                <McpMarkdown>{tool.description}</McpMarkdown>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        )}
        <Accordion.Item id={`${tool.name}-schema`} textValue="Input and output">
          <Accordion.Heading>
            <Accordion.Trigger className="px-6 py-3.5">
              <span className="flex-1 text-start text-sm font-medium">Input and output</span>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="px-6 pb-5 pt-0">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted">Input</p>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-content2 p-3 text-xs">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted">Output</p>
                  {hasOutputSchema ? (
                    <pre className="max-h-64 overflow-auto rounded-xl bg-content2 p-3 text-xs">
                      {JSON.stringify(tool.outputSchema, null, 2)}
                    </pre>
                  ) : (
                    <p className="rounded-xl bg-content2 p-3 text-sm text-muted">
                      No output shape provided
                    </p>
                  )}
                </div>
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}

function McpConnectionForm({ editConnection, onComplete, addError }) {
  const [connection, setConnection] = useState(() => getInitialConnection(editConnection));
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [toolSearch, setToolSearch] = useState("");

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const tools = connection.schema?.mcp?.tools || [];
  const visibleTools = tools.filter((tool) => {
    const query = toolSearch.trim().toLowerCase();
    if (!query) return true;
    return `${tool.name} ${tool.title || ""} ${tool.description || ""}`.toLowerCase().includes(query);
  });
  const approvals = connection.schema?.mcp?.allowedTools || {};
  const reviewRequired = new Set(
    (connection.schema?.mcp?.reviewRequired || []).map((item) => item.name)
  );
  const allowedCount = tools.filter((tool) => {
    const approval = approvals[tool.name];
    return approval?.datasets === true || approval?.ask === true;
  }).length;
  const server = connection.schema?.mcp?.server;
  const serverInitials = String(server?.name || "MCP")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const authenticationType = connection.authentication?.type || "none";

  const headerRows = useMemo(() => {
    return Object.entries(connection.authentication?.headers || {}).map(([name, value]) => ({ name, value }));
  }, [connection.authentication?.headers]);

  useEffect(() => {
    setConnection(getInitialConnection(editConnection));
  }, [editConnection]);

  const validate = () => {
    const nextErrors = {};
    if (!connection.name || connection.name.length > 24) {
      nextErrors.name = "Enter a name with 24 characters or fewer.";
    }
    try {
      const endpoint = new URL(connection.host);
      if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("scheme");
    } catch (error) {
      nextErrors.host = "Enter a valid HTTP or HTTPS server URL.";
    }
    if (authenticationType === "bearer"
      && !connection.authentication?.token
      && !editConnection?.authentication?.hasToken) {
      nextErrors.token = "Enter a bearer token.";
    }
    if (authenticationType === "headers" && headerRows.some((header) => !header.name || !header.value
      && !editConnection?.authentication?.headerNames?.includes(header.name))) {
      nextErrors.headers = "Complete each custom header.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildConnection = () => ({
    ...connection,
    type: "mcp",
    subType: "mcp",
    host: connection.host.trim(),
    authentication: {
      ...connection.authentication,
      type: authenticationType,
    },
  });

  const applyDiscovery = (discovery) => {
    if (!discovery) return;
    setConnection((current) => ({
      ...current,
      active: true,
      schema: {
        ...(current.schema || {}),
        mcp: discovery,
      },
    }));
  };

  const onTest = async () => {
    if (!validate()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const action = editConnection?.id
        ? await dispatch(testSavedConnection({ team_id: team.id, connection_id: editConnection.id }))
        : await dispatch(testRequest({ team_id: team.id, connection: buildConnection() }));
      const response = action.payload;
      const raw = await response.text();
      const parsed = parseConnectionTestBody(raw);
      const details = parsed.details
        || (!response.ok && response.status >= 400 ? `HTTP ${response.status}` : "");
      setTestResult({
        ok: response.ok,
        status: response.status,
        message: parsed.message,
        details,
      });
      if (response.ok) {
        try {
          applyDiscovery(JSON.parse(raw).discovery);
        } catch (error) {
          // Discovery payload was not JSON.
        }
      }
    } catch (error) {
      setTestResult({
        ok: false,
        status: 400,
        message: "Chartbrew could not reach this MCP server.",
        details: "",
      });
    } finally {
      setTestLoading(false);
    }
  };

  const onSave = async () => {
    if (!validate()) return false;
    setSaveLoading(true);
    try {
      return await onComplete(buildConnection());
    } finally {
      setSaveLoading(false);
    }
  };

  const onStartOAuth = async () => {
    if (!editConnection?.id || !validate()) return;
    setOauthLoading(true);
    try {
      const saved = await onComplete(buildConnection());
      if (!saved) return;
      const action = await dispatch(runSourceAction({
        team_id: team.id,
        connection_id: editConnection.id,
        action: "startOAuth",
      }));
      if (action.payload?.url) window.location.assign(action.payload.url);
      else setErrors({ oauth: action.payload?.error || "OAuth could not start." });
    } finally {
      setOauthLoading(false);
    }
  };

  const onAuthenticationTypeChange = (type) => {
    setConnection({
      ...connection,
      authentication: {
        type,
        token: "",
        headers: type === "headers" ? connection.authentication?.headers || {} : {},
      },
    });
    setTestResult(null);
  };

  const updateHeader = (oldName, field, value) => {
    const headers = { ...(connection.authentication?.headers || {}) };
    const currentValue = headers[oldName] || "";
    delete headers[oldName];
    headers[field === "name" ? value : oldName] = field === "value" ? value : currentValue;
    setConnection({ ...connection, authentication: { ...connection.authentication, headers } });
  };

  const addHeader = () => {
    let name = "x-api-key";
    let index = 2;
    while (Object.prototype.hasOwnProperty.call(connection.authentication?.headers || {}, name)) {
      name = `x-api-key-${index}`;
      index += 1;
    }
    setConnection({
      ...connection,
      authentication: {
        ...connection.authentication,
        headers: { ...(connection.authentication?.headers || {}), [name]: "" },
      },
    });
  };

  const removeHeader = (name) => {
    const headers = { ...(connection.authentication?.headers || {}) };
    delete headers[name];
    setConnection({ ...connection, authentication: { ...connection.authentication, headers } });
  };

  const onChangeApproval = (tool, updates) => {
    const current = approvals[tool.name] || {};
    const nextApproval = {
      ...current,
      datasets: current.datasets === true,
      ask: current.ask === true,
      confirmedReadOnly: true,
      contractFingerprint: tool.contractFingerprint,
      riskFingerprint: tool.riskFingerprint,
      ...updates,
    };
    setConnection({
      ...connection,
      schema: {
        ...connection.schema,
        mcp: {
          ...connection.schema.mcp,
          allowedTools: { ...approvals, [tool.name]: nextApproval },
        },
      },
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Card className="gap-6 rounded-3xl border border-divider p-6 shadow-none">
        <Card.Header className="flex flex-row items-center gap-3">
          <Avatar className="size-10 shrink-0">
            {server?.icon && <Avatar.Image alt="" src={server.icon} />}
            <Avatar.Fallback>{serverInitials}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <Card.Title className="text-base font-semibold">
              {editConnection ? `Edit ${connection.name || "MCP connection"}` : "Connect an MCP server"}
            </Card.Title>
          </div>
        </Card.Header>
        <Card.Content className="gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField isInvalid={Boolean(errors.name)} name="mcp-name">
              <Label>Connection name</Label>
              <Input
                value={connection.name || ""}
                onChange={(event) => setConnection({ ...connection, name: event.target.value })}
                placeholder="Product data"
                variant="secondary"
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </TextField>
            <TextField isInvalid={Boolean(errors.host)} name="mcp-endpoint">
              <Label>Server URL</Label>
              <Input
                value={connection.host || ""}
                onChange={(event) => setConnection({ ...connection, host: event.target.value })}
                placeholder="https://mcp.example.com/mcp"
                variant="secondary"
              />
              {errors.host && <FieldError>{errors.host}</FieldError>}
            </TextField>
          </div>

          <div className="max-w-sm">
            <Select
              aria-label="Authentication method"
              value={authenticationType}
              onChange={onAuthenticationTypeChange}
              selectionMode="single"
              disallowEmptySelection
              variant="secondary"
            >
              <Label>Authentication</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {AUTH_OPTIONS.map((option) => (
                    <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                      {option.label}<ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {authenticationType === "bearer" && (
            <TextField className="max-w-xl" isInvalid={Boolean(errors.token)} name="mcp-bearer">
              <Label>Bearer token</Label>
              <Input
                type="password"
                value={connection.authentication?.token || ""}
                onChange={(event) => setConnection({
                  ...connection,
                  authentication: { ...connection.authentication, token: event.target.value },
                })}
                placeholder={editConnection?.authentication?.hasToken ? "Saved token" : "Paste token"}
                variant="secondary"
              />
              {errors.token && <FieldError>{errors.token}</FieldError>}
            </TextField>
          )}

          {authenticationType === "headers" && (
            <div>
              <div className="flex items-center justify-between">
                <Label>Custom headers</Label>
                <Button size="sm" variant="tertiary" onPress={addHeader}><LuPlus /> Add header</Button>
              </div>
              <div className="mt-2 space-y-2">
                {headerRows.map((header) => (
                  <div key={header.name} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      aria-label="Header name"
                      value={header.name}
                      onChange={(event) => updateHeader(header.name, "name", event.target.value)}
                      variant="secondary"
                    />
                    <Input
                      aria-label={`${header.name} value`}
                      type="password"
                      value={header.value}
                      onChange={(event) => updateHeader(header.name, "value", event.target.value)}
                      placeholder={editConnection?.authentication?.headerNames?.includes(header.name) ? "Saved value" : "Value"}
                      variant="secondary"
                    />
                    <Button isIconOnly aria-label={`Remove ${header.name}`} variant="tertiary" onPress={() => removeHeader(header.name)}>
                      <LuTrash2 />
                    </Button>
                  </div>
                ))}
              </div>
              {errors.headers && <p className="mt-2 text-sm text-danger">{errors.headers}</p>}
            </div>
          )}

          {authenticationType === "oauth" && (
            <div className="flex flex-wrap items-center gap-3">
              {editConnection?.id ? (
                <Button variant="outline" isPending={oauthLoading} onPress={onStartOAuth}>
                  {oauthLoading ? <ButtonSpinner /> : null}
                  {editConnection?.authentication?.hasToken ? "Reconnect OAuth" : "Connect with OAuth"}
                </Button>
              ) : (
                <p className="text-sm text-muted">Save this connection, then connect with OAuth.</p>
              )}
              {editConnection?.authentication?.hasToken && (
                <div className="flex flex-row items-center gap-1 text-success">
                  <LuCircleCheck size={16} />
                  <span className="text-xs">Connected</span>
                </div>
              )}
              {errors.oauth && <p className="w-full text-sm text-danger">{errors.oauth}</p>}
            </div>
          )}
        </Card.Content>
        <Card.Footer className="flex-col items-stretch gap-4 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="tertiary"
              isPending={testLoading}
              isDisabled={authenticationType === "oauth" && !editConnection?.authentication?.hasToken}
              onPress={onTest}
            >
              {testLoading ? <ButtonSpinner /> : <LuRefreshCw />}
              Test and load tools
            </Button>
            <Button variant="primary" isPending={saveLoading} onPress={onSave}>
              {saveLoading && <ButtonSpinner />}
              Save connection
            </Button>
          </div>
          {testResult && (
            <Alert className="shadow-none border border-divider" status={testResult.ok ? "success" : "danger"}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{testResult.ok ? "Connection succeeded" : "Connection failed"}</Alert.Title>
                {testResult.message && <Alert.Description>{testResult.message}</Alert.Description>}
                {!testResult.ok && testResult.details && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-primary">View error details</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-secondary p-3 text-xs text-foreground">
                      {testResult.details}
                    </pre>
                  </details>
                )}
              </Alert.Content>
            </Alert>
          )}
          {addError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Title>Connection could not be saved</Alert.Title></Alert.Content>
            </Alert>
          )}
        </Card.Footer>
      </Card>

      {tools.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Tools</p>
              <Chip size="sm" variant="secondary">
                {allowedCount} of {tools.length} allowed
              </Chip>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {connection.schema?.mcp?.discoveredAt && (
                <span>{`Updated ${new Date(connection.schema.mcp.discoveredAt).toLocaleString()}`}</span>
              )}
              {connection.schema?.mcp?.discoveredAt && (
                <span aria-hidden="true">·</span>
              )}
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <span className="inline-flex items-center gap-1">
                    Approvals reset if a tool changes
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content className="max-w-xs">
                  Review this list again after the server updates a tool.
                </Tooltip.Content>
              </Tooltip>
              {server?.websiteUrl && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={server.websiteUrl} rel="noreferrer" target="_blank">
                    Server website
                  </Link>
                </>
              )}
            </div>
          </div>

          {tools.length > 4 && (
            <SearchField
              aria-label="Search tools"
              className="max-w-md"
              name="mcp-tool-search"
              value={toolSearch}
              onChange={(value) => setToolSearch(typeof value === "string" ? value : "")}
              variant="secondary"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search tools" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          )}

          <div className="flex flex-col gap-5">
            {visibleTools.map((tool) => (
              <McpToolRow
                key={tool.name}
                tool={tool}
                approval={approvals[tool.name]}
                needsReview={reviewRequired.has(tool.name)}
                onChangeApproval={onChangeApproval}
              />
            ))}
            {visibleTools.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No matching tools.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

McpToolRow.propTypes = {
  tool: PropTypes.object.isRequired,
  approval: PropTypes.object,
  needsReview: PropTypes.bool,
  onChangeApproval: PropTypes.func.isRequired,
};

McpConnectionForm.propTypes = {
  editConnection: PropTypes.object,
  onComplete: PropTypes.func.isRequired,
  addError: PropTypes.bool,
};

export default McpConnectionForm;
