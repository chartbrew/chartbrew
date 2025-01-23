import React from "react";
import PropTypes from "prop-types";
import {
  Link, Spacer,
} from "@heroui/react";

import Row from "./Row";
import Text from "./Text";

function Callout({
  title, text, actionUrl, actionText,
}) {

  return (
    <blockquote className="border px-4 my-6 py-3 rounded-xl [&>p]:m-0 border-default-200 dark:border-default-100 bg-default-200/20">
      {title && (
        <Row>
          <Text size="h4">
            {title}
          </Text>
        </Row>
      )}
      {text && (
        <Row>
          <Text>
            {text}
          </Text>
        </Row>
      )}
      {actionUrl && actionText && (
        <>
          <Spacer y={0.5} />
          <Row>
            <Text variant={"b"}>
              <Link href={actionUrl} target="_blank" rel="noopener noreferrer">
                {actionText}
              </Link>
            </Text>
          </Row>
        </>
      )}
    </blockquote>
  );
}

Callout.propTypes = {
  title: PropTypes.string,
  text: PropTypes.string,
  actionUrl: PropTypes.string,
  actionText: PropTypes.string,
  color: PropTypes.oneOf(["primary", "secondary", "success", "error", "warning"]),
};

Callout.defaultProps = {
  title: "",
  text: "",
  actionUrl: "",
  actionText: "",
  color: "primary",
};

export default Callout;
