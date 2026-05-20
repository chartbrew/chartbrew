import React from "react";
import PropTypes from "prop-types";
import {
  Label,
  ListBox,
  Select,
} from "@heroui/react";

function getOptionValue(option) {
  if (option.value !== undefined) return String(option.value);
  return String(option.id);
}

function JiraBuilderSelectField({
  label,
  value,
  onChange,
  options,
  name,
  className,
  isDisabled,
}) {
  return (
    <Select
      fullWidth
      isDisabled={isDisabled}
      name={name}
      variant="secondary"
      value={value !== undefined && value !== null ? String(value) : null}
      onChange={(nextValue) => onChange(nextValue)}
      className={className}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => {
            const optionValue = getOptionValue(option);
            return (
              <ListBox.Item key={optionValue} id={optionValue} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

JiraBuilderSelectField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired,
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
  isDisabled: PropTypes.bool,
};

JiraBuilderSelectField.defaultProps = {
  value: "",
  className: "",
  isDisabled: false,
};

export default JiraBuilderSelectField;
