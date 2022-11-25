import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Dropdown, Input, Loading, Modal, Row, Spacer, Text
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

  useEffect(() => {
    if (config) {
      setDataType(config.type || "none");

      if (config.format && !dateFormats.find((f) => f.value === config.format)) {
        setFormatValue("custom");
        setCustomDateFormat(config.format);
      } else {
        setFormatValue(config.format || "");
      }
    } else {
      setDataType("none");
      setFormatValue("");
      setCustomDateFormat("DD/MM/YYYY");
    }
  }, [config]);

  const _onSave = () => {
    if (dataType === "none") {
      onUpdate(null);
    }

    let format = formatValue;
    if (formatValue === "custom") {
      format = customDateFormat;
    }

    onUpdate({
      type: dataType,
      format,
    });
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
            <Dropdown>
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
              <Dropdown>
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
          disabled={(dataType !== "none" && !formatValue) || loading}
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
