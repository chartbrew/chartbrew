import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  Alert,
  Button,
  ComboBox,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  Table,
  TextArea,
  TextField,
  Tooltip,
} from "@heroui/react";
import { LuCode, LuInfo, LuPlay, LuRefreshCw, LuSave, LuTrash2 } from "react-icons/lu";
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

const PREVIEW_ROW_LIMIT = 50;
const LONG_TEXT_FIELDS = new Set(["query", "sql", "hogql", "statement", "context", "prompt"]);

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

function summarizeText(value, limit = 88) {
  const text = String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const period = text.indexOf(". ");
  const sentence = period === -1 ? text : text.slice(0, period + 1);
  if (sentence.length <= limit) return sentence;
  return `${sentence.slice(0, limit - 1).trim()}…`;
}

function humanizeName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function fieldLabel(name, schema = {}) {
  if (schema.title && schema.title !== name) return schema.title;
  return humanizeName(name);
}

function isLongTextField(name, schema) {
  if (getSchemaType(schema) !== "string") return false;
  if (LONG_TEXT_FIELDS.has(String(name).toLowerCase())) return true;
  return Number(schema.maxLength) > 200;
}

function partitionFields(schema = {}) {
  const required = schema.required || [];
  const long = [];
  const main = [];
  const extra = [];
  Object.entries(schema.properties || {}).forEach(([name, fieldSchema]) => {
    const isRequired = required.includes(name);
    if (isLongTextField(name, fieldSchema)) long.push([name, fieldSchema, isRequired]);
    else if (isRequired) main.push([name, fieldSchema, true]);
    else extra.push([name, fieldSchema, false]);
  });
  long.sort(([left], [right]) => {
    const rank = (name) => (["query", "sql", "hogql"].includes(name.toLowerCase()) ? 0 : 1);
    return rank(left) - rank(right);
  });
  return { extra, long, main };
}

function formatPreviewCell(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function LabelWithTip({ label, required, tip }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}{required ? " *" : ""}
      {tip ? (
        <Tooltip delay={0}>
          <Tooltip.Trigger>
            <span className="flex text-muted">
              <LuInfo size={14} aria-hidden />
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content className="max-w-sm">{tip}</Tooltip.Content>
        </Tooltip>
      ) : null}
    </span>
  );
}

