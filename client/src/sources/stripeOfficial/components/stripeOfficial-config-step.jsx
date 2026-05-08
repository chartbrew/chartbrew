import React from "react";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Disclosure,
  Input,
  Label,
  Separator,
  Switch,
  TextField,
} from "@heroui/react";
import { LuPlus, LuX } from "react-icons/lu";

import {
  COMPILED_METRIC_OPTIONS,
  DIMENSION_OPTIONS,
  FILTER_OPERATOR_OPTIONS,
  INTERVAL_OPTIONS,
  MAX_RECORD_OPTIONS,
} from "../stripeOfficial-builder.constants";
import {
  getExpandFields,
  getFilterDefinition,
  getFilterDefinitions,
  parseMetric,
  serializeMetric,
} from "../stripeOfficial-builder.utils";
import { useStripeOfficialBuilder } from "./stripeOfficial-builder-context";
import StripeOfficialBuilderSelectField from "./stripeOfficial-builder-select-field";
import StripeOfficialDateRangeFields from "./stripeOfficial-date-range-fields";

function StripeOfficialFilterValueField({ filter, index, definition }) {
  const {
    updateFilterAt,
    updateMetadataFilterKey,
  } = useStripeOfficialBuilder();
  const operatorNeedsValue = !["isNull", "isNotNull"].includes(filter.operator);
  const metadataKey = definition?.type === "metadata"
    ? String(filter.field || "").replace(/^metadata\./, "")
    : "";

  if (!operatorNeedsValue) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {definition?.type === "metadata" && (
          <TextField fullWidth name={`stripe-filter-metadata-key-${index}`}>
            <Label>Metadata key</Label>
            <Input
              placeholder="plan"
              value={metadataKey}
              onChange={(event) => updateMetadataFilterKey(index, event.target.value)}
              variant="secondary"
            />
          </TextField>
        )}
        <TextField fullWidth name={`stripe-filter-value-${index}`}>
          <Label>Value</Label>
          <Input value="" placeholder="No value needed" disabled variant="secondary" />
        </TextField>
      </div>
    );
  }

  if (definition?.type === "boolean") {
    return (
      <StripeOfficialBuilderSelectField
        name={`stripe-filter-value-${index}`}
        label="Value"
        value={String(filter.value === true || filter.value === "true")}
        onChange={(value) => updateFilterAt(index, { value: value === "true" })}
        options={[
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ]}
      />
    );
  }

  const valueField = (
    <TextField fullWidth name={`stripe-filter-value-${index}`}>
      <Label>Value</Label>
      <Input
        type={definition?.type === "number" ? "number" : "text"}
        placeholder={definition?.type === "number" ? "0" : "Enter value"}
        value={filter.value ?? ""}
        onChange={(event) => updateFilterAt(index, { value: event.target.value })}
        variant="secondary"
      />
    </TextField>
  );

  if (definition?.type !== "metadata") return valueField;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <TextField fullWidth name={`stripe-filter-metadata-key-${index}`}>
        <Label>Metadata key</Label>
        <Input
          placeholder="plan"
          value={metadataKey}
          onChange={(event) => updateMetadataFilterKey(index, event.target.value)}
          variant="secondary"
        />
      </TextField>
      {valueField}
    </div>
  );
}

