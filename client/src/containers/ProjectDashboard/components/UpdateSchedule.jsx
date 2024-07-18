import React, { useState } from "react"
import PropTypes from "prop-types";
import { Autocomplete, AutocompleteItem, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, TimeInput } from "@nextui-org/react";
import timezones from "../../../modules/timezones";
import { LuMapPin } from "react-icons/lu";

const getMachineTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

function UpdateSchedule({ isOpen, onClose, timezone }) {
  const [schedule, setSchedule] = useState({
    timezone: timezone || getMachineTimezone(),
  });

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

  const _onSave = () => {
    // console.log("schedule", schedule);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>
          <div className='text-lg font-bold'>Schedule dashboard updates</div>
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
          <Button variant="bordered" onClick={onClose}>
            {"Cancel"}
          </Button>
          <Button onClick={_onSave} color="primary">
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
