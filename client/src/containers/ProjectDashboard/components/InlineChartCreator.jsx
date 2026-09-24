import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Drawer, Input, Label, ListBox, Modal, Select, Spinner, TextField } from "@heroui/react";
import { LuArrowUpRight, LuDatabase, LuX } from "react-icons/lu";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { v4 as uuid } from "uuid";
import { chartCreationRequest } from "../../../api/chartCreation";
import PixelLoader from "../../../components/PixelLoader";
import getConnectionLogo from "../../../modules/getConnectionLogo";
import { useTheme } from "../../../modules/ThemeContext";
import AiComposer from "../../Ai/AiComposer";

const TYPES = { kpi: "Number", line: "Line", bar: "Bar", horizontalBar: "Horizontal bar", table: "Table", pie: "Pie", doughnut: "Doughnut", avg: "Average", map: "Map" };
const OPERATIONS = { none: "As provided", sum: "Total", avg: "Average", min: "Minimum", max: "Maximum", count: "Count", count_unique: "Unique count" };
const PHASES = { finding: "Finding suitable data…", checking: "Checking your chart…", saving: "Saving your chart…", saved: "Loading your chart…" };

function ChartSelect({ label, value, items, onChange, isDisabled, compact = false }) {
  return (
    <Select value={value || null} onChange={onChange} isDisabled={isDisabled} variant="secondary" className={compact ? "min-w-0 max-w-64 flex-1" : "w-full"}>
      <Label className={compact ? "sr-only" : undefined}>{label}</Label>
      <Select.Trigger className={compact ? "h-8 min-h-8 px-2 text-xs shadow-none" : undefined}>
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

ChartSelect.propTypes = { label: PropTypes.string, value: PropTypes.string, items: PropTypes.array, onChange: PropTypes.func, isDisabled: PropTypes.bool, compact: PropTypes.bool };

function InlineChartSession({ projectId, userId, sessionId, targetChartId, onClose, onSaved, onChartContainer, onPublish, runtime }) {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const storageKey = `chart-creation:${userId}:${projectId}:${sessionId}`;
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
  const [finishing, setFinishing] = useState(false);
  const active = useRef(null);
  const completed = useRef(null);
  const form = useRef(null);
  const inputRef = useRef(null);
  const busy = operation?.state === "running" || finishing;
  const chartId = settings?.chartId || request?.chartId;

  const loadSettings = async (id) => {
    const result = await chartCreationRequest(projectId, `chart/${id}/inline-settings`);
    setSettings({ ...result, chartId: id });
    setTitle(result.name);
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
        if (pending.chartId) await loadSettings(result.chartId);
        else {
          toast.success("Chart draft saved");
          close(true);
        }
        setPrompt("");
      } catch (_) {
        setError("Chart saved. Reload the dashboard to show it.");
      } finally {
        setFinishing(false);
      }
    } else if (result.state === "failed") {
      setError(result.message || "The chart could not be created. Try again.");
    } else if (result.state === "cancelled") {
      close(true);
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
        setPrompt(saved.body.prompt || "");
        setSource(saved.body.connectionId ? String(saved.body.connectionId) : "auto");
        setDataset(saved.dataset || null);
        setOperation({ state: "running", phase: "finding" });
        if (saved.chartId) loadSettings(saved.chartId).catch(() => {});
      }
      if (!saved?.body?.requestId && targetChartId) loadSettings(targetChartId).catch((reason) => setError(reason.message));
    } catch (_) { sessionStorage.removeItem(storageKey); }
    return () => { controller.abort(); active.current = null; };
  }, [projectId, userId, sessionId]);

  useEffect(() => {
    if (!targetChartId && options && !request) {
      form.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [Boolean(options)]);

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

  const submit = async (changes = {}, selectedDataset = dataset) => {
    if (busy) return;
    const body = {
      requestId: uuid(), mode: "prompt", prompt, runtime,
      ...(dataset ? { datasetId: dataset.dataset_id } : { connectionId: source === "auto" ? null : Number(source) }),
      ...(settings ? { expectedVersion: settings.version } : {}),
      ...changes,
    };
    const pending = { body, chartId: settings?.chartId || null, dataset: selectedDataset };
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

  const close = (force = false) => {
    if (busy && !force) return;
    sessionStorage.removeItem(storageKey);
    active.current = null;
    setRequest(null);
    setOperation(null);
    setSettings(null);
    setDataset(null);
    setPrompt("");
    setError("");
    onClose();
  };

  const chooseDataset = (item) => {
    setDataset(item);
    setPicker(false);
    submit({ mode: prompt.trim() && options?.aiEnabled ? "prompt" : "dataset", datasetId: item.dataset_id, connectionId: null, choices: {} }, item);
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

  if (targetChartId && !settings) {
    return (
      <div role="status" className="my-4 flex items-center gap-3">
        {error || <Spinner aria-label="Loading chart settings" />}
        <Button variant="secondary" onPress={() => close()}>Close</Button>
      </div>
    );
  }

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
          : `min-w-0 rounded-3xl border border-divider bg-surface p-4${busy ? " relative isolate overflow-hidden" : ""}`}
      >
        {!settings && busy && (
          <div className="inline-chart-loading-field" aria-hidden="true">
            {Array.from({ length: 12 }, (_, tile) => (
              <PixelLoader key={tile} variant="heat" size={120} />
            ))}
          </div>
        )}
        {settings && (
          <header className="flex shrink-0 flex-col gap-1 border-b border-divider px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Configure chart</h2>
              <Button isIconOnly variant="ghost" aria-label="Close chart settings" isDisabled={busy || title !== settings.name || Boolean(error)} onPress={() => close()}>
                <LuX size={18} />
              </Button>
            </div>
            <Button size="sm" variant="tertiary" className="-ml-2 self-start" isDisabled={busy} onPress={() => navigate(`/dashboard/${projectId}/chart/${chartId}/edit`)}>
              Open full editor
              <LuArrowUpRight size={16} />
            </Button>
          </header>
        )}

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
          <AiComposer
            id={`chart-prompt-${sessionId}`}
            name="chartPrompt"
            inputRef={inputRef}
            value={prompt}
            onValueChange={setPrompt}
            isLoading={busy}
            selectedContext={{ multiSelect: [] }}
            placeholder={settings ? "Describe a change to your chart…" : "Describe the chart you want to create…"}
            submitLabel={settings ? "Update chart" : "Generate chart"}
            onSubmitQuestion={() => { submit(); return false; }}
            rows={3}
            framed
            leadingControl={!settings && (
              <ChartSelect compact label={dataset ? "Dataset" : "Connection"} value={source} isDisabled={busy || Boolean(dataset)}
                items={[{ value: "auto", label: dataset?.name || "Auto connection" }, ...options.connections.map((item) => ({
                  value: String(item.id), label: item.name, logo: item.icon || getConnectionLogo(item, isDark),
                }))]}
                onChange={(value) => { setSource(value); setDataset(null); }}
              />
            )}
          />
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
            <PixelLoader variant="bars" />
            <span className="flex-1 text-sm">{finishing ? "Loading your chart…" : PHASES[operation?.phase] || PHASES.finding}</span>
            {!finishing && <Button size="sm" variant="ghost" onPress={cancel}>Cancel</Button>}
          </div>
        )}
        {error && (
          <div className="mt-4 space-y-2" role="alert">
            <p className="text-sm text-danger">{error}</p>
            {!busy && request && operation?.state !== "succeeded" && (
              <Button size="sm" variant="secondary" onPress={() => submit({ ...request.body, requestId: uuid(), ...(settings ? { expectedVersion: settings.version } : {}) })}>
                Retry
              </Button>
            )}
            {!busy && operation?.state === "succeeded" && !settings && (
              <Button size="sm" variant="secondary" onPress={() => window.location.reload()}>
                Reload dashboard
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
        <footer className={settings ? "flex shrink-0 items-center justify-between gap-3 bg-surface px-6 py-4" : `flex flex-wrap items-center gap-2${options?.aiEnabled ? " mt-4" : ""}`}>
          {!settings ? (
            <>
              <Button variant={options?.aiEnabled ? "secondary" : "primary"} isDisabled={busy || !options} onPress={() => setPicker(true)}>
                <LuDatabase size={16} />
                Use a dataset
              </Button>
              <Button variant="ghost" isDisabled={busy} onPress={() => navigate(`/dashboard/${projectId}/chart`)}>
                Open in Chart Studio
                <LuArrowUpRight size={16} />
              </Button>
              <Button isIconOnly variant="ghost" className="ml-auto" aria-label="Cancel chart creation" isDisabled={busy} onPress={() => close()}>
                <LuX size={18} />
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" isDisabled={busy || title !== settings.name || Boolean(error)} onPress={() => close()}>
                {settings.draft ? "Save draft" : "Done"}
              </Button>
              {settings.draft && (
                <Button
                  variant="primary"
                  isDisabled={busy || title !== settings.name || Boolean(error)}
                  onPress={async () => {
                    setFinishing(true);
                    try {
                      await onPublish(settings.chartId);
                      close(true);
                    } catch (reason) {
                      setError(reason.message);
                      setFinishing(false);
                    }
                  }}
                >
                  Publish chart
                </Button>
              )}
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
                <Button variant="secondary" onPress={() => setPicker(false)}>Cancel</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

InlineChartSession.propTypes = {
  projectId: PropTypes.string.isRequired, userId: PropTypes.number.isRequired,
  sessionId: PropTypes.string.isRequired, targetChartId: PropTypes.number,
  onClose: PropTypes.func.isRequired, onSaved: PropTypes.func.isRequired,
  onChartContainer: PropTypes.func.isRequired, onPublish: PropTypes.func.isRequired, runtime: PropTypes.object.isRequired,
};

function InlineChartCreator({ open, onClose, selectedChartId, onSelectChart, ...props }) {
  const storageKey = `chart-creations:${props.userId}:${props.projectId}`;
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      return Array.isArray(saved) ? saved : [];
    } catch (_) { return []; }
  });

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  useEffect(() => {
    if (!open) return;
    setSessions((current) => [...current, uuid()]);
    onClose();
  }, [open]);

  return (
    <>
      {sessions.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-3 px-px lg:grid-cols-2">
          {sessions.map((id) => (
            <InlineChartSession
              {...props}
              key={id}
              sessionId={id}
              onClose={() => setSessions((current) => current.filter((item) => item !== id))}
            />
          ))}
        </div>
      )}
      {selectedChartId && (
        <InlineChartSession
          {...props}
          key={selectedChartId}
          sessionId={`edit-${selectedChartId}`}
          targetChartId={selectedChartId}
          onClose={() => {
            onSelectChart(null);
            requestAnimationFrame(() => {
              const trigger = document.querySelector(`[data-configure-chart="${selectedChartId}"]`) || document.querySelector("[data-add-chart]");
              trigger?.focus({ preventScroll: true });
            });
          }}
        />
      )}
    </>
  );
}

InlineChartCreator.propTypes = {
  projectId: PropTypes.string.isRequired, userId: PropTypes.number.isRequired,
  open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired,
  selectedChartId: PropTypes.number, onSelectChart: PropTypes.func.isRequired,
};

export default InlineChartCreator;
