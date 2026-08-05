import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, ListBox, Modal, Select,
} from "@heroui/react";

import {
  createObservationValueFormat,
  getObservationValueFormat,
} from "../../modules/observationFormat";

function MonitorSettingsModal({ isPending, monitor, onClose, onSave }) {
  const [currency, setCurrency] = useState("USD");
  const [decimals, setDecimals] = useState("auto");
  const [desiredDirection, setDesiredDirection] = useState("neutral");
  const [formatSource, setFormatSource] = useState("chart");
  const [name, setName] = useState("");
  const [notation, setNotation] = useState("standard");
  const [percentageScale, setPercentageScale] = useState("1");
  const [valueMeaning, setValueMeaning] = useState("number");

  useEffect(() => {
    if (!monitor) return;
    const valueFormat = getObservationValueFormat("number", monitor.valueFormat);
    setCurrency(valueFormat.display.currency || "USD");
    setDecimals(Number.isInteger(valueFormat.display.decimals)
      ? `${valueFormat.display.decimals}`
      : "auto");
    setDesiredDirection(monitor.desiredDirection || "neutral");
    setFormatSource(valueFormat.mode === "chart" ? "chart" : "override");
    setName(monitor.name || "");
    setNotation(valueFormat.display.notation || "standard");
    setPercentageScale(`${valueFormat.display.scale || 1}`);
    setValueMeaning(valueFormat.meaning);
  }, [monitor]);

  return (
    <Modal.Backdrop isOpen={Boolean(monitor)} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit watched metric</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Input
              label="Name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
            <Select fullWidth onChange={setDesiredDirection} value={desiredDirection}>
              <Label>Healthy direction</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="higher" textValue="Higher is better">
                    Higher is better<ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="lower" textValue="Lower is better">
                    Lower is better<ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="neutral" textValue="Either direction can matter">
                    Either direction can matter<ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <Select fullWidth onChange={setFormatSource} value={formatSource}>
              <Label>Value formatting</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="chart" textValue="Use chart formatting">
                    Use chart formatting<ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="override" textValue="Customize formatting">
                    Customize formatting<ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            {formatSource === "override" ? (
              <Select fullWidth onChange={setValueMeaning} value={valueMeaning}>
                <Label>Value type</Label>
                <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="number" textValue="Number">
                      Number<ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="currency" textValue="Currency">
                      Currency<ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="percentage" textValue="Percentage">
                      Percentage<ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            ) : null}
            {formatSource === "override" && valueMeaning === "currency" ? (
              <Input
                label="Currency code"
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                value={currency}
              />
            ) : null}
            {formatSource === "override" && valueMeaning === "percentage" ? (
              <Select fullWidth onChange={setPercentageScale} value={percentageScale}>
                <Label>How is the percentage stored?</Label>
                <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="1" textValue="12.4 means 12.4%">12.4 means 12.4%<ListBox.ItemIndicator /></ListBox.Item>
                    <ListBox.Item id="100" textValue="0.124 means 12.4%">0.124 means 12.4%<ListBox.ItemIndicator /></ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            ) : null}
            {formatSource === "override" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select fullWidth onChange={setDecimals} value={decimals}>
                  <Label>Decimal places</Label>
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="auto" textValue="Automatic">
                        Automatic<ListBox.ItemIndicator />
                      </ListBox.Item>
                      {[0, 1, 2, 3].map((value) => (
                        <ListBox.Item id={`${value}`} key={value} textValue={`${value}`}>
                          {value}<ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {valueMeaning === "percentage" ? null : (
                  <Select fullWidth onChange={setNotation} value={notation}>
                    <Label>Large numbers</Label>
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="standard" textValue="Show full value">
                          Show full value<ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="compact" textValue="Abbreviate">
                          Abbreviate<ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="secondary">Cancel</Button>
            <Button
              isDisabled={!name.trim()}
              isPending={isPending}
              onPress={() => onSave({
                desiredDirection,
                name: name.trim(),
                valueFormat: createObservationValueFormat({
                  currency,
                  decimals,
                  meaning: valueMeaning,
                  mode: formatSource,
                  notation,
                  percentageScale,
                }),
              })}
              variant="primary"
            >
              Save changes
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

MonitorSettingsModal.propTypes = {
  isPending: PropTypes.bool.isRequired,
  monitor: PropTypes.shape({
    desiredDirection: PropTypes.string,
    name: PropTypes.string.isRequired,
    valueFormat: PropTypes.object,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

MonitorSettingsModal.defaultProps = { monitor: null };

export default MonitorSettingsModal;
