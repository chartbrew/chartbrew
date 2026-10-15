import React from "react";
import PropTypes from "prop-types";
import {
  Autocomplete, Button, Label, ListBox, SearchField, useFilter,
} from "@heroui/react";

import { LuClock4 } from "react-icons/lu";

import timezones from "../../../modules/timezones";

function OnboardingPreferences({ error, isPending, onBack, onChange, onContinue, settings }) {
  const { contains } = useFilter({ sensitivity: "base" });
  const options = [...new Set([...timezones, settings.timezone])];

  return (
    <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 4 of 5</div>
      <h1 className="mt-2 text-balance text-3xl font-bold">Customize your workspace</h1>
      <div className="mt-8 space-y-3">
        <Autocomplete
          fullWidth
          isDisabled={isPending}
          selectionMode="single"
          variant="secondary"
          value={settings.timezone}
          onChange={(timezone) => {
            if (timezone) onChange({ ...settings, timezone });
          }}
        >
          <Label>First dashboard timezone</Label>
          <Autocomplete.Trigger>
            <Autocomplete.Value />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover>
            <Autocomplete.Filter filter={contains}>
              <SearchField autoFocus name="timezone-search" variant="secondary">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search timezones..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListBox renderEmptyState={() => <p className="p-4 text-sm">No timezones found</p>}>
                {options.map((timezone) => (
                  <ListBox.Item key={timezone} id={timezone} textValue={timezone}>
                    {timezone}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
        <Button
          isDisabled={isPending}
          onPress={() => onChange({
            ...settings,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          })}
          variant="secondary"
        >
          <LuClock4 />
          Get current timezone
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="mt-8 flex items-center justify-between gap-2">
        <Button isDisabled={isPending} onPress={onBack} variant="outline">Back</Button>
        <Button isPending={isPending} onPress={onContinue} size="lg" variant="primary">Continue</Button>
      </div>
    </div>
  );
}

OnboardingPreferences.propTypes = {
  error: PropTypes.string,
  isPending: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  settings: PropTypes.shape({
    timezone: PropTypes.string.isRequired,
  }).isRequired,
};

export default OnboardingPreferences;
