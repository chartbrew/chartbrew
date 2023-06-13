import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Container, Dropdown, Input, Loading, Modal, Row, Spacer, Text
} from "@nextui-org/react";

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
    <Modal width="500px" open={open}>
      <Modal.Header>
        <Text h4>
          {"Change data format"}
        </Text>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row>
            <Text b>Data type</Text>
          </Row>
          <Row>
            <Dropdown isBordered>
              <Dropdown.Button auto bordered>
                {dataTypes.find((d) => d.value === dataType)?.text}
              </Dropdown.Button>
              <Dropdown.Menu
                selectionMode="single"
                selectedKeys={[dataType]}
                onAction={(key) => setDataType(key)}
              >
                {dataTypes.map((d) => (
                  <Dropdown.Item key={d.value}>
                    {d.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </Row>
          <Spacer y={0.5} />

          {dataType !== "none" && (
            <Row>
              <Text b>Format</Text>
            </Row>
          )}
          {dataType === "date" && (
            <Row>
              <Dropdown isBordered>
                <Dropdown.Button auto bordered>
                  {dateFormats.find((d) => d.value === formatValue)?.text}
                </Dropdown.Button>
                <Dropdown.Menu
                  selectionMode="single"
                  selectedKeys={[formatValue]}
                  onAction={(key) => setFormatValue(key)}
                  css={{ minWidth: "max-content" }}
                >
                  {dateFormats.map((d) => (
                    <Dropdown.Item key={d.value}>
                      {d.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>

              {formatValue === "custom" && (
                <>
                  <Spacer x={0.5} />
                  <Input
                    bordered
                    value={customDateFormat}
                    placeholder="Enter the format here"
                    onChange={(e) => setCustomDateFormat(e.target.value)}
                  />
                </>
              )}
            </Row>
          )}
          {dataType === "date" && formatValue === "custom" && (
            <>
              <Spacer y={0.2} />
              <Row>
                <Text small>
                  {"See "}
                  <a
                    href="https://momentjs.com/docs/#/displaying/format/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {"moment.js documentation"}
                  </a>
                  {" for how to format dates."}
                </Text>
              </Row>
            </>
          )}
          {(dataType === "number" || dataType === "currency") && (
            <>
              {dataType === "currency" && (
                <>
                  <Row>
                    <Input
                      bordered
                      value={symbol}
                      placeholder="Enter symbol here $, £, €, etc."
                      onChange={(e) => setSymbol(e.target.value)}
                      size="sm"
                    />
                  </Row>
                  <Spacer y={0.5} />
                </>
              )}
              <Row>
                <Checkbox
                  label="Add thousands separator"
                  isSelected={thousandsSeparator}
                  onChange={(checked) => setThousandsSeparator(checked)}
                  size="sm"
                />
              </Row>
              <Spacer y={0.5} />
              <Row>
                <Text b>Decimals</Text>
              </Row>
              <Row align="center">
                <Checkbox
                  label="Allow decimals"
                  isSelected={allowDecimals}
                  onChange={(checked) => setAllowDecimals(checked)}
                  size="sm"
                />
                <Spacer x={0.5} />
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  bordered
                  disabled={!allowDecimals}
                  size="sm"
                />
              </Row>
            </>
          )}
        </Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          auto
          color="warning"
          flat
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          auto
          onClick={_onSave}
          disabled={(dataType === "date" && !formatValue) || loading}
          icon={loading ? <Loading type="spinner" /> : null}
        >
          Save
        </Button>
      </Modal.Footer>
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
