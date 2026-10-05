import React, { useEffect, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  LuChartNoAxesColumn,
  LuCircleCheck,
  LuDatabase,
  LuPlug,
  LuRefreshCw,
} from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { dismissDataHealth, getDataHealth } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { ActivityList, ActivityListRow } from "./ActivityList";
import { formatTimeAgo } from "../../modules/observationFormat";

const HEALTH_TYPE_LABELS = {
  chart: "Chart",
  connection: "Connection",
  dashboard: "Dashboard",
  dataset: "Dataset",
  monitor: "Watched metric",
};

function getHealthIcon(type, resolved = false) {
  if (resolved) return <LuCircleCheck className="text-success" size={18} aria-hidden />;
  const iconProps = { className: "text-warning", size: 18, "aria-hidden": true };
  if (type === "connection") return <LuPlug {...iconProps} />;
  if (type === "dataset") return <LuDatabase {...iconProps} />;
  if (type === "chart") return <LuChartNoAxesColumn {...iconProps} />;
  return <LuRefreshCw {...iconProps} />;
}

function DataHealthPage() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const [health, setHealth] = useState({ count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    getDataHealth(team.id)
      .then(setHealth)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  const removeIssue = async (item) => {
    setRemovingId(item.id);
    try {
      await dismissDataHealth(team.id, item.id);
      setHealth((current) => {
        const active = (current.active || current.items).filter((issue) => issue.id !== item.id);
        return {
          ...current,
          active,
          count: active.length,
          items: active.slice(0, 5),
          resolved: current.resolved?.filter((issue) => issue.id !== item.id),
        };
      });
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
      toast.success("Issue removed from your list");
    } catch {
      toast.error("Could not remove this issue. Try again.");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading data health" />
      </div>
    );
  }

  const activeItems = health.active || health.items;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="active-health-heading" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" id="active-health-heading">
          Needs attention
        </h2>
        {activeItems.length > 0 ? (
          <ActivityList label="Data health">
            {activeItems.map((item) => (
              <ActivityListRow
                actions={(
                  <>
                    {item.action ? (
                      <Button onPress={() => navigate(item.action.path)} size="sm" variant="secondary">
                        {item.action.label}
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Remove issue: ${item.title}`}
                      isDisabled={removingId !== null}
                      isPending={removingId === item.id}
                      onPress={() => removeIssue(item)}
                      size="sm"
                      variant="tertiary"
                    >
                      Remove
                    </Button>
                  </>
                )}
                icon={getHealthIcon(item.type)}
                key={item.id}
                meta={(
                  <>
                    <span className="text-muted">{item.message}</span>
                    <span className="mt-2 block text-xs text-muted">
                      Detected {formatTimeAgo(item.detectedAt)}
                    </span>
                  </>
                )}
                title={(
                  <>
                    <span className="font-medium text-foreground">{item.title || item.message}</span>
                    <Chip color="warning" size="sm" variant="soft">
                      <Chip.Label>{HEALTH_TYPE_LABELS[item.type] || "Data issue"}</Chip.Label>
                    </Chip>
                  </>
                )}
              />
            ))}
          </ActivityList>
        ) : (
          <ActivityList label="Data health">
            <ActivityListRow
              icon={<LuCircleCheck className="text-success" size={18} aria-hidden />}
              meta="New issues will appear here when data cannot refresh."
              title={<span className="font-medium text-foreground">No data health issues to review</span>}
            />
          </ActivityList>
        )}
      </section>

      {health.resolved?.length > 0 ? (
        <section aria-labelledby="resolved-health-heading" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold" id="resolved-health-heading">
            Resolved recently
          </h2>
          <ActivityList label="Data health">
            {health.resolved.map((item) => (
              <ActivityListRow
                actions={(
                  <Button
                    aria-label={`Remove issue: ${item.title}`}
                    isDisabled={removingId !== null}
                    isPending={removingId === item.id}
                    onPress={() => removeIssue(item)}
                    size="sm"
                    variant="tertiary"
                  >
                    Remove
                  </Button>
                )}
                icon={getHealthIcon(item.type, true)}
                key={item.id}
                meta={(
                  <>
                    <span className="text-muted">{item.message}</span>
                    <span className="mt-2 block text-xs text-muted">
                      Recovered {formatTimeAgo(item.resolvedAt)}
                    </span>
                  </>
                )}
                title={(
                  <>
                    <span className="font-medium text-foreground">{item.title}</span>
                    <Chip color="success" size="sm" variant="soft">
                      <Chip.Label>Resolved</Chip.Label>
                    </Chip>
                  </>
                )}
              />
            ))}
          </ActivityList>
        </section>
      ) : null}
    </div>
  );
}

export default DataHealthPage;
