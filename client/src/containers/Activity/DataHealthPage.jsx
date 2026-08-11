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

import { getDataHealth } from "../../api/observations";
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

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    getDataHealth(team.id)
      .then(setHealth)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

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
          <ActivityList>
            {activeItems.map((item) => (
              <ActivityListRow
                actions={item.action ? (
                  <Button onPress={() => navigate(item.action.path)} size="sm" variant="secondary">
                    {item.action.label}
                  </Button>
                ) : null}
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
          <ActivityList>
            <ActivityListRow
              icon={<LuCircleCheck className="text-success" size={18} aria-hidden />}
              meta="No current connection, dataset, chart, or watched metric failures were found."
              title={<span className="font-medium text-foreground">Data is refreshing normally</span>}
            />
          </ActivityList>
        )}
      </section>

      {health.resolved?.length > 0 ? (
        <section aria-labelledby="resolved-health-heading" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold" id="resolved-health-heading">
            Resolved recently
          </h2>
          <ActivityList>
            {health.resolved.map((item) => (
              <ActivityListRow
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
