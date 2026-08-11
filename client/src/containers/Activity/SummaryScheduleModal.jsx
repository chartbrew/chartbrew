import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  Button,
  Description,
  EmptyState,
  Label,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  SearchField,
  Select,
  Spinner,
  TimeField,
  useFilter,
} from "@heroui/react";
import { Time } from "@internationalized/date";
import {
  LuChartNoAxesColumnIncreasing,
  LuListFilter,
  LuMapPin,
} from "react-icons/lu";
import toast from "react-hot-toast";

import {
  createObservationDigest,
  getObservationDigestOptions,
  previewObservationDigest,
  updateObservationDigest,
} from "../../api/observations";
import timezones from "../../modules/timezones";
import ScheduleDaysOfWeek, {
  allDayValues,
  hasValidDailyDays,
} from "../ProjectDashboard/components/ScheduleDaysOfWeek";

const DELIVERY_DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 7, name: "Sunday" },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function formatMonthDay(day) {
  const remainder = day % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

function getMachineTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function parseTime(value) {
  const [hour, minute] = `${value || "09:00"}`.split(":").map(Number);
  return new Time(hour, minute);
}

function getInitialSchedule(subscription) {
  return {
    cadence: subscription?.cadence || "weekly",
    contentMode: subscription?.contentMode || "kpi_review",
    dayOfMonth: subscription?.dayOfMonth || 1,
    dayOfWeek: subscription?.dayOfWeek || 1,
    deliveryDays: subscription?.deliveryDays || undefined,
    enabled: subscription?.enabled ?? true,
    evaluationWaitMinutes: subscription?.evaluationWaitMinutes || 120,
    monitorId: subscription?.monitorId || null,
    projectId: subscription?.projectId || null,
    scopeType: subscription?.monitorId
      ? "monitor"
      : subscription?.projectId ? "project" : "workspace",
    time: parseTime(subscription?.localDeliveryTime),
    timezone: subscription?.timezone || getMachineTimezone(),
  };
}

function getSchedulePayload(schedule) {
  return {
    cadence: schedule.cadence,
    contentMode: schedule.contentMode,
    dayOfMonth: schedule.dayOfMonth,
    dayOfWeek: schedule.dayOfWeek,
    deliveryDays: schedule.cadence === "daily"
      && Array.isArray(schedule.deliveryDays)
      && schedule.deliveryDays.length !== allDayValues.length
      ? schedule.deliveryDays
      : null,
    enabled: true,
    evaluationWaitMinutes: schedule.evaluationWaitMinutes,
    localDeliveryTime: `${`${schedule.time.hour}`.padStart(2, "0")}:${`${schedule.time.minute}`.padStart(2, "0")}`,
    monitorId: schedule.scopeType === "monitor" ? schedule.monitorId : null,
    projectId: schedule.scopeType === "project" ? schedule.projectId : null,
    timezone: schedule.timezone,
  };
}

function SummaryScheduleModal({ isOpen, onClose, onSaved, subscription, teamId }) {
  const [schedule, setSchedule] = useState(() => getInitialSchedule(subscription));
  const [options, setOptions] = useState(null);
  const [pending, setPending] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewPending, setPreviewPending] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });

  useEffect(() => {
    if (!isOpen) return;
    setSchedule(getInitialSchedule(subscription));
    setOptions(null);
    getObservationDigestOptions(teamId)
      .then((data) => {
        setOptions(data);
        if (!subscription) {
          setSchedule((current) => ({
            ...current,
            cadence: data.recommendedCadence || current.cadence,
          }));
        }
      })
      .catch((error) => toast.error(error.message));
  }, [isOpen, subscription, teamId]);

  useEffect(() => {
    setPreviewData(null);
  }, [schedule]);

  const monitors = useMemo(() => {
    if (!options?.monitors) return [];
    if (schedule.projectId && schedule.scopeType === "monitor") {
      return options.monitors.filter((monitor) => (
        Number(monitor.projectId) === Number(schedule.projectId)
      ));
    }
    return options.monitors;
  }, [options?.monitors, schedule.projectId, schedule.scopeType]);

  const canSave = Boolean(
    schedule.cadence
    && schedule.time
    && schedule.timezone
    && options?.recipient?.email
    && (schedule.cadence !== "daily" || hasValidDailyDays(schedule.deliveryDays))
    && (schedule.cadence !== "monthly"
      || (schedule.dayOfMonth >= 1 && schedule.dayOfMonth <= 31))
    && (schedule.scopeType !== "project" || schedule.projectId)
    && (schedule.scopeType !== "monitor" || schedule.monitorId)
  );

  const save = async () => {
    setPending(true);
    try {
      const payload = getSchedulePayload(schedule);
      const saved = subscription
        ? await updateObservationDigest(teamId, subscription.id, payload)
        : await createObservationDigest(teamId, payload);
      onSaved(saved);
      toast.success(subscription ? "Email update saved" : "KPI review scheduled");
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  };

  const preview = async () => {
    setPreviewPending(true);
    try {
      setPreviewData(await previewObservationDigest(teamId, getSchedulePayload(schedule)));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPreviewPending(false);
    }
  };

  const disable = async () => {
    setPending(true);
    try {
      const saved = await updateObservationDigest(teamId, subscription.id, { enabled: false });
      onSaved(saved);
      toast.success("KPI review paused");
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-2xl">
          <Modal.Header>
            <Modal.Heading>
              {subscription ? "Edit email update" : "Schedule a KPI review"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5">
            {!options ? (
              <div className="flex min-h-40 items-center justify-center">
                <Spinner aria-label="Loading KPI review options" />
              </div>
            ) : (
              <>
                <RadioGroup
                  aria-label="Email content"
                  name="kpi-review-content"
                  onChange={(contentMode) => setSchedule((current) => ({
                    ...current,
                    contentMode,
                  }))}
                  value={schedule.contentMode}
                  variant="secondary"
                >
                  <Label>What should the email include?</Label>
                  <Radio value="kpi_review">
                    <Radio.Content>
                      <Radio.Control><Radio.Indicator /></Radio.Control>
                      <LuChartNoAxesColumnIncreasing aria-hidden />
                      KPI review
                    </Radio.Content>
                    <Description>
                      The latest result for each watched metric, including results without a large change.
                    </Description>
                  </Radio>
                  <Radio value="changes_only">
                    <Radio.Content>
                      <Radio.Control><Radio.Indicator /></Radio.Control>
                      <LuListFilter className="text-foreground-500" aria-hidden />
                      Changes only
                    </Radio.Content>
                    <Description>
                      Only important metric changes and data issues.
                    </Description>
                  </Radio>
                </RadioGroup>

                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Delivery</p>
                  <div className="rounded-lg border border-divider px-3 py-2 text-sm">
                    Email to {options.recipient?.email}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Select
                    aria-label="Email frequency"
                    onChange={(cadence) => setSchedule((current) => ({ ...current, cadence }))}
                    value={schedule.cadence}
                    variant="secondary"
                    fullWidth
                  >
                    <Label>How often?</Label>
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="daily" textValue="Daily">
                          Daily
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="weekly" textValue="Weekly">
                          Weekly
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="monthly" textValue="Monthly">
                          Monthly
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {schedule.cadence === "weekly" ? (
                    <Select
                      aria-label="Weekly delivery day"
                      onChange={(dayOfWeek) => setSchedule((current) => ({
                        ...current,
                        dayOfWeek: Number(dayOfWeek),
                      }))}
                      value={`${schedule.dayOfWeek}`}
                      variant="secondary"
                      fullWidth
                    >
                      <Label>Day</Label>
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {DELIVERY_DAYS.map((day) => (
                            <ListBox.Item id={`${day.id}`} key={day.id} textValue={day.name}>
                              {day.name}<ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  ) : null}
                  {schedule.cadence === "monthly" ? (
                    <Select
                      aria-label="Monthly delivery day"
                      onChange={(dayOfMonth) => setSchedule((current) => ({
                        ...current,
                        dayOfMonth: Number(dayOfMonth),
                      }))}
                      value={`${schedule.dayOfMonth}`}
                      variant="secondary"
                      fullWidth
                    >
                      <Label>Send on</Label>
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {MONTH_DAYS.map((day) => (
                            <ListBox.Item
                              id={`${day}`}
                              key={day}
                              textValue={formatMonthDay(day)}
                            >
                              {formatMonthDay(day)}
                              {day > 28 ? " · Last day in shorter months" : ""}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  ) : null}
                  <TimeField
                    aria-label="Email delivery time"
                    className="min-w-36"
                    hourCycle={12}
                    onChange={(time) => setSchedule((current) => ({ ...current, time }))}
                    value={schedule.time}
                  >
                    <Label>Time</Label>
                    <TimeField.Group variant="secondary">
                      <TimeField.Input>
                        {(segment) => <TimeField.Segment segment={segment} />}
                      </TimeField.Input>
                    </TimeField.Group>
                  </TimeField>
                </div>

                {schedule.cadence === "daily" ? (
                  <ScheduleDaysOfWeek
                    onChange={(deliveryDays) => setSchedule((current) => ({
                      ...current,
                      deliveryDays,
                    }))}
                    selectedDays={schedule.deliveryDays}
                  />
                ) : null}

                <div className="flex items-end gap-2">
                  <Autocomplete
                    aria-label="Email timezone"
                    onChange={(timezone) => setSchedule((current) => ({
                      ...current,
                      timezone: timezone || "",
                    }))}
                    value={schedule.timezone}
                    variant="secondary"
                    fullWidth
                  >
                    <Label>Timezone</Label>
                    <Autocomplete.Trigger>
                      <Autocomplete.Value />
                      <Autocomplete.ClearButton />
                      <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover>
                      <Autocomplete.Filter filter={contains}>
                        <SearchField autoFocus name="summary-timezone-search" variant="secondary">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search timezones..." />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                        <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                          {timezones.map((timezone) => (
                            <ListBox.Item id={timezone} key={timezone} textValue={timezone}>
                              {timezone}<ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Autocomplete.Filter>
                    </Autocomplete.Popover>
                  </Autocomplete>
                  <Button
                    aria-label="Use my timezone"
                    isIconOnly
                    onPress={() => setSchedule((current) => ({
                      ...current,
                      timezone: getMachineTimezone(),
                    }))}
                    variant="secondary"
                  >
                    <LuMapPin aria-hidden />
                  </Button>
                </div>

                <Select
                  aria-label="Metrics included in the email"
                  onChange={(scopeType) => setSchedule((current) => ({
                    ...current,
                    monitorId: null,
                    projectId: null,
                    scopeType,
                  }))}
                  value={schedule.scopeType}
                  variant="secondary"
                  fullWidth
                >
                  <Label>Include</Label>
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="workspace" textValue="All accessible dashboards">All accessible dashboards<ListBox.ItemIndicator /></ListBox.Item>
                      <ListBox.Item id="project" textValue="One dashboard">One dashboard<ListBox.ItemIndicator /></ListBox.Item>
                      <ListBox.Item id="monitor" textValue="One watched metric">One watched metric<ListBox.ItemIndicator /></ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                {schedule.scopeType === "project" ? (
                  <Select
                    aria-label="Dashboard included in the email"
                    onChange={(projectId) => setSchedule((current) => ({ ...current, projectId }))}
                    placeholder="Choose a dashboard"
                    value={schedule.projectId ? `${schedule.projectId}` : null}
                    variant="secondary"
                    fullWidth
                  >
                    <Label>Dashboard</Label>
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {options.projects.map((project) => (
                          <ListBox.Item id={`${project.id}`} key={project.id} textValue={project.name}>
                            {project.name}<ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                ) : null}

                {schedule.scopeType === "monitor" ? (
                  <Select
                    aria-label="Watched metric included in the email"
                    onChange={(monitorId) => setSchedule((current) => ({ ...current, monitorId }))}
                    placeholder="Choose a watched metric"
                    value={schedule.monitorId || null}
                    variant="secondary"
                    fullWidth
                  >
                    <Label>Watched metric</Label>
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {monitors.map((monitor) => (
                          <ListBox.Item id={monitor.id} key={monitor.id} textValue={monitor.name}>
                            {monitor.name}{monitor.projectName ? ` · ${monitor.projectName}` : ""}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                ) : null}

                {previewData ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Email preview</p>
                    <iframe
                      className="h-128 w-full rounded-lg border border-divider bg-white"
                      sandbox=""
                      srcDoc={previewData.html}
                      title="KPI review email preview"
                    />
                  </div>
                ) : null}
              </>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              {subscription?.enabled ? (
                <Button isPending={pending} onPress={disable} variant="danger-soft">
                  Pause schedule
                </Button>
              ) : null}
              <Button
                isDisabled={!canSave || pending}
                isPending={previewPending}
                onPress={preview}
                variant="secondary"
              >
                Preview email
              </Button>
            </div>
            <div className="flex flex-row items-center gap-2">
              <Button onPress={onClose} variant="tertiary">Cancel</Button>
              <Button isDisabled={!canSave} isPending={pending} onPress={save} variant="primary">
                {subscription ? "Save changes" : "Schedule review"}
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

SummaryScheduleModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  subscription: PropTypes.object,
  teamId: PropTypes.number.isRequired,
};

export default SummaryScheduleModal;
