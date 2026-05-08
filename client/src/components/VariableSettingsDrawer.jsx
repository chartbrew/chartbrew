import React from "react";
import PropTypes from "prop-types";
import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  TextField,
} from "@heroui/react";

import { ButtonSpinner } from "./ButtonSpinner";

const DEFAULT_REQUIRED_HINT =
  "This variable is required. The request will fail if you don't provide a value.";

const QUERY_REQUIRED_HINT =
  "This variable is required. The query will fail if you don't provide a value.";

function VariableSettingsDrawer(props) {
  const {
    variable,
    onClose,
    onPatch,
    onSave,
    onDelete,
    savePending,
    deletePending,
    requiredWithoutDefaultHint = DEFAULT_REQUIRED_HINT,
    defaultValueFieldName,
  } = props;

  const isOpen = !!variable;
  const variableName = variable?.name || "";
  const variableType = variable?.type || null;
  const canSave = Boolean(variableName.trim() && variableType);

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Variable settings</Modal.Heading>
            {variableName ? (
              <code className="w-fit rounded-md bg-accent-soft-hover px-1.5 py-0.5 text-sm text-accent-600">
                {`{{${variableName}}}`}
              </code>
            ) : null}
          </Modal.Header>
          <Modal.Body className="p-1">
            <div className="flex flex-col gap-4">
              <TextField
                variant="secondary"
                className="w-full"
                name="variable-name"
                isRequired
              >
                <Label>Variable name</Label>
                <Input
                  placeholder="startDate"
                  aria-label="Variable name"
                  fullWidth
                  value={variableName}
                  onChange={(e) => onPatch({ name: e.target.value.trim() })}
                />
                <Description>
                  Use this name in placeholders like {variableName ? `{{${variableName}}}` : "{{variableName}}"}.
                </Description>
              </TextField>

              <div className="flex flex-col gap-2">
                <Select
                  placeholder="Select a variable type"
                  fullWidth
                  selectionMode="single"
                  value={variableType}
                  onChange={(value) => onPatch({ type: value })}
                  variant="secondary"
                >
                  <Label>Select a type</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="string" textValue="String">
                        String
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="number" textValue="Number">
                        Number
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="boolean" textValue="Boolean">
                        Boolean
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="date" textValue="Date">
                        Date
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <TextField
                  variant="secondary"
                  className="w-full"
                  {...(defaultValueFieldName ? { name: defaultValueFieldName } : {})}
                >
                  <Label>Default value</Label>
                  <Input
                    placeholder="Type a value here"
                    aria-label="Default value"
                    fullWidth
                    value={variable?.default_value ?? ""}
                    onChange={(e) => onPatch({ default_value: e.target.value })}
                  />
                  {variable?.required && !variable?.default_value ? (
                    <Description>
                      {requiredWithoutDefaultHint}
                    </Description>
                  ) : null}
                </TextField>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Required</Label>
                <Switch
                  isSelected={variable?.required}
                  onChange={(selected) => onPatch({ required: selected })}
                  aria-label="Required"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="justify-between">
            <div>
              {variable?.id && onDelete ? (
                <Button
                  variant="danger-soft"
                  onPress={onDelete}
                  isPending={deletePending}
                >
                  {deletePending ? <ButtonSpinner /> : null}
                  Remove
                </Button>
              ) : null}
            </div>
            <div className="flex flex-row gap-2">
              <Button variant="tertiary" onPress={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                onPress={onSave}
                isPending={savePending}
                isDisabled={!canSave}
              >
                {savePending ? <ButtonSpinner /> : null}
                Save
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

VariableSettingsDrawer.propTypes = {
  variable: PropTypes.oneOfType([PropTypes.object, PropTypes.oneOf([null])]),
  onClose: PropTypes.func.isRequired,
  onPatch: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  savePending: PropTypes.bool,
  deletePending: PropTypes.bool,
  requiredWithoutDefaultHint: PropTypes.string,
  defaultValueFieldName: PropTypes.string,
};

VariableSettingsDrawer.defaultProps = {
  variable: null,
  savePending: false,
  deletePending: false,
  onDelete: null,
  requiredWithoutDefaultHint: DEFAULT_REQUIRED_HINT,
  defaultValueFieldName: undefined,
};

export default VariableSettingsDrawer;
export { DEFAULT_REQUIRED_HINT, QUERY_REQUIRED_HINT };
