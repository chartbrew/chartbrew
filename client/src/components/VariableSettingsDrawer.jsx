import React from "react";
import PropTypes from "prop-types";
import {
  Button,
  Description,
  Drawer,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextField,
  Tooltip,
} from "@heroui/react";
import { LuChevronsRight } from "react-icons/lu";

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
    savePending,
    requiredWithoutDefaultHint = DEFAULT_REQUIRED_HINT,
    defaultValueFieldName,
  } = props;

  const isOpen = !!variable;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content
          placement="right"
          className="sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium"
          style={{
            paddingTop: "54px",
          }}
        >
          <Drawer.Dialog>
            <Drawer.Header className="flex flex-row items-center border-b border-divider gap-2 pb-2 justify-between bg-surface/50 backdrop-saturate-150 backdrop-blur-lg">
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    onPress={onClose}
                    size="sm"
                    variant="tertiary"
                  >
                    <LuChevronsRight />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Close</Tooltip.Content>
              </Tooltip>
              <div className="text-sm font-bold">Variable settings</div>
              <div className="flex flex-row items-center gap-2">
                <code className="rounded-md bg-accent-soft-hover px-1.5 py-0.5 text-sm text-accent-600">
                  {variable?.name}
                </code>
              </div>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col gap-2">
                <Label>Variable name</Label>
                <pre className="text-accent">
                  {variable?.name}
                </pre>
              </div>
              <div className="h-4" />
              <div className="flex flex-col gap-2">
                <Select
                  placeholder="Select a variable type"
                  fullWidth
                  selectionMode="single"
                  value={variable?.type || null}
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
              <div className="h-2" />
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
              <div className="h-2" />
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
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="tertiary" onPress={onClose}>
                Close
              </Button>
              <Button variant="primary" onPress={onSave} isPending={savePending}>
                {savePending ? <ButtonSpinner /> : null}
                Save
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

VariableSettingsDrawer.propTypes = {
  variable: PropTypes.oneOfType([PropTypes.object, PropTypes.oneOf([null])]),
  onClose: PropTypes.func.isRequired,
  onPatch: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  savePending: PropTypes.bool,
  requiredWithoutDefaultHint: PropTypes.string,
  defaultValueFieldName: PropTypes.string,
};

VariableSettingsDrawer.defaultProps = {
  variable: null,
  savePending: false,
  requiredWithoutDefaultHint: DEFAULT_REQUIRED_HINT,
  defaultValueFieldName: undefined,
};

export default VariableSettingsDrawer;
export { DEFAULT_REQUIRED_HINT, QUERY_REQUIRED_HINT };
