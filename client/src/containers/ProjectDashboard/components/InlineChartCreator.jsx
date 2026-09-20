import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Drawer, Input, Label, ListBox, Modal, Select, Spinner, TextArea, TextField } from "@heroui/react";
import { LuArrowUpRight, LuDatabase, LuTrash2, LuX } from "react-icons/lu";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { v4 as uuid } from "uuid";
import { chartCreationRequest } from "../../../api/chartCreation";
import getConnectionLogo from "../../../modules/getConnectionLogo";
import { useTheme } from "../../../modules/ThemeContext";

const TYPES = { kpi: "Number", line: "Line", bar: "Bar", horizontalBar: "Horizontal bar", table: "Table", pie: "Pie", doughnut: "Doughnut", avg: "Average", map: "Map" };
const OPERATIONS = { none: "As provided", sum: "Total", avg: "Average", min: "Minimum", max: "Maximum", count: "Count", count_unique: "Unique count" };
const PHASES = { finding: "Finding suitable data…", checking: "Checking your chart…", saving: "Saving your chart…", saved: "Loading your chart…" };

function ChartSelect({ label, value, items, onChange, isDisabled }) {
  return (
    <Select value={value || null} onChange={onChange} isDisabled={isDisabled} variant="secondary" className="w-full">
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value className="flex items-center gap-2" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox items={items}>
          {(item) => (
            <ListBox.Item id={item.value} textValue={item.label}>
              {item.logo && (
                <Avatar className="size-6 shrink-0 rounded-sm">
                  <Avatar.Image src={item.logo} alt="" className="object-contain" />
                  <Avatar.Fallback>
                    <LuDatabase size={16} />
                  </Avatar.Fallback>
                </Avatar>
              )}
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

ChartSelect.propTypes = { label: PropTypes.string, value: PropTypes.string, items: PropTypes.array, onChange: PropTypes.func, isDisabled: PropTypes.bool };

function InlineChartCreator({ projectId, userId, open, onClose, onSaved, onSelectChart, onChartContainer, onUndo, runtime }) {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const storageKey = `chart-creation:${userId}:${projectId}`;
  const [options, setOptions] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("auto");
  const [dataset, setDataset] = useState(null);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [operation, setOperation] = useState(null);
  const [request, setRequest] = useState(null);
  const [settings, setSettings] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const active = useRef(null);
  const completed = useRef(null);
  const form = useRef(null);
  const inputRef = useRef(null);
  const wasVisible = useRef(false);
  const busy = operation?.state === "running" || finishing;
  const chartId = settings?.chartId || request?.chartId;
  const visible = open || Boolean(request) || Boolean(settings);

  useEffect(() => {
    const restoreFocus = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (!restoreFocus) return undefined;
    const frame = requestAnimationFrame(() => document.querySelector("[data-add-chart]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const loadSettings = async (id) => {
    const result = await chartCreationRequest(projectId, `chart/${id}/inline-settings`);
    setSettings({ ...result, chartId: id });
    setTitle(result.name);
    onSelectChart(id);
  };

  const acceptResult = async (result, pending) => {
    if (active.current !== pending.body.requestId || completed.current === result.requestId) return;
    setOperation(result);
    if (result.state === "running") return;
    completed.current = result.requestId;
    if (result.state === "succeeded") {
      setFinishing(true);
      setError(result.message || "");
      try {
        await onSaved(result.chartId);
        await loadSettings(result.chartId);
        if (!pending.chartId) setUndoAvailable(true);
        if (!pending.chartId) toast.success("Chart added");
        setPrompt("");
      } catch (_) {
        setError("Chart saved. Reload the dashboard to show it.");
      } finally {
        setFinishing(false);
      }
    } else if (result.state === "failed") {
      setError(result.message || "The chart could not be created. Try again.");
    } else if (result.state === "cancelled") {
      close(false, true);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    chartCreationRequest(projectId, "chart-creations/options", undefined, controller.signal)
      .then(setOptions).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved?.body?.requestId) {
        active.current = saved.body.requestId;
        setRequest(saved);
        onClose(true);
        setPrompt(saved.body.prompt || "");
        setOperation({ state: "running", phase: "finding" });
        if (saved.chartId) loadSettings(saved.chartId).catch(() => {});
      }
    } catch (_) { sessionStorage.removeItem(storageKey); }
    return () => { controller.abort(); active.current = null; };
  }, [projectId, userId]);

  useEffect(() => {
    if (open && !settings) {
      form.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open, Boolean(settings)]);

  useEffect(() => {
    if (!request || operation?.state !== "running") return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const result = await chartCreationRequest(projectId, `chart-creations/${request.body.requestId}`);
        if (!stopped) await acceptResult(result, request);
      } catch (reason) {
        if (!stopped && reason.status === 404) {
          try {
            const path = request.chartId ? `chart/${request.chartId}/refinements` : "chart-creations";
            const result = await chartCreationRequest(projectId, path, request.body);
            if (!stopped) await acceptResult(result, request);
          } catch (retryError) {
            if (!stopped && retryError.status) await acceptResult({ requestId: request.body.requestId, state: "failed", message: retryError.message }, request);
          }
        } else if (!stopped) setError("Connection lost. Checking whether your chart was saved…");
      }
      if (!stopped) timer = window.setTimeout(poll, 1500);
    };
    timer = window.setTimeout(poll, 1000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [request, operation?.state]);

  useEffect(() => {
    if (!picker) return undefined;
    const controller = new AbortController();
    setPickerLoading(true);
    const timer = window.setTimeout(async () => {
      setPickerError("");
      try {
        const search = new URLSearchParams({ q: query, ...(source !== "auto" ? { connectionId: source } : {}) });
        const result = await chartCreationRequest(projectId, `chart-creations/datasets?${search}`, undefined, controller.signal);
        setDatasets(result.datasets);
        setNextOffset(result.truncated ? result.nextOffset : null);
      } catch (reason) {
        if (reason.name !== "AbortError") setPickerError(reason.message);
      } finally { if (!controller.signal.aborted) setPickerLoading(false); }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [picker, query, source, projectId]);

  const submit = async (changes = {}) => {
    if (busy) return;
    const body = {
      requestId: uuid(), mode: "prompt", prompt, runtime,
      ...(dataset ? { datasetId: dataset.dataset_id } : { connectionId: source === "auto" ? null : Number(source) }),
      ...(settings ? { expectedVersion: settings.version } : {}),
      ...changes,
    };
    const pending = { body, chartId: settings?.chartId || null };
    active.current = body.requestId;
    completed.current = null;
    setRequest(pending);
    setError("");
    setOperation({ state: "running", phase: "finding" });
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
    try {
      const path = pending.chartId ? `chart/${pending.chartId}/refinements` : "chart-creations";
      await acceptResult(await chartCreationRequest(projectId, path, body), pending);
    } catch (reason) {
      if (active.current !== body.requestId) return;
      if (reason.status) {
        await acceptResult({ requestId: body.requestId, state: "failed", message: reason.message }, pending);
      } else {
        setError("Connection lost. Checking whether your chart was saved…");
      }
    }
  };

  const cancel = async () => {
    try {
      await acceptResult(await chartCreationRequest(projectId, `chart-creations/${request.body.requestId}/cancel`, {}), request);
    } catch (reason) { setError(reason.message); }
  };

  const close = (addAnother = false, force = false) => {
    if (busy && !force) return;
    sessionStorage.removeItem(storageKey);
    active.current = null;
    setRequest(null);
    setOperation(null);
    setSettings(null);
    setDataset(null);
    setPrompt("");
    setError("");
    setUndoAvailable(false);
    onSelectChart(null);
    onClose(addAnother);
  };

  const chooseDataset = (item) => {
    setDataset(item);
    setPicker(false);
    submit({ mode: prompt.trim() && options?.aiEnabled ? "prompt" : "dataset", datasetId: item.dataset_id, connectionId: null, choices: {} });
  };

  const saveSetting = (key, value) => {
    submit({ mode: "settings", choices: { [key]: value }, datasetId: null, connectionId: null });
  };

  const loadMore = async () => {
    setPickerLoading(true);
    try {
      const search = new URLSearchParams({ q: query, offset: nextOffset, ...(source !== "auto" ? { connectionId: source } : {}) });
      const result = await chartCreationRequest(projectId, `chart-creations/datasets?${search}`);
      setDatasets((current) => [...current, ...result.datasets]);
      setNextOffset(result.truncated ? result.nextOffset : null);
    } catch (reason) { setPickerError(reason.message); }
    finally { setPickerLoading(false); }
  };

  if (!visible) return null;

  const fieldItems = Object.entries(settings?.fields || {}).filter(([, type]) => ["number", "string", "boolean", "date"].includes(type))
    .map(([value]) => ({ value, label: value.replace(/^root(?:\[\])?\./, "") }));
  const question = operation?.state === "needs_input" ? operation : null;

  const editor = (
      <section
        ref={form}
        aria-label={settings ? "Chart settings" : "Create a chart"}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy && !picker && !error) {
            event.stopPropagation();
            close();
          }
        }}
        className={settings
          ? "inline-chart-panel"
          : "my-5 max-w-3xl rounded-2xl border border-divider bg-surface p-5 sm:p-6"}
      >
        <header className={settings ? "flex shrink-0 flex-col gap-1 border-b border-divider px-6 py-4" : "mb-5"}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{settings ? "Edit chart" : "What would you like to show?"}</h2>
          <Button isIconOnly variant="ghost" aria-label={settings ? "Close chart settings" : "Cancel chart creation"} isDisabled={busy || Boolean(settings && (title !== settings.name || error))} onPress={() => close()}>
            <LuX size={18} />
          </Button>
        </div>
        {settings && (
          <Button size="sm" variant="ghost" className="-ml-2 self-start" isDisabled={busy} onPress={() => navigate(`/dashboard/${projectId}/chart/${chartId}/edit`)}>
            Open full editor
            <LuArrowUpRight size={16} />
          </Button>
        )}
        </header>

        <div className={settings ? "min-h-0 flex-1 overflow-y-auto px-6 py-4" : ""}>
        {settings && (
          <div className="mb-6 flex flex-col gap-4">
            <TextField
              isDisabled={busy}
              value={title}
              onChange={setTitle}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setTitle(settings.name);
                }
                if (event.key === "Enter" && title.trim() && title !== settings.name) saveSetting("name", title.trim());
              }}
              onBlur={() => {
                if (title.trim() && title !== settings.name) saveSetting("name", title.trim());
              }}
            >
              <Label>Title</Label>
              <Input variant="secondary" maxLength={255} />
            </TextField>
            <ChartSelect
              label="Chart type"
              value={settings.type}
              isDisabled={busy}
              items={Object.entries(TYPES).filter(([value]) => value === settings.type || value === "table"
                || (fieldItems.length > 1 && ["line", "bar", "horizontalBar", "pie", "doughnut", "map"].includes(value))
                || ["kpi", "avg"].includes(value)).map(([value, label]) => ({ value, label }))}
              onChange={(value) => saveSetting("type", value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <ChartSelect label="Value" value={settings.yAxis} isDisabled={busy} items={fieldItems} onChange={(value) => saveSetting("yAxis", value)} />
              <ChartSelect label="Calculation" value={settings.yAxisOperation} isDisabled={busy} items={Object.entries(OPERATIONS).map(([value, label]) => ({ value, label }))} onChange={(value) => saveSetting("yAxisOperation", value)} />
            </div>
            <div className={settings.fields?.[settings.xAxis] === "date" ? "grid grid-cols-2 gap-4" : ""}>
              <ChartSelect label={settings.type === "map" ? "Location" : "Group by"} value={settings.xAxis} isDisabled={busy} items={fieldItems} onChange={(value) => saveSetting("xAxis", value)} />
              {settings.fields?.[settings.xAxis] === "date" && (
                <ChartSelect label="Interval" value={settings.timeInterval} isDisabled={busy} items={["hour", "day", "week", "month", "year"].map((value) => ({ value, label: value }))} onChange={(value) => saveSetting("timeInterval", value)} />
              )}
            </div>
            <Button variant="ghost" className="-ml-2 self-start" isDisabled={busy} onPress={() => setPicker(true)}>
              <LuDatabase size={16} />
              Change dataset
            </Button>
          </div>
        )}

        {options?.aiEnabled && (
          <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex flex-col gap-4">
            <TextField isDisabled={busy} value={prompt} onChange={setPrompt}>
              <Label>{settings ? "Refine with AI" : "Describe your chart"}</Label>
              <TextArea ref={inputRef} variant="secondary" maxLength={4000} rows={settings ? 2 : 3} placeholder={settings ? "Make it weekly" : "Website visits by country in the last 30 days"} />
            </TextField>
            {!settings && (
              <ChartSelect label={dataset ? "Dataset" : "Connection"} value={source} isDisabled={busy || Boolean(dataset)}
                items={[{ value: "auto", label: dataset?.name || "Choose automatically" }, ...options.connections.map((item) => ({
                  value: String(item.id), label: item.name, logo: item.icon || getConnectionLogo(item, isDark),
                }))]}
                onChange={(value) => { setSource(value); setDataset(null); }}
              />
            )}
            <Button type="submit" variant={settings ? "secondary" : "primary"} isDisabled={busy || !prompt.trim()} className="self-start">
              {settings ? "Update chart" : "Generate chart"}
            </Button>
          </form>
        )}

        {question && (
          <div className="mt-4 space-y-3" role="status">
            <p>{question.question}</p>
            {question.choices?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {question.choices.map((choice) => (
                  <Button key={choice.value} size="sm" variant="secondary" onPress={() => submit({ ...request.body, requestId: uuid(), choices: { ...request.body.choices, [question.field]: choice.value } })}>
                    {choice.label}
                  </Button>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Add this detail to your description, then try again.</p>}
          </div>
        )}
        {busy && (
          <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite">
            <Spinner size="sm" />
            <span className="flex-1 text-sm">{finishing ? "Loading your chart…" : PHASES[operation?.phase] || PHASES.finding}</span>
            {!finishing && <Button size="sm" variant="ghost" onPress={cancel}>Cancel</Button>}
          </div>
        )}
        {error && (
          <div className="mt-4 space-y-2" role="alert">
            <p className="text-sm text-danger">{error}</p>
            {!busy && request && (
              <Button size="sm" variant="secondary" onPress={() => submit({ ...request.body, requestId: uuid(), ...(settings ? { expectedVersion: settings.version } : {}) })}>
                Retry
              </Button>
            )}
            {!busy && settings && (
              <Button size="sm" variant="ghost" onPress={() => loadSettings(settings.chartId).then(() => setError("")).catch((reason) => setError(reason.message))}>
                Reload chart
              </Button>
            )}
          </div>
        )}
        </div>
        <footer className={settings ? "flex shrink-0 items-center justify-between gap-3 border-t border-divider bg-surface px-6 py-4" : "mt-5 flex flex-wrap items-center gap-2 border-t border-divider pt-4"}>
          {!settings ? (
            <>
              <Button variant={options?.aiEnabled ? "secondary" : "primary"} isDisabled={busy || !options} onPress={() => setPicker(true)}>
                <LuDatabase size={16} />
                Use a dataset
              </Button>
              <Button variant="ghost" isDisabled={busy} onPress={() => navigate(`/dashboard/${projectId}/chart`)}>
                Build manually
                <LuArrowUpRight size={16} />
              </Button>
            </>
          ) : (
            <>
              {undoAvailable && (
                <Button
                  variant="ghost"
                  className="text-danger"
                  isDisabled={busy}
                  onPress={async () => {
                    setFinishing(true);
                    try {
                      await onUndo(settings.chartId);
                      setFinishing(false);
                      close();
                    } catch (reason) {
                      setError(reason.message);
                      setFinishing(false);
                    }
                  }}
                >
                  <LuTrash2 size={16} />
                  Remove chart
                </Button>
              )}
              <Button className="ml-auto" isDisabled={busy || title !== settings.name || Boolean(error)} onPress={() => close()}>Done</Button>
            </>
          )}
        </footer>
      </section>
  );

  return (
    <>
      {settings ? (
        <Drawer>
          <Drawer.Backdrop isOpen isDismissable={false} isKeyboardDismissDisabled={busy || picker || title !== settings.name || Boolean(error)} onOpenChange={(isOpen) => { if (!isOpen) close(); }}>
            <Drawer.Content placement="right">
              <Drawer.Dialog aria-label="Edit chart" className="inline-chart-dialog">
                <div className="inline-chart-stage">
                  <div ref={onChartContainer} className="inline-chart-preview" />
                </div>
                {editor}
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      ) : editor}

      <Modal>
        <Modal.Backdrop isOpen={picker} onOpenChange={setPicker}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Choose a dataset</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="gap-4">
                <TextField value={query} onChange={setQuery}>
                  <Label>Search datasets</Label>
                  <Input variant="secondary" placeholder="Name or field" />
                </TextField>
                {pickerError && <p role="alert" className="text-sm text-danger">{pickerError}</p>}
                <ListBox aria-label="Datasets" items={datasets} onAction={(id) => chooseDataset(datasets.find((item) => String(item.dataset_id) === String(id)))} className="max-h-80 overflow-y-auto">
                  {(item) => (
                    <ListBox.Item id={String(item.dataset_id)} textValue={item.name}>
                      <div className="min-w-0 flex-1 flex flex-col gap-1 py-1">
                        <span>{item.name}</span>
                        <span className="text-sm text-muted">{item.connectionName}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {item.connections?.map((connection) => (
                          <Avatar key={connection.id} size="sm" className="shrink-0" title={connection.name}>
                            <Avatar.Image src={connection.icon || getConnectionLogo(connection, isDark)} alt={connection.name} className="object-contain" />
                            <Avatar.Fallback>
                              <LuDatabase size={16} />
                            </Avatar.Fallback>
                          </Avatar>
                        ))}
                      </div>
                    </ListBox.Item>
                  )}
                </ListBox>
                {pickerLoading && <Spinner aria-label="Loading datasets" />}
                {!pickerLoading && !pickerError && !datasets.length && (
                  <div className="space-y-3">
                    <p>{query ? "No matching datasets. Try another search." : "No datasets available."}</p>
                    {options?.canConfigureSources && <Button variant="secondary" onPress={() => navigate("/connections")}>Connect a source</Button>}
                  </div>
                )}
                {nextOffset != null && <Button variant="secondary" isDisabled={pickerLoading} onPress={loadMore}>Show more</Button>}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => navigate(`/dashboard/${projectId}/chart?tab=templates`)}>Browse templates</Button>
                <Button variant="secondary" onPress={() => setPicker(false)}>Cancel</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

InlineChartCreator.propTypes = {
  projectId: PropTypes.string.isRequired, userId: PropTypes.number.isRequired,
  open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSaved: PropTypes.func.isRequired,
  onChartContainer: PropTypes.func.isRequired, onSelectChart: PropTypes.func.isRequired, onUndo: PropTypes.func.isRequired, runtime: PropTypes.object.isRequired,
};

export default InlineChartCreator;
