import React from "react";
import PropTypes from "prop-types";
import {
  Label,
  ListBox,
  Select,
} from "@heroui/react";

import { getOptionValue } from "../stripeOfficial-builder.utils";

function StripeOfficialBuilderSelectField({
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
      value={value || null}
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

StripeOfficialBuilderSelectField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired,
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
  isDisabled: PropTypes.bool,
};

StripeOfficialBuilderSelectField.defaultProps = {
  value: "",
  className: "",
  isDisabled: false,
};

export default StripeOfficialBuilderSelectField;
