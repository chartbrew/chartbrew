import React from "react";
import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Label,
  Tooltip,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { LuVariable } from "react-icons/lu";

import { DATE_VARIABLES } from "../jira-builder.constants";
import { getPlaceholderVariableName } from "../jira-builder.utils";
import { useJiraBuilder } from "./jira-builder-context";

function JiraDatePickerField({ datePart, label }) {
  const {
    configuration,
    getDatePickerValue,
    openDateVariableSettings,
    updateVisual,
  } = useJiraBuilder();
  const variableName = getPlaceholderVariableName(configuration.visual?.[datePart])
    || DATE_VARIABLES[datePart];
  const isUsingVariable = Boolean(getPlaceholderVariableName(configuration.visual?.[datePart]));
  const dateValue = getDatePickerValue(datePart);

  return (
    <div className="flex items-end gap-2">
      <DatePicker
        name={`jira-${datePart}`}
        value={parseDate(dateValue)}
        onChange={(date) => {
          if (date) updateVisual({ [datePart]: date.toString() });
        }}
        className="min-w-0 flex-1"
      >
        <Label>{label}</Label>
        <DateField.Group fullWidth variant="secondary">
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label={`${label} date`}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
      <Tooltip>
        <Tooltip.Trigger>
          <Button
            isIconOnly
            aria-label={`Configure ${label.toLowerCase()} variable`}
            size="sm"
            variant={isUsingVariable ? "primary" : "secondary"}
            onPress={() => openDateVariableSettings(datePart)}
          >
            <LuVariable size={16} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {isUsingVariable ? `Using {{${variableName}}}` : "Click to set a variable"}
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

function JiraDateRangeFields() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <JiraDatePickerField datePart="startDate" label="Start date" />
      <JiraDatePickerField datePart="endDate" label="End date" />
    </div>
  );
}

export default JiraDateRangeFields;