function StripeOfficialFilters() {
  const {
    activeFilterCount,
    configuration,
    addFilter,
    removeFilterAt,
    updateConfiguration,
    updateFilterAt,
  } = useStripeOfficialBuilder();
  const filterDefinitions = configuration.mode === "compiled_metric"
    ? []
    : getFilterDefinitions(configuration.resource);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <span className="text-base font-semibold text-foreground">Filters</span>
        <span className="text-sm text-muted">
          {activeFilterCount > 0 ? `${activeFilterCount} active` : "None active"}
        </span>
      </div>

      {configuration.mode === "compiled_metric" && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-700 dark:text-warning-300">
          Compiled metric filters need metric-specific rules. Use currency above for this first pass.
        </p>
      )}

      {configuration.mode !== "compiled_metric" && (configuration.filters || []).length === 0 && (
        <div className="rounded-lg border border-dashed border-divider bg-surface-secondary/40 p-4 text-sm text-muted">
          No filters yet. Add a filter to narrow the Stripe rows before Chartbrew aggregates or renders them.
        </div>
      )}

      {configuration.mode !== "compiled_metric" && (configuration.filters || []).map((filter, index) => {
        const definition = getFilterDefinition(configuration.resource, filter.field) || filterDefinitions[0];
        const operatorOptions = (definition?.operators || ["is"]).map((operator) => FILTER_OPERATOR_OPTIONS[operator]);
        const filterSelectValue = definition?.type === "metadata" ? "metadata.*" : filter.field;

        return (
          <div key={`${filter.field}-${index}`} className="grid grid-cols-12 gap-3 rounded-lg border border-divider p-3">
            <div className="col-span-12 md:col-span-4">
              <StripeOfficialBuilderSelectField
                name={`stripe-filter-field-${index}`}
                label="Field"
                value={filterSelectValue}
                onChange={(value) => updateFilterAt(index, { field: value })}
                options={filterDefinitions.map((filterDefinition) => ({
                  value: filterDefinition.field,
                  label: filterDefinition.label,
                }))}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <StripeOfficialBuilderSelectField
                name={`stripe-filter-operator-${index}`}
                label="Operator"
                value={filter.operator || "is"}
                onChange={(value) => updateFilterAt(index, { operator: value })}
                options={operatorOptions.filter(Boolean)}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <StripeOfficialFilterValueField filter={filter} index={index} definition={definition} />
            </div>
            <div className="col-span-12 flex items-end md:col-span-1">
              <Button
                isIconOnly
                aria-label="Remove filter"
                variant="tertiary"
                onPress={() => removeFilterAt(index)}
              >
                <LuX size={16} />
              </Button>
            </div>
          </div>
        );
      })}

      {configuration.mode !== "compiled_metric" && (
        <div className="flex flex-row flex-wrap gap-2">
          <Button
            className="w-fit"
            variant="tertiary"
            onPress={addFilter}
            isDisabled={filterDefinitions.length === 0}
          >
            <LuPlus size={16} />
            Add filter
          </Button>
          {(configuration.filters || []).length > 0 && (
            <Button
              className="w-fit"
              variant="tertiary"
              onPress={() => updateConfiguration({ filters: [] })}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StripeOfficialAdvancedOptions() {
  const {
    configuration,
    searchSupported,
    showAdvanced,
    setShowAdvanced,
    toggleExpandField,
    toggleSearchMode,
    updateConfiguration,
    updatePagination,
  } = useStripeOfficialBuilder();
  const expandFields = configuration.mode === "compiled_metric"
    ? []
    : getExpandFields(configuration.resource);

  return (
    <Disclosure isExpanded={showAdvanced} onExpandedChange={setShowAdvanced}>
      <Disclosure.Heading>
        <Button slot="trigger" variant="ghost">
          Advanced options
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-4 pt-3">
          <StripeOfficialBuilderSelectField
            name="stripe-max-records"
            label="Max records"
            value={String(configuration.pagination?.maxRecords || 5000)}
            onChange={(value) => updatePagination({ maxRecords: Number(value) })}
            options={MAX_RECORD_OPTIONS}
          />
          <p className="-mt-2 text-xs text-muted">
            Chartbrew paginates automatically until this limit is reached.
          </p>

          <div className="flex flex-col gap-3">
            {configuration.mode === "raw" && (
              <Switch
                isSelected={Boolean(configuration.rawObjectMode)}
                onChange={(isSelected) => updateConfiguration({ rawObjectMode: isSelected })}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label className="text-sm">Return full Stripe objects</Label>
                </Switch.Content>
              </Switch>
            )}

            <Switch
              isDisabled={!searchSupported}
              isSelected={configuration.queryMode === "search"}
              onChange={toggleSearchMode}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <Label className="text-sm">Use Stripe Search API</Label>
                  {!searchSupported && <Chip size="sm" variant="soft">not supported</Chip>}
                </div>
              </Switch.Content>
            </Switch>

            {configuration.queryMode === "search" && (
              <TextField fullWidth name="stripe-search-query">
                <Label>Search query</Label>
                <Input
                  placeholder={"metadata['plan']:'pro' OR email:'customer@example.com'"}
                  value={configuration.searchQuery || ""}
                  onChange={(event) => updateConfiguration({ searchQuery: event.target.value })}
                  variant="secondary"
                />
              </TextField>
            )}

            {expandFields.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Expand fields</span>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {expandFields.map((field) => (
                    <Checkbox
                      key={field.value}
                      name={`stripe-expand-${field.value}`}
                      isSelected={(configuration.expand || []).includes(field.value)}
                      onChange={(isSelected) => toggleExpandField(field.value, isSelected)}
                      variant="secondary"
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>{field.label}</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

function StripeOfficialConfigStep() {
  const {
    configuration,
    metricOptions,
    selectedDimension,
    selectedInterval,
    selectedMetric,
    selectCompiledMetric,
    updateConfiguration,
    updateDateRange,
  } = useStripeOfficialBuilder();

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-accent">Step 2</span>
          <span className="text-base font-semibold text-foreground">Configure your dataset</span>
        </div>

        {configuration.mode === "aggregate" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <StripeOfficialBuilderSelectField
                name="stripe-metric"
                label="Metric"
                value={selectedMetric}
                onChange={(value) => updateConfiguration({ metric: parseMetric(value) })}
                options={metricOptions.map((metric) => ({
                  value: serializeMetric(metric),
                  label: metric.label,
                }))}
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StripeOfficialBuilderSelectField
                name="stripe-dimension"
                label="Group by"
                value={selectedDimension}
                onChange={(value) => {
                  const dimension = DIMENSION_OPTIONS.find((option) => option.field === value);
                  updateConfiguration({
                    dimension: {
                      ...configuration.dimension,
                      field: value,
                      type: dimension?.type,
                    },
                  });
                }}
                options={DIMENSION_OPTIONS}
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StripeOfficialBuilderSelectField
                name="stripe-interval"
                label="Interval"
                value={selectedInterval}
                isDisabled={configuration.dimension?.type !== "date"}
                onChange={(value) => updateConfiguration({
                  dimension: {
                    ...configuration.dimension,
                    interval: value,
                  },
                })}
                options={INTERVAL_OPTIONS}
              />
            </div>
          </div>
        )}

        {configuration.mode === "compiled_metric" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <StripeOfficialBuilderSelectField
                name="stripe-compiled-metric"
                label="Metric"
                value={configuration.compiledMetric || "mrr"}
                onChange={selectCompiledMetric}
                options={COMPILED_METRIC_OPTIONS}
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StripeOfficialBuilderSelectField
                name="stripe-compiled-interval"
                label="Interval"
                value={selectedInterval}
                onChange={(value) => updateConfiguration({
                  dimension: {
                    ...configuration.dimension,
                    interval: value,
                  },
                })}
                options={INTERVAL_OPTIONS}
              />
            </div>
            <TextField className="col-span-12 md:col-span-6 lg:col-span-3" fullWidth name="stripe-compiled-currency">
              <Label>Currency</Label>
              <Input
                placeholder="auto"
                value={configuration.currency || "auto"}
                onChange={(event) => updateConfiguration({ currency: event.target.value.toLowerCase() || "auto" })}
                variant="secondary"
              />
            </TextField>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <StripeOfficialBuilderSelectField
              name="stripe-date-field"
              label="Date field"
              value={configuration.dateRange?.field || "created"}
              onChange={(value) => updateDateRange({ field: value })}
              options={[
                { value: "created", label: "Created date" },
                { value: "updated", label: "Updated date" },
              ]}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <StripeOfficialDateRangeFields />
          </div>
        </div>

        <StripeOfficialFilters />

        <Separator variant="tertiary" />

        <StripeOfficialAdvancedOptions />
      </Card.Content>
    </Card>
  );
}

export default StripeOfficialConfigStep;
