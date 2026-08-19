import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  Chip,
  Description,
  Disclosure,
  EmptyState,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  Switch,
  Table,
  Tabs,
  TextArea,
  TextField,
  Tooltip,
  useFilter,
} from "@heroui/react";
import {
  LuCode,
  LuInfo,
  LuLayoutList,
  LuPlay,
  LuRefreshCw,
  LuSave,
  LuSlidersHorizontal,
  LuTrash2,
  LuWrench,
} from "react-icons/lu";
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
import McpAiBuilder from "./mcp-ai-builder";
import {
  getFieldTypeLabel,
  getSchemaDefault,
  getSchemaExample,
  getSchemaType,
  hasFormFields,
  isLongTextField,
  partitionFields,
} from "./mcp-builder.utils";

const PREVIEW_ROW_LIMIT = 50;

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

function formatPreviewCell(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function FieldLabel({ label, required, typeLabel }) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      {required ? <span className="text-danger">*</span> : null}
      {typeLabel ? <span className="text-xs font-normal text-muted">{typeLabel}</span> : null}
    </span>
  );
}

function StepHeading({ extra, step, tip, title }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-semibold text-accent">
        {step}
      </span>
      <p className="text-base font-semibold text-foreground">{title}</p>
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
      {extra ? (
        <Chip size="sm" variant="soft">
          <Chip.Label>{extra}</Chip.Label>
        </Chip>
      ) : null}
    </div>
  );
}

function FieldHelp({ text }) {
  if (!text) return null;
  return <Description>{text}</Description>;
}

