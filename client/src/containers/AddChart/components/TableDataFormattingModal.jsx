import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Chip, Description, Separator, Input, Label, ListBox, Modal,
  Popover,
  Select,
  TextField,
} from "@heroui/react";
import { LuCheck, LuPlus, LuX } from "react-icons/lu";
import { Block } from "@uiw/react-color";
import { chartColors } from "../../../config/colors";
import { normalizeColorForUiwPicker } from "../../../modules/uiwColorPicker";
import { cn } from "../../../modules/utils";

const dataTypes = [{
  value: "none",
  text: "None",
}, {
  value: "date",
  text: "Date",
}, {
  value: "number",
  text: "Number",
}, {
  value: "currency",
  text: "Currency",
}];

const dateFormats = [{
  value: "custom",
  text: "Custom",
}, {
  value: "dddd, D MMMM YYYY",
  text: "Monday, 23 November 2020",
}, {
  value: "ddd, D MMM YYYY",
  text: "Mon, 23 Nov 2020",
}, {
  value: "D MMMM YYYY",
  text: "23 November 2020",
}, {
  value: "D MMMM YYYY, HH:mm",
  text: "23 November 2020, 14:00",
}, {
  value: "D MMM YYYY",
  text: "23 Nov 2020",
}, {
  value: "D MMMM",
  text: "23 November",
}, {
  value: "D MMM",
  text: "23 Nov",
}, {
  value: "MMMM YYYY",
  text: "November 2020",
}, {
  value: "MM/DD/YYYY",
  text: "11/23/2020",
}, {
  value: "DD/MM/YYYY",
  text: "23/11/2020",
}, {
  value: "YYYY/MM/DD",
  text: "2020/11/23",
}, {
  value: "YYYY-MM-DD",
  text: "2020-11-23",
}];

const displayFormats = [{
  value: "default",
  text: "Default",
}, {
  value: "mapping",
  text: "Value mapping",
}, {
  value: "progress",
  text: "Progress bar",
}, {
  value: "button",
  text: "Button (URL)",
}, {
  value: "image",
  text: "Image",
}];

/** HeroUI v3 table URL button presets (aligns with Button variants). */
const TABLE_COLUMN_BUTTON_STYLES = [
  { id: "accent", label: "Accent", chipColor: "accent", chipVariant: "primary" },
  { id: "success", label: "Success", chipColor: "success", chipVariant: "primary" },
  { id: "warning", label: "Warning", chipColor: "warning", chipVariant: "primary" },
  { id: "danger", label: "Danger", chipColor: "danger", chipVariant: "primary" },
  { id: "danger-soft", label: "Danger soft", chipColor: "danger", chipVariant: "soft" },
];

const TABLE_COLUMN_BUTTON_STYLE_IDS = new Set(TABLE_COLUMN_BUTTON_STYLES.map((s) => s.id));

function persistedVariantForTableColumnButtonStyle(styleId) {
  if (styleId === "danger") return "danger";
  if (styleId === "danger-soft") return "danger-soft";
  return "primary";
}

function normalizeTableColumnButtonSettingsFromConfig(button) {
  if (!button) {
    return { color: "accent", variant: "primary", text: "View" };
  }
  const { color, variant, text } = button;
  if (TABLE_COLUMN_BUTTON_STYLE_IDS.has(color)) {
    return {
      color,
      variant: persistedVariantForTableColumnButtonStyle(color),
      text: text || "View",
    };
  }
  if (color === "danger" && (variant === "flat" || variant === "tertiary" || variant === "light")) {
    return { color: "danger-soft", variant: "danger-soft", text: text || "View" };
  }
  if (color === "danger") {
    return { color: "danger", variant: "danger", text: text || "View" };
  }
  if (color === "success") {
    return { color: "success", variant: "primary", text: text || "View" };
  }
  if (color === "warning") {
    return { color: "warning", variant: "primary", text: text || "View" };
  }
  return {
    color: "accent",
    variant: "primary",
    text: text || "View",
  };
}

