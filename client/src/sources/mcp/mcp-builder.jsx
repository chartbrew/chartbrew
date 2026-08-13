import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Switch,
  TextField,
} from "@heroui/react";
import { LuCode, LuPlay, LuRefreshCw, LuSave, LuTrash2 } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import CodeEditor from "../../components/CodeEditor";
import { useTheme } from "../../modules/ThemeContext";
import DataTransform from "../../containers/Dataset/DataTransform";
import {
  getDataRequestBuilderMetadata,
  runDataRequest,
} from "../../slices/dataset";
import { selectTeam } from "../../slices/team";

function getSchemaType(schema = {}) {
  if (Array.isArray(schema.type)) return schema.type.find((type) => type !== "null") || "string";
  return schema.type || (schema.properties ? "object" : "string");
}

function getSchemaDefault(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (getSchemaType(schema) !== "object") return undefined;
  const value = Object.entries(schema.properties || {}).reduce((result, [name, childSchema]) => {
    const childDefault = getSchemaDefault(childSchema);
    if (childDefault !== undefined) result[name] = childDefault;
    return result;
  }, {});
  return Object.keys(value).length ? value : undefined;
}

function SchemaField({ name, schema, value, required, onChange }) {
  const type = getSchemaType(schema);
  const label = schema.title || name;
  const description = schema.description || "";

  if (Array.isArray(schema.enum)) {
    return (
      <Select
        aria-label={label}
        value={value === undefined ? null : String(value)}
        onChange={(nextValue) => {
          const selected = schema.enum.find((option) => String(option) === String(nextValue));
          onChange(selected);
        }}
        selectionMode="single"
        variant="secondary"
      >
        <Label>{label}{required ? " *" : ""}</Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {schema.enum.map((option) => (
              <ListBox.Item key={String(option)} id={String(option)} textValue={String(option)}>
                {String(option)}<ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </Select>
    );
  }

  if (type === "boolean") {
    return (
      <div>
        <Switch isSelected={value === true} onChange={onChange}>
          <Switch.Content>
            <Switch.Control><Switch.Thumb /></Switch.Control>
            {label}{required ? " *" : ""}
          </Switch.Content>
        </Switch>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
    );
  }

  if (type === "object" && Object.keys(schema.properties || {}).length > 0) {
    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <fieldset className="rounded-xl border border-divider p-4 md:col-span-2">
        <legend className="px-1 text-sm font-medium">{label}{required ? " *" : ""}</legend>
        {description && <p className="mb-4 text-xs text-muted">{description}</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.entries(schema.properties).map(([childName, childSchema]) => (
            <SchemaField
              key={childName}
              name={childName}
              schema={childSchema}
              value={objectValue[childName]}
              required={(schema.required || []).includes(childName)}
              onChange={(childValue) => {
                const nextValue = { ...objectValue };
                if (childValue === "" || childValue === undefined) delete nextValue[childName];
                else nextValue[childName] = childValue;
                onChange(nextValue);
              }}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (type === "object" || type === "array") {
    return (
      <TextField name={`mcp-argument-${name}`}>
        <Label>{label}{required ? " *" : ""}</Label>
        <textarea
          className="min-h-28 w-full rounded-xl border border-divider bg-surface-secondary px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
          value={typeof value === "string" ? value : JSON.stringify(value ?? (type === "array" ? [] : {}), null, 2)}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch (error) {
              onChange(event.target.value);
            }
          }}
          aria-label={label}
        />
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </TextField>
    );
  }

  return (
    <TextField name={`mcp-argument-${name}`}>
      <Label>{label}{required ? " *" : ""}</Label>
      <Input
        type="text"
        inputMode={type === "number" || type === "integer" ? "decimal" : undefined}
        value={value ?? ""}
        onChange={(event) => {
          if (["number", "integer"].includes(type)
            && event.target.value !== ""
            && Number.isFinite(Number(event.target.value))) {
            onChange(Number(event.target.value));
          } else {
            onChange(event.target.value);
          }
        }}
        placeholder={schema.default !== undefined ? String(schema.default) : ""}
        variant="secondary"
      />
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    </TextField>
  );
}

function McpBuilder({ dataRequest, onChangeRequest, onSave, onDelete }) {
  const [request, setRequest] = useState(dataRequest || {});
  const [metadata, setMetadata] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [argumentsText, setArgumentsText] = useState("{}");
  const [argumentsError, setArgumentsError] = useState("");
  const [result, setResult] = useState("");
  const [runError, setRunError] = useState("");
  const [showTransform, setShowTransform] = useState(false);

  const dispatch = useDispatch();
  const params = useParams();
  const team = useSelector(selectTeam);
  const { isDark } = useTheme();
  const configuration = request.configuration || {
    source: "mcp",
    tool: { name: "", contractFingerprint: "" },
    arguments: {},
    output: { mode: "auto", path: [] },
  };
  const approvedTools = useMemo(() => {
    return (metadata?.tools || []).filter((tool) => tool.approval?.datasets === true);
  }, [metadata]);
  const selectedTool = approvedTools.find((tool) => tool.name === configuration.tool?.name);

  useEffect(() => {
    setRequest(dataRequest || {});
    setArgumentsText(JSON.stringify(dataRequest?.configuration?.arguments || {}, null, 2));
  }, [dataRequest?.id]);

  useEffect(() => {
    loadMetadata();
  }, [dataRequest?.id, team?.id]);

  const updateConfiguration = (nextConfiguration) => {
    const nextRequest = { ...request, configuration: nextConfiguration };
    setRequest(nextRequest);
    onChangeRequest(nextRequest);
  };

  const loadMetadata = () => {
    if (!team?.id || !dataRequest?.id || !dataRequest?.dataset_id) return;
    setMetadataLoading(true);
    dispatch(getDataRequestBuilderMetadata({
      team_id: team.id,
      dataset_id: dataRequest.dataset_id,
      dataRequest_id: dataRequest.id,
    }))
      .then((action) => setMetadata(action.payload || null))
      .catch(() => setMetadata(null))
      .finally(() => setMetadataLoading(false));
  };

  const selectTool = (toolName) => {
    const tool = approvedTools.find((item) => item.name === toolName);
    const defaultArguments = Object.entries(tool?.inputSchema?.properties || {}).reduce((resultObject, [name, schema]) => {
      const defaultValue = getSchemaDefault(schema);
      if (defaultValue !== undefined) resultObject[name] = defaultValue;
      return resultObject;
    }, {});
    const nextConfiguration = {
      source: "mcp",
      tool: {
        name: tool?.name || "",
        contractFingerprint: tool?.contractFingerprint || "",
      },
      arguments: defaultArguments,
      output: { mode: "auto", path: [] },
    };
    setArgumentsText(JSON.stringify(defaultArguments, null, 2));
    setArgumentsError("");
    updateConfiguration(nextConfiguration);
  };

  const updateArgument = (name, value) => {
    const nextArguments = { ...(configuration.arguments || {}) };
    if (value === "" || value === undefined) delete nextArguments[name];
    else nextArguments[name] = value;
    setArgumentsText(JSON.stringify(nextArguments, null, 2));
    updateConfiguration({ ...configuration, arguments: nextArguments });
  };

  const updateAdvancedArguments = (value) => {
    setArgumentsText(value);
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Arguments must be a JSON object.");
      }
      setArgumentsError("");
      updateConfiguration({ ...configuration, arguments: parsed });
    } catch (error) {
      setArgumentsError(error.message);
    }
  };

  const saveRequest = async () => {
    if (!selectedTool || argumentsError) return null;
    setSaveLoading(true);
    try {
      return await onSave(request);
    } finally {
      setSaveLoading(false);
    }
  };

  const runRequest = async () => {
    if (!selectedTool || argumentsError) return;
    setRunLoading(true);
    setRunError("");
    try {
      const saved = await onSave(request);
      const requestId = saved?.payload?.id || dataRequest.id;
      const action = await dispatch(runDataRequest({
        team_id: team.id,
        dataset_id: dataRequest.dataset_id || params.datasetId,
        dataRequest_id: requestId,
        getCache: false,
      }));
      const payload = action.payload;
      if (payload?.status?.statusCode >= 400) {
        setRunError(typeof payload.response === "string" ? payload.response : JSON.stringify(payload.response));
        return;
      }
      const rows = payload?.response?.dataRequest?.responseData?.data;
      setResult(JSON.stringify(rows ?? payload?.response ?? {}, null, 2));
    } catch (error) {
      setRunError(error.message || "The MCP tool could not run.");
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-divider bg-surface p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-2xl">
          <Select
            aria-label="MCP tool"
            value={configuration.tool?.name || null}
            onChange={selectTool}
            selectionMode="single"
            disallowEmptySelection
            variant="secondary"
          >
            <Label>Tool</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {approvedTools.map((tool) => (
                  <ListBox.Item key={tool.name} id={tool.name} textValue={tool.title || tool.name}>
                    <div className="min-w-0">
                      <p className="font-medium">{tool.title || tool.name}</p>
                      {tool.description && <p className="truncate text-xs text-muted">{tool.description}</p>}
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <Button variant="tertiary" isPending={metadataLoading} onPress={loadMetadata}>
          {metadataLoading ? <ButtonSpinner /> : <LuRefreshCw />}
          Reload tools
        </Button>
      </div>

      {!metadataLoading && approvedTools.length === 0 && (
        <Alert className="mt-5 shadow-none" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No tools are approved for datasets</Alert.Title>
            <Alert.Description>Open the connection and approve a read-only tool for Datasets.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {selectedTool && (
        <>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{selectedTool.title || selectedTool.name}</p>
              {selectedTool.description && <p className="mt-1 max-w-3xl text-sm text-muted">{selectedTool.description}</p>}
            </div>
            <Button size="sm" variant={advanced ? "secondary" : "tertiary"} onPress={() => setAdvanced(!advanced)}>
              <LuCode /> {advanced ? "Use form" : "Edit JSON"}
            </Button>
          </div>

          <div className="mt-5">
            {advanced ? (
              <>
                <CodeEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  height="300px"
                  value={argumentsText}
                  onChange={updateAdvancedArguments}
                />
                {argumentsError && <p className="mt-2 text-sm text-danger">{argumentsError}</p>}
              </>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {Object.entries(selectedTool.inputSchema?.properties || {}).map(([name, schema]) => (
                  <SchemaField
                    key={name}
                    name={name}
                    schema={schema}
                    value={configuration.arguments?.[name]}
                    required={(selectedTool.inputSchema?.required || []).includes(name)}
                    onChange={(value) => updateArgument(name, value)}
                  />
                ))}
                {Object.keys(selectedTool.inputSchema?.properties || {}).length === 0 && (
                  <p className="text-sm text-muted">This tool does not need arguments.</p>
                )}
              </div>
            )}
          </div>

          <Separator className="my-6" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              aria-label="Output selection"
              value={configuration.output?.mode || "auto"}
              onChange={(mode) => updateConfiguration({
                ...configuration,
                output: { ...configuration.output, mode },
              })}
              selectionMode="single"
              disallowEmptySelection
              variant="secondary"
            >
              <Label>Output</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="auto" textValue="Automatic">Automatic<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="path" textValue="Select a path">Select a path<ListBox.ItemIndicator /></ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            {configuration.output?.mode === "path" && (
              <TextField name="mcp-output-path">
                <Label>Result path</Label>
                <Input
                  value={Array.isArray(configuration.output?.path)
                    ? configuration.output.path.join(".")
                    : configuration.output?.path || ""}
                  onChange={(event) => updateConfiguration({
                    ...configuration,
                    output: { ...configuration.output, path: event.target.value },
                  })}
                  placeholder="data.items"
                  variant="secondary"
                />
              </TextField>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" isPending={runLoading} onPress={runRequest}>
              {runLoading ? <ButtonSpinner /> : <LuPlay />}
              Run tool
            </Button>
            <Button variant="secondary" isPending={saveLoading} onPress={saveRequest}>
              {saveLoading ? <ButtonSpinner /> : <LuSave />}
              Save
            </Button>
            <Button variant="tertiary" onPress={() => setShowTransform(true)}>
              Transform data
            </Button>
            <Button variant="tertiary" onPress={() => onDelete(dataRequest.id)}>
              <LuTrash2 /> Delete
            </Button>
          </div>

          {runError && (
            <Alert className="mt-5 shadow-none" status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Title>Tool run failed</Alert.Title><Alert.Description>{runError}</Alert.Description></Alert.Content>
            </Alert>
          )}
          {result && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">Preview</p>
                <Chip size="sm" variant="secondary">JSON</Chip>
              </div>
              <CodeEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="320px"
                value={result}
                readOnly
              />
            </div>
          )}
          {showTransform && (
            <DataTransform
              isOpen={showTransform}
              onClose={() => setShowTransform(false)}
              initialTransform={request.transform}
              onSave={(transform) => {
                const nextRequest = { ...request, transform };
                setRequest(nextRequest);
                onChangeRequest(nextRequest);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

SchemaField.propTypes = {
  name: PropTypes.string.isRequired,
  schema: PropTypes.object.isRequired,
  value: PropTypes.any,
  required: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

McpBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default McpBuilder;
