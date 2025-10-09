import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Select, SelectItem, Spacer,
} from "@heroui/react";

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
    } else {
      setDataType("none");
      setFormatValue("");
      setCustomDateFormat("DD/MM/YYYY");
      setThousandsSeparator(false);
      setDecimals(0);
      setAllowDecimals(false);
      setSymbol("");
    }
  }, [config]);

  const _onSave = () => {
    const newConfig = {};

    if (dataType === "none") {
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