function TableDataFormattingModal(props) {
  const {
    open, onUpdate, onClose, config, loading,
  } = props;

  const [dataType, setDataType] = useState("none");
  const [formatValue, setFormatValue] = useState("");
  const [customDateFormat, setCustomDateFormat] = useState("DD/MM/YYYY");
  const [thousandsSeparator, setThousandsSeparator] = useState(false);
  const [decimals, setDecimals] = useState(0);
  const [allowDecimals, setAllowDecimals] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [displayFormat, setDisplayFormat] = useState("default");
  const [rules, setRules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [buttonSettings, setButtonSettings] = useState({
    color: "accent",
    variant: "primary",
    text: "View",
  });
  const [imageSettings, setImageSettings] = useState({
    size: 100,
    variant: "inline"
  });

  useEffect(() => {
    if (config) {
      setDataType(config.type || "none");

      if (config.format && !dateFormats.find((f) => f.value === config.format)) {
        setFormatValue("custom");
        setCustomDateFormat(config.format);
      } else {
        setFormatValue(config.format || "");
      }

      if (config.thousandsSeparator) {
        setThousandsSeparator(true);
      }

      if (config.decimals > -1) {
        setDecimals(config.decimals);
      }

      if (config.allowDecimals) {
        setAllowDecimals(true);
      }

      if (config.symbol) {
        setSymbol(config.symbol);
      }

      if (config.display?.format) {
        setDisplayFormat(config.display.format);
      }

      if (config.display?.rules) {
        setRules(config.display.rules);
      }

      if (config.display?.progress) {
        setProgress(config.display.progress);
      }

      if (config.display?.button) {
        setButtonSettings(normalizeTableColumnButtonSettingsFromConfig(config.display.button));
      }

      if (config.display?.image) {
        setImageSettings({
          size: config.display.image.size,
          variant: config.display.image.variant,
        });
      }
    } else {
      setDataType("none");
      setFormatValue("");
      setCustomDateFormat("DD/MM/YYYY");
      setThousandsSeparator(false);
      setDecimals(0);
      setAllowDecimals(false);
      setSymbol("");
      setDisplayFormat("default");
      setRules([]);
      setButtonSettings({
        color: "accent",
        variant: "primary",
        text: "View",
      });
      setImageSettings({
        size: 100,
        variant: "inline"
      });
    }
  }, [config]);

  const _onSave = () => {
    const newConfig = {};

    if (dataType === "none" && displayFormat === "default") {
      onUpdate(null);
    }

    let format = formatValue;
    if (formatValue === "custom") {
      format = customDateFormat;
    }

    newConfig.type = dataType;
    newConfig.format = format;
    newConfig.thousandsSeparator = thousandsSeparator;
    if (allowDecimals) {
      newConfig.decimals = decimals;
      newConfig.allowDecimals = allowDecimals;
    }
    if (symbol) newConfig.symbol = symbol;
    if (displayFormat) newConfig.display = { ...(newConfig.display || {}), format: displayFormat };
    if (rules) newConfig.display = { ...(newConfig.display || {}), rules };
    if (progress) newConfig.display = { ...(newConfig.display || {}), progress };
    if (buttonSettings.color && buttonSettings.text) {
      newConfig.display = {
        ...(newConfig.display || {}),
        button: {
          color: buttonSettings.color,
          variant: persistedVariantForTableColumnButtonStyle(buttonSettings.color),
          text: buttonSettings.text,
        },
      };
    }
    if (imageSettings.size) newConfig.display = { ...(newConfig.display || {}), image: { size: imageSettings.size, variant: imageSettings.variant } };

    onUpdate(newConfig);
  };

  const _onChangeButtonSettings = (data) => {
    setButtonSettings({ ...buttonSettings, ...data });
  };

  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal.Container size="lg">
        <Modal.Dialog>
        <Modal.Header className="flex flex-col">
          <Modal.Heading>Column formatting</Modal.Heading>
          <div className="text-sm text-gray-500 font-normal">Change the data format for this column</div>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-2 p-1">
          <div className="flex flex-row">
            <Select
              variant="secondary"
              selectionMode="single"
              value={dataType}
              onChange={(value) => setDataType(value)}
              aria-label="Select a data type"
              className="w-full"
            >
              <Label>Data type</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {dataTypes.map((d) => (
                    <ListBox.Item key={d.value} id={d.value} textValue={d.text}>
                      {d.text}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {dataType === "date" && (
            <div className="flex flex-row items-center">
              <Select
                variant="secondary"
                selectionMode="single"
                value={formatValue || null}
                onChange={(value) => setFormatValue(value)}
                aria-label="Select a date format"
                fullWidth
              >
                <Label>Date format</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {dateFormats.map((d) => (
                      <ListBox.Item key={d.value} id={d.value} textValue={d.text}>
                        {d.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {formatValue === "custom" && (
                <>
                  <div className="w-2" />
                  <Input
                    variant="secondary"
                    value={customDateFormat}
                    placeholder="Enter the format here"
                    onChange={(e) => setCustomDateFormat(e.target.value)}
                    fullWidth
                  />
                </>
              )}
            </div>
          )}
          {dataType === "date" && formatValue === "custom" && (
            <>
              <div className="text-sm text-gray-500">
                {"See "}
                <a
                  href="https://momentjs.com/docs/#/displaying/format/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {"moment.js documentation"}
                </a>
                {" for how to format dates."}
              </div>
            </>
          )}
          {(dataType === "number" || dataType === "currency") && (
            <>
              {dataType === "currency" && (
                <>
                  <div>
                    <Input
                      variant="secondary"
                      value={symbol}
                      placeholder="Enter symbol here $, £, €, etc."
                      onChange={(e) => setSymbol(e.target.value)}
                      size="sm"
                      fullWidth
                    />
                  </div>
                </>
              )}
              <div>
                <Checkbox
                  id="table-format-thousands"
                  isSelected={thousandsSeparator}
                  onChange={(checked) => setThousandsSeparator(checked)}
                  className="w-full"
                  variant="secondary"
                >
                  <Checkbox.Control className="size-4 shrink-0">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label htmlFor="table-format-thousands" className="text-sm">Use thousands separator</Label>
                  </Checkbox.Content>
                </Checkbox>
              </div>
              <div>
                <Checkbox
                  id="table-format-decimals"
                  isSelected={allowDecimals}
                  onChange={(checked) => setAllowDecimals(checked)}
                  className="w-full"
                  variant="secondary"
                >
                  <Checkbox.Control className="size-4 shrink-0">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label htmlFor="table-format-decimals" className="text-sm">Allow decimals</Label>
                  </Checkbox.Content>
                </Checkbox>
              </div>
              <div>
                <TextField name="decimals" className="w-full">
                  <Label>Decimals</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    variant="secondary"
                    isDisabled={!allowDecimals}
                    size="sm"
                  />
                </TextField>
              </div>
            </>
          )}

          <div className="h-1" />
          <Separator />
          <div className="h-1" />

          <Select 
            variant="secondary"
            selectionMode="single"
            value={displayFormat}
            onChange={(value) => setDisplayFormat(value)}
            aria-label="Select a display format"
          >
            <Label>Display format</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {displayFormats.map((d) => (
                  <ListBox.Item key={d.value} id={d.value} textValue={d.text}>
                    {d.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {displayFormat === "mapping" && (
            <div className="flex flex-col items-start gap-1">
              {rules.map((r, index) => (
                <div key={index} className="flex flex-row items-center gap-2 w-full">
                  <Input
                    placeholder="Enter the original value here"
                    value={r.value}
                    onChange={(e) => setRules(rules.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                    variant="secondary"
                    size="sm"
                  />
                  <Input
                    placeholder="Enter the display value here"
                    value={r.label}
                    onChange={(e) => setRules(rules.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))}
                    variant="secondary"
                    size="sm"
                  />
                  <Popover aria-label="Color picker">
                      <Popover.Trigger>
                      <Chip
                        size="sm"
                        variant="soft"
                        onPress={() => setRules(rules.map((r, i) => (i === index ? { ...r, color: r.color ? null : chartColors.blue.hex } : r)))}
                        className="rounded-sm pl-10 border border-solid border-content3"
                        style={{
                          backgroundColor: r.color || "transparent",
                        }}
                      />
                    </Popover.Trigger>
                    <Popover.Content className="flex flex-col items-start py-2">
                      <Popover.Dialog>
                        <Block
                          showTriangle={false}
                          color={normalizeColorForUiwPicker(r.color, chartColors.blue.hex)}
                          onChange={(color) => setRules(rules.map((r, i) => (i === index ? { ...r, color: color.hex } : r)))}
                          colors={Object.values(chartColors).map((c) => c.hex)}
                          style={{ boxShadow: "none" }}
                        />
                        <Button
                          variant="ghost"
                          onPress={() => setRules(rules.map((r, i) => (i === index ? { ...r, color: null } : r)))}
                          size="sm"
                        >
                          <LuX />
                          Remove color
                        </Button>
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={() => setRules(rules.filter((_, i) => i !== index))}
                    size="sm"
                  >
                    <LuX />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                onPress={() => setRules([...rules, { value: "", label: "" }])}
                size="sm"
              >
                <LuPlus className="text-gray-500" size={16} />
                Add rule
              </Button>
            </div>
          )}

          {displayFormat === "progress" && (
            <div className="flex flex-col items-start gap-1">
              <div className="flex flex-row items-center gap-1">
                <Input
                  type="number"
                  placeholder="Min value"
                  value={progress?.min}
                  onChange={(e) => setProgress({ ...progress, min: e.target.value })}
                  variant="secondary"
                  size="sm"
                />
                <div className="text-sm text-gray-500">to</div>
                <Input
                  type="number"
                  placeholder="Max value"
                  value={progress?.max}
                  onChange={(e) => setProgress({ ...progress, max: e.target.value })}
                  variant="secondary"
                  size="sm"
                />
              </div>
            </div>
          )}

          {displayFormat === "button" && (
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-gray-500">
                Button style:
              </div>
              <div className="flex flex-row flex-wrap items-center gap-2">
                {TABLE_COLUMN_BUTTON_STYLES.map((style) => {
                  const selected = buttonSettings.color === style.id;
                  return (
                    <Chip
                      key={style.id}
                      size="sm"
                      color={style.chipColor}
                      variant={style.chipVariant}
                      aria-pressed={selected}
                      aria-label={`${style.label}${selected ? ", selected" : ""}`}
                      onClick={() => _onChangeButtonSettings({
                        color: style.id,
                        variant: persistedVariantForTableColumnButtonStyle(style.id),
                      })}
                      className={cn(
                        selected
                          ? "cursor-pointer px-3 border-2 border-divider"
                          : "cursor-pointer px-3"
                      )}
                    >
                      {selected ? (
                        <LuCheck size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
                      ) : null}
                      <Chip.Label className={selected ? "font-semibold" : undefined}>
                        {style.label}
                      </Chip.Label>
                    </Chip>
                  );
                })}
              </div>
              <div className="h-2" />
              <div className="text-sm text-gray-500">
                Button text:
              </div>
              <div className="flex flex-row items-center gap-1 w-full">
                <Input
                  placeholder="Enter the button text here"
                  value={buttonSettings.text}
                  onChange={(e) => _onChangeButtonSettings({ text: e.target.value })}
                  variant="secondary"
                  size="sm"
                  fullWidth
                />
              </div>
            </div>
          )}

          {displayFormat === "image" && (
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-gray-500">
                Image size (width in pixels)
              </div>
              <div className="flex flex-row items-center gap-1 w-full">
                <Input
                  type="number"
                  placeholder="Enter the image size here"
                  value={imageSettings.size}
                  onChange={(e) => setImageSettings({ ...imageSettings, size: e.target.value })}
                  variant="secondary"
                  size="sm"
                  fullWidth
                />
                <div className="text-sm text-gray-500">px</div>
              </div>

              <div className="h-2" />
              <div className="text-sm text-gray-500">
                Image variant
              </div>
              <Select
                variant="secondary"
                selectionMode="single"
                value={imageSettings.variant}
                onChange={(value) => setImageSettings({ ...imageSettings, variant: value })}
                aria-label="Select a image variant"
                className="w-full"
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="inline" textValue="Inline">
                      <div className="flex flex-col">
                        <span>Inline</span>
                        <span className="text-wrap text-xs text-foreground-500">The image will be displayed directly in the cell</span>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="popup" textValue="Popup">
                      <div className="flex flex-col">
                        <span>Popup</span>
                        <span className="text-wrap text-xs text-foreground-500">The cell will display a button that opens the image in a popup</span>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
                <Description>Choose how images render in the table cell</Description>
              </Select>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onPress={onClose}
            size="sm"
          >
            Close
          </Button>
          <Button
            onPress={_onSave}
            size="sm"
            isDisabled={(dataType === "date" && !formatValue)}
            isPending={loading}
          >
            Save
          </Button>
        </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

TableDataFormattingModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  config: PropTypes.object,
  onUpdate: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

TableDataFormattingModal.defaultProps = {
  open: false,
  config: null,
  loading: false,
};

export default TableDataFormattingModal;