function SchemaField({ name, schema, value, required, onChange }) {
  const type = getSchemaType(schema);
  const label = fieldLabel(name, schema);
  const tip = summarizeText(schema.description, 220);

  if (Array.isArray(schema.enum)) {
    return (
      <Select
        aria-label={label}
        onChange={(nextValue) => {
          const selected = schema.enum.find((option) => String(option) === String(nextValue));
          onChange(selected);
        }}
        selectionMode="single"
        value={value === undefined ? null : String(value)}
        variant="secondary"
      >
        <Label>
          <LabelWithTip label={label} required={required} tip={tip} />
        </Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {schema.enum.map((option) => (
              <ListBox.Item id={String(option)} key={String(option)} textValue={String(option)}>
                {String(option)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  }

  if (type === "boolean") {
    return (
      <Switch isSelected={value === true} onChange={onChange}>
        <Switch.Content>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <LabelWithTip label={label} required={required} tip={tip} />
        </Switch.Content>
      </Switch>
    );
  }

  if (type === "object" && Object.keys(schema.properties || {}).length > 0) {
    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <fieldset className="md:col-span-2">
        <legend className="mb-3 text-sm font-medium text-foreground">
          <LabelWithTip label={label} required={required} tip={tip} />
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.entries(schema.properties).map(([childName, childSchema]) => (
            <SchemaField
              key={childName}
              name={childName}
              onChange={(childValue) => {
                const nextValue = { ...objectValue };
                if (childValue === "" || childValue === undefined) delete nextValue[childName];
                else nextValue[childName] = childValue;
                onChange(nextValue);
              }}
              required={(schema.required || []).includes(childName)}
              schema={childSchema}
              value={objectValue[childName]}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (type === "object" || type === "array") {
    return (
      <TextField name={`mcp-argument-${name}`}>
        <Label>
          <LabelWithTip label={label} required={required} tip={tip} />
        </Label>
        <TextArea
          aria-label={label}
          className="min-h-28 font-mono text-sm"
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch (_error) {
              onChange(event.target.value);
            }
          }}
          value={typeof value === "string" ? value : JSON.stringify(value ?? (type === "array" ? [] : {}), null, 2)}
          variant="secondary"
        />
      </TextField>
    );
  }

  if (isLongTextField(name, schema)) {
    const isQuery = ["query", "sql", "hogql", "statement"].includes(name.toLowerCase());
    return (
      <TextField name={`mcp-argument-${name}`}>
        <Label>
          <LabelWithTip label={label} required={required} tip={tip} />
        </Label>
        <TextArea
          aria-label={label}
          className={isQuery ? "min-h-44 font-mono text-sm" : "min-h-28 text-sm"}
          onChange={(event) => onChange(event.target.value)}
          rows={isQuery ? 10 : 4}
          value={value ?? ""}
          variant="secondary"
        />
      </TextField>
    );
  }

  return (
    <TextField name={`mcp-argument-${name}`}>
      <Label>
        <LabelWithTip label={label} required={required} tip={tip} />
      </Label>
      <Input
        inputMode={type === "number" || type === "integer" ? "decimal" : undefined}
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
        type="text"
        value={value ?? ""}
        variant="secondary"
      />
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
  const [previewRows, setPreviewRows] = useState(null);
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
  const fieldGroups = useMemo(
    () => partitionFields(selectedTool?.inputSchema),
    [selectedTool],
  );
  const previewColumns = useMemo(() => {
    if (!Array.isArray(previewRows) || !previewRows.length) return [];
    const first = previewRows.find((row) => row && typeof row === "object" && !Array.isArray(row));
    return first ? Object.keys(first) : [];
  }, [previewRows]);
  const previewIsTextBlock = previewColumns.length === 1 && previewColumns[0] === "content";

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
    setPreviewRows(null);
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
        setPreviewRows(null);
        return;
      }
      const rows = payload?.response?.dataRequest?.responseData?.data;
      setPreviewRows(Array.isArray(rows) ? rows : rows ? [rows] : []);
    } catch (error) {
      setRunError(error.message || "The tool could not run.");
      setPreviewRows(null);
    } finally {
      setRunLoading(false);
    }
  };

  const renderFields = (fields) => fields.map(([name, schema, required]) => (
    <SchemaField
      key={name}
      name={name}
      onChange={(value) => updateArgument(name, value)}
      required={required}
      schema={schema}
      value={configuration.arguments?.[name]}
    />
  ));

  const toolSummary = summarizeText(selectedTool?.description, 160);

  return (
    <div className="flex flex-col gap-6 pl-1 pr-1 sm:pl-4 sm:pr-4">
      <div className="flex flex-wrap items-end gap-2">
        <ComboBox
          aria-label="Tool"
          className="min-w-0 flex-1"
          menuTrigger="focus"
          onSelectionChange={(toolName) => {
            if (toolName) selectTool(String(toolName));
          }}
          selectedKey={configuration.tool?.name || null}
          variant="secondary"
        >
          <Label>
            <LabelWithTip label="Tool" tip={toolSummary} />
          </Label>
          <ComboBox.InputGroup>
            <Input placeholder="Search tools" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover className="max-w-md">
            <ListBox>
              {approvedTools.map((tool) => {
                const title = tool.title || tool.name;
                const summary = summarizeText(tool.description);
                return (
                  <ListBox.Item
                    id={tool.name}
                    key={tool.name}
                    textValue={`${title} ${summary}`.trim()}
                  >
                    <Label>{title}</Label>
                    {summary ? <Description className="line-clamp-2">{summary}</Description> : null}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <Tooltip delay={0}>
          <Tooltip.Trigger>
            <Button
              aria-label="Reload tools"
              isIconOnly
              isPending={metadataLoading}
              onPress={loadMetadata}
              variant="tertiary"
            >
              {metadataLoading ? <ButtonSpinner /> : <LuRefreshCw size={16} aria-hidden />}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Reload tools</Tooltip.Content>
        </Tooltip>
        {selectedTool ? (
          <Button onPress={() => setAdvanced(!advanced)} variant="tertiary">
            <LuCode size={16} aria-hidden />
            {advanced ? "Use form" : "Edit JSON"}
          </Button>
        ) : null}
      </div>

      {!metadataLoading && approvedTools.length === 0 && (
        <Alert className="shadow-none" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No tools are available for datasets</Alert.Title>
            <Alert.Description>Open the connection and allow a read-only tool for datasets.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {selectedTool && (
        <>
          {advanced ? (
            <div className="flex flex-col gap-2">
              <CodeEditor
                height="280px"
                mode="json"
                onChange={updateAdvancedArguments}
                theme={isDark ? "one_dark" : "tomorrow"}
                value={argumentsText}
              />
              {argumentsError ? <p className="text-sm text-danger">{argumentsError}</p> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {fieldGroups.long.length > 0 ? (
                <div className="flex flex-col gap-5">
                  {renderFields(fieldGroups.long)}
                </div>
              ) : null}
              {fieldGroups.main.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderFields(fieldGroups.main)}
                </div>
              ) : null}
              {fieldGroups.long.length === 0 && fieldGroups.main.length === 0 && fieldGroups.extra.length === 0 ? (
                <p className="text-sm text-muted">This tool does not need extra details.</p>
              ) : null}
              <Accordion className="border-0 bg-transparent shadow-none" hideSeparator variant="surface">
                <Accordion.Item id="mcp-more-options" textValue="More options">
                  <Accordion.Heading>
                    <Accordion.Trigger className="rounded-lg px-0 py-1.5">
                      <span className="text-sm font-medium text-foreground">More options</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-5 px-0 pb-1 pt-3">
                      {fieldGroups.extra.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {renderFields(fieldGroups.extra)}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Select
                          aria-label="Result format"
                          disallowEmptySelection
                          onChange={(mode) => updateConfiguration({
                            ...configuration,
                            output: { ...configuration.output, mode },
                          })}
                          selectionMode="single"
                          value={configuration.output?.mode || "auto"}
                          variant="secondary"
                        >
                          <Label>Result format</Label>
                          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="auto" textValue="Detect automatically">
                                Detect automatically
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="path" textValue="Choose a field path">
                                Choose a field path
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                        {configuration.output?.mode === "path" ? (
                          <TextField name="mcp-output-path">
                            <Label>Field path</Label>
                            <Input
                              onChange={(event) => updateConfiguration({
                                ...configuration,
                                output: { ...configuration.output, path: event.target.value },
                              })}
                              placeholder="data.items"
                              value={Array.isArray(configuration.output?.path)
                                ? configuration.output.path.join(".")
                                : configuration.output?.path || ""}
                              variant="secondary"
                            />
                          </TextField>
                        ) : null}
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button isPending={runLoading} onPress={runRequest} variant="primary">
              {runLoading ? <ButtonSpinner /> : <LuPlay size={16} aria-hidden />}
              Run
            </Button>
            <Button isPending={saveLoading} onPress={saveRequest} variant="secondary">
              {saveLoading ? <ButtonSpinner /> : <LuSave size={16} aria-hidden />}
              Save
            </Button>
            <Button onPress={() => setShowTransform(true)} variant="ghost">
              Transform
            </Button>
            <Button className="ml-auto" onPress={() => onDelete(dataRequest.id)} variant="danger-soft">
              <LuTrash2 size={16} aria-hidden />
              Delete
            </Button>
          </div>

          {runError ? (
            <Alert className="shadow-none" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Could not run this tool</Alert.Title>
                <Alert.Description>{runError}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          {previewRows === null ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-divider px-6 py-8 text-center">
              <p className="text-sm text-muted">Run to preview rows</p>
            </div>
          ) : previewIsTextBlock || previewColumns.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <p className="text-sm text-muted">This result is not rows and columns yet.</p>
              <CodeEditor
                height="240px"
                mode="json"
                readOnly
                theme={isDark ? "one_dark" : "tomorrow"}
                value={JSON.stringify(previewRows, null, 2)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <p className="text-sm text-muted">
                  {previewRows.length} {previewRows.length === 1 ? "row" : "rows"}
                </p>
              </div>
              <Table className="border border-divider shadow-none">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Tool preview" className="min-w-[560px]">
                    <Table.Header>
                      {previewColumns.map((column, index) => (
                        <Table.Column id={column} isRowHeader={index === 0} key={column}>
                          {column}
                        </Table.Column>
                      ))}
                    </Table.Header>
                    <Table.Body>
                      {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((row, rowIndex) => (
                        <Table.Row id={`preview-${rowIndex}`} key={`preview-${rowIndex}`}>
                          {previewColumns.map((column) => (
                            <Table.Cell key={column}>
                              <span className="block max-w-[240px] truncate" title={formatPreviewCell(row[column])}>
                                {formatPreviewCell(row[column])}
                              </span>
                            </Table.Cell>
                          ))}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}

          {showTransform ? (
            <DataTransform
              initialTransform={request.transform}
              isOpen={showTransform}
              onClose={() => setShowTransform(false)}
              onSave={(transform) => {
                const nextRequest = { ...request, transform };
                setRequest(nextRequest);
                onChangeRequest(nextRequest);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

LabelWithTip.propTypes = {
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  tip: PropTypes.string,
};

SchemaField.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  schema: PropTypes.object.isRequired,
  value: PropTypes.any,
};

McpBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default McpBuilder;
