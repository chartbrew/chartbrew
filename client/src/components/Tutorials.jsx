import React, { useEffect } from "react";
import Joyride, { ACTIONS, EVENTS, STATUS } from "react-joyride";
import PropTypes from "prop-types";
import { Button, Spacer, semanticColors } from "@heroui/react";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

import Segment from "./Segment";
import Row from "./Row";
import { useTheme } from "../modules/useTheme";
import { useDispatch, useSelector } from "react-redux";
import { selectUser, updateUser } from "../slices/user";

export const configs = {
  home: [
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
  dashboard: [
    {
      id: "dashboard",
      target: ".dashboard-tutorial",
      title: "Dashboards: Your canvas for insights",
      content: "This is where your data takes visual form. Arrange and display your charts here to tell the story hidden in your numbers.",
      placementBeacon: "top",
    },
    {
      id: "create-chart",
      target: ".create-chart-tutorial",
      title: "Create visualizations",
      content: "Tap to start crafting new charts and data visuals that make your data speak volumes."
    },
    {
      id: "chart-settings",
      target: ".chart-settings-tutorial",
      title: "Chart settings",
      content: "Tailor your chart to perfection. Here, you can set auto-updates, embed options, configure alerts, and add your chart to reports. Customize to suit your needs."
    },
    {
      id: "dashboard-report",
      target: ".dashboard-report-tutorial",
      title: "Dashboard reports",
      content: "This space lets you add charts, tweak text and colors, and brand your report. Perfect for presenting insights to stakeholders."
    },
    {
      id: "dashboard-settings",
      target: ".dashboard-settings-tutorial",
      title: "Dashboard settings",
      content: "Here, you can rename your dashboard and set the preferred timezone. Customize to align with your project's context.",
    },
    {
      id: "dashboard-template",
      target: ".dashboard-template-tutorial",
      title: "Dashboard templates",
      content: "Streamline your workflow. Use this function to turn your dashboard into a reusable template, enabling quick replication for consistent reporting."
    },
    {
      id: "dashboard-export",
      target: ".dashboard-export-tutorial",
      title: "Export dashboard to Excel",
      content: "Export your dashboard to Excel for further analysis or to share with stakeholders."
    },
    {
      id: "dashboard-layout",
      target: ".dashboard-layout-tutorial",
      title: "Change your dashboard layout",
      content: "This mode allows you to modify the dashboard layout. Tailor the arrangement to best showcase your data insights."
    }
  ],
  chart_empty: [
    {
      id: "chart-empty-filter",
      target: ".chart-empty-filter-tutorial",
      title: "Find your datasets",
      content: "Toggle between datasets tagged with this project or view All. Select the data that best fits your chart's narrative.",
      placement: "left-start",
    },
    {
      id: "chart-empty-select",
      target: ".chart-empty-select-tutorial",
      title: "Select your dataset",
      content: "Begin your visualization journey here. Click on a dataset to start creating your chart and bringing your data to life.",
    }
  ],
  chart_cdc: [
    {
      id: "chart-cdc-formula",
      target: ".chart-cdc-formula",
      title: "Formula",
      content: "You can configure simple formulas to format the final numbers you get on the chart. Tap on the field to see some examples."
    },
    {
      id: "chart-cdc-goal",
      target: ".chart-cdc-goal",
      title: "Set a goal",
      content: "Goals only work with single value charts and can show a progress bar with where you are in relation to your goal."
    },
    {
      id: "chart-cdc-alert",
      target: ".chart-cdc-alert",
      title: "Get notified",
      content: "Set up alerts to get notified when your data reaches a certain threshold or there is an anomaly in your data. You can configure alerts to be sent to your email or Slack."
    },
    {
      id: "chart-cdc-colors",
      target: ".chart-cdc-colors",
      title: "Change the appearance",
      content: "Customize the colors of your chart to match your brand or project's theme."
    },
    {
      id: "chart-cdc-add",
      target: ".chart-cdc-add",
      title: "Add more datasets",
      content: "You can add more datasets to your chart to create more complex visualizations."
    },
  ],
  chart_preview: [
    {
      id: "chart-preview-types",
      target: ".chart-preview-types",
      title: "Select a chart type",
      content: "Choose from various chart types like bar, line, pie, etc., to best represent your data. Each type offers a unique perspective, so pick the one that aligns with your visualization goals."
    },
    {
      id: "chart-preview-growth",
      target: ".chart-preview-growth",
      title: "Show growth",
      content: "Use these checkboxes to highlight growth trends in your data, providing a clear view of increases or decreases over time.",
    },
  ],
  chart_settings: [
    {
      id: "chart-settings-dates",
      target: ".chart-settings-dates",
      title: "Date range filters",
      content: "Use these filters to select the date range you want to visualize. The date range requires you to have a Date Field selected in the dataset configuration.",
    },
    {
      id: "chart-settings-relative",
      target: ".chart-settings-relative",
      title: "Relative to present",
      content: "Toggle the auto-update checkbox to make the date range relative to the present date. This means that you don't have to manually update the range every time you want to see the latest data.",
    },
    {
      id: "chart-settings-interval",
      target: ".chart-settings-interval",
      title: "Date interval",
      content: "This option lets you choose the granularity of your data. For example, if you have daily data, you can choose to see it by day, month, or year.",
    },
  ]
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
  <Segment className="bg-content1 max-w-[500px] z-50" {...tooltipProps}>
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

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
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

  if (!tutorial || !initRef.current) return null;

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
