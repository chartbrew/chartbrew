import React, { useEffect, useState } from "react";
import { Chip, Tabs } from "@heroui/react";
import { useSearchParams } from "react-router";
import { useSelector } from "react-redux";

import { getActivityCounts } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import AlertsPage from "./AlertsPage";
import ChangesPage from "./ChangesPage";
import DataHealthPage from "./DataHealthPage";
import KpiReviewsPage from "./KpiReviewsPage";
import WatchedMetricsPage from "./WatchedMetricsPage";

function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const team = useSelector(selectTeam);
  const [counts, setCounts] = useState({ changes: 0, dataHealth: 0 });
  const selectedTab = searchParams.get("tab") || "changes";

  useEffect(() => {
    let active = true;
    const loadCounts = () => {
      if (!team?.id) return;
      getActivityCounts(team.id)
        .then((nextCounts) => {
          if (active) setCounts(nextCounts);
        })
        .catch(() => {
          if (active) setCounts({ changes: 0, dataHealth: 0 });
        });
    };
    loadCounts();
    window.addEventListener("cb:activity-updated", loadCounts);
    return () => {
      active = false;
      window.removeEventListener("cb:activity-updated", loadCounts);
    };
  }, [team?.id]);

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
            <Tabs.Tab id="changes" className="gap-1">
              Changes
              {counts.changes > 0 ? (
                <Chip color="accent" size="sm" variant="soft">
                  <Chip.Label>{counts.changes > 99 ? "99+" : counts.changes}</Chip.Label>
                </Chip>
              ) : null}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="alerts">
              Alerts
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="health" className="gap-1">
              Data health
              {counts.dataHealth > 0 ? (
                <Chip color="warning" size="sm" variant="soft">
                  <Chip.Label>
                    {counts.dataHealth > 99 ? "99+" : counts.dataHealth}
                  </Chip.Label>
                </Chip>
              ) : null}
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
