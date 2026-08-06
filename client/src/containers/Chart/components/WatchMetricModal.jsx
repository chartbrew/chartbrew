import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Label, ListBox, Modal, Select,
} from "@heroui/react";

import {
  createObservationValueFormat,
  formatMetricValue,
  getObservationValueFormat,
} from "../../../modules/observationFormat";

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
  chartName,
  description,
  heading,
  initialImportance,
  initialLayerId,
  isOpen,
  isPending,
  lockMetric,
  onClose,
  onSubmit,
  options,
  submitLabel,
}) {
  const [currency, setCurrency] = useState("USD");
  const [decimals, setDecimals] = useState("auto");
  const [desiredDirection, setDesiredDirection] = useState("neutral");
  const [formatSource, setFormatSource] = useState("chart");
  const [importance, setImportance] = useState("1");
  const [layerId, setLayerId] = useState(null);
  const [notation, setNotation] = useState("standard");
  const [percentageScale, setPercentageScale] = useState("1");
  const [valueMeaning, setValueMeaning] = useState("number");

  useEffect(() => {
    if (!isOpen) return;
    setCurrency("USD");
    setDecimals("auto");
    setDesiredDirection("neutral");
    setFormatSource("chart");
    setImportance(`${initialImportance || 1}`);
    setLayerId(initialLayerId || options[0]?.id || null);
    setNotation("standard");
    setPercentageScale("1");
    setValueMeaning("number");
  }, [initialImportance, initialLayerId, isOpen, options]);

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
  const previewValues = previewFormat.meaning === "percentage"
    ? (previewFormat.display.scale === 100 ? [0.124, 0.102] : [12.4, 10.2])
    : [12500, 10000];
  const previewDifference = previewFormat.meaning === "percentage"
    ? `down ${Math.abs((previewValues[1] - previewValues[0]) * previewFormat.display.scale).toFixed(1)} percentage points`
    : "down 20.0%";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[520px]">
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
                <div className="flex flex-col gap-2">
                  <Select
                    fullWidth
                    onChange={setDesiredDirection}
                    value={desiredDirection}
                  >
                    <Label>What is a healthy result?</Label>
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
                  <p className="text-xs text-foreground-500">
                    This helps Chartbrew prioritize changes that need attention.
                  </p>
                </div>

                {lockMetric ? (
                  <div className="flex flex-col gap-1">
                    <Label>Metric to watch</Label>
                    <p className="font-medium text-foreground">
                      {selectedOption?.name || chartName}
                    </p>
                    <p className="text-xs text-foreground-500">
                      {selectedOption?.kind === "timeseries"
                        ? "Compared by time period"
                        : "Compared after each refresh"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Select
                      fullWidth
                      onChange={(value) => {
                        setLayerId(value);
                        setFormatSource("chart");
                      }}
                      placeholder="Choose a metric"
                      value={layerId}
                    >
                      <Label>Metric to watch</Label>
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
                              <div>
                                <p>{option.name || chartName}</p>
                                <p className="text-xs text-foreground-400">
                                  {option.kind === "timeseries" ? "Compared by time period" : "Compared after each refresh"}
                                </p>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <p className="text-xs text-foreground-500">
                      Choose the value that should be tracked over time.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
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
                  <p className="text-xs text-foreground-500">
                    More important metrics are prioritized when several changes happen together.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Select
                    fullWidth
                    onChange={setFormatSource}
                    placeholder="Choose how values appear"
                    value={formatSource}
                  >
                    <Label>Value formatting</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="chart" textValue="Use chart formatting">
                          Use chart formatting
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="override" textValue="Customize formatting">
                          Customize formatting
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <p className="text-xs text-foreground-500">
                    Custom formatting only affects detected changes, not the chart.
                  </p>
                </div>

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
                  <div className="flex flex-col gap-2">
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
                    <p className="text-xs text-foreground-500">
                      Pick the example that matches the values returned by the dataset.
                    </p>
                  </div>
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
                            <ListBox.Item id="standard" textValue="Show full value">
                              Show full value<ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="compact" textValue="Abbreviate">
                              Abbreviate<ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-col gap-4 bg-background/50 p-4 rounded-lg">

                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
                      Example
                    </p>
                    <p className="font-medium">
                      {formatMetricValue(previewValues[0], "number", previewFormat)}
                      {" → "}
                      {formatMetricValue(previewValues[1], "number", previewFormat)}
                    </p>
                    <p className="text-sm text-foreground-500">{previewDifference}</p>
                  </div>

                  <p className="text-sm text-foreground-500">
                    Chartbrew will evaluate the chart's existing data now. If it needs more history,
                    you can follow its progress and refresh it from Activity.
                  </p>
                </div>
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
              isDisabled={!layerId}
              isPending={isPending}
              onPress={() => onSubmit({
                desiredDirection,
                importance: Number(importance),
                layerId,
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
  isOpen: PropTypes.bool.isRequired,
  isPending: PropTypes.bool.isRequired,
  lockMetric: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    kind: PropTypes.string.isRequired,
    name: PropTypes.string,
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

WatchMetricModal.defaultProps = {
  chartName: "Metric",
  description: (
    <>
      Chartbrew will compare this value after successful chart refreshes and surface material
      changes on <span className="font-bold">Home</span> and <span className="font-medium">Activity</span>.
    </>
  ),
  heading: "Watch this metric",
  initialImportance: 1,
  initialLayerId: null,
  lockMetric: false,
  submitLabel: "Start watching",
};

export default WatchMetricModal;
