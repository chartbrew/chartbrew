import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import {
  Button, Chip, Label, ListBox, Modal, Select, TextArea, TextField,
} from "@heroui/react";
import {
  LuCalendarClock,
  LuCircleHelp,
  LuFingerprint,
  LuSigma,
  LuTags,
  LuWandSparkles,
} from "react-icons/lu";

import {
  getDatasetIntelligence,
  refreshDatasetIntelligence,
  updateDatasetIntelligence,
} from "../../slices/dataset";
import { ButtonSpinner } from "../../components/ButtonSpinner";

const EMPTY_OVERRIDES = {
  dataset: {},
  fields: {},
  monitoring: {},
};

const FIELD_ROLES = [
  { value: "measure", label: "Measure", icon: LuSigma },
  { value: "dimension", label: "Dimension", icon: LuTags },
  { value: "time", label: "Time", icon: LuCalendarClock },
  { value: "identifier", label: "Identifier", icon: LuFingerprint },
  { value: "unknown", label: "Unknown", icon: LuCircleHelp },
];

const AGGREGATIONS = [
  ["sum", "Sum"],
  ["avg", "Average"],
  ["min", "Minimum"],
  ["max", "Maximum"],
  ["count", "Count"],
  ["none", "None"],
];

function copyOverrides(overrides = EMPTY_OVERRIDES) {
  return {
    dataset: { ...(overrides.dataset || {}) },
    fields: Object.fromEntries(
      Object.entries(overrides.fields || {}).map(([field, value]) => [
        field,
        { ...value },
      ])
    ),
    monitoring: { ...(overrides.monitoring || {}) },
  };
}

function displayFieldPath(path) {
  return path.replace(/^root\[\]\.?/, "");
}

