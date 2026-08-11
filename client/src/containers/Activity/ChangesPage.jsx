import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import {
  Chip, InputGroup, Spinner, Table,
} from "@heroui/react";
import { LuChevronRight, LuSearch } from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { getActivity } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import HeroPaginationNav from "../../components/HeroPaginationNav";
import ObservationCard from "./ObservationCard";
import { ActivityEmptyState } from "./ActivityList";
import {
  formatCompactComparison,
  formatTimeAgo,
} from "../../modules/observationFormat";

const PAST_CHANGES_PER_PAGE = 10;

function ChangesPage() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastActivity, setPastActivity] = useState([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [pastTotal, setPastTotal] = useState(0);
  const [query, setQuery] = useState("");
  const pastRequestId = useRef(0);

  useEffect(() => {
    if (!team?.id) return;
    setQuery("");
    setLoading(true);
    getActivity(team.id, { limit: 50, status: "open" })
      .then((response) => setActivity(response.items))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  const loadPastPage = async (page, search = query) => {
    if (!team?.id) return;
    const requestId = pastRequestId.current + 1;
    pastRequestId.current = requestId;
    setPastLoading(true);
    try {
      const response = await getActivity(team.id, {
        limit: PAST_CHANGES_PER_PAGE,
        page,
        search: search.trim(),
        status: "resolved",
      });
      if (requestId !== pastRequestId.current) return;
      setPastActivity(response.items);
      setPastPage(response.page || page);
      setPastTotal(response.total || response.items.length);
    } catch (error) {
      if (requestId === pastRequestId.current) toast.error(error.message);
    } finally {
      if (requestId === pastRequestId.current) setPastLoading(false);
    }
  };

  useEffect(() => {
    if (!team?.id) return undefined;
    const timeout = setTimeout(() => loadPastPage(1, query), query.trim() ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [team?.id, query]);

  const filteredActivity = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return activity;
    return activity.filter((item) => [
      item.title,
      item.summary,
      item.project?.name,
      item.chart?.name,
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [activity, query]);

  const openActivity = filteredActivity.filter((item) => item.status === "open");
  const needsAttentionActivity = openActivity.filter((item) => item.impact !== "positive");
  const notableActivity = openActivity.filter((item) => item.impact === "positive");
  const pastTotalPages = Math.max(1, Math.ceil(pastTotal / PAST_CHANGES_PER_PAGE));
  const pastPageStart = pastTotal === 0 ? 0 : ((pastPage - 1) * PAST_CHANGES_PER_PAGE) + 1;
  const pastPageEnd = Math.min(pastPage * PAST_CHANGES_PER_PAGE, pastTotal);

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading changes" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InputGroup fullWidth className="max-w-lg">
        <InputGroup.Input
          aria-label="Search changes"
          placeholder="Search changes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <InputGroup.Suffix className="pr-2">
          <LuSearch className="size-4 text-muted" aria-hidden />
        </InputGroup.Suffix>
      </InputGroup>

      <section aria-labelledby="open-changes-heading" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" id="open-changes-heading">
          Needs attention
        </h2>
        {needsAttentionActivity.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {needsAttentionActivity.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        ) : (
          <ActivityEmptyState
            description="No current change needs your attention."
            title="Nothing needs attention"
          />
        )}
      </section>

      {notableActivity.length > 0 ? (
        <section aria-labelledby="notable-changes-heading" className="mt-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold" id="notable-changes-heading">
            Notable changes
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {notableActivity.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        </section>
      ) : null}

      {pastLoading || pastTotal > 0 ? (
        <section aria-labelledby="past-changes-heading" className="mt-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold" id="past-changes-heading">
            Past changes
          </h2>
          <Table className={`overflow-hidden rounded-3xl border border-divider shadow-none ${pastLoading ? "opacity-60" : ""}`}>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Past changes"
                className="min-w-[760px]"
                onRowAction={(key) => navigate(`/activity/${key}`)}
              >
                <Table.Header>
                  <Table.Column id="change" isRowHeader textValue="Change">Change</Table.Column>
                  <Table.Column id="source" textValue="Source">Source</Table.Column>
                  <Table.Column id="period" textValue="Period">Period</Table.Column>
                  <Table.Column id="resolved" textValue="Resolved">Resolved</Table.Column>
                  <Table.Column className="w-10" id="action" textValue="Open change" />
                </Table.Header>
                <Table.Body renderEmptyState={() => (
                  <span className="text-sm text-muted">No matching changes on this page</span>
                )}>
                  {pastActivity.map((observation) => (
                    <Table.Row
                      className="cursor-pointer"
                      id={String(observation.id)}
                      key={observation.id}
                    >
                      <Table.Cell>
                        <div className="flex max-w-md flex-col gap-0.5 py-1">
                          <span className="font-medium text-foreground">{observation.title}</span>
                          <span className="truncate text-xs text-muted">{observation.summary}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-col gap-0.5">
                          <span>{observation.project?.name || "Workspace"}</span>
                          <span className="text-xs text-muted">{observation.chart?.name || "—"}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-sm text-muted">
                        {formatCompactComparison(observation) || "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip className="whitespace-nowrap" size="sm" variant="soft">
                          <Chip.Label>
                            {observation.resolvedAt
                              ? `Resolved ${formatTimeAgo(observation.resolvedAt)}`
                              : "Resolved"}
                          </Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <LuChevronRight className="text-foreground-400" size={16} aria-hidden />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="flex flex-col gap-3 border-t border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted" aria-live="polite">
                {pastLoading
                  ? "Loading past changes…"
                  : `${pastPageStart}–${pastPageEnd} of ${pastTotal}`}
              </span>
              {pastTotalPages > 1 ? (
                <HeroPaginationNav
                  ariaLabel="Past changes pagination"
                  onPageChange={loadPastPage}
                  page={pastPage}
                  totalPages={pastTotalPages}
                />
              ) : null}
            </Table.Footer>
          </Table>
        </section>
      ) : null}
    </div>
  );
}

export default ChangesPage;
