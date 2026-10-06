import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, ListBox, ProgressCircle, Select, Table, Tabs } from "@heroui/react";
import { LuRefreshCw } from "react-icons/lu";

import { getPlatformAnalytics, getTeamAnalytics } from "../../api/platformSettings";
import EChartsRenderer from "../Chart/components/EChartsRenderer";
import EChartsErrorBoundary from "../Chart/components/EChartsErrorBoundary";
import KpiMode from "../Chart/components/KpiMode";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

function Analytics({ teamId }) {
  const [view, setView] = useState("requests");
  const [days, setDays] = useState("30");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    const request = teamId === undefined
      ? getPlatformAnalytics(days, controller.signal)
      : getTeamAnalytics(teamId, days, controller.signal);
    request
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.status === 403
            ? "You do not have access to these analytics. Contact your administrator."
            : "Could not load analytics. Try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, refresh, teamId]);

  const isAi = view === "ai";
  const analytics = isAi ? data?.ai : data;
  const period = data ? `${dateFormat.format(new Date(data.from))} - ${dateFormat.format(new Date(data.to))} · UTC` : "";
  const hasRecords = analytics && (isAi
    ? analytics.summary.calls + analytics.summary.pending > 0
    : analytics.summary.successful + analytics.summary.failed > 0);
  const columns = isAi ? [
    { key: "calls", label: "AI calls" },
    { key: "prompt_tokens", label: "Input tokens" },
    { key: "completion_tokens", label: "Output tokens" },
    { key: "total_tokens", label: "Total tokens" },
    { key: "unknown", label: "Missing counts" },
    { key: "pending", label: "No final result" },
  ] : [
    { key: "successful", label: "Successful" },
    { key: "failed", label: "Failed" },
    { key: "meanSeconds", label: "Mean time (s)" },
  ];
  const charts = isAi ? [
    { key: "tokens", title: "Tokens by day", label: "Input tokens by day on the left axis and output tokens on the right axis", unit: "Separate scales" },
    { key: "calls", title: "AI calls by day", label: "AI calls by day", unit: "Calls" },
  ] : [
    { key: "outcomes", title: "Requests by day", label: "Successful and failed requests by day", unit: "Requests" },
    { key: "duration", title: "Mean request time", label: "Mean request time by day, in seconds", unit: "Seconds" },
  ];

  return (
    <Tabs className="flex min-w-0 flex-col gap-6" selectedKey={view} onSelectionChange={setView}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Analytics category">
          <Tabs.Tab id="requests">
            Data requests
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="ai">
            AI usage
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">{period}</p>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            aria-label="Period"
            className="w-40"
            onChange={(value) => { if (value) setDays(String(value)); }}
            selectionMode="single"
            value={days}
            variant="secondary"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["7", "30", "90"].map((value) => (
                  <ListBox.Item id={value} key={value} textValue={`Last ${value} days`}>
                    {`Last ${value} days`}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Button aria-label="Refresh analytics" isDisabled={loading} isIconOnly variant="secondary" onPress={() => setRefresh((value) => value + 1)}>
            <LuRefreshCw aria-hidden size={16} />
          </Button>
        </div>
      </div>

      <Tabs.Panel id={view} key={view} className="flex min-w-0 flex-col gap-6">
        {loading && (
          <div className="flex min-h-64 items-center justify-center" role="status">
            <ProgressCircle aria-label="Loading analytics" isIndeterminate />
          </div>
        )}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-divider bg-surface p-6" role="alert">
            <p>{error}</p>
            <Button variant="secondary" onPress={() => setRefresh((value) => value + 1)}>Try again</Button>
          </div>
        )}
        {analytics && !loading && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {analytics.metrics.map((metric) => (
                <section key={metric.id} className="rounded-3xl border border-divider bg-surface px-3 py-5 tabular-nums" aria-label={metric.label}>
                  <div className="h-20">
                    <KpiMode chart={{ render: { configuration: { items: [metric] } } }} />
                  </div>
                </section>
              ))}
            </div>

            {!hasRecords ? (
              <div className="rounded-3xl border border-divider bg-surface p-8 text-center">
                <h2 className="text-lg font-semibold">{isAi ? "No AI usage in this period" : "No completed requests in this period"}</h2>
                <p className="mt-2 text-sm text-muted">
                  {isAi ? "Choose a longer period, or use Chartbrew AI and refresh this page." : "Choose a longer period, or run a data request and refresh this page."}
                </p>
              </div>
            ) : (
              <>
                {charts.map(({ key, title, label, unit }) => (
                  <section key={key} className="min-w-0 rounded-3xl border border-divider bg-surface p-4 sm:p-6" aria-label={label}>
                    <div className="mb-4 flex items-baseline justify-between gap-3">
                      <h2 className="text-lg font-semibold">{title}</h2>
                      <span className="text-sm text-muted">{unit}</span>
                    </div>
                    <div className="h-72 sm:h-80">
                      <EChartsErrorBoundary key={`${data.to}-${key}`} fallback={<p role="alert">Could not display this chart. Use the daily values below.</p>}>
                        <EChartsRenderer
                          ariaLabel={label}
                          option={{ ...analytics.charts[key].configuration, aria: { enabled: true, description: `${label}. Exact values are in the daily values table.` } }}
                        />
                      </EChartsErrorBoundary>
                    </div>
                  </section>
                ))}
                {isAi && teamId === undefined && (
                  <section className="min-w-0 rounded-3xl border border-divider bg-surface p-4 sm:p-6" aria-label="Usage by model">
                    <h2 className="mb-4 text-lg font-semibold">Usage by model</h2>
                    <Table className="tabular-nums" variant="secondary">
                      <Table.ScrollContainer className="max-h-80">
                        <Table.Content aria-label={`AI usage by model, ${period}`}>
                          <Table.Header>
                            <Table.Column isRowHeader>Model</Table.Column>
                            {columns.map((column) => <Table.Column key={column.key}>{column.label}</Table.Column>)}
                          </Table.Header>
                          <Table.Body>
                            {analytics.models.map((model) => (
                              <Table.Row id={JSON.stringify([model.provider, model.model])} key={JSON.stringify([model.provider, model.model])}>
                                <Table.Cell className="whitespace-nowrap">{[model.provider, model.model].filter(Boolean).join(" / ")}</Table.Cell>
                                {columns.map((column) => <Table.Cell key={column.key}>{numberFormat.format(model[column.key])}</Table.Cell>)}
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Content>
                      </Table.ScrollContainer>
                    </Table>
                  </section>
                )}
                <details className="rounded-3xl border border-divider bg-surface p-4 sm:p-6">
                  <summary className="cursor-pointer text-sm font-medium focus-visible:outline-accent">View daily values</summary>
                  <Table className="mt-4 tabular-nums" variant="secondary">
                    <Table.ScrollContainer className="max-h-80">
                      <Table.Content aria-label={`Daily ${isAi ? "AI usage" : "requests"}, ${period}`}>
                        <Table.Header>
                          <Table.Column isRowHeader>Date (UTC)</Table.Column>
                          {columns.map((column) => <Table.Column key={column.key}>{column.label}</Table.Column>)}
                        </Table.Header>
                        <Table.Body>
                          {analytics.daily.map((day) => (
                            <Table.Row id={day.date} key={day.date}>
                              <Table.Cell className="whitespace-nowrap">{dateFormat.format(new Date(day.date))}</Table.Cell>
                              {columns.map((column) => (
                                <Table.Cell key={column.key}>{day[column.key] === null ? "—" : numberFormat.format(day[column.key])}</Table.Cell>
                              ))}
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </details>
              </>
            )}
          </>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}

Analytics.propTypes = {
  teamId: PropTypes.number,
};

export default Analytics;
