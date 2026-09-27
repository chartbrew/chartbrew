import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, ColorSwatch, Dropdown, Input, Label, ListBox, Modal, Radio, RadioGroup,
  Select, Separator, TextField, ToggleButton, ToggleButtonGroup,
} from "@heroui/react";
import { LuEllipsisVertical, LuMoon, LuPlus, LuSun, LuUndo2 } from "react-icons/lu";
import toast from "react-hot-toast";
import ColorPickerControl from "../../../components/ColorPickerControl";
import { reportAppearanceRequest } from "../reportAppearanceApi";
import { reportColorLabels, reportContrastWarnings, reportThemes } from "../../../../../shared/reportAppearance.mjs";

function ReportAppearance({ value, onChange, mode, onModeChange, onReset, canReset, teamId, userId, teamAdmin, disabled }) {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const base = `/team/${teamId}/report-theme-presets`;
  const warnings = useMemo(() => reportContrastWarnings(value[mode]), [value, mode]);
  const selectedTheme = reportThemes.find((item) => JSON.stringify(item.appearance) === JSON.stringify(value));
  const preset = presets.find((item) => item.id === selectedPreset);
  const canManage = preset && (teamAdmin || preset.created_by === userId);

  const loadPresets = async () => {
    setLoadError("");
    try {
      setPresets(await reportAppearanceRequest(base));
    } catch {
      setLoadError("Presets could not be loaded.");
    }
  };

  useEffect(() => {
    let active = true;
    setPresets([]);
    setSelectedPreset(null);
    setLoadError("");
    reportAppearanceRequest(base).then((items) => {
      if (active) setPresets(items);
    }).catch(() => {
      if (active) setLoadError("Presets could not be loaded.");
    });
    return () => { active = false; };
  }, [base]);

  const applyTheme = (item) => {
    onChange(structuredClone(item.appearance));
    setSelectedPreset(typeof item.id === "number" ? item.id : null);
  };

  const openDialog = (action) => {
    setName(action === "rename" ? preset.name : "");
    setError("");
    setDialog({ action });
  };

  const savePreset = async () => {
    setBusy(true);
    setError("");
    try {
      const action = dialog.action;
      let result;
      if (action === "create") {
        result = await reportAppearanceRequest(base, "POST", { name, appearance: value });
        setPresets((items) => [...items, result]);
        setSelectedPreset(result.id);
      } else {
        result = await reportAppearanceRequest(`${base}/${preset.id}`, action === "delete" ? "DELETE" : "PUT", {
          revision: preset.revision,
          ...(action === "rename" ? { name } : {}),
          ...(action === "update" ? { appearance: value } : {}),
        });
        setPresets((items) => action === "delete" ? items.filter((item) => item.id !== preset.id)
          : items.map((item) => item.id === preset.id ? result : item));
        if (action === "delete") setSelectedPreset(null);
      }
      setDialog(null);
      toast.success(action === "delete" ? "Preset deleted" : "Preset saved");
    } catch (err) {
      setError(err.status === 409 ? "This preset changed. Close this dialog and reload presets before trying again." : err.message);
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle = {
    create: "Save as preset", rename: "Rename preset", update: "Update preset",
    delete: "Delete preset",
  }[dialog?.action];

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup
        aria-label="Built-in themes"
        orientation="horizontal"
        variant="secondary"
        value={selectedTheme?.id || ""}
        onChange={(id) => applyTheme(reportThemes.find((item) => item.id === id))}
        isDisabled={disabled}
        className="grid grid-cols-3 gap-2"
      >
        {reportThemes.map((item) => (
          <Radio key={item.id} value={item.id} className="min-w-0">
            <Radio.Content className="flex w-full flex-col items-start gap-2 rounded-lg border border-border p-2 data-[selected=true]:border-accent data-[selected=true]:ring-1 data-[selected=true]:ring-accent">
              <span aria-hidden="true" className="flex h-14 w-full flex-col overflow-hidden rounded-sm border" style={{ background: item.appearance[mode].page, borderColor: item.appearance[mode].border }}>
                <span className="flex h-4 items-center gap-1 px-1" style={{ background: item.appearance[mode].header }}>
                  <span className="h-1 w-2" style={{ background: item.appearance[mode].accent }} />
                  <span className="h-1 w-6" style={{ background: item.appearance[mode].headerText }} />
                </span>
                <span className="m-1 flex flex-1 items-end gap-1 px-1 pt-1" style={{ background: item.appearance[mode].surface }}>
                  {["h-2", "h-4", "h-3"].map((height) => (
                    <span key={height} className={`${height} flex-1`} style={{ background: item.appearance[mode].accent }} />
                  ))}
                </span>
              </span>
              <span className="text-xs font-medium">{item.name}</span>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>

      <div className="flex items-end gap-2">
        <Select
          aria-label="Team presets"
          placeholder="Team presets"
          variant="secondary"
          className="min-w-0 flex-1"
          value={selectedPreset === null ? null : String(selectedPreset)}
          onChange={(id) => { const item = presets.find((entry) => String(entry.id) === id); if (item) applyTheme(item); }}
          isDisabled={disabled || !presets.length}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox aria-label="Team presets">
              {presets.map((item) => (
                <ListBox.Item id={String(item.id)} key={item.id} textValue={item.name}>
                  <ColorSwatch color={item.appearance[mode].accent} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {canManage && (
          <Dropdown>
            <Button isIconOnly variant="secondary" aria-label="Preset actions" isDisabled={disabled}>
              <LuEllipsisVertical size={16} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Preset actions">
                <Dropdown.Item id="update" onAction={() => openDialog("update")}>Update preset</Dropdown.Item>
                <Dropdown.Item id="rename" onAction={() => openDialog("rename")}>Rename</Dropdown.Item>
                <Dropdown.Item id="delete" variant="danger" onAction={() => openDialog("delete")}>Delete</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>
      {loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" isDisabled={disabled} onPress={() => openDialog("create")}>
          <LuPlus size={14} />
          Save as preset
        </Button>
        <Button size="sm" variant="ghost" onPress={loadPresets} isDisabled={disabled}>Reload presets</Button>
      </div>
      <Separator />

      <Select variant="secondary" value={value.mode} onChange={(next) => { if (next) onChange({ ...value, mode: next }); }} isDisabled={disabled}>
        <Label>Default appearance</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label="Default appearance">
            {["system", "light", "dark"].map((item) => (
              <ListBox.Item id={item} key={item} textValue={item[0].toUpperCase() + item.slice(1)}>
                {item[0].toUpperCase() + item.slice(1)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Colors</h3>
        <ToggleButtonGroup
          aria-label="Edit colors"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([mode])}
          onSelectionChange={(keys) => { const next = [...keys][0]; if (next) onModeChange(next); }}
          isDisabled={disabled}
          size="sm"
        >
          <ToggleButton id="light" aria-label="Light colors">
            <LuSun size={14} />
            Light
          </ToggleButton>
          <ToggleButton id="dark" aria-label="Dark colors">
            <LuMoon size={14} />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div className="flex flex-col gap-1 [&_.color-picker]:w-full">
        {Object.entries(reportColorLabels).map(([key, label]) => (
          <div key={key}>
            <ColorPickerControl
              ariaLabel={label}
              value={value[mode][key]}
              valueFormat="hex"
              className="w-full"
              isDisabled={disabled}
              onChange={(color) => onChange({ ...value, [mode]: { ...value[mode], [key]: color.toUpperCase() } })}
              renderTrigger={({ color }) => (
                <span className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-secondary">
                  <span className="flex-1 text-left text-sm">{label}</span>
                  <span className="text-xs text-muted">{color}</span>
                  <ColorSwatch color={color} size="sm" className="border border-border" />
                </span>
              )}
            />
            {warnings.filter((warning) => warning.field === key).map((warning) => (
              <p key={warning.message} className="px-2 pb-2 text-xs text-warning">{warning.message}</p>
            ))}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="self-start" isDisabled={!canReset || disabled} onPress={onReset}>
        <LuUndo2 size={14} />
        Reset changes
      </Button>

      <Modal>
        <Modal.Backdrop isOpen={Boolean(dialog)} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }} isDismissable={!busy} isKeyboardDismissDisabled={busy}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{dialogTitle}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {["create", "rename"].includes(dialog?.action) && (
                  <TextField isDisabled={busy}>
                    <Label>Preset name</Label>
                    <Input variant="secondary" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
                  </TextField>
                )}
                {dialog?.action === "create" && <p className="text-sm text-muted">Available to your team. Save the report separately to publish its colors.</p>}
                {dialog?.action === "update" && <p className="text-sm">Replace this preset's light and dark colors? Existing reports will not change.</p>}
                {dialog?.action === "delete" && <p className="text-sm">Delete this team preset? Saved reports keep their colors.</p>}
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setDialog(null)} isDisabled={busy}>Cancel</Button>
                <Button
                  variant={dialog?.action === "delete" ? "danger" : "primary"}
                  isPending={busy}
                  isDisabled={(["create", "rename"].includes(dialog?.action) && !name.trim())}
                  onPress={savePreset}
                >
                  {dialog?.action === "delete" ? "Delete" : "Save preset"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

ReportAppearance.propTypes = {
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  onModeChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  canReset: PropTypes.bool.isRequired,
  teamId: PropTypes.number.isRequired,
  userId: PropTypes.number.isRequired,
  teamAdmin: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default ReportAppearance;
