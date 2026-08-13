import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Switch,
  TextField,
} from "@heroui/react";
import {
  LuBot,
  LuDatabase,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuShieldCheck,
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
  const isConfirmed = approval?.confirmedReadOnly === true;
  const required = tool.inputSchema?.required || [];

  return (
    <div className="border-b border-divider py-5 last:border-b-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{tool.title || tool.name}</p>
            {tool.annotations?.readOnlyHint && (
              <Chip size="sm" variant="soft" color="success">Read-only hint</Chip>
            )}
            {isDestructive && (
              <Chip size="sm" variant="soft" color="danger">Not available</Chip>
            )}
            {needsReview && !isDestructive && (
              <Chip size="sm" variant="soft" color="warning">Needs review</Chip>
            )}
          </div>
          {tool.title && <p className="mt-1 text-xs text-muted">{tool.name}</p>}
          {tool.description && (
            <p className="mt-2 text-sm leading-6 text-foreground-500">{tool.description}</p>
          )}
          {required.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Required:</span>
              {required.map((name) => <Chip key={name} size="sm" variant="secondary">{name}</Chip>)}
            </div>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-primary">View tool schema</summary>
            <div className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Input</p>
                <pre className="max-h-64 overflow-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground">
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Output</p>
                <pre className="max-h-64 overflow-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground">
                  {JSON.stringify(tool.outputSchema || {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>

        <div className="w-full shrink-0 space-y-3 lg:w-64">
          {!isDestructive && (
            <Checkbox
              isSelected={isConfirmed}
              onChange={(selected) => onChangeApproval(tool, { confirmedReadOnly: selected })}
            >
              <Checkbox.Content>
                <Checkbox.Control className="size-4 shrink-0">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-sm">I confirm this tool only reads data</span>
              </Checkbox.Content>
            </Checkbox>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm"><LuDatabase size={16} /> Datasets</span>
            <Switch
              aria-label={`Allow ${tool.name} in datasets`}
              isDisabled={!isConfirmed || isDestructive}
              isSelected={approval?.datasets === true}
              onChange={(selected) => onChangeApproval(tool, { datasets: selected })}
            >
              <Switch.Control><Switch.Thumb /></Switch.Control>
            </Switch>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm"><LuBot size={16} /> Ask</span>
            <Switch
              aria-label={`Allow ${tool.name} in Ask`}
              isDisabled={!isConfirmed || isDestructive}
              isSelected={approval?.ask === true}
              onChange={(selected) => onChangeApproval(tool, { ask: selected })}
            >
              <Switch.Control><Switch.Thumb /></Switch.Control>
            </Switch>
          </div>
        </div>
      </div>
    </div>
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
      const body = await response.json().catch(() => ({}));
      setTestResult({ ok: response.ok, status: response.status, message: body.error || body.message || "" });
      if (response.ok) applyDiscovery(body.discovery);
    } catch (error) {
      setTestResult({ ok: false, status: 400, message: "Chartbrew could not reach this MCP server." });
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
    if (updates.confirmedReadOnly === false) {
      const nextApprovals = { ...approvals };
      delete nextApprovals[tool.name];
      setConnection({
        ...connection,
        schema: { ...connection.schema, mcp: { ...connection.schema.mcp, allowedTools: nextApprovals } },
      });
      return;
    }
    const nextApproval = {
      ...current,
      datasets: current.datasets === true,
      ask: current.ask === true,
      confirmedReadOnly: updates.confirmedReadOnly ?? current.confirmedReadOnly ?? false,
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
    <div className="rounded-3xl border border-divider bg-surface p-6 pb-8">
      <div className="max-w-3xl">
        <p className="text-lg font-semibold">
          {editConnection ? `Edit ${editConnection.name}` : "Connect an MCP server"}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <div className="mt-4 max-w-sm">
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
          <TextField className="mt-4 max-w-xl" isInvalid={Boolean(errors.token)} name="mcp-bearer">
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
          <div className="mt-5">
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
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {editConnection?.authentication?.hasToken && (
              <Chip variant="soft" color="success"><LuShieldCheck /> OAuth connected</Chip>
            )}
            {editConnection?.id ? (
              <Button variant="secondary" isPending={oauthLoading} onPress={onStartOAuth}>
                {oauthLoading ? <ButtonSpinner /> : <LuShieldCheck />}
                {editConnection?.authentication?.hasToken ? "Reconnect OAuth" : "Connect with OAuth"}
              </Button>
            ) : (
              <p className="text-sm text-muted">Save this connection, then connect with OAuth.</p>
            )}
            {errors.oauth && <p className="w-full text-sm text-danger">{errors.oauth}</p>}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
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
          <Alert className="mt-4 shadow-none" status={testResult.ok ? "success" : "danger"}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{testResult.ok ? "Connection succeeded" : "Connection failed"}</Alert.Title>
              {testResult.message && <Alert.Description>{testResult.message}</Alert.Description>}
            </Alert.Content>
          </Alert>
        )}
        {addError && (
          <Alert className="mt-4" status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Title>Connection could not be saved</Alert.Title></Alert.Content>
          </Alert>
        )}
      </div>

      {tools.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {server?.icon ? (
                <img alt="" src={server.icon} className="size-10 rounded-lg object-contain" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-lg bg-surface-secondary text-sm font-semibold">
                  {serverInitials}
                </div>
              )}
              <div>
                <p className="font-semibold">{server?.name || "Available tools"}</p>
                <p className="text-sm text-muted">{tools.length} {tools.length === 1 ? "tool" : "tools"}</p>
                {server?.description && (
                  <p className="mt-1 max-w-2xl text-sm text-foreground-500">{server.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                  {connection.schema?.mcp?.discoveredAt && (
                    <span>{`Updated ${new Date(connection.schema.mcp.discoveredAt).toLocaleString()}`}</span>
                  )}
                  {server?.websiteUrl && (
                    <a href={server.websiteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Server website
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <LuTriangleAlert size={16} /> Approvals reset when a tool changes
            </div>
          </div>
          <TextField className="mt-5 max-w-md" aria-label="Search MCP tools">
            <div className="relative">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" size={16} />
              <Input
                value={toolSearch}
                onChange={(event) => setToolSearch(event.target.value)}
                placeholder="Search tools"
                variant="secondary"
                className="pl-9"
              />
            </div>
          </TextField>
          <div className="mt-3">
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
        </>
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
