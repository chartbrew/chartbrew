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

    onUpdate(newConfig);
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
