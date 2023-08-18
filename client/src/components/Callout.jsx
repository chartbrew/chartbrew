import React from "react";
import PropTypes from "prop-types";
import {
  Container, Link, Row, Spacer, Text, useTheme,
} from "@nextui-org/react";

function Callout({
  title, text, actionUrl, color, actionText,
}) {
  const { isDark } = useTheme();

  let bgColor;
  switch (color) {
    case "primary":
      bgColor = isDark ? "$primaryContrast" : "$blue100";
      break;
    case "secondary":
      bgColor = isDark ? "$secondaryContrast" : "$orange100";
      break;
    case "success":
      bgColor = isDark ? "$successContrast" : "$green100";
      break;
    case "error":
      bgColor = isDark ? "$errorContrast" : "$red100";
      break;
    case "warning":
      bgColor = isDark ? "$warningContrast" : "$warningLight";
      break;
    default:
      bgColor = isDark ? "$primaryContrast" : "$blue100";
  }

  return (
    <Container css={{
      backgroundColor: bgColor, p: 10, br: "$sm", border: `2px solid $${color}Border`,
    }}>
      {title && (
        <Row>
          <Text h5>
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
            <Text b>
              <Link href={actionUrl} target="_blank" rel="noopener noreferrer">
                {actionText}
              </Link>
            </Text>
          </Row>
        </>
      )}
    </Container>
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
