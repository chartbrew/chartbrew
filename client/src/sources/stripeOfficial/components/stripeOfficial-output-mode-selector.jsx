import React from "react";
import { Button, Card } from "@heroui/react";
import { LuChartLine, LuTable2 } from "react-icons/lu";

import { useStripeOfficialBuilder } from "./stripeOfficial-builder-context";

function StripeOfficialOutputModeSelector() {
  const { configuration, updateConfiguration } = useStripeOfficialBuilder();

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">
            What do you want to build?
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Button
              variant={configuration.mode === "aggregate" || configuration.mode === "compiled_metric" ? "secondary" : "outline"}
              className={`h-auto justify-start rounded-2xl border p-4 ${
                configuration.mode === "aggregate" || configuration.mode === "compiled_metric"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-divider bg-surface text-foreground"
              }`}
              onPress={() => updateConfiguration({ mode: "aggregate" })}
              fullWidth
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">
                <LuChartLine size={20} />
              </span>
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="text-base font-semibold">Chart metric</span>
                <span className="text-sm font-normal text-muted">Aggregated, grouped data</span>
              </span>
            </Button>

            <Button
              variant={configuration.mode === "raw" ? "secondary" : "outline"}
              className={`h-auto justify-start rounded-2xl border p-4 ${
                configuration.mode === "raw"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-divider bg-surface text-foreground"
              }`}
              onPress={() => updateConfiguration({ mode: "raw" })}
              fullWidth
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <LuTable2 size={20} />
              </span>
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="text-base font-semibold">Table of records</span>
                <span className="text-sm font-normal text-muted">Individual rows, latest first</span>
              </span>
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

export default StripeOfficialOutputModeSelector;
