import React from "react";
import Joyride, { STATUS } from "react-joyride";
import PropTypes from "prop-types";
import { Button, Spacer } from "@nextui-org/react";

import Segment from "./Segment";
import Row from "./Row";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

export const configs = {
  dashboard: [
    {
      id: "dashboard-welcome",
      target: ".dashboard",
      title: "Welcome!",
      content: "Welcome to the dashboard! This is a longer message to test the wrapping of the text. This is a longer message to test the wrapping of the text. This is a longer message to test the wrapping of the text. This is a longer message to test the wrapping of the text.",
      disableBeacon: true,
      placement: "center",
      showProgress: false,
    }
  ],
};

const Tooltip = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
}) => (
  <Segment className="bg-content1 dark:bg-content3" {...tooltipProps}>
    {step.title && (
      <>
        <Row>
          <span className="text-lg font-medium">{step.title}</span>
        </Row>
        <Spacer y={4} />
      </>
    )}
    <div>
      {step.content}
    </div>
    <Spacer y={4} />
    <div className="flex justify-end items-center gap-1">
      {index > 0 && (
        <Button {...backProps} startContent={<LuArrowLeft />} variant="bordered" size="sm">
          <span id="back">
            Back
          </span>
        </Button>
      )}
      {continuous && (
        <Button {...primaryProps} endContent={<LuArrowRight />} color="primary" size="sm">
          <span id="next" >
            Next
          </span>
        </Button>
      )}
      {!continuous && (
        <Button {...closeProps} color="primary" size="sm">
          <span id="close">
            Close
          </span>
        </Button>
      )}
    </div>
  </Segment>
);

Tooltip.propTypes = {
  continuous: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
  step: PropTypes.object.isRequired,
  backProps: PropTypes.object.isRequired,
  closeProps: PropTypes.object.isRequired,
  primaryProps: PropTypes.object.isRequired,
  tooltipProps: PropTypes.object.isRequired,
};

function Tutorials({ currentPage }) {
  if (!configs[currentPage]) return null;

  const _onCallback = (data) => {
    const { status } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      //
    }
  };

  return (
    <Joyride
      steps={configs[currentPage]}
      tooltipComponent={Tooltip}
      continuous={true}
      callback={_onCallback}
    />
  );
}

Tutorials.propTypes = {
  currentPage: PropTypes.string.isRequired,
};

export default Tutorials
