import React, { useState } from "react";
import PropTypes from "prop-types";
import { Badge, Spacer } from "@nextui-org/react";

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
    <>
      {messageTypes[mode].filter((m) => m.primary).map((message) => (
        <>
          <Badge
            key={message.value}
            onClick={() => onSelect(message.value)}
            color="primary"
            variant={selected === message.value ? "default" : "bordered"}
            css={{ cursor: "pointer", mb: 5 }}
          >
            {message.text}
          </Badge>
          <Spacer x={0.1} />
        </>
      ))}
      {!showAll
        && messageTypes[mode].filter((m) => !m.primary && selected === m.value).map((message) => (
          <>
            <Badge
              onClick={() => onSelect(message.value)}
              color="primary"
              variant="bordered"
              css={{ cursor: "pointer" }}
            >
              {message.text}
            </Badge>
            <Spacer x={0.1} />
          </>
        ))}
      {!showAll && showPrimary && (
        <>
          <Badge
            onClick={() => setShowAll(true)}
            color="secondary"
            css={{ cursor: "pointer" }}
          >
            {"Show all"}
          </Badge>
          <Spacer x={0.1} />
        </>
      )}
      {showAll && messageTypes[mode].filter((m) => !m.primary).map((message) => (
        <>
          <Badge
            key={message.value}
            onClick={() => onSelect(message.value)}
            variant={selected === message.value ? "default" : "bordered"}
            color="primary"
            css={{ cursor: "pointer" }}
          >
            {message.text}
          </Badge>
          <Spacer x={0.1} />
        </>
      ))}
      {showAll && (
        <>
          <Badge
            onClick={() => setShowAll(false)}
            color="secondary"
            css={{ cursor: "pointer" }}
          >
            {"Hide extra"}
          </Badge>
          <Spacer x={0.1} />
        </>
      )}
    </>
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
