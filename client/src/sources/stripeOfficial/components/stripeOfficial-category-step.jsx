import React from "react";
import { Button, Card, Separator } from "@heroui/react";

import {
  CATEGORY_OPTIONS,
  QUICK_STARTS,
  RESOURCE_LABELS,
  RESOURCE_METRICS,
} from "../stripeOfficial-builder.constants";
import {
  sanitizeExpandForResource,
  sanitizeFiltersForResource,
} from "../stripeOfficial-builder.utils";
import { useStripeOfficialBuilder } from "./stripeOfficial-builder-context";

function StripeOfficialCategoryStep() {
  const {
    configuration,
    selectedCategory,
    selectCategory,
    selectQuickStart,
    updateConfiguration,
  } = useStripeOfficialBuilder();
  const currentQuickStarts = QUICK_STARTS[selectedCategory.id] || [];

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-accent">Step 1</span>
          <span className="font-semibold text-foreground">Choose a category</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
          {CATEGORY_OPTIONS.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory.id === category.id;
            return (
              <Button
                key={category.id}
                variant={isSelected ? "secondary" : "outline"}
                className={`h-24 min-w-0 flex-col justify-center gap-2 rounded-2xl border px-3 ${
                  isSelected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-divider bg-surface text-foreground"
                }`}
                onPress={() => selectCategory(category)}
                fullWidth
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.iconClassName}`}>
                  <Icon size={20} />
                </span>
                <span className="w-full truncate text-sm font-semibold">{category.label}</span>
              </Button>
            );
          })}
        </div>

        <Separator variant="tertiary" />

        <div className="flex flex-col gap-3">
          <div className="flex flex-row flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Quick start:</span>
            {currentQuickStarts.map((quickStart) => (
              <Button
                key={quickStart.label}
                size="sm"
                className="rounded-full"
                variant="secondary"
                onPress={() => selectQuickStart(quickStart)}
              >
                {quickStart.label}
              </Button>
            ))}
          </div>

          {selectedCategory.id === "payments" && (
            <div className="flex flex-row flex-wrap items-center gap-2">
              <span className="text-sm text-muted">API source:</span>
              {["payment_intents", "charges"].map((resource) => (
                <Button
                  key={resource}
                  size="sm"
                  className="rounded-full"
                  variant={configuration.resource === resource ? "primary" : "secondary"}
                  onPress={() => {
                    const nextMetric = (RESOURCE_METRICS[resource] || [])[0] || { operation: "count" };
                    updateConfiguration({
                      mode: configuration.mode === "raw" ? "raw" : "aggregate",
                      resource,
                      compiledMetric: null,
                      metric: nextMetric,
                      filters: sanitizeFiltersForResource(configuration.filters || [], resource),
                      expand: sanitizeExpandForResource(configuration.expand || [], resource),
                      queryMode: configuration.queryMode,
                      searchQuery: configuration.searchQuery,
                    });
                  }}
                >
                  {RESOURCE_LABELS[resource]}
                </Button>
              ))}
              <span className="text-xs text-muted">Payment Intents are recommended for modern accounts</span>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export default StripeOfficialCategoryStep;
