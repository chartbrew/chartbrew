import React from "react";
import { Tabs } from "@heroui/react";
import { useSearchParams } from "react-router";

import AlertsPage from "./AlertsPage";
import ChangesPage from "./ChangesPage";
import DataHealthPage from "./DataHealthPage";
import KpiReviewsPage from "./KpiReviewsPage";
import WatchedMetricsPage from "./WatchedMetricsPage";

function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = searchParams.get("tab") || "changes";

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-tw text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-foreground-500">
          Review detected changes, refresh issues, and watched metrics.
        </p>
      </header>

      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSearchParams({ tab: key })}
      >
        <Tabs.ListContainer className="w-fit max-w-full">
          <Tabs.List
            aria-label="Activity sections"
            className="w-fit *:w-fit *:shrink-0 *:whitespace-nowrap"
          >
            <Tabs.Tab id="changes">
              Changes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="alerts">
              Alerts
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="health">
              Data health
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="monitors">
              Watched metrics
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="summaries">
              KPI reviews
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="changes" className="p-0 pt-1">
          <ChangesPage />
        </Tabs.Panel>
        <Tabs.Panel id="alerts" className="p-0 pt-1">
          <AlertsPage />
        </Tabs.Panel>
        <Tabs.Panel id="health" className="p-0 pt-1">
          <DataHealthPage />
        </Tabs.Panel>
        <Tabs.Panel id="monitors" className="p-0 pt-1">
          <WatchedMetricsPage />
        </Tabs.Panel>
        <Tabs.Panel id="summaries" className="p-0 pt-1">
          <KpiReviewsPage />
        </Tabs.Panel>
      </Tabs>
    </main>
  );
}

export default Activity;