function ArgumentsExample({ schema }) {
  const required = schema?.required || [];
  const preferredFields = ["query", "sql", "hogql", "statement", "context"];
  const properties = Object.entries(schema?.properties || {}).sort(([leftName], [rightName]) => {
    const requiredDifference = Number(!required.includes(leftName)) - Number(!required.includes(rightName));
    if (requiredDifference !== 0) return requiredDifference;

    const preferredRank = (name) => {
      const index = preferredFields.indexOf(name.toLowerCase());
      return index === -1 ? preferredFields.length : index;
    };
    return preferredRank(leftName) - preferredRank(rightName);
  });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Example JSON</p>
        <pre className="max-h-64 overflow-auto rounded-2xl border border-divider bg-content2 p-4 font-mono text-xs text-foreground">
          {JSON.stringify(getSchemaExample(schema), null, 2)}
        </pre>
      </div>
      {properties.length > 0 ? (
        <div className="flex flex-col gap-2 border border-divider rounded-2xl p-4 bg-default-50">
          <p className="text-sm font-semibold text-foreground">Arguments definition</p>
          <ul className="divide-y divide-divider text-sm">
            {properties.map(([name, field]) => (
              <li className="px-4 py-3" key={name}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{name}</span>
                  {required.includes(name) ? <span className="text-danger">*</span> : null}
                  <span className="font-mono text-xs font-normal text-muted">
                    {getFieldTypeLabel(field, name)}
                  </span>
                </span>
                {field.description ? (
                  <p className="mt-0.5 text-muted">{summarizeText(field.description, 160)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SchemaField({ name, onChange, required, schema, value }) {
  const type = getSchemaType(schema);
  const label = fieldLabel(name, schema);
  const typeLabel = getFieldTypeLabel(schema, name);
  const help = summarizeText(schema.description, 220);

  if (type === "boolean") {
    return (
      <div className={`flex items-center justify-between gap-4 rounded-2xl py-3.5`}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            <FieldLabel label={label} required={required} typeLabel={typeLabel} />
          </p>
          {help ? <p className="mt-0.5 text-xs text-muted">{help}</p> : null}
        </div>
        <Switch aria-label={label} isSelected={value === true} onChange={onChange}>
          <Switch.Control><Switch.Thumb /></Switch.Control>
        </Switch>
      </div>
    );
  }

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
          <FieldLabel label={label} required={required} typeLabel={typeLabel} />
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
        <FieldHelp text={help} />
      </Select>
    );
  }

  if (type === "object" && Object.keys(schema.properties || {}).length > 0) {
    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <fieldset className="md:col-span-2">
        <legend className="mb-3 text-sm font-medium text-foreground">
          <FieldLabel label={label} required={required} typeLabel={typeLabel} />
        </legend>
        {help ? <p className="mb-3 text-xs text-muted">{help}</p> : null}
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
              panel={panel}
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
          <FieldLabel label={label} required={required} typeLabel={typeLabel} />
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
        <FieldHelp text={help} />
      </TextField>
    );
  }

  if (isLongTextField(name, schema)) {
    const isQuery = ["query", "sql", "hogql", "statement"].includes(name.toLowerCase());
    return (
      <TextField className="md:col-span-2" name={`mcp-argument-${name}`}>
        <Label>
          <FieldLabel label={label} required={required} typeLabel={typeLabel} />
        </Label>
        <TextArea
          aria-label={label}
          className={isQuery ? "min-h-44 font-mono text-sm" : "min-h-28 text-sm"}
          onChange={(event) => onChange(event.target.value)}
          rows={isQuery ? 10 : 4}
          value={value ?? ""}
          variant="secondary"
        />
        <FieldHelp text={help} />
      </TextField>
    );
  }

  return (
    <TextField name={`mcp-argument-${name}`}>
      <Label>
        <FieldLabel label={label} required={required} typeLabel={typeLabel} />
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
      <FieldHelp text={help} />
    </TextField>
  );
}

function ResultFormatFields({ configuration, onChange }) {
  const pathValue = Array.isArray(configuration.output?.path)
    ? configuration.output.path.join(".")
    : configuration.output?.path || "";

  return (
    <>
      <Select
        aria-label="Result format"
        disallowEmptySelection
        onChange={(mode) => onChange({
          ...configuration,
          output: { ...configuration.output, mode },
        })}
        selectionMode="single"
        value={configuration.output?.mode || "auto"}
        variant="secondary"
      >
        <Label>
          <FieldLabel label="Result format" typeLabel="enum" />
        </Label>
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
        <Description>How Chartbrew turns the tool result into rows.</Description>
      </Select>
      {configuration.output?.mode === "path" ? (
        <TextField name="mcp-output-path">
          <Label>
            <FieldLabel label="Field path" typeLabel="string" />
          </Label>
          <Input
            onChange={(event) => onChange({
              ...configuration,
              output: { ...configuration.output, path: event.target.value },
            })}
            placeholder="data.items"
            value={pathValue}
            variant="secondary"
          />
          <Description>Dot path to the array of rows in the result.</Description>
        </TextField>
      ) : null}
    </>
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
  const { contains } = useFilter({ sensitivity: "base" });
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
  const canRenderForm = hasFormFields(selectedTool?.inputSchema);
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

  useEffect(() => {
    if (selectedTool && !canRenderForm) setAdvanced(true);
  }, [selectedTool?.name, canRenderForm]);

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
    setAdvanced(!hasFormFields(tool?.inputSchema));
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

  const applyAiConfiguration = (nextConfiguration) => {
    const tool = approvedTools.find((item) => item.name === nextConfiguration?.tool?.name);
    const nextArguments = nextConfiguration?.arguments || {};
    setArgumentsText(JSON.stringify(nextArguments, null, 2));
    setArgumentsError("");
    setPreviewRows(null);
    setRunError("");
    setAdvanced(!hasFormFields(tool?.inputSchema));
    updateConfiguration(nextConfiguration);
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

  const renderFields = (fields, panel = false) => fields.map(([name, schema, required]) => (
    <SchemaField
      key={name}
      name={name}
      onChange={(value) => updateArgument(name, value)}
      panel={panel}
      required={required}
      schema={schema}
      value={configuration.arguments?.[name]}
    />
  ));

  const schemaProperties = Object.keys(selectedTool?.inputSchema?.properties || {});
  const requiredCount = (selectedTool?.inputSchema?.required || [])
    .filter((name) => schemaProperties.includes(name)).length;
  const fieldCountLabel = schemaProperties.length
    ? `${schemaProperties.length} ${schemaProperties.length === 1 ? "field" : "fields"}${
      requiredCount ? ` · ${requiredCount} required` : ""
    }`
    : "";
  const optionalCount = fieldGroups.extra.length;
  const selectedTitle = selectedTool?.title || selectedTool?.name || "";
  const selectedSummary = summarizeText(selectedTool?.description);
  const showMoreOptions = selectedTool && (!advanced || !canRenderForm);

  return (
    <div className="flex flex-col gap-8 px-4 sm:px-6 pb-6">
      {team?.id ? (
        <McpAiBuilder
          configuration={configuration}
          dataRequest={dataRequest}
          onApply={applyAiConfiguration}
          teamId={team.id}
        />
      ) : null}
      <Card className="gap-0 overflow-visible bg-transparent p-0 shadow-none" variant="transparent">
        <Card.Content className="gap-0 p-0">
          <section className="flex flex-col gap-4 pb-8">
            <StepHeading
              step="1"
              tip="Pick a read-only tool that can return rows for this dataset."
              title="Choose a tool"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Autocomplete
                aria-label="Tool"
                className="min-w-0 flex-1"
                fullWidth
                onChange={(toolName) => {
                  if (toolName) selectTool(String(toolName));
                }}
                placeholder="Search tools"
                selectionMode="single"
                value={configuration.tool?.name || null}
                variant="secondary"
              >
                <Autocomplete.Trigger className="min-h-16 border-divider bg-content2 shadow-none">
                  <Autocomplete.Value>
                    {({ defaultChildren, isPlaceholder }) => {
                      if (isPlaceholder || !selectedTool) return defaultChildren;
                      return (
                        <span className="flex min-w-0 flex-col items-start gap-0.5 py-0.5 text-left">
                          <span className="truncate font-medium text-foreground">{selectedTitle}</span>
                          {selectedSummary ? (
                            <span className="truncate text-xs font-normal text-muted">{selectedSummary}</span>
                          ) : null}
                        </span>
                      );
                    }}
                  </Autocomplete.Value>
                  <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                  <Autocomplete.Filter filter={contains}>
                    <SearchField autoFocus name="mcp-tool-search" variant="secondary">
                      <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search tools" />
                        <SearchField.ClearButton />
                      </SearchField.Group>
                    </SearchField>
                    <ListBox renderEmptyState={() => <EmptyState>No matching tools</EmptyState>}>
                      {approvedTools.map((tool) => {
                        const title = tool.title || tool.name;
                        const summary = summarizeText(tool.description);
                        return (
                          <ListBox.Item
                            id={tool.name}
                            key={tool.name}
                            textValue={title}
                          >
                            <div className="flex flex-col gap-1">
                              <Label>{title}</Label>
                              {summary ? <Description className="line-clamp-2">{summary}</Description> : null}
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        );
                      })}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Button
                    aria-label="Reload tools"
                    className="border border-divider bg-surface text-muted"
                    isPending={metadataLoading}
                    onPress={loadMetadata}
                    variant="tertiary"
                  >
                    {metadataLoading ? <ButtonSpinner /> : <LuRefreshCw size={16} aria-hidden />}
                    Reload tools
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Reload tools</Tooltip.Content>
              </Tooltip>
            </div>
            {selectedTool ? (
              <Tabs
                selectedKey={advanced ? "json" : "form"}
                onSelectionChange={(key) => {
                  if (key === "json") setAdvanced(true);
                  if (key === "form" && canRenderForm) setAdvanced(false);
                }}
              >
                <Tabs.ListContainer className="w-fit border border-divider shadow-none">
                  <Tabs.List aria-label="Argument editor" className="w-fit min-w-0 *:w-fit *:shrink-0">
                    <Tabs.Tab className="px-4 gap-1" id="form" isDisabled={!canRenderForm}>
                      <LuLayoutList size={16} aria-hidden />
                      Form
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab className="px-4 gap-1" id="json">
                      <LuCode size={16} aria-hidden />
                      JSON
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            ) : null}
          </section>

          {!metadataLoading && approvedTools.length === 0 && (
            <Alert className="mt-6 shadow-none" status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>No tools are available for datasets</Alert.Title>
                <Alert.Description>Open the connection and allow a read-only tool for datasets.</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {selectedTool ? (
            <section className="flex flex-col gap-5 border-t border-divider pt-8">
              <StepHeading
                extra={fieldCountLabel}
                step="2"
                title={advanced ? "Edit arguments" : "Fill in the arguments"}
              />
              {advanced ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-semibold text-foreground">Arguments</p>
                    <div className="min-w-0 overflow-hidden rounded-2xl border border-divider bg-field">
                      <CodeEditor
                        height="420px"
                        mode="json"
                        onChange={updateAdvancedArguments}
                        theme={isDark ? "one_dark" : "tomorrow"}
                        value={argumentsText}
                      />
                    </div>
                  </div>
                  <ArgumentsExample schema={selectedTool.inputSchema} />
                </div>
              ) : (
                <div className="flex flex-col gap-5">
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
                </div>
              )}
              {argumentsError ? <p className="text-sm text-danger">{argumentsError}</p> : null}

              {showMoreOptions ? (
                <div className="overflow-hidden rounded-2xl border border-divider bg-content2/60">
                  <Disclosure defaultExpanded>
                    <Disclosure.Heading>
                      <Button
                        className="h-auto w-full justify-start rounded-none px-4 py-4"
                        slot="trigger"
                        variant="ghost"
                      >
                        <LuSlidersHorizontal size={16} aria-hidden />
                        More options
                        {optionalCount ? (
                          <span className="font-normal text-muted">
                            {optionalCount} optional {optionalCount === 1 ? "argument" : "arguments"}
                          </span>
                        ) : null}
                        <Disclosure.Indicator className="ml-auto" />
                      </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                      <Disclosure.Body className="flex flex-col gap-4 border-t border-divider px-4 pb-4 pt-4">
                        {!advanced && fieldGroups.extra.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {renderFields(fieldGroups.extra, true)}
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <ResultFormatFields
                            configuration={configuration}
                            onChange={updateConfiguration}
                          />
                        </div>
                      </Disclosure.Body>
                    </Disclosure.Content>
                  </Disclosure>
                </div>
              ) : null}
            </section>
          ) : null}
        </Card.Content>

        {selectedTool ? (
          <Card.Footer className="-mx-4 -mb-6 mt-8 flex flex-wrap items-center gap-2 border-t border-divider bg-content2/60 px-4 py-4 sm:-mx-6 sm:px-6">
            <Button className="h-10 rounded-full px-5" isPending={runLoading} onPress={runRequest} variant="primary">
              {runLoading ? <ButtonSpinner /> : <LuPlay fill="currentColor" size={16} aria-hidden />}
              Run
            </Button>
            <Button className="h-10 rounded-full px-5" isPending={saveLoading} onPress={saveRequest} variant="outline">
              {saveLoading ? <ButtonSpinner /> : <LuSave size={16} aria-hidden />}
              Save
            </Button>
            <Button className="h-10 rounded-full px-4" onPress={() => setShowTransform(true)} variant="ghost">
              <LuWrench size={16} aria-hidden />
              Transform
            </Button>
            <Button className="ml-auto h-10 rounded-full px-5" onPress={() => onDelete(dataRequest.id)} variant="danger-soft">
              <LuTrash2 size={16} aria-hidden />
              Delete
            </Button>
          </Card.Footer>
        ) : null}
      </Card>

      {runError ? (
        <Alert className="shadow-none" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could not run this tool</Alert.Title>
            <Alert.Description>{runError}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {selectedTool ? (
        previewRows === null ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Preview</p>
            </div>
            <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-divider px-6 py-8 text-center">
              <p className="text-sm text-muted">Run to preview rows</p>
            </div>
          </section>
        ) : previewIsTextBlock || previewColumns.length === 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <p className="text-sm text-muted">This result is not rows and columns yet.</p>
            <CodeEditor
              height="240px"
              mode="json"
              readOnly
              theme={isDark ? "one_dark" : "tomorrow"}
              value={JSON.stringify(previewRows, null, 2)}
            />
          </section>
        ) : (
          <section className="flex flex-col gap-3">
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
          </section>
        )
      ) : null}

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
    </div>
  );
}

FieldLabel.propTypes = {
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  typeLabel: PropTypes.string,
};

StepHeading.propTypes = {
  extra: PropTypes.string,
  step: PropTypes.string.isRequired,
  tip: PropTypes.string,
  title: PropTypes.string.isRequired,
};

FieldHelp.propTypes = {
  text: PropTypes.string,
};

ArgumentsExample.propTypes = {
  schema: PropTypes.object,
};

SchemaField.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  panel: PropTypes.bool,
  required: PropTypes.bool,
  schema: PropTypes.object.isRequired,
  value: PropTypes.any,
};

ResultFormatFields.propTypes = {
  configuration: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

McpBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default McpBuilder;
