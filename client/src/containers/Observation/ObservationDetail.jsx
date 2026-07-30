import React, { useEffect, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  LuBookmark,
  LuBookmarkCheck,
  LuChartNoAxesColumnIncreasing,
  LuCheck,
  LuClock,
  LuExternalLink,
  LuEyeOff,
  LuShare2,
  LuThumbsDown,
  LuThumbsUp,
} from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  exploreObservationDrivers,
  getObservation,
  resolveObservation,
  sendObservationFeedback,
  updateObservationPreference,
} from "../../api/observations";
import {
  formatAbsoluteDelta,
  formatMetricValue,
  formatRelativeChange,
  formatTimeAgo,
} from "../../modules/observationFormat";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import ObservationInvestigation from "../Ai/ObservationInvestigation";

const EDIT_ROLES = new Set(["projectAdmin", "projectEditor", "teamAdmin", "teamOwner"]);

function formatPeriod(period) {
  if (!period?.start || !period?.end) return "Period unavailable";
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(period.start))} – ${formatter.format(new Date(period.end))}`;
}

function ObservationDetail() {
  const { observationId } = useParams();
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [observation, setObservation] = useState(null);
  const [driverAnalysis, setDriverAnalysis] = useState(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const canEdit = EDIT_ROLES.has(teamRole);
  const isSnoozed = observation?.preference?.snoozedUntil
    && new Date(observation.preference.snoozedUntil) > new Date();

  useEffect(() => {
    if (!team?.id || !observationId) return;
    setLoading(true);
    getObservation(team.id, observationId)
      .then(async (result) => {
        setObservation(result);
        if (!result.preference.readAt) {
          await updateObservationPreference(team.id, observationId, { read: true });
          setObservation((current) => ({
            ...current,
            preference: { ...current.preference, readAt: new Date().toISOString() },
          }));
          window.dispatchEvent(new CustomEvent("cb:activity-updated"));
        }
      })
      .catch(() => setObservation(null))
      .finally(() => setLoading(false));
  }, [team?.id, observationId]);

  const updatePreference = async (values) => {
    try {
      const preference = await updateObservationPreference(team.id, observationId, values);
      setObservation((current) => ({ ...current, preference }));
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const feedback = async (verdict, reasonCode) => {
    try {
      await sendObservationFeedback(team.id, observationId, { reasonCode, verdict });
      toast.success("Thanks for the feedback");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const setResolved = async (resolved) => {
    try {
      const updated = await resolveObservation(team.id, observationId, resolved);
      setObservation((current) => ({ ...current, ...updated }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: observation.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied");
      }
    } catch (error) {
      if (error.name !== "AbortError") toast.error("Could not share this change");
    }
  };

  const exploreDrivers = async () => {
    setDriverLoading(true);
    try {
      setDriverAnalysis(await exploreObservationDrivers(team.id, observationId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDriverLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading change" />
      </div>
    );
  }
  if (!observation) {
    return (
      <div className="rounded-xl border border-divider bg-content1 px-4 py-5">
        <p className="font-medium">This change is not available</p>
        <Button className="mt-3" onPress={() => navigate("/activity")} size="sm" variant="secondary">
          Back to activity
        </Button>
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
            {observation.project?.name || "Workspace"}
          </p>
          <h1 className="font-tw text-2xl font-semibold">{observation.title}</h1>
          <p className="text-sm text-foreground-500">{observation.summary}</p>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Chip
              color={observation.status === "resolved" ? "success" : "warning"}
              size="sm"
              variant="soft"
            >
              <Chip.Label>{observation.status}</Chip.Label>
            </Chip>
            {observation.monitor ? (
              <Chip color={observation.monitor.active ? "accent" : "default"} size="sm" variant="soft">
                <Chip.Label>
                  {observation.monitor.active ? "Watched" : "No longer watched"}
                </Chip.Label>
              </Chip>
            ) : null}
            <span className="text-sm text-foreground-500">
              Last detected {formatTimeAgo(observation.lastDetectedAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
          <Button onPress={share} size="sm" variant="ghost">
            <LuShare2 size={16} aria-hidden />
            Share
          </Button>
          <Button
            onPress={() => updatePreference({ saved: !observation.preference.savedAt })}
            size="sm"
            variant="secondary"
          >
            {observation.preference.savedAt
              ? <LuBookmarkCheck size={16} aria-hidden />
              : <LuBookmark size={16} aria-hidden />}
            {observation.preference.savedAt ? "Saved" : "Save"}
          </Button>
          <Button
            onPress={() => updatePreference({
              snoozedUntil: isSnoozed
                ? null
                : new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
            })}
            size="sm"
            variant="ghost"
          >
            <LuClock size={16} aria-hidden />
            {isSnoozed ? "Unsnooze" : "Snooze 24h"}
          </Button>
          <Button
            onPress={() => updatePreference({ dismissed: !observation.preference.dismissedAt })}
            size="sm"
            variant="ghost"
          >
            <LuEyeOff size={16} aria-hidden />
            {observation.preference.dismissedAt ? "Restore" : "Dismiss"}
          </Button>
          {canEdit ? (
            <Button
              onPress={() => setResolved(observation.status !== "resolved")}
              size="sm"
              variant="primary"
            >
              <LuCheck size={16} aria-hidden />
              {observation.status === "resolved" ? "Reopen" : "Resolve"}
            </Button>
          ) : null}
        </div>
      </header>

      <section
        className="grid grid-cols-1 divide-y divide-divider rounded-xl border border-divider bg-content1 md:grid-cols-3 md:divide-x md:divide-y-0"
        aria-label="Change evidence"
      >
        <div className="px-4 py-3">
          <p className="text-sm text-foreground-500">Current</p>
          <p className="mt-1 font-tw text-xl font-semibold">
            {formatMetricValue(
              observation.currentValue,
              observation.unit,
              observation.monitor?.valueFormat
            )}
          </p>
          <p className="mt-1 text-xs text-foreground-400">
            {formatPeriod(observation.currentPeriod)}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-foreground-500">Comparison</p>
          <p className="mt-1 font-tw text-xl font-semibold">
            {formatMetricValue(
              observation.baselineValue,
              observation.unit,
              observation.monitor?.valueFormat
            )}
          </p>
          <p className="mt-1 text-xs text-foreground-400">
            {formatPeriod(observation.comparisonPeriod)}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-foreground-500">Change</p>
          <p className={observation.direction === "increase"
            ? "mt-1 font-tw text-xl font-semibold text-success"
            : "mt-1 font-tw text-xl font-semibold text-danger"}
          >
            {observation.direction === "increase" ? "+" : "−"}
            {formatRelativeChange(observation.relativeDelta)}
          </p>
          <p className="mt-1 text-xs text-foreground-400">
            {observation.direction === "increase" ? "+" : "−"}
            {formatAbsoluteDelta(
              observation.absoluteDelta,
              observation.unit,
              observation.monitor?.valueFormat
            )} absolute
            {" · "}
            {observation.confidence} confidence
          </p>
        </div>
      </section>

      {observation.chart ? (
        <div className="flex flex-col gap-3 rounded-xl border border-divider bg-content1 px-4 py-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
              Source chart
            </p>
            <p className="mt-0.5 truncate font-medium">{observation.chart.name}</p>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-2">
            <Button
              onPress={() => navigate(`/dashboard/${observation.project.id}`)}
              size="sm"
              variant="outline"
            >
              Open dashboard
            </Button>
            {canEdit ? (
              <Button
                onPress={() => navigate(
                  `/dashboard/${observation.project.id}/chart/${observation.chart.id}/edit`
                )}
                size="sm"
                variant="secondary"
              >
                Open chart
                <LuExternalLink size={16} aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-tw text-lg font-semibold">What changed?</h2>
        <p className="text-sm text-foreground-600">
          Compared with {formatPeriod(observation.comparisonPeriod)},{" "}
          {observation.monitor?.name || "this metric"} moved from{" "}
          {formatMetricValue(
            observation.baselineValue,
            observation.unit,
            observation.monitor?.valueFormat
          )} to{" "}
          {formatMetricValue(
            observation.currentValue,
            observation.unit,
            observation.monitor?.valueFormat
          )}.
        </p>
        <div className="flex flex-row">
          <Button
            isPending={driverLoading}
            onPress={exploreDrivers}
            size="sm"
            variant="secondary"
          >
            <LuChartNoAxesColumnIncreasing size={16} aria-hidden />
            Explore drivers
          </Button>
        </div>
        {driverAnalysis?.status === "not_enough_evidence" ? (
          <p className="text-sm text-foreground-500">{driverAnalysis.message}</p>
        ) : null}
        {driverAnalysis?.status === "ready" ? (
          <>
            <p className="text-sm font-medium">{driverAnalysis.message}</p>
            <div className="divide-y divide-divider rounded-xl border border-divider bg-content1">
              {driverAnalysis.segments.map((segment) => (
                <div
                  className="flex flex-row items-center justify-between gap-3 px-4 py-3"
                  key={segment.segment}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{segment.segment}</p>
                    <p className="mt-0.5 text-sm text-foreground-500">
                      {formatMetricValue(
                        segment.comparison,
                        observation.unit,
                        observation.monitor?.valueFormat
                      )} to{" "}
                      {formatMetricValue(
                        segment.current,
                        observation.unit,
                        observation.monitor?.valueFormat
                      )}
                    </p>
                  </div>
                  <Chip size="sm" variant="soft">
                    <Chip.Label>
                      {formatRelativeChange(segment.movementShare)} of movement
                    </Chip.Label>
                  </Chip>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-tw text-lg font-semibold">Investigate this change</h2>
        <ObservationInvestigation observationId={observation.id} teamId={team.id} />
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-divider bg-content1 px-4 py-3 md:flex-row md:items-center">
        <p className="flex-1 text-sm text-foreground-500">Was this change useful?</p>
        <div className="flex shrink-0 flex-row items-center gap-2">
          <Button
            onPress={() => feedback("relevant", "clear_and_useful")}
            size="sm"
            variant="secondary"
          >
            <LuThumbsUp size={16} aria-hidden />
            Useful
          </Button>
          <Button
            onPress={() => feedback("not_relevant", "not_actionable")}
            size="sm"
            variant="ghost"
          >
            <LuThumbsDown size={16} aria-hidden />
            Not useful
          </Button>
        </div>
      </div>
    </main>
  );
}

export default ObservationDetail;
