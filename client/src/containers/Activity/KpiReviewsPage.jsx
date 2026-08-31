import React, { useEffect, useState } from "react";
import {
  Button, Chip, Dropdown, Modal, Spinner,
} from "@heroui/react";
import {
  LuBell,
  LuEllipsis,
  LuMail,
  LuPencil,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  deleteObservationDigest,
  getObservationDigests,
  sendTestObservationDigest,
  updateObservationDigest,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import SummaryScheduleModal from "./SummaryScheduleModal";
import {
  ActivityEmptyState,
  ActivityList,
  ActivityListRow,
} from "./ActivityList";
import { formatTimeAgo } from "../../modules/observationFormat";

const DELIVERY_DAY_LABELS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getDigestMeta(subscription) {
  const deliveryDays = Array.isArray(subscription.deliveryDays)
    ? subscription.deliveryDays
    : [];
  let schedule = `Daily at ${subscription.localDeliveryTime}`;
  if (subscription.cadence === "weekly") {
    schedule = `${DELIVERY_DAY_LABELS[subscription.dayOfWeek] || "Monday"} at ${subscription.localDeliveryTime}`;
  } else if (subscription.cadence === "monthly") {
    schedule = `Day ${subscription.dayOfMonth || 1} at ${subscription.localDeliveryTime}`;
  } else if (deliveryDays.length) {
    const selectedDays = deliveryDays
      .map((day) => `${day}`.slice(0, 3))
      .map((day) => `${day[0].toUpperCase()}${day.slice(1)}`)
      .join(", ");
    schedule = `${selectedDays} at ${subscription.localDeliveryTime}`;
  }
  const next = subscription.nextDeliveryAt
    ? `Next ${formatTimeAgo(subscription.nextDeliveryAt)}`
    : "No upcoming delivery";
  const lastStatus = subscription.lastDelivery?.status === "delivered"
    ? `Last delivered ${formatTimeAgo(subscription.lastDelivery.attemptedAt)}`
    : subscription.lastDelivery?.status === "waiting_for_data"
      ? `Last delivered ${formatTimeAgo(subscription.lastDelivery.attemptedAt)} · Waiting for a final result`
      : subscription.lastDelivery?.status === "no_updates"
        ? `Last checked ${formatTimeAgo(subscription.lastDelivery.attemptedAt)} · No updates`
        : subscription.lastDelivery?.status === "failed"
          ? `Last delivery failed ${formatTimeAgo(subscription.lastDelivery.attemptedAt)}`
          : "Not delivered yet";
  return `${subscription.scope?.name || "All accessible dashboards"} · Email · ${schedule} · ${subscription.timezone} · ${next} · ${lastStatus}`;
}

function KpiReviewsPage() {
  const team = useSelector(selectTeam);
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDigest, setSelectedDigest] = useState(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [testDigestPendingId, setTestDigestPendingId] = useState(null);
  const [digestRemovePending, setDigestRemovePending] = useState(false);
  const [digestToRemove, setDigestToRemove] = useState(null);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    getObservationDigests(team.id)
      .then(setDigests)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  const removeDigest = async (subscriptionId) => {
    setDigestRemovePending(true);
    try {
      await deleteObservationDigest(team.id, subscriptionId);
      setDigests((current) => current.filter((item) => item.id !== subscriptionId));
      setDigestToRemove(null);
      toast.success("KPI review schedule removed");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDigestRemovePending(false);
    }
  };

  const toggleDigest = async (subscription) => {
    try {
      const updated = await updateObservationDigest(team.id, subscription.id, {
        enabled: !subscription.enabled,
      });
      setDigests((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      toast.success(updated.enabled ? "KPI review resumed" : "KPI review paused");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendTestDigest = async (subscriptionId) => {
    setTestDigestPendingId(subscriptionId);
    try {
      await sendTestObservationDigest(team.id, subscriptionId);
      toast.success("Test email sent");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTestDigestPendingId(null);
    }
  };

  const saveDigest = (subscription) => {
    setDigests((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => item.id === subscription.id ? subscription : item)
        : [subscription, ...current];
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading KPI reviews" />
      </div>
    );
  }

  return (
    <>
      {digests.length > 0 ? (
        <ActivityList>
          {digests.map((subscription) => (
            <ActivityListRow
              actions={(
                <>
                  <Button onPress={() => toggleDigest(subscription)} size="sm" variant="secondary">
                    {subscription.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Dropdown aria-label="KPI review options">
                    <Dropdown.Trigger
                      aria-label={testDigestPendingId === subscription.id
                        ? "Sending test email"
                        : "Open KPI review options"}
                      className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                      isDisabled={Boolean(testDigestPendingId)}
                    >
                      {testDigestPendingId === subscription.id
                        ? <Spinner aria-hidden size="sm" />
                        : <LuEllipsis size={18} aria-hidden />}
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          id="edit"
                          onPress={() => {
                            setSelectedDigest(subscription);
                            setScheduleModalOpen(true);
                          }}
                          textValue="Edit schedule"
                        >
                          <LuPencil size={16} aria-hidden />
                          Edit schedule
                        </Dropdown.Item>
                        <Dropdown.Item
                          id="send-test"
                          onPress={() => sendTestDigest(subscription.id)}
                          textValue="Send test email"
                        >
                          <LuMail size={16} aria-hidden />
                          Send test email
                        </Dropdown.Item>
                        <Dropdown.Item
                          id="delete"
                          onPress={() => setDigestToRemove(subscription)}
                          textValue="Delete schedule"
                          variant="danger"
                        >
                          <LuTrash2 size={16} aria-hidden />
                          Delete schedule
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </>
              )}
              icon={<LuBell className="text-foreground-400" size={18} aria-hidden />}
              key={subscription.id}
              meta={getDigestMeta(subscription)}
              title={(
                <>
                  <span className="font-medium text-foreground">
                    {subscription.cadence === "monthly"
                      ? "Monthly"
                      : subscription.cadence === "weekly" ? "Weekly" : "Daily"}{" "}
                    {subscription.contentMode === "changes_only" ? "changes only" : "KPI review"}
                  </span>
                  {!subscription.enabled ? (
                    <Chip size="sm" variant="soft"><Chip.Label>Paused</Chip.Label></Chip>
                  ) : null}
                </>
              )}
            />
          ))}
        </ActivityList>
      ) : (
        <ActivityEmptyState
          description="Choose when Chartbrew should email your latest KPI results."
          title="No KPI reviews scheduled"
        />
      )}

      <div className="mt-3">
        <Button
          onPress={() => {
            setSelectedDigest(null);
            setScheduleModalOpen(true);
          }}
          size="sm"
          variant="primary"
        >
          <LuPlus size={16} aria-hidden />
          Schedule review
        </Button>
      </div>

      <SummaryScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSaved={saveDigest}
        subscription={selectedDigest}
        teamId={team.id}
      />

      <Modal.Backdrop
        isOpen={Boolean(digestToRemove)}
        onOpenChange={(open) => {
          if (!open && !digestRemovePending) setDigestToRemove(null);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>Delete this KPI review schedule?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground-500">
                Chartbrew will stop sending this email. Activity and emails already sent
                will not be removed.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={digestRemovePending}
                onPress={() => setDigestToRemove(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isPending={digestRemovePending}
                onPress={() => removeDigest(digestToRemove.id)}
                variant="danger"
              >
                Delete schedule
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export default KpiReviewsPage;
