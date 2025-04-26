import React, { useEffect, useRef, useState } from "react"
import PropTypes from "prop-types";
import {
  Autocomplete, AutocompleteItem, Button, Input, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, Select, SelectItem, TimeInput, Spacer, Image, Textarea, ButtonGroup, Tooltip,
  Tabs, Tab,
  Checkbox,
} from "@heroui/react";
import {
  LuCamera, LuLaptop, LuMail, LuMailPlus, LuMapPin, LuMonitor, LuPlus, LuRefreshCw, LuSettings,
  LuSlack, LuSmartphone, LuTablet, LuWebhook, LuSun, LuMoon,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Time } from "@internationalized/date";

import timezones from "../../../modules/timezones";
import { getProject, selectProject, updateProject, takeSnapshot } from "../../../slices/project";
import { selectIntegrations, getTeamIntegrations } from "../../../slices/integration";
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

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col">
            <div className="text-lg font-bold">Schedule snapshot deliveries</div>
            <div className="text-sm text-gray-500">
              {"Snapshots of your dashboards sent over multiple channels"}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-2 w-full pb-6">
              <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2">
                <Select
                  placeholder="Select snapshot frequency"
                  aria-label="Update frequency"
                  variant="bordered"
                  selectedKeys={[schedule.frequency]}
                  onSelectionChange={(keys) => setSchedule({ ...schedule, frequency: keys.currentKey })}
                >
                  {frequencies.map((frequency) => (
                    <SelectItem key={frequency.value} textValue={frequency.label}>
                      {frequency.label}
                    </SelectItem>
                  ))}
                </Select>

                {schedule.frequency === "weekly" && (
                  <>
                    <div>{"on"}</div>
                    <Select
                      placeholder="Select day"
                      aria-label="Update day of week"
                      variant="bordered"
                      selectedKeys={[schedule.dayOfWeek]}
                      onSelectionChange={(keys) => setSchedule({ ...schedule, dayOfWeek: keys.currentKey })}
                    >
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value} textValue={day.label}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </>
                )}

                {(schedule.frequency === "every_x_days" || schedule.frequency === "every_x_hours" || schedule.frequency === "every_x_minutes") && (
                  <Input
                    placeholder="X"
                    type="number"
                    aria-label="Update frequency"
                    variant="bordered"
                    value={schedule.frequencyNumber}
                    onChange={(e) => setSchedule({ ...schedule, frequencyNumber: e.target.value })}
                  />
                )}

                {(schedule.frequency === "every_x_days" || schedule.frequency === "daily" || schedule.frequency === "weekly") && (
                  <>
                    <div>{"at"}</div>
                    <TimeInput
                      aria-label="Update time"
                      variant="bordered"
                      value={schedule.time}
                      hourCycle={12}
                      onChange={(time) => {
                        setSchedule({ ...schedule, time })
                      }}
                    />
                  </>
                )}
              </div>
              {(schedule.frequency === "every_x_days" || schedule.frequency === "daily" || schedule.frequency === "weekly") && (
                <div className="flex flex-row items-center gap-2">
                  <Autocomplete
                    placeholder="Select a timezone"
                    variant="bordered"
                    onSelectionChange={(key) => {
                      setSchedule({ ...schedule, timezone: key });
                    }}
                    selectedKey={schedule.timezone}
                    defaultValue={schedule.timezone}
                    fullWidth
                    aria-label="Timezone"
                  >
                    {timezones.map((timezone) => (
                      <AutocompleteItem key={timezone} textValue={timezone}>
                        {timezone}
                      </AutocompleteItem>
                    ))}
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

              <Spacer y={2} />

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
                <Tooltip content="Create a new integration">
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={_onCreateNewIntegration}
                  >
                    <LuPlus size={18} />
                  </Button>
                </Tooltip>
                <Tooltip content="Refresh list">
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={_onRefreshIntegrationList}
                  >
                    <LuRefreshCw size={18} />
                  </Button>
                </Tooltip>
              </div>

              {schedule.mediums.email?.enabled && (
                <>
                  <div className="mt-2">
                    <Textarea
                      placeholder="Enter email address (one per line)"
                      variant="bordered"
                      value={customEmails.join("\n")}
                      onChange={(e) => setCustomEmails(e.target.value.split("\n"))}
                      maxRows={10}
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

              <Spacer y={2} />

              <div className="flex flex-row items-center justify-between">
                <div className="font-medium">
                  {"Preview"}
                </div>
                <Button
                  variant="flat"
                  size="sm"
                  onPress={() => navigate(`/b/${project.brewName}`)}
                  startContent={<LuSettings size={18} />}
                >
                  Edit visuals
                </Button>
              </div>

              {snapshotPath && (
                <div className="w-full bg-content3 rounded-lg p-2">
                  <div
                    className="flex flex-col items-center cursor-pointer"
                    onClick={() => {
                      window.open(snapshotPath, "_blank");
                    }}
                  >
                    <Image src={snapshotPath} alt="Snapshot" className="max-h-96" />
                  </div>
                </div>
              )}

              <div className="flex flex-row items-center justify-between flex-wrap">
                <div className="flex flex-row items-center">
                  <Button
                    size="sm"
                    onPress={_onTakeSnapshot}
                    isLoading={isLoading}
                    variant="flat"
                    startContent={<LuCamera size={18} />}
                  >
                    Take snapshot
                  </Button>
                  <Spacer x={2} />
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
                  <Tooltip content="Viewport width">
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
                  </Tooltip>
                  <Input
                    placeholder="Viewport width"
                    type="number"
                    variant="bordered"
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
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Close
            </Button>
            <Button onPress={_onSave} color="primary" isLoading={isLoading} isDisabled={!_canSave()}>
              {"Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

SnapshotSchedule.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  timezone: PropTypes.string.isRequired,
};

export default SnapshotSchedule;
