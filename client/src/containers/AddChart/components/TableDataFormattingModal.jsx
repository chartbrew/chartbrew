import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select, SelectItem, Spacer,
} from "@heroui/react";
import { LuPlus, LuX } from "react-icons/lu";
import { TwitterPicker } from "react-color";
import { chartColors } from "../../../config/colors";

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
}];

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
    color: "primary",
    variant: "flat",
    text: "View",
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
        setButtonSettings({
          color: config.display.button.color,
          variant: config.display.button.variant,
          text: config.display.button.text,
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
        color: "primary",
        variant: "flat",
        text: "View",
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
    if (buttonSettings.color && buttonSettings.variant && buttonSettings.text) newConfig.display = { ...(newConfig.display || {}), button: { color: buttonSettings.color, variant: buttonSettings.variant, text: buttonSettings.text } };

    onUpdate(newConfig);
  };

  const _onChangeButtonSettings = (data) => {
    setButtonSettings({ ...buttonSettings, ...data });
  };

  return (
    <Modal isOpen={open} size="xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col">
          <div>Column formatting</div>
          <div className="text-sm text-gray-500 font-normal">Change the data format for this column</div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-row">
            <Select
              label="Data type"
              variant="bordered"
              selectedKeys={[dataType]}
              onSelectionChange={(keys) => setDataType(keys.currentKey)}
              selectionMode="single"
              aria-label="Select a data type"
              disallowEmptySelection
            >
              {dataTypes.map((d) => (
                <SelectItem key={d.value} textValue={d.text}>
                  {d.text}
                </SelectItem>
              ))}
            </Select>
          </div>

          {dataType === "date" && (
            <div className="flex flex-row items-center">
              <Select
                label="Date format"
                variant="bordered"
                selectedKeys={[formatValue]}
                onSelectionChange={(keys) => setFormatValue(keys.currentKey)}
                selectionMode="single"
                aria-label="Select a date format"
              >
                {dateFormats.map((d) => (
                  <SelectItem key={d.value} textValue={d.text}>
                    {d.text}
                  </SelectItem>
                ))}
              </Select>

              {formatValue === "custom" && (
                <>
                  <Spacer x={1} />
                  <Input
                    variant="bordered"
                    value={customDateFormat}
                    placeholder="Enter the format here"
                    onChange={(e) => setCustomDateFormat(e.target.value)}
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
                      variant="bordered"
                      value={symbol}
                      placeholder="Enter symbol here $, £, €, etc."
                      onChange={(e) => setSymbol(e.target.value)}
                      size="sm"
                    />
                  </div>
                </>
              )}
              <div>
                <Checkbox
                  isSelected={thousandsSeparator}
                  onValueChange={(checked) => setThousandsSeparator(checked)}
                  size="sm"
                >
                  Use thousands separator
                </Checkbox>
              </div>
              <div>
                <Checkbox
                  isSelected={allowDecimals}
                  onValueChange={(checked) => setAllowDecimals(checked)}
                  size="sm"
                >
                  Allow decimals
                </Checkbox>
              </div>
              <div>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  variant="bordered"
                  isDisabled={!allowDecimals}
                  size="sm"
                />
              </div>
            </>
          )}

          <Divider />
          <Select 
            label="Display format"
            variant="bordered"
            selectedKeys={[displayFormat]}
            onSelectionChange={(keys) => setDisplayFormat(keys.currentKey)}
            selectionMode="single"
            aria-label="Select a display format"
            disallowEmptySelection
          >
            {displayFormats.map((d) => (
              <SelectItem key={d.value} textValue={d.text}>
                {d.text}
              </SelectItem>
            ))}
          </Select>

          {displayFormat === "mapping" && (
            <div className="flex flex-col items-start gap-1">
              {rules.map((r, index) => (
                <div key={index} className="flex flex-row items-center gap-2 w-full">
                  <Input
                    placeholder="Enter the original value here"
                    value={r.value}
                    onChange={(e) => setRules(rules.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                    variant="bordered"
                    size="sm"
                  />
                  <Input
                    placeholder="Enter the display value here"
                    value={r.label}
                    onChange={(e) => setRules(rules.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))}
                    variant="bordered"
                    size="sm"
                  />
                  <Popover aria-label="Color picker">
                    <PopoverTrigger>
                      <Chip
                        size="sm"
                        variant="light"
                        onPress={() => setRules(rules.map((r, i) => (i === index ? { ...r, color: r.color ? null : "rgba(0,0,0,0)" } : r)))}
                        className="pl-10 border-1 border-solid border-content3"
                        radius="sm"
                        style={{
                          backgroundColor: r.color || "transparent",
                        }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="flex flex-col items-start py-2">
                      <TwitterPicker
                        triangle={"hide"}
                        color={r.color || "rgba(0,0,0,0)"}
                        onChange={(color) => setRules(rules.map((r, i) => (i === index ? { ...r, color: color.hex } : r)))}
                        colors={Object.values(chartColors).map((c) => c.hex)}
                        styles={{ default: { card: { boxShadow: "none" } } }}
                      />
                      <Button
                        variant="light"
                        onPress={() => setRules(rules.map((r, i) => (i === index ? { ...r, color: null } : r)))}
                        size="sm"
                        startContent={<LuX />}
                      >
                        Remove color
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => setRules(rules.filter((_, i) => i !== index))}
                    size="sm"
                  >
                    <LuX />
                  </Button>
                </div>
              ))}
              <Button
                variant="light"
                onPress={() => setRules([...rules, { value: "", label: "" }])}
                size="sm"
                startContent={<LuPlus className="text-gray-500" size={16} />}
              >
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
                  variant="bordered"
                  size="sm"
                />
                <div className="text-sm text-gray-500">to</div>
                <Input
                  type="number"
                  placeholder="Max value"
                  value={progress?.max}
                  onChange={(e) => setProgress({ ...progress, max: e.target.value })}
                  variant="bordered"
                  size="sm"
                />
              </div>
            </div>
          )}

          {displayFormat === "button" && (
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-gray-500">
                Button color:
              </div>
              <div className="flex flex-row items-center gap-1">
                <Chip
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => _onChangeButtonSettings({ color: "primary", variant: "solid" })}
                  className={`px-4 ${buttonSettings.color === "primary" && buttonSettings.variant === "solid" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  onClick={() => _onChangeButtonSettings({ color: "primary", variant: "flat" })}
                  className={`px-4 ${buttonSettings.color === "primary" && buttonSettings.variant === "flat" ? " outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="solid"
                  color="secondary"
                  onClick={() => _onChangeButtonSettings({ color: "secondary", variant: "solid" })}
                  className={`px-4 ${buttonSettings.color === "secondary" && buttonSettings.variant === "solid" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  onClick={() => _onChangeButtonSettings({ color: "secondary", variant: "bordered" })}
                  className={`px-4 ${buttonSettings.color === "secondary" && buttonSettings.variant === "bordered" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="solid"
                  color="success"
                  onClick={() => _onChangeButtonSettings({ color: "success", variant: "light" })}
                  className={`px-4 ${buttonSettings.color === "success" && buttonSettings.variant === "light" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  onClick={() => _onChangeButtonSettings({ color: "success", variant: "flat" })}
                  className={`px-4 ${buttonSettings.color === "success" && buttonSettings.variant === "flat" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="solid"
                  color="default"
                  onClick={() => _onChangeButtonSettings({ color: "default", variant: "solid" })}
                  className={`px-4 ${buttonSettings.color === "default" && buttonSettings.variant === "solid" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="default"
                  onClick={() => _onChangeButtonSettings({ color: "default", variant: "flat" })}
                  className={`px-4 ${buttonSettings.color === "default" && buttonSettings.variant === "flat" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="solid"
                  color="warning"
                  onClick={() => _onChangeButtonSettings({ color: "warning", variant: "solid" })}
                  className={`px-4 ${buttonSettings.color === "warning" && buttonSettings.variant === "solid" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  onClick={() => _onChangeButtonSettings({ color: "warning", variant: "flat" })}
                  className={`px-4 ${buttonSettings.color === "warning" && buttonSettings.variant === "flat" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="solid"
                  color="danger"
                  onClick={() => _onChangeButtonSettings({ color: "danger", variant: "solid" })}
                  className={`px-4 ${buttonSettings.color === "danger" && buttonSettings.variant === "solid" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
                <Chip
                  size="sm"
                  variant="flat"
                  color="danger"
                  onClick={() => _onChangeButtonSettings({ color: "danger", variant: "flat" })}
                  className={`px-4 ${buttonSettings.color === "danger" && buttonSettings.variant === "flat" ? "outline-black outline-2" : ""}`}
                  content=" "
                />
              </div>
              <Spacer y={1} />
              <div className="text-sm text-gray-500">
                Button text:
              </div>
              <div className="flex flex-row items-center gap-1">
                <Input
                  placeholder="Enter the button text here"
                  value={buttonSettings.text}
                  onChange={(e) => _onChangeButtonSettings({ text: e.target.value })}
                  variant="bordered"
                  size="sm"
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="bordered"
            onPress={onClose}
            size="sm"
          >
            Close
          </Button>
          <Button
            onPress={_onSave}
            size="sm"
            isDisabled={(dataType === "date" && !formatValue)}
            isLoading={loading}
            color="primary"
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
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
