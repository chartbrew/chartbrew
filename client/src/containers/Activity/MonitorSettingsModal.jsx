import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, ListBox, Modal, Select,
} from "@heroui/react";

function buildValueFormat(mode, currency, scale) {
  if (mode === "chart") return { mode: "chart" };
  if (mode === "currency") return { currency: currency || "USD", mode: "override", type: "currency" };
  if (mode === "percentage") return { mode: "override", scale: Number(scale), type: "percentage" };
  return { mode: "override", type: "number" };
}

function MonitorSettingsModal({ isPending, monitor, onClose, onSave }) {
  const [currency, setCurrency] = useState("USD");
  const [desiredDirection, setDesiredDirection] = useState("neutral");
  const [formatMode, setFormatMode] = useState("chart");
  const [name, setName] = useState("");
  const [percentageScale, setPercentageScale] = useState("1");

  useEffect(() => {
    if (!monitor) return;
    setCurrency(monitor.valueFormat?.currency || "USD");
    setDesiredDirection(monitor.desiredDirection || "neutral");
    setFormatMode(monitor.valueFormat?.mode === "chart"
      ? "chart"
      : monitor.valueFormat?.type || "number");
    setName(monitor.name || "");
    setPercentageScale(`${monitor.valueFormat?.scale || 1}`);
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
            <Select fullWidth onChange={setFormatMode} value={formatMode}>
              <Label>Display values as</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="chart" textValue="Same as chart">Same as chart<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="number" textValue="Number">Number<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="currency" textValue="Currency">Currency<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="percentage" textValue="Percentage">Percentage<ListBox.ItemIndicator /></ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            {formatMode === "currency" ? (
              <Input
                label="Currency code"
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                value={currency}
              />
            ) : null}
            {formatMode === "percentage" ? (
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
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="secondary">Cancel</Button>
            <Button
              isDisabled={!name.trim()}
              isPending={isPending}
              onPress={() => onSave({
                desiredDirection,
                name: name.trim(),
                valueFormat: buildValueFormat(formatMode, currency, percentageScale),
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
