import React, { useEffect, useRef, useState } from "react"
import PropTypes from "prop-types";
import {
  Autocomplete, Button, EmptyState, Input, Label, ListBox, Modal, SearchField, Select, TimeField, TextArea, ButtonGroup, Tooltip, useFilter,
  Tabs, Tab,
  Checkbox,
} from "@heroui/react";
import {
  LuCamera, LuLaptop, LuMail, LuMailPlus, LuMapPin, LuMonitor, LuPlus, LuRefreshCw, LuSettings,
  LuSlack, LuSmartphone, LuTablet, LuWebhook, LuSun, LuMoon,
  LuCopy,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Time } from "@internationalized/date";

import timezones from "../../../modules/timezones";
import { getProject, selectProject, updateProject, takeSnapshot } from "../../../slices/project";
import { selectIntegrations, getTeamIntegrations } from "../../../slices/integration";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import { API_HOST } from "../../../config/settings";
import { selectProjectMembers } from "../../../slices/team";
import { useNavigate, useParams } from "react-router";

const getMachineTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

function SnapshotSchedule({ isOpen, onClose }) {
  const params = useParams();

  const project = useSelector(selectProject);
  const integrations = useSelector(selectIntegrations);
  const team = useSelector((state) => state.team?.active);
  const projectMembers = useSelector((state) => selectProjectMembers(state, params.projectId));

  const [schedule, setSchedule] = useState({
    timezone: project.timezone || getMachineTimezone(),
    mediums: {
      email: {
        enabled: true,
      }
    },
  });
  const [selectedIntegrations, setSelectedIntegrations] = useState([]);
  const [customEmails, setCustomEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotPath, setSnapshotPath] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });

  const dispatch = useDispatch();
  const initRef = useRef(null);
  const snapshotRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (project?.id && !snapshotRef.current && isOpen) {
      snapshotRef.current = true;
      _onTakeSnapshot();
    }
  }, [project, isOpen]);

  useEffect(() => {
    if (project?.snapshotSchedule && !initRef.current) {
      initRef.current = true;
      _resetSchedule();
      if (project.snapshotSchedule?.integrations) {
        setSelectedIntegrations(project.snapshotSchedule.integrations);
      }
      if (project.snapshotSchedule?.customEmails) {
        setCustomEmails(project.snapshotSchedule.customEmails);
      }
    }
  }, [project]);

  useEffect(() => {
    if (team?.id) {
      dispatch(getTeamIntegrations({ team_id: team.id }));
    }
  }, [team?.id]);

  const _resetSchedule = () => {
    setSchedule({
      timezone: project.timezone || project?.snapshotSchedule?.timezone || getMachineTimezone(),
      frequency: project.snapshotSchedule?.frequency || undefined,
      dayOfWeek: project.snapshotSchedule?.dayOfWeek || undefined,
      frequencyNumber: project.snapshotSchedule?.frequencyNumber || undefined,
      time: project.snapshotSchedule?.time ? new Time(project.snapshotSchedule.time?.hour, project.snapshotSchedule.time?.minute) : undefined,
      mediums: project.snapshotSchedule?.mediums || {
        email: {
          enabled: true,
        }
      },
      viewport: project.snapshotSchedule?.viewport || {
        width: 1920,
        height: 1080,
      },
      theme: project.snapshotSchedule?.theme || "light",
    });
  };

  const frequencies = [
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Every X days", value: "every_x_days" },
    { label: "Every X hours", value: "every_x_hours" },
    { label: "Every X minutes", value: "every_x_minutes" },
  ];

  const daysOfWeek = [
    { label: "Monday", value: "monday" },
    { label: "Tuesday", value: "tuesday" },
    { label: "Wednesday", value: "wednesday" },
    { label: "Thursday", value: "thursday" },
    { label: "Friday", value: "friday" },
    { label: "Saturday", value: "saturday" },
    { label: "Sunday", value: "sunday" },
  ];

  const _onChangeMediums = (medium) => {
    setSchedule({
      ...schedule,
      mediums: {
        ...schedule.mediums,
        [medium]: {
          enabled: !schedule.mediums[medium]?.enabled,
        }
      }
    });
  };

  const _onSelectIntegration = (integration) => {
    // enable/disable integration
    let found = false;
    const newSelection = selectedIntegrations.map((si) => {
      if (si.integration_id === integration.id) {
        found = true;
        return {
          id: si.id,
          integration_id: integration.id,
          enabled: !si.enabled
        };
      }

      return si;
    });

    if (!found) {
      newSelection.push({
        integration_id: integration.id,
        enabled: true
      });
    }

    setSelectedIntegrations(newSelection);
  };

  const _onSave = async () => {
    setIsLoading(true);
    const response = await dispatch(updateProject({
      project_id: project.id,
      data: { 
        snapshotSchedule: {
          ...schedule,
          integrations: selectedIntegrations,
          customEmails: customEmails,
        }
      },
    }));

    await dispatch(getProject({ project_id: project.id, active: true }));

    if (response?.error?.message) {
      toast.error(response.error.message, { autoClose: 2000 });
    } else {
      toast.success("Schedule updated", { autoClose: 2000 });
    }

    setIsLoading(false);
  };

  const _onRemoveSchedule = async () => {
    setIsLoading(true);
    const response = await dispatch(updateProject({
      project_id: project.id,
      data: { snapshotSchedule: null }
    }));

    if (response?.error?.message) {
      toast.error(response.error.message, { autoClose: 2000 });
    } else {
      toast.success("Schedule removed", { autoClose: 2000 });
      await dispatch(getProject({ project_id: project.id, active: true }));
      onClose();
    }

    setIsLoading(false);
  };

  const _canSave = () => {
    // validate if any information is missing from the schedule
    if (!schedule.frequency) {
      return false;
    }

    if (schedule.frequency === "weekly" && (!schedule.dayOfWeek || !schedule.time)) {
      return false;
    }

    if (schedule.frequency === "daily" && !schedule.time) {
      return false;
    }

    if (schedule.frequency === "every_x_days" && (!schedule.frequencyNumber || !schedule.time)) {
      return false;
    }

    if (schedule.frequency === "every_x_hours" && !schedule.frequencyNumber) {
      return false;
    }

    if (schedule.frequency === "every_x_minutes" && !schedule.frequencyNumber) {
      return false;
    }

    return true;
  }

  const _onCreateNewIntegration = () => {
    window.open("/integrations", "_blank");
  };

  const _onRefreshIntegrationList = () => {
    if (team?.id) {
      dispatch(getTeamIntegrations({ team_id: team.id }));
    }
  };

  const _onTakeSnapshot = async () => {
    setIsLoading(true);
    const response = await dispatch(takeSnapshot({ project_id: project.id, options: schedule }));
    if (response?.error?.message) {
      toast.error(response.error.message, { autoClose: 2000 });
    } else {
      setSnapshotPath(`${API_HOST}/${response.payload.snapshot_path}?v=${Date.now()}`);
    }
    setIsLoading(false);
  };

  const _onAddProjectMembers = () => {
    const members = projectMembers.map((member) => member.email);
    const uniqueEmails = [...new Set([...customEmails, ...members])];
    setCustomEmails(uniqueEmails);
  };

  const _onCopyToClipboard = async () => {
    try {
      const response = await fetch(snapshotPath);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      toast.success("Copied to clipboard", { autoClose: 2000 });
    } catch (error) {
      toast.error("Failed to copy image", { autoClose: 2000 });
    }
  }

  return (
    <>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-3xl">
          <Modal.Header className="flex flex-col">
            <Modal.Heading>Schedule snapshot deliveries</Modal.Heading>
            <div className="text-lg font-bold">Schedule snapshot deliveries</div>
            <div className="text-sm text-gray-500">
              {"Snapshots of your dashboards sent over multiple channels"}
            </div>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-2 w-full pb-6">
              <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2">
                <Select
                  placeholder="Select snapshot frequency"
                  aria-label="Update frequency"
                  variant="secondary"
                  selectionMode="single"
                  value={schedule.frequency || null}
                  onChange={(value) => setSchedule({ ...schedule, frequency: value })}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {frequencies.map((frequency) => (
                        <ListBox.Item key={frequency.value} id={frequency.value} textValue={frequency.label}>
                          {frequency.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                {schedule.frequency === "weekly" && (
                  <>
                    <div>{"on"}</div>
                    <Select
                      placeholder="Select day"
                      aria-label="Update day of week"
                      variant="secondary"
                      selectionMode="single"
                      value={schedule.dayOfWeek || null}
                      onChange={(value) => setSchedule({ ...schedule, dayOfWeek: value })}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {daysOfWeek.map((day) => (
                            <ListBox.Item key={day.value} id={day.value} textValue={day.label}>
                              {day.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </>
                )}

                {(schedule.frequency === "every_x_days" || schedule.frequency === "every_x_hours" || schedule.frequency === "every_x_minutes") && (
                  <Input
                    placeholder="X"
                    type="number"
                    aria-label="Update frequency"
                    variant="secondary"
                    value={schedule.frequencyNumber}
                    onChange={(e) => setSchedule({ ...schedule, frequencyNumber: e.target.value })}
                  />
                )}

                {(schedule.frequency === "every_x_days" || schedule.frequency === "daily" || schedule.frequency === "weekly") && (
                  <>
                    <div>{"at"}</div>
                    <TimeField
                      aria-label="Update time"
                      value={schedule.time}
                      hourCycle={12}
                      onChange={(time) => {
                        setSchedule({ ...schedule, time });
                      }}
                      className="min-w-[9rem]"
                    >
                      <TimeField.Group variant="secondary">
                        <TimeField.Input>
                          {(segment) => <TimeField.Segment segment={segment} />}
                        </TimeField.Input>
                      </TimeField.Group>
                    </TimeField>
                  </>
                )}
              </div>
              {(schedule.frequency === "every_x_days" || schedule.frequency === "daily" || schedule.frequency === "weekly") && (
                <div className="flex flex-row items-center gap-2">
                  <Autocomplete
                    placeholder="Select a timezone"
                    variant="secondary"
                    selectionMode="single"
                    value={schedule.timezone || null}
                    onChange={(value) => {
                      setSchedule({ ...schedule, timezone: value || "" });
                    }}
                    fullWidth
                    aria-label="Timezone"
                  >
                    <Label>Timezone</Label>
                    <Autocomplete.Trigger>
                      <Autocomplete.Value />
                      <Autocomplete.ClearButton />
                      <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover>
                      <Autocomplete.Filter filter={contains}>
                        <SearchField autoFocus name="timezone-search" variant="secondary">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search timezones..." />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                        <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                          {timezones.map((timezone) => (
                            <ListBox.Item key={timezone} id={timezone} textValue={timezone}>
                              {timezone}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Autocomplete.Filter>
                    </Autocomplete.Popover>
                  </Autocomplete>

                  <Button
                    color="primary"
                    variant="light"
                    size="sm"
                    onPress={() => setSchedule({ ...schedule, timezone: getMachineTimezone() })}
                  >
                    <LuMapPin />
                  </Button>
                </div>
              )}

              <div className="h-4" />

              <div className="font-medium">
                {"Where should we send the snapshots?"}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  auto
                  startContent={<LuMail />}
                  size="sm"
                  variant={!schedule.mediums.email?.enabled ? "flat": "solid"}
                  onPress={() => _onChangeMediums("email")}
                  color={schedule.mediums.email?.enabled ? "primary" : "default"}
                >
                  Email
                </Button>
                {integrations && integrations.map((integration) => (
                  <Button
                    key={integration.id}
                    auto
                    startContent={
                      integration.config?.slackMode ? <LuSlack />
                        : integration.type === "webhook" ? <LuWebhook />
                          : null
                    }
                    size="sm"
                    variant={
                      selectedIntegrations.length === 0
                      || !selectedIntegrations.find(
                        (i) => i.integration_id === integration.id && i.enabled
                      ) ? "flat" : "solid"
                    }
                    onPress={() => _onSelectIntegration(integration)}
                    color={
                      selectedIntegrations.length === 0
                      || !selectedIntegrations.find(
                        (i) => i.integration_id === integration.id && i.enabled
                      ) ? "default" : "primary"
                    }
                  >
                    {integration.name}
                  </Button>
                ))}
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={_onCreateNewIntegration}
                    >
                      <LuPlus size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Create a new integration</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={_onRefreshIntegrationList}
                    >
                      <LuRefreshCw size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Refresh list</Tooltip.Content>
                </Tooltip>
              </div>

              {schedule.mediums.email?.enabled && (
                <>
                  <div className="mt-2">
                    <TextArea
                      placeholder="Enter email address (one per line)"
                      variant="secondary"
                      value={customEmails.join("\n")}
                      onChange={(e) => setCustomEmails(e.target.value.split("\n"))}
                      rows={10}
                    />
                    <div className="flex flex-row items-center gap-2">
                      <Button
                        size="sm"
                        onPress={_onAddProjectMembers}
                        variant="light"
                        startContent={<LuMailPlus size={18} />}
                      >
                        Add dashboard members
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <div className="h-4" />

              <div className="flex flex-row items-center justify-between">
                <div className="font-medium">
                  {"Preview"}
                </div>
                <div className="flex flex-row items-center gap-2">
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={_onCopyToClipboard}
                    startContent={<LuCopy size={18} />}
                  >
                    Copy image
                  </Button>
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={() => navigate(`/report/${project.brewName}/edit`)}
                    startContent={<LuSettings size={18} />}
                  >
                    Edit visuals
                  </Button>
                </div>
              </div>

              {snapshotPath && (
                <div className="w-full bg-content3 rounded-lg p-2">
                  <div
                    className="flex flex-col items-center cursor-pointer"
                    onClick={() => {
                      window.open(snapshotPath, "_blank");
                    }}
                  >
                    <img src={snapshotPath} alt="Snapshot" className="max-h-96 max-w-full" />
                  </div>
                </div>
              )}

              <div className="flex flex-row items-center justify-between flex-wrap">
                <div className="flex flex-row items-center">
                  <Button
                    size="sm"
                    onPress={_onTakeSnapshot}
                    isPending={isLoading}
                    variant="flat"
                    startContent={isLoading ? <ButtonSpinner /> : <LuCamera size={18} />}
                  >
                    Take snapshot
                  </Button>
                  <div className="w-4" />
                  <Tabs
                    selectedKey={schedule.theme}
                    onSelectionChange={(key) => setSchedule({ ...schedule, theme: key })}
                    size="sm"
                    variant="light"
                    disableAnimation
                  >
                    <Tab key="light" title={<LuSun size={18} />} />
                    <Tab key="dark" title={<LuMoon size={18} />} />
                  </Tabs>
                </div>

                <div className="flex flex-row items-center gap-2">
                  <Tooltip>
                    <Tooltip.Trigger>
                      <ButtonGroup variant="light" size="sm">
                        <Button
                          onPress={() => setSchedule({ ...schedule, viewport: { ...schedule.viewport, width: 375, height: 667 } })}
                          isIconOnly
                          color={schedule?.viewport?.width === 375 ? "primary" : "default"}
                        >
                          <LuSmartphone />
                        </Button>
                        <Button
                          onPress={() => setSchedule({ ...schedule, viewport: { ...schedule.viewport, width: 768, height: 1024 } })}
                          isIconOnly
                          color={schedule?.viewport?.width === 768 ? "primary" : "default"}
                        >
                          <LuTablet />
                        </Button>
                        <Button
                          onPress={() => setSchedule({ ...schedule, viewport: { ...schedule.viewport, width: 1440, height: 900 } })}
                          isIconOnly
                          color={schedule?.viewport?.width === 1440 ? "primary" : "default"}
                        >
                          <LuLaptop />
                        </Button>
                        <Button
                          onPress={() => setSchedule({ ...schedule, viewport: { ...schedule.viewport, width: 1920, height: 1080 } })}
                          isIconOnly
                          color={schedule?.viewport?.width === 1920 ? "primary" : "default"}
                        >
                          <LuMonitor />
                        </Button>
                      </ButtonGroup>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Viewport width</Tooltip.Content>
                  </Tooltip>
                  <Input
                    placeholder="Viewport width"
                    type="number"
                    variant="secondary"
                    value={schedule?.viewport?.width}
                    onChange={(e) => setSchedule({ ...schedule, viewport: { ...schedule.viewport, width: parseInt(e.target.value, 10) } })}
                    className="max-w-24"
                    size="sm"
                    max={7680}
                  />
                </div>
              </div>
              <div className="flex flex-row items-center gap-4">
                <Checkbox
                  isSelected={schedule.removeStyling}
                  onValueChange={(isSelected) => setSchedule({ ...schedule, removeStyling: isSelected })}
                  size="sm"
                >
                  Remove styling
                </Checkbox>
                <Checkbox
                  isSelected={schedule.removeHeader}
                  onValueChange={(isSelected) => setSchedule({ ...schedule, removeHeader: isSelected })}
                  size="sm"
                >
                  Remove header
                </Checkbox>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="items-center">
            {!project?.snapshotSchedule?.frequency && (
              <div className="text-sm text-gray-500">
                {"Schedule is not set yet"}
              </div>
            )}
            <Button variant="outline" onPress={onClose}>
              Close
            </Button>
            {project?.snapshotSchedule?.frequency && (
              <Button variant="danger" onPress={_onRemoveSchedule}>
                Remove schedule
              </Button>
            )}
            <Button
              onPress={_onSave}
              isDisabled={!_canSave()}
              isPending={isLoading}
              startContent={isLoading ? <ButtonSpinner /> : undefined}
            >
              {project?.snapshotSchedule?.frequency ? "Update" : "Set schedule"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </>
  )
}

SnapshotSchedule.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  timezone: PropTypes.string.isRequired,
};

export default SnapshotSchedule;
