import React, { useEffect, useState } from "react";
import { Button, Chip, InputGroup, Spinner, Table } from "@heroui/react";
import { LuSearch, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { getActivity, resolveObservation } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import canAccess from "../../config/canAccess";
import HeroPaginationNav from "../../components/HeroPaginationNav";
import {
  formatCompactComparison,
  formatObservationChangeMagnitude,
  formatTimeAgo,
} from "../../modules/observationFormat";

import { ACTIVITY_PAGE_SIZE as PAGE_SIZE, getActivityPage } from "./activityPagination";

function ChangesPage() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [activity, setActivity] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [refreshKey, setRefreshKey] = useState(0);
  const [resolvingId, setResolvingId] = useState(null);
  const canResolve = canAccess("projectEditor", user?.id, team?.TeamRoles);

  useEffect(() => {
    if (!team?.id) return undefined;
    let active = true;
    setLoading(true);
    setLoadError(false);
    const timeout = setTimeout(() => {
      getActivity(team.id, { limit: PAGE_SIZE, page, search: query.trim(), status })
        .then((response) => {
          if (!active) return;
          const { totalPages: lastPage } = getActivityPage(page, response.total);
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setActivity(response);
        })
        .catch(() => { if (active) setLoadError(true); })
        .finally(() => { if (active) setLoading(false); });
    }, query.trim() ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [team?.id, page, query, status, refreshKey]);

  const resolveChange = async (observation) => {
    setResolvingId(observation.id);
    const resolved = observation.status !== "resolved";
    try {
      await resolveObservation(team.id, observation.id, resolved);
      setRefreshKey((current) => current + 1);
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
      toast.success(resolved ? "Change resolved" : "Change reopened");
    } catch {
      toast.error("Could not update this change. Try again.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <InputGroup fullWidth className="max-w-lg">
          <InputGroup.Input
            aria-label="Search changes"
            placeholder="Search changes"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <InputGroup.Suffix className="pr-2">
            <LuSearch className="size-4 text-muted" aria-hidden />
          </InputGroup.Suffix>
        </InputGroup>
        <div className="flex gap-1" role="group" aria-label="Change status">
          {[["open", "Open"], ["resolved", "Resolved"], ["", "All"]].map(([value, label]) => (
            <Button
              aria-pressed={status === value}
              key={value}
              onPress={() => {
                setStatus(value);
                setPage(1);
              }}
              size="sm"
              variant={status === value ? "secondary" : "tertiary"}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      {loadError ? (
        <div className="flex items-center gap-3" role="alert">
          <p>Changes could not load. Try again.</p>
          <Button onPress={() => setRefreshKey((current) => current + 1)} variant="secondary">
            Retry
          </Button>
        </div>
      ) : (
        <Table className="overflow-hidden rounded-3xl border border-divider shadow-none">
          <Table.ScrollContainer>
            <Table.Content aria-label="Changes" aria-busy={loading} className="min-w-[960px]">
              <Table.Header>
                <Table.Column id="activity" isRowHeader>Activity</Table.Column>
                <Table.Column id="status">Status</Table.Column>
                <Table.Column id="dashboard">Dashboard</Table.Column>
                <Table.Column id="change">Change</Table.Column>
                <Table.Column id="detected">Detected</Table.Column>
                <Table.Column id="actions" className="text-right">Actions</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => (
                <div className="flex items-center justify-center px-6 py-12 text-center">
                  {loading ? <Spinner aria-label="Loading changes" /> : (
                    <span className="text-sm text-muted">
                      No changes found. Try another search or status.
                    </span>
                  )}
                </div>
              )}>
                {(loading ? [] : activity.items).map((observation) => {
                  const resolved = observation.status === "resolved";
                  const positive = observation.impact === "positive";
                  const color = resolved ? "default" : positive ? "success" : "warning";
                  const changeClass = observation.impact === "negative"
                    ? "text-danger" : positive ? "text-success" : "text-muted";
                  const metricName = observation.chart?.name || observation.monitor?.name || observation.title;
                  return (
                    <Table.Row id={String(observation.id)} key={observation.id}>
                      <Table.Cell>
                        <div className="flex max-w-md items-center gap-3 py-1">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-current/10 ${changeClass}`}>
                            {observation.direction === "increase"
                              ? <LuTrendingUp size={18} aria-hidden />
                              : <LuTrendingDown size={18} aria-hidden />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{metricName}</p>
                            <p className="text-xs text-muted">
                              {formatCompactComparison(observation) || observation.summary}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-col items-start gap-1">
                          <Chip color={color} size="sm" variant="soft">
                            <Chip.Label>{resolved ? "Resolved" : positive ? "Notable change" : "Needs attention"}</Chip.Label>
                          </Chip>
                          {resolved && observation.resolvedAt ? (
                            <span className="text-xs text-muted">{formatTimeAgo(observation.resolvedAt)}</span>
                          ) : null}
                          {observation.preference?.dismissedAt ? (
                            <span className="text-xs text-muted">Hidden from Home</span>
                          ) : null}
                          {new Date(observation.preference?.snoozedUntil) > new Date() ? (
                            <span className="text-xs text-muted">Snoozed on Home</span>
                          ) : null}
                        </div>
                      </Table.Cell>
                      <Table.Cell>{observation.project?.name || "Workspace"}</Table.Cell>
                      <Table.Cell className={`whitespace-nowrap font-medium ${changeClass}`}>
                        {observation.direction === "increase" ? "+" : "−"}
                        {formatObservationChangeMagnitude(observation)}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-sm text-muted">
                        {formatTimeAgo(observation.lastDetectedAt)}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center justify-end gap-2">
                          {canResolve ? (
                            <Button
                              aria-label={`${resolved ? "Reopen" : "Resolve"} ${metricName}`}
                              isDisabled={resolvingId !== null}
                              isPending={resolvingId === observation.id}
                              onPress={() => resolveChange(observation)}
                              size="sm"
                              variant="secondary"
                            >
                              {resolved ? "Reopen" : "Resolve"}
                            </Button>
                          ) : null}
                          <Button
                            aria-label={`View ${metricName}`}
                            onPress={() => navigate(`/activity/${observation.id}`)}
                            size="sm"
                            variant="tertiary"
                          >
                            View
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3">
            <span className="text-sm text-muted" aria-live="polite">
              {loading ? "Loading changes…" : `${activity.total ? (page - 1) * PAGE_SIZE + 1 : 0}–${Math.min(page * PAGE_SIZE, activity.total)} of ${activity.total}`}
            </span>
            {!loading && activity.total > PAGE_SIZE ? (
              <HeroPaginationNav
                ariaLabel="Changes pagination"
                onPageChange={setPage}
                page={page}
                totalPages={Math.ceil(activity.total / PAGE_SIZE)}
              />
            ) : null}
          </Table.Footer>
        </Table>
      )}
    </div>
  );
}

export default ChangesPage;
