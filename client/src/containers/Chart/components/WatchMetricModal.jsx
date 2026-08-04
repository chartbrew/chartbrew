import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Label, ListBox, Modal, Select,
} from "@heroui/react";

import {
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

function getFormatSelection(mode, currency, percentageScale) {
  if (mode === "chart") return { mode: "chart" };
  if (mode === "currency") {
    return { currency, mode: "override", type: "currency" };
  }
  if (mode === "percentage") {
    return { mode: "override", scale: Number(percentageScale), type: "percentage" };
  }
  return { mode: "override", type: "number" };
}

function WatchMetricModal({
  chartName,
  isOpen,
  isPending,
  onClose,
  onSubmit,
  options,
}) {
  const [currency, setCurrency] = useState("USD");
  const [desiredDirection, setDesiredDirection] = useState("neutral");
  const [formatMode, setFormatMode] = useState("chart");
  const [layerId, setLayerId] = useState(null);
  const [percentageScale, setPercentageScale] = useState("1");

  useEffect(() => {
    if (!isOpen) return;
    setCurrency("USD");
    setDesiredDirection("neutral");
    setFormatMode("chart");
    setLayerId(options[0]?.id || null);
    setPercentageScale("1");
  }, [isOpen, options]);

  const selectedOption = useMemo(() => {
    return options.find((option) => `${option.id}` === `${layerId}`) || options[0];
  }, [layerId, options]);
  const selectedValueFormat = getFormatSelection(formatMode, currency, percentageScale);
  const previewFormat = formatMode === "chart"
    ? getObservationValueFormat("number", selectedOption?.valueFormat)
    : getObservationValueFormat("number", selectedValueFormat);
  const previewValues = previewFormat.type === "percentage"
    ? (previewFormat.scale === 100 ? [0.124, 0.102] : [12.4, 10.2])
    : [12500, 10000];
  const previewDifference = previewFormat.type === "percentage"
    ? `down ${Math.abs((previewValues[1] - previewValues[0]) * previewFormat.scale).toFixed(1)} percentage points`
    : "down 20.0%";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-1 pr-12">
            <Modal.Heading>Watch this metric</Modal.Heading>
            <p className="text-sm font-normal text-foreground-500">
              Chartbrew will compare this value after successful chart refreshes and surface
              material changes on <span className="font-bold">Home</span> and <span className="font-medium">Activity</span>.
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

                <div className="flex flex-col gap-2">
                  <Select
                    fullWidth
                    onChange={(value) => {
                      setLayerId(value);
                      setFormatMode("chart");
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

                <div className="flex flex-col gap-2">
                  <Select
                    fullWidth
                    onChange={setFormatMode}
                    placeholder="Choose how values appear"
                    value={formatMode}
                  >
                    <Label>Display values as</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="chart" textValue="Same as chart">
                          Same as chart
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="number" textValue="Number">
                          Number
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="currency" textValue="Currency">
                          Currency
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="percentage" textValue="Percentage">
                          Percentage
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <p className="text-xs text-foreground-500">
                    This only changes how values appear in detected changes. It does not change the chart.
                  </p>
                </div>

                {formatMode === "currency" ? (
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

                {formatMode === "percentage" ? (
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
                    After setup, Chartbrew will start building a baseline on the next successful
                    refresh. It will let you know when there is enough history to evaluate changes.
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
                layerId,
                valueFormat: selectedValueFormat,
              })}
              variant="primary"
            >
              Start watching
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

WatchMetricModal.propTypes = {
  chartName: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  isPending: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    kind: PropTypes.string.isRequired,
    name: PropTypes.string,
    valueFormat: PropTypes.shape({
      currency: PropTypes.string,
      mode: PropTypes.string,
      prefix: PropTypes.string,
      scale: PropTypes.number,
      suffix: PropTypes.string,
      type: PropTypes.string,
    }),
  })).isRequired,
};

WatchMetricModal.defaultProps = {
  chartName: "Metric",
};

export default WatchMetricModal;