function RoleOption({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="shrink-0 text-default-500" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

function DatasetIntelligenceModal({
  datasetId,
  isOpen,
  onOpenChange,
  onClose,
  teamId,
}) {
  const dispatch = useDispatch();
  const [intelligence, setIntelligence] = useState(null);
  const [overrides, setOverrides] = useState(copyOverrides());
  const [summary, setSummary] = useState("");
  const [grain, setGrain] = useState("");
  const [initialSummary, setInitialSummary] = useState("");
  const [initialGrain, setInitialGrain] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const hydrate = useCallback((result) => {
    const nextOverrides = copyOverrides(result?.overrides);
    const nextSummary = nextOverrides.dataset.summary
      || result?.profile?.dataset?.summary
      || "";
    const nextGrain = nextOverrides.dataset.grain
      || result?.profile?.dataset?.grain
      || "";

    setIntelligence(result);
    setOverrides(nextOverrides);
    setSummary(nextSummary);
    setGrain(nextGrain);
    setInitialSummary(nextSummary);
    setInitialGrain(nextGrain);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    dispatch(getDatasetIntelligence({
      team_id: teamId,
      dataset_id: datasetId,
    }))
      .unwrap()
      .then(hydrate)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [datasetId, dispatch, hydrate, teamId]);

  useEffect(() => {
    if (!isOpen || !teamId || !datasetId) return;
    load();
  }, [datasetId, isOpen, load, teamId]);

  const updateFieldOverride = (fieldPath, property, value) => {
    setOverrides((current) => {
      const next = copyOverrides(current);
      const field = { ...(next.fields[fieldPath] || {}) };

      if (value === "automatic") delete field[property];
      else field[property] = value;

      if (Object.keys(field).length === 0) delete next.fields[fieldPath];
      else next.fields[fieldPath] = field;
      return next;
    });
  };

  const updateDefaultTimeField = (value) => {
    setOverrides((current) => {
      const next = copyOverrides(current);
      if (value === "automatic") delete next.monitoring.defaultTimeField;
      else next.monitoring.defaultTimeField = value;
      return next;
    });
  };

  const save = async (nextOverrides = overrides) => {
    const payload = copyOverrides(nextOverrides);

    if (summary !== initialSummary) {
      if (summary.trim()) payload.dataset.summary = summary.trim();
      else delete payload.dataset.summary;
    }
    if (grain !== initialGrain) {
      if (grain.trim()) payload.dataset.grain = grain.trim();
      else delete payload.dataset.grain;
    }

    setSaving(true);
    try {
      const result = await dispatch(updateDatasetIntelligence({
        team_id: teamId,
        dataset_id: datasetId,
        overrides: payload,
      })).unwrap();
      hydrate(result);
      toast.success("Dataset meaning saved");
    } catch (error) {
      toast.error("Could not save dataset meaning");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await dispatch(refreshDatasetIntelligence({
        team_id: teamId,
        dataset_id: datasetId,
      })).unwrap();
      hydrate(result);
      toast.success("Dataset meaning refreshed");
    } catch (error) {
      toast.error("Could not refresh dataset meaning");
    } finally {
      setLoading(false);
    }
  };

  const useAutomaticValues = async () => {
    setSaving(true);
    try {
      const result = await dispatch(updateDatasetIntelligence({
        team_id: teamId,
        dataset_id: datasetId,
        overrides: copyOverrides(),
      })).unwrap();
      hydrate(result);
      toast.success("Automatic values restored");
    } catch (error) {
      toast.error("Could not restore automatic values");
    } finally {
      setSaving(false);
    }
  };

  const fields = Object.entries(intelligence?.profile?.fields || {});
  const timeFields = fields.filter(([, field]) => field.role === "time");
  const inferredDefaultTimeField = intelligence?.profile?.monitoring?.defaultTimeField;
  const automaticTimeLabel = inferredDefaultTimeField
    ? `Automatic (${displayFieldPath(inferredDefaultTimeField)})`
    : "Automatic";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="3xl">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Dataset meaning</Modal.Heading>
            <p className="text-sm text-muted">
              Help Chartbrew understand and reuse this dataset accurately through agentic operations.
            </p>
          </Modal.Header>
          <Modal.Body>
            {loading && (
              <div className="flex justify-center py-10">
                <ButtonSpinner />
              </div>
            )}

            {!loading && intelligence?.status === "disabled" && (
              <div className="py-8 text-center text-default-600">
                Dataset meaning is unavailable.
              </div>
            )}

            {!loading && loadError && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div>Could not load dataset meaning.</div>
                <Button variant="outline" onPress={load}>Try again</Button>
              </div>
            )}

            {!loading && !loadError && intelligence
              && intelligence.status !== "disabled"
              && !intelligence.profile && (
              <div className="py-8 text-center">
                Could not determine dataset meaning.
              </div>
            )}

            {!loading && intelligence?.profile && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField name="dataset-summary" fullWidth>
                    <Label>Summary</Label>
                    <TextArea
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder="Example: Online orders with customer, product, and revenue details"
                      rows={3}
                      variant="secondary"
                    />
                  </TextField>
                  <TextField name="dataset-grain" fullWidth>
                    <Label>One row represents</Label>
                    <TextArea
                      value={grain}
                      onChange={(event) => setGrain(event.target.value)}
                      placeholder="Example: One row per completed order"
                      rows={3}
                      variant="secondary"
                    />
                  </TextField>
                </div>

                <Select
                  placeholder="Automatic"
                  selectionMode="single"
                  value={overrides.monitoring.defaultTimeField || "automatic"}
                  onChange={updateDefaultTimeField}
                  variant="secondary"
                  className="max-w-md"
                >
                  <Label>Default time field</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover aria-label="Select default time field">
                    <ListBox>
                      <ListBox.Item id="automatic" textValue={automaticTimeLabel}>
                        {automaticTimeLabel}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {timeFields.map(([fieldPath]) => (
                        <ListBox.Item
                          key={fieldPath}
                          id={fieldPath}
                          textValue={displayFieldPath(fieldPath)}
                        >
                          {displayFieldPath(fieldPath)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">Fields</div>
                    <Button
                      variant="secondary"
                      onPress={useAutomaticValues}
                      isDisabled={loading || saving || !intelligence?.profile}
                    >
                      Use automatic values
                    </Button>
                  </div>
                  {fields.length === 0 && (
                    <div className="text-default-600 py-6">
                      Run the dataset once to detect its fields.
                    </div>
                  )}
                  {fields.length > 0 && (
                    <div className="max-h-105 overflow-y-auto border border-divider rounded-2xl">
                      {fields.map(([fieldPath, field]) => (
                        <div
                          key={fieldPath}
                          className="grid grid-cols-1 md:grid-cols-[minmax(180px,1fr)_240px_240px] gap-3 items-center p-3 border-b border-divider last:border-b-0"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="truncate" title={fieldPath}>
                              {displayFieldPath(fieldPath)}
                            </span>
                            <Chip size="sm" variant="soft">{field.type}</Chip>
                          </div>
                          <Select
                            aria-label={`Role for ${displayFieldPath(fieldPath)}`}
                            selectionMode="single"
                            value={overrides.fields[fieldPath]?.role || "automatic"}
                            onChange={(value) => updateFieldOverride(fieldPath, "role", value)}
                            variant="secondary"
                          >
                            <Select.Trigger>
                              <Select.Value className="whitespace-nowrap" />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover
                              aria-label={`Select role for ${displayFieldPath(fieldPath)}`}
                            >
                              <ListBox>
                                <ListBox.Item id="automatic" textValue={`Automatic (${field.role})`}>
                                  <RoleOption
                                    icon={LuWandSparkles}
                                    label={`Automatic (${field.role})`}
                                  />
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {FIELD_ROLES.map((role) => (
                                  <ListBox.Item
                                    key={role.value}
                                    id={role.value}
                                    textValue={role.label}
                                  >
                                    <RoleOption icon={role.icon} label={role.label} />
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <Select
                            aria-label={`Aggregation for ${displayFieldPath(fieldPath)}`}
                            selectionMode="single"
                            value={overrides.fields[fieldPath]?.defaultAggregation || "automatic"}
                            onChange={(value) => {
                              updateFieldOverride(fieldPath, "defaultAggregation", value);
                            }}
                            variant="secondary"
                          >
                            <Select.Trigger>
                              <Select.Value className="whitespace-nowrap" />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover
                              aria-label={`Select aggregation for ${displayFieldPath(fieldPath)}`}
                            >
                              <ListBox>
                                <ListBox.Item
                                  id="automatic"
                                  textValue={`Automatic (${field.defaultAggregation})`}
                                >
                                  Automatic ({field.defaultAggregation})
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {AGGREGATIONS.map(([value, label]) => (
                                  <ListBox.Item key={value} id={value} textValue={label}>
                                    {label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onPress={refresh}
              isDisabled={loading || saving || intelligence?.status === "disabled"}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onPress={() => save()}
              isPending={saving}
              isDisabled={loading || !intelligence?.profile}
            >
              {saving ? <ButtonSpinner /> : null}
              Save
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export default DatasetIntelligenceModal;
