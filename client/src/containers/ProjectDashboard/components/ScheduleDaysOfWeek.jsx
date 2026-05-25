import React from "react";
import PropTypes from "prop-types";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";

export const daysOfWeek = [
  { label: "Monday", shortLabel: "Mon", value: "monday" },
  { label: "Tuesday", shortLabel: "Tue", value: "tuesday" },
  { label: "Wednesday", shortLabel: "Wed", value: "wednesday" },
  { label: "Thursday", shortLabel: "Thu", value: "thursday" },
  { label: "Friday", shortLabel: "Fri", value: "friday" },
  { label: "Saturday", shortLabel: "Sat", value: "saturday" },
  { label: "Sunday", shortLabel: "Sun", value: "sunday" },
];

export const allDayValues = daysOfWeek.map((day) => day.value);

export const getSelectedDailyDays = (selectedDays) => {
  if (!Array.isArray(selectedDays)) {
    return allDayValues;
  }

  return selectedDays;
};

export const hasValidDailyDays = (selectedDays) => {
  return getSelectedDailyDays(selectedDays).length > 0;
};

function ScheduleDaysOfWeek({ selectedDays, onChange }) {
  const selectedDailyDays = getSelectedDailyDays(selectedDays);

  return (
    <div className="flex flex-col gap-2">
      <ToggleButtonGroup
        className="flex-wrap"
        selectedKeys={new Set(selectedDailyDays)}
        selectionMode="multiple"
        size="sm"
        onSelectionChange={(selectedKeys) => onChange([...selectedKeys])}
      >
        {daysOfWeek.map((day) => (
          <ToggleButton
            key={day.value}
            aria-label={day.label}
            id={day.value}
          >
            {day.shortLabel}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

ScheduleDaysOfWeek.propTypes = {
  selectedDays: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
};

export default ScheduleDaysOfWeek;
