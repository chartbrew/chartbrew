import React, { useState } from "react";
import PropTypes from "prop-types";
import { Chip } from "@heroui/react";

const messageTypes = {
  messages: [
    { value: "delivered", text: "Delivered", primary: true },
    { value: "opened", text: "Opened", primary: true },
    { value: "clicked", text: "Clicked", primary: true },
    { value: "converted", text: "Converted", primary: true },
    { value: "attempted", text: "Attempted", primary: false },
    { value: "bounced", text: "Bounced", primary: false },
    { value: "created", text: "Created", primary: false },
    { value: "drafted", text: "Drafted", primary: false },
    { value: "dropped", text: "Dropped", primary: false },
    { value: "failed", text: "Failed", primary: false },
    { value: "drafted", text: "Drafted", primary: false },
    { value: "sent", text: "Sent", primary: false },
    { value: "spammed", text: "Spammed", primary: false },
    { value: "undeliverable", text: "Undeliverable", primary: false },
    { value: "unsubscribed", text: "Unsubscribed", primary: false },
    { value: "2xx", text: "2xx responses", primary: false },
    { value: "3xx", text: "3xx responses", primary: false },
    { value: "4xx", text: "4xx responses", primary: false },
    { value: "5xx", text: "5xx responses", primary: false }
  ],
  journeys: [
    { value: "started", text: "Started", primary: true },
    { value: "activated", text: "Activated", primary: true },
    { value: "exited_early", text: "Exited Early", primary: true },
    { value: "finished", text: "Finished", primary: true },
    { value: "converted", text: "Converted", primary: true },
    { value: "never_activated", text: "Never activated", primary: true },
    { value: "messaged", text: "Messaged", primary: true }
  ],
};

function MessageTypeLabels(props) {
  const {
    selected, onSelect, mode, showPrimary
  } = props;

  const [showAll, setShowAll] = useState(false);

  return (
    <div className="gap-1 flex flex-row flex-wrap">
      {messageTypes[mode].filter((m) => m.primary).map((message) => (
        <>
          <Chip
            key={message.value}
            onClick={() => onSelect(message.value)}
            color="primary"
            variant={selected === message.value ? "solid" : "bordered"}
            className="cursor-pointer"
          >
            {message.text}
          </Chip>
        </>
      ))}
      {!showAll
        && messageTypes[mode].filter((m) => !m.primary && selected === m.value).map((message) => (
          <>
            <Chip
              onClick={() => onSelect(message.value)}
              color="primary"
              variant="bordered"
              css={{ cursor: "pointer" }}
            >
              {message.text}
            </Chip>
          </>
        ))}
      {!showAll && showPrimary && (
        <>
          <Chip
            onClick={() => setShowAll(true)}
            color="secondary"
            className="cursor-pointer"
          >
            {"Show all"}
          </Chip>
        </>
      )}
      {showAll && messageTypes[mode].filter((m) => !m.primary).map((message) => (
        <>
          <Chip
            key={message.value}
            onClick={() => onSelect(message.value)}
            variant={selected === message.value ? "solid" : "bordered"}
            color="primary"
            className="cursor-pointer"
          >
            {message.text}
          </Chip>
        </>
      ))}
      {showAll && (
        <>
          <Chip
            onClick={() => setShowAll(false)}
            color="secondary"
            className="cursor-pointer"
          >
            {"Hide extra"}
          </Chip>
        </>
      )}
    </div>
  );
}

MessageTypeLabels.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selected: PropTypes.string,
  mode: PropTypes.string.isRequired,
  showPrimary: PropTypes.bool,
};

MessageTypeLabels.defaultProps = {
  selected: "",
  showPrimary: true,
};

export default MessageTypeLabels;
