import React, { useEffect, useRef, useState } from "react"
import PropTypes from "prop-types";
import { Autocomplete, AutocompleteItem, Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, TimeInput } from "@heroui/react";
import timezones from "../../../modules/timezones";
import { LuMapPin } from "react-icons/lu";
import { getProject, selectProject, updateProject } from "../../../slices/project";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Time } from "@internationalized/date";
import { selectCharts, updateChart } from "../../../slices/chart";

const getMachineTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

function UpdateSchedule({ isOpen, onClose }) {
  const project = useSelector(selectProject);
  const charts = useSelector(selectCharts)?.filter((chart) => chart.project_id === project.id);

  const [schedule, setSchedule] = useState({
    timezone: project.timezone || getMachineTimezone(),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [removingUpdates, setRemovingUpdates] = useState(false);
  const dispatch = useDispatch();
  const initRef = useRef(null);

  useEffect(() => {
    if (project?.updateSchedule && !initRef.current) {
      initRef.current = true;
      setSchedule({
        timezone: project.timezone || project?.updateSchedule?.timezone || getMachineTimezone(),
        frequency: project.updateSchedule?.frequency || undefined,
        dayOfWeek: project.updateSchedule?.dayOfWeek || undefined,
        frequencyNumber: project.updateSchedule?.frequencyNumber || undefined,
        time: project.updateSchedule?.time ? new Time(project.updateSchedule.time?.hour, project.updateSchedule.time?.minute) : undefined,
      });
    }
  }, [project]);

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

  const _onSave = async () => {
    setIsLoading(true);
    const response = await dispatch(updateProject({
      project_id: project.id,
      data: { updateSchedule: schedule },
    }));

    await dispatch(getProject({ project_id: project.id, active: true }));

    if (response?.error?.message) {
      toast.error(response.error.message, { autoClose: 2000 });
    } else {
      toast.success("Schedule updated", { autoClose: 2000 });
      onClose();
    }

    setIsLoading(false);
  };

  const _areChartsUpdating = () => {
    if (!charts) return false;
    return charts.some((chart) => chart.autoUpdate && chart.autoUpdate > 0);
  };

  const _disableIndividualChartUpdates = async () => {
    setRemovingUpdates(true);
    await Promise.all(charts.map(async (chart) => {
      if (chart.autoUpdate && chart.autoUpdate > 0) {
        await dispatch(updateChart({
          project_id: project.id,
          chart_id: chart.id,
          data: { autoUpdate: 0 },
          justUpdates: true,
        }));
      }
    }));

    await dispatch(getProject({ project_id: project.id, active: true }));

    setRemovingUpdates(false);
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

  const _disableAutomaticUpdates = async () => {
    await dispatch(updateProject({
      project_id: project.id,
      data: { updateSchedule: {} },
    }));
    await dispatch(getProject({ project_id: project.id, active: true }));
    setSchedule({
      timezone: project.timezone || getMachineTimezone(),
    });
    toast.success("Automatic updates disabled");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader className="flex flex-col">
          <div className="flex flex-row gap-2 items-center">
            <div className="text-lg font-bold">Schedule dashboard updates</div>
            <Chip color="secondary" radius="sm" size="sm" variant="flat">
              New!
            </Chip>
          </div>
          <div className="text-sm text-gray-500">
            {"All the charts in this dashboard will be updated at the appointed time"}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2">
            <Select
              placeholder="Select update frequency"
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
                onClick={() => setSchedule({ ...schedule, timezone: getMachineTimezone() })}
              >
                <LuMapPin />
              </Button>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {_areChartsUpdating() && (
            <Button
              variant="light"
              color="primary"
              isLoading={removingUpdates}
              onClick={_disableIndividualChartUpdates}
            >
              Disable individual chart updates
            </Button>
          )}
          {project.updateSchedule?.frequency && (
            <Button variant="flat" onClick={_disableAutomaticUpdates}>
              {"Disable the schedule"}
            </Button>
          )}
          <Button
            onClick={_onSave}
            color="primary"
            isLoading={isLoading}
            isDisabled={!_canSave()}
          >
            {"Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

UpdateSchedule.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  timezone: PropTypes.string.isRequired,
};

export default UpdateSchedule
