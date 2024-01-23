import React, { useEffect } from "react";
import Joyride, { ACTIONS, EVENTS, STATUS } from "react-joyride";
import PropTypes from "prop-types";
import { Button, Spacer, semanticColors } from "@nextui-org/react";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

import Segment from "./Segment";
import Row from "./Row";
import useThemeDetector from "../modules/useThemeDetector";
import { useDispatch, useSelector } from "react-redux";
import { selectUser, updateUser } from "../slices/user";

export const configs = {
  dashboard: [
    {
      id: "connections",
      target: ".connection-tutorial",
      title: "Data sources connections",
      content: "Here, you link your various data sources. It's a crucial step to set up before diving into creating datasets. Without establishing connections, there's no data to visualize. Think of it as laying the foundation for your data-driven insights.",
      showProgress: false,
    },
    {
      id: "datasets",
      target: ".dataset-tutorial",
      title: "Manage your datasets",
      content: "Your data, organized and ready for action. This is where you create and manage datasets to bring your data to life in dashboards. Crafted for flexibility, these datasets can be used across multiple dashboards or merged for comprehensive chart displays. It's all about transforming your data into visual stories.",
      showProgress: false,
    },
    {
      id: "create-dashboards",
      target: ".create-dashboard-tutorial",
      title: "Create dashboards",
      content: "Create dashboards where you can visualize your datasets. You can invite your team and clients to see and edit these dashboards."
    },
    {
      id: "team-settings",
      target: ".team-settings-tutorial",
      title: "Manage your team",
      content: "Adjust your team settings from here and invite your team members or clients to collaborate. You can adjust the permissions of each member to control what dashboards they can see and edit.",
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
  <Segment className="bg-content1 max-w-[500px]" {...tooltipProps}>
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
  const [currentStep, setCurrentStep] = React.useState(0);
  const [tutorial, setTutorial] = React.useState(configs[currentPage]);

  const theme = useThemeDetector() ? "dark" : "light";
  const user = useSelector(selectUser);

  const dispatch = useDispatch();
  const initRef = React.useRef(null);

  useEffect(() => {
    if (user?.tutorials?.[currentPage] && !initRef.current) {
      initRef.current = true;
      setTutorial(configs[currentPage].slice(user.tutorials[currentPage]));
    } else if (user?.id && !user?.tutorials?.[currentPage] && !initRef.current) {
      initRef.current = true;
    }
  }, [user]);

  if (!tutorial || !initRef.current) return null;

  const _onCallback = (data) => {
    const { status, type, index, action } = data;

    if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
      // Update state to advance the tour
      setCurrentStep(index + (action === ACTIONS.PREV ? -1 : 1));

      const newTutorials = { ...user.tutorials };
      newTutorials[currentPage] = index + (action === ACTIONS.PREV ? -1 : 1);

      dispatch(updateUser({ user_id: user.id, data: { tutorials: newTutorials } }));
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      const newTutorials = { ...user.tutorials };
      newTutorials[currentPage] = configs[currentPage].length;

      dispatch(updateUser({ user_id: user.id, data: { tutorials: newTutorials }}));
    }
  };

  return (
    <Joyride
      steps={tutorial}
      stepIndex={currentStep}
      tooltipComponent={Tooltip}
      continuous={true}
      callback={_onCallback}
      styles={{
        options: {
          beaconSize: 30,
        },
        beaconInner: {
          backgroundColor: semanticColors[theme].primary.DEFAULT,
        },
        beaconOuter: {
          backgroundColor: "transparent",
          border: `2px solid ${semanticColors[theme].primary.DEFAULT}`,
        },
      }}
    />
  );
}

Tutorials.propTypes = {
  currentPage: PropTypes.string.isRequired,
};

export default Tutorials
