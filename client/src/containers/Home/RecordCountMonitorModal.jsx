import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Label, ListBox, Modal, Select,
} from "@heroui/react";

function RecordCountMonitorModal({ isOpen, isPending, onClose, onSubmit, options }) {
  const [datasetId, setDatasetId] = useState(null);
  const [desiredDirection, setDesiredDirection] = useState("neutral");

  useEffect(() => {
    if (!isOpen) return;
    setDatasetId(options[0]?.id || null);
    setDesiredDirection("neutral");
  }, [isOpen, options]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-1 pr-12">
            <Modal.Heading>Watch dataset records</Modal.Heading>
            <p className="text-sm font-normal text-foreground-500">
              Chartbrew will count the records returned after each refresh and flag material changes.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5">
            <Select
              fullWidth
              onChange={setDatasetId}
              placeholder="Choose a dataset"
              value={datasetId}
            >
              <Label>Dataset</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {options.map((option) => (
                    <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
                      {option.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <div className="flex flex-col gap-2">
              <Select
                fullWidth
                onChange={setDesiredDirection}
                value={desiredDirection}
              >
                <Label>What needs attention?</Label>
                <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="neutral" textValue="Any material change">
                      Any material change<ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="higher" textValue="Record count drops">
                      Record count drops<ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="lower" textValue="Record count rises">
                      Record count rises<ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
              <p className="text-xs text-foreground-500">
                Choose any change when unexpected growth and missing records are both important.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="secondary">Cancel</Button>
            <Button
              isDisabled={!datasetId}
              isPending={isPending}
              onPress={() => onSubmit({
                datasetId: Number(datasetId),
                desiredDirection,
              })}
              variant="primary"
            >
              Start watching
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

RecordCountMonitorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  isPending: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
};

export default RecordCountMonitorModal;
