import React, { useState } from "react";
import PropTypes from "prop-types";
import { Icon, Label } from "semantic-ui-react";

const messageTypes = [{
  value: "delivered",
  text: "Delivered",
  star: true,
}, {
  value: "opened",
  text: "Opened",
  star: true,
}, {
  value: "clicked",
  text: "Clicked",
  star: true,
}, {
  value: "converted",
  text: "Converted",
  star: true,
}, {
  value: "attempted",
  text: "Attempted",
  star: false,
}, {
  value: "bounced",
  text: "Bounced",
  star: false,
}, {
  value: "created",
  text: "Created",
  star: false,
}, {
  value: "drafted",
  text: "Drafted",
  star: false,
}, {
  value: "dropped",
  text: "Dropped",
  star: false,
}, {
  value: "failed",
  text: "Failed",
  star: false,
}, {
  value: "drafted",
  text: "Drafted",
  star: false,
}, {
  value: "sent",
  text: "Sent",
  star: false,
}, {
  value: "spammed",
  text: "Spammed",
  star: false,
}, {
  value: "undeliverable",
  text: "Undeliverable",
  star: false,
}, {
  value: "unsubscribed",
  text: "Unsubscribed",
  star: false,
}, {
  value: "2xx",
  text: "2xx responses",
  star: false,
}, {
  value: "3xx",
  text: "3xx responses",
  star: false,
}, {
  value: "4xx",
  text: "4xx responses",
  star: false,
}, {
  value: "5xx",
  text: "5xx responses",
  star: false,
}];

function MessageTypeLabels(props) {
  const { selected, onSelect } = props;

  const [showAll, setShowAll] = useState(false);

  return (
    <Label.Group>
      {messageTypes.filter((m) => m.star).map((message) => (
        <Label
          key={message.value}
          as="a"
          onClick={() => onSelect(message.value)}
          color={selected === message.value ? "primary" : null}
        >
          <Icon name="star outline" />
          {message.text}
        </Label>
      ))}
      {!showAll && messageTypes.filter((m) => !m.star && selected === m.value).map((message) => (
        <Label
          as="a"
          onClick={() => onSelect(message.value)}
          color="violet"
        >
          {message.text}
        </Label>
      ))}
      {!showAll && (
        <Label
          as="a"
          onClick={() => setShowAll(true)}
          basic
        >
          {"Show all "}
          <Icon name="chevron right" />
        </Label>
      )}
      {showAll && messageTypes.filter((m) => !m.star).map((message) => (
        <Label
          key={message.value}
          as="a"
          onClick={() => onSelect(message.value)}
          color={selected === message.value ? "primary" : null}
        >
          {message.text}
        </Label>
      ))}
      {showAll && (
        <Label
          as="a"
          onClick={() => setShowAll(false)}
          basic
          primary
        >
          <Icon name="chevron left" />
          {"Hide extra"}
        </Label>
      )}
    </Label.Group>
  );
}

MessageTypeLabels.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selected: PropTypes.string,
};

MessageTypeLabels.defaultProps = {
  selected: "",
};

export default MessageTypeLabels;
