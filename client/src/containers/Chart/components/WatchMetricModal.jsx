import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion, Button, Chip, Input, Label, ListBox, Modal, Select,
} from "@heroui/react";
import { LuArrowLeftRight, LuSlidersHorizontal } from "react-icons/lu";

import {
  createObservationValueFormat,
  getObservationValueFormat,
} from "../../../modules/observationFormat";
import PeriodComparisonFields, {
  getBehaviorCopy,
  getDefaultPeriodSettings,
  getPeriodComparisonPayload,
  getPeriodCopy,
  getThresholdCopy,
  getThresholdEffectCopy,
  isPeriodSettingsValid,
  PeriodCalendarFields,
} from "./PeriodComparisonFields";

const FALLBACK_CURRENCIES = [
  "AUD", "CAD", "CHF", "CNY", "EUR", "GBP", "INR", "JPY", "NZD", "SEK", "SGD", "THB", "USD",
];

function getCurrencies() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("currency");
  }
  return FALLBACK_CURRENCIES;
}

const CURRENCIES = getCurrencies();

function getCurrencyName(currency) {
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: "currency" });
    return `${currency} — ${displayNames.of(currency)}`;
  } catch (error) {
    return currency;
  }
}

function WatchMetricModal({
  chartName = "Metric",
  description = "Choose what Chartbrew compares and when a change matters.",
  heading = "Watch this metric",
  initialImportance = 1,
  initialLayerId = null,
  initialName = null,
  initialSettings = null,
  isOpen,
  isPending,
  lockMetric = false,
  onClose,
  onSubmit,
  options,
  submitLabel = "Start watching",
}) {
  const [currency, setCurrency] = useState("USD");
  const [decimals, setDecimals] = useState("auto");
  const [desiredDirection, setDesiredDirection] = useState("neutral");
  const [formatSource, setFormatSource] = useState("chart");
  const [importance, setImportance] = useState("1");
  const [layerId, setLayerId] = useState(null);
  const [name, setName] = useState("");
  const [notation, setNotation] = useState("standard");
  const [periodSettings, setPeriodSettings] = useState(() => getDefaultPeriodSettings());
  const [percentageScale, setPercentageScale] = useState("1");
  const [valueMeaning, setValueMeaning] = useState("number");

  useEffect(() => {
    if (!isOpen) return;
    const selected = options.find((option) => {
      return `${option.id}` === `${initialLayerId || options[0]?.id}`;
    }) || options[0];
    const settings = initialSettings || selected || {};
    const valueFormat = getObservationValueFormat("number", settings.valueFormat);
    setCurrency(valueFormat.display.currency || "USD");
    setDecimals(Number.isInteger(valueFormat.display.decimals)
      ? `${valueFormat.display.decimals}`
      : "auto");
    setDesiredDirection(settings.desiredDirection || "neutral");
    setFormatSource(valueFormat.mode === "chart" ? "chart" : "override");
    setImportance(`${settings.importance || initialImportance}`);
    setLayerId(initialLayerId || selected?.id || null);
    setName(initialName || "");
    setNotation(valueFormat.display.notation || "standard");
    setPeriodSettings(getDefaultPeriodSettings(settings));
    setPercentageScale(`${valueFormat.display.scale || 1}`);
    setValueMeaning(valueFormat.meaning);
  }, [initialImportance, initialLayerId, initialName, initialSettings, isOpen, options]);

  const selectedOption = useMemo(() => {
    return options.find((option) => `${option.id}` === `${layerId}`) || options[0];
  }, [layerId, options]);
  const selectedValueFormat = createObservationValueFormat({
    currency,
    decimals,
    meaning: valueMeaning,
    mode: formatSource,
    notation,
    percentageScale,
  });
  const previewFormat = formatSource === "chart"
    ? getObservationValueFormat("number", selectedOption?.valueFormat)
    : getObservationValueFormat("number", selectedValueFormat);
  const periodCopy = getPeriodCopy(periodSettings.comparisonPeriod);
  const behaviorCopy = getBehaviorCopy(
    periodSettings.metricBehavior,
    periodSettings.comparisonPeriod
  );
  const thresholdCopy = getThresholdCopy(
    periodSettings.thresholdType,
    periodSettings.thresholdValue
  );
  const thresholdEffectCopy = getThresholdEffectCopy(
    periodSettings.thresholdType,
    periodSettings.thresholdValue
  );
  const metricName = selectedOption?.name || name.trim() || chartName;
  const directionCopy = {
    higher: "Higher results are good.",
    lower: "Lower results are good.",
    neutral: "Changes in either direction can matter.",
  }[desiredDirection];

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[560px]">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-1 pr-12">
            <Modal.Heading>{heading}</Modal.Heading>
            <p className="text-sm font-normal text-foreground-500">
              {description}
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5">
            {options.length > 0 ? (
              <>
                {lockMetric ? (
                  <div className="flex flex-col gap-1">
                    <Label>{selectedOption?.kind === "timeseries" ? "Series" : "Chart value"}</Label>
                    <Chip variant="soft" color="accent">
                      {selectedOption?.name || chartName}
                    </Chip>
                  </div>
                ) : (
                  <Select
                    fullWidth
                    onChange={(value) => {
                      setLayerId(value);
                      setFormatSource("chart");
                      setPeriodSettings(getDefaultPeriodSettings(
                        options.find((option) => `${option.id}` === `${value}`)
                      ));
                    }}
                    placeholder="Choose a chart value"
                    value={layerId}
                  >
                    <Label>Which chart value should Chartbrew watch?</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {options.map((option) => (
                          <ListBox.Item
                            id={option.id}
                            key={option.id}
                            textValue={option.name || chartName}
                          >
                            {option.name || chartName}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}

                <Select
                  fullWidth
                  onChange={setDesiredDirection}
                  value={desiredDirection}
                >
                  <Label>Which result is better?</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="higher" textValue="Higher is better">
                        Higher is better
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="lower" textValue="Lower is better">
                        Lower is better
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="neutral" textValue="Either direction can matter">
                        Either direction can matter
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <PeriodComparisonFields
                  aggregate={selectedOption?.aggregate}
                  kind={selectedOption?.kind}
                  onChange={setPeriodSettings}
                  periodAvailability={selectedOption?.periodAvailability}
                  recommendedMetricBehavior={selectedOption?.recommendedMetricBehavior}
                  refreshSchedule={selectedOption?.refreshSchedule}
                  timeUnit={selectedOption?.timeUnit}
                  value={periodSettings}
                  valueMeaning={previewFormat.meaning}
                />

                <div className="flex items-start gap-3 rounded-xl bg-surface-secondary p-4">
                  <LuArrowLeftRight
                    aria-hidden
                    className="mt-0.5 shrink-0 text-primary"
                    size={19}
                  />
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-foreground">{periodCopy.label}</p>
                    <p className="text-sm text-foreground-500">
                      {periodCopy.example} Chartbrew uses {behaviorCopy.summary}.
                    </p>
                    <p className="text-sm text-foreground-500">
                      A change appears when <span className="font-medium text-foreground">{metricName}</span>
                      {" moves by "}{thresholdCopy.summary}. {thresholdEffectCopy} {directionCopy}
                    </p>
                  </div>
                </div>

                <Accordion className="bg-surface-secondary" variant="surface">
                  <Accordion.Item id="watch-metric-more-options" textValue="More options">
                    <Accordion.Heading>
                      <Accordion.Trigger className="items-start gap-3">
                        <LuSlidersHorizontal
                          aria-hidden
                          className="mt-0.5 shrink-0 text-foreground-400"
                          size={18}
                        />
                        <div className="flex flex-1 flex-col items-start gap-0.5 text-start">
                          <span className="font-medium">More options</span>
                          <span className="text-sm text-foreground-500">
                            {periodSettings.comparisonPeriod === "week" ? "Week start, " : ""}
                            Timezone, priority, and number format
                          </span>
                        </div>
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-5 pt-1 pb-4">
                        {initialName !== null ? (
                          <Input
                            label="Name shown in Activity"
                            onChange={(event) => setName(event.target.value)}
                            value={name}
                          />
                        ) : null}

                        <PeriodCalendarFields
                          onChange={setPeriodSettings}
                          value={periodSettings}
                        />

                        <Select fullWidth onChange={setImportance} value={importance}>
                          <Label>How important is this metric?</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="1" textValue="Standard">
                                Standard<ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="2" textValue="Important">
                                Important<ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="3" textValue="Critical">
                                Critical<ListBox.ItemIndicator />
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        <Select
                          fullWidth
                          onChange={setFormatSource}
                          placeholder="Choose how values appear"
                          value={formatSource}
                        >
                          <Label>Number format</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="chart" textValue="Use the chart format">
                                Use the chart format
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="override" textValue="Use a different format">
                                Use a different format
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        {formatSource === "override" ? (
                          <Select fullWidth onChange={setValueMeaning} value={valueMeaning}>
                            <Label>Value type</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="number" textValue="Number">
                                  Number<ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="currency" textValue="Currency">
                                  Currency<ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="percentage" textValue="Percentage">
                                  Percentage<ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        ) : null}

                        {formatSource === "override" && valueMeaning === "currency" ? (
                          <Select
                            fullWidth
                            onChange={setCurrency}
                            placeholder="Choose a currency"
                            value={currency}
                          >
                            <Label>Currency</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover className="max-h-72">
                              <ListBox>
                                {CURRENCIES.map((currencyOption) => (
                                  <ListBox.Item
                                    id={currencyOption}
                                    key={currencyOption}
                                    textValue={getCurrencyName(currencyOption)}
                                  >
                                    {getCurrencyName(currencyOption)}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        ) : null}

                        {formatSource === "override" && valueMeaning === "percentage" ? (
                          <Select
                            fullWidth
                            onChange={setPercentageScale}
                            value={percentageScale}
                          >
                            <Label>How is the percentage stored?</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="1" textValue="12.4 means 12.4%">
                                  12.4 means 12.4%
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="100" textValue="0.124 means 12.4%">
                                  0.124 means 12.4%
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        ) : null}

                        {formatSource === "override" ? (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select fullWidth onChange={setDecimals} value={decimals}>
                              <Label>Decimal places</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  <ListBox.Item id="auto" textValue="Automatic">
                                    Automatic<ListBox.ItemIndicator />
                                  </ListBox.Item>
                                  {[0, 1, 2, 3].map((value) => (
                                    <ListBox.Item id={`${value}`} key={value} textValue={`${value}`}>
                                      {value}<ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                            {valueMeaning === "percentage" ? null : (
                              <Select fullWidth onChange={setNotation} value={notation}>
                                <Label>Large numbers</Label>
                                <Select.Trigger>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    <ListBox.Item id="standard" textValue="Show the full value">
                                      Show the full value<ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    <ListBox.Item id="compact" textValue="Use a short value">
                                      Use a short value<ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            )}
                          </div>
                        ) : null}
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-medium">This chart does not have a metric Chartbrew can watch yet.</p>
                <p className="text-sm text-foreground-500">
                  Use an ungrouped time series or a single numeric value, then try again.
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={!layerId || (initialName !== null && !name.trim())
                || !isPeriodSettingsValid(periodSettings, {
                aggregate: selectedOption?.aggregate,
                kind: selectedOption?.kind,
                periodAvailability: selectedOption?.periodAvailability,
                timeUnit: selectedOption?.timeUnit,
                valueMeaning: previewFormat.meaning,
              })}
              isPending={isPending}
              onPress={() => onSubmit({
                desiredDirection,
                importance: Number(importance),
                layerId,
                ...(initialName !== null ? { name: name.trim() } : {}),
                ...getPeriodComparisonPayload(periodSettings),
                valueFormat: selectedValueFormat,
              })}
              variant="primary"
            >
              {submitLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

WatchMetricModal.propTypes = {
  chartName: PropTypes.string,
  description: PropTypes.node,
  heading: PropTypes.string,
  initialImportance: PropTypes.number,
  initialLayerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialName: PropTypes.string,
  initialSettings: PropTypes.shape({
    comparison: PropTypes.object,
    desiredDirection: PropTypes.string,
    importance: PropTypes.number,
    metricBehavior: PropTypes.string,
    threshold: PropTypes.object,
    valueFormat: PropTypes.object,
  }),
  isOpen: PropTypes.bool.isRequired,
  isPending: PropTypes.bool.isRequired,
  lockMetric: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    aggregate: PropTypes.string,
    calendarTimezone: PropTypes.string,
    kind: PropTypes.string.isRequired,
    name: PropTypes.string,
    periodAvailability: PropTypes.object,
    recommendedMetricBehavior: PropTypes.string,
    refreshSchedule: PropTypes.shape({
      automatic: PropTypes.bool,
      intervalSeconds: PropTypes.number,
    }),
    timeUnit: PropTypes.string,
    valueFormat: PropTypes.shape({
      display: PropTypes.shape({
        currency: PropTypes.string,
        decimals: PropTypes.number,
        notation: PropTypes.string,
        scale: PropTypes.number,
      }),
      meaning: PropTypes.string,
      mode: PropTypes.string,
    }),
  })).isRequired,
  submitLabel: PropTypes.string,
};

export default WatchMetricModal;
