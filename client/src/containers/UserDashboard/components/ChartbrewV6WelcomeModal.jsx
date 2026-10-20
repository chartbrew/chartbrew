import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Modal } from "@heroui/react";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";
import toast from "react-hot-toast";

import { completeTutorial } from "../../../slices/user";
import { selectTeam } from "../../../slices/team";
import {
  CHARTBREW_V6_WELCOME_TUTORIAL, shouldShowChartbrewV6Welcome,
} from "./chartbrewV6Welcome";
import studioImage from "../../../assets/v6/studio.jpg";
import activityImage from "../../../assets/v6/activity.jpg";
import mapsImage from "../../../assets/v6/maps.jpg";
import reportsImage from "../../../assets/v6/reports.jpg";
import mcpImage from "../../../assets/v6/mcp.jpg";
import overviewImage from "../../../assets/v6/overview.jpg";
import overviewVideo from "../../../assets/v6/overview.mp4";

const steps = [{
  label: "Meet v6",
  title: "A new chapter for your data",
  description: "Build with AI, follow the metrics that matter, and share reports that feel like yours. See what is new in this 52-second tour.",
  video: overviewVideo,
  image: overviewImage,
  alt: "Chartbrew v6 video overview",
}, {
  label: "Chart Studio",
  title: "From a question to a finished chart",
  description: "Ask AI to build or change a chart. Refine it with a live preview, inspect the data, and restore an earlier version from History.",
  image: studioImage,
  alt: "Chart Studio showing an AI conversation, the chart data, and saved history",
}, {
  label: "Watched metrics",
  title: "Keep track of what changed",
  description: "Watch key metrics, compare reporting periods, and review changes from Home and Activity. Schedule KPI reviews to bring the updates to your inbox.",
  image: activityImage,
  alt: "A scheduled daily KPI email with changes in trials, revenue, and trial conversion",
}, {
  label: "Maps & charts",
  title: "See your data from a new angle",
  description: "Plot values on geographic maps or compare numbers in scatter charts. Updated charts bring clearer labels, tooltips, and layouts across screen sizes.",
  image: mapsImage,
  alt: "An illustrated world map showing example values across countries",
}, {
  label: "MCP connections",
  title: "Your data, in your AI assistant",
  description: "Use Chartbrew from Claude, ChatGPT, or another MCP-compatible app. You can also connect external MCP services to give the Chartbrew assistant more context.",
  image: mcpImage,
  alt: "An AI app using the Chartbrew MCP server to review changes in dashboard metrics",
}, {
  label: "Report themes",
  title: "Make every report your own",
  description: "Choose from six report themes in light and dark, or save your own preset for the team. Copy or download chart images for updates without making your charts public.",
  image: reportsImage,
  alt: "The same report in Chartbrew, Neutral, Forest, Ocean, Rose, and Citrus themes",
}];

function ChartbrewV6WelcomeModal() {
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const user = useSelector((state) => state.user);
  const team = useSelector(selectTeam);
  const dispatch = useDispatch();
  const activeStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const isOpen = !dismissed && !user.loading && shouldShowChartbrewV6Welcome(user.data, team);

  const onClose = () => {
    if (dismissed) return;

    setDismissed(true);
    dispatch(completeTutorial({
      user_id: user.data.id,
      tutorial: { [CHARTBREW_V6_WELCOME_TUTORIAL]: true },
    })).unwrap().catch(() => {
      toast.error("Could not save your preference. This tour may appear again when you sign in.");
    });
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      isDismissable={false}
      isKeyboardDismissDisabled={false}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="overflow-hidden rounded-3xl p-0 sm:max-w-4xl">
          <Modal.CloseTrigger aria-label="Close the v6 tour" className="z-10 bg-surface text-foreground" />
          <Modal.Heading className="sr-only">What&apos;s new in Chartbrew v6</Modal.Heading>
          <Modal.Body className="flex flex-col gap-6 p-0">
            <div className="aspect-video shrink-0 overflow-hidden bg-background">
              {activeStep.video ? (
                <video
                  controls
                  playsInline
                  preload="none"
                  poster={activeStep.image}
                  src={activeStep.video}
                  aria-label={activeStep.alt}
                  className="h-full w-full bg-[#101010] object-contain"
                />
              ) : (
                <img
                  key={activeStep.image}
                  src={activeStep.image}
                  alt={activeStep.alt}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-3 px-6 sm:px-8">
              <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{activeStep.title}</h2>
              <p className="text-base leading-7 text-muted">{activeStep.description}</p>
            </div>
          </Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-5 sm:px-8">
            <nav aria-label="Tour steps" className="flex items-center">
              {steps.map((step, index) => (
                <Button
                  key={step.label}
                  isIconOnly
                  variant="ghost"
                  aria-label={`Step ${index + 1}: ${step.label}`}
                  aria-current={index === stepIndex ? "step" : undefined}
                  onPress={() => setStepIndex(index)}
                  className={`h-11 min-w-0 px-2 ${index === stepIndex ? "w-14" : "w-8"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-3 rounded-full transition-[width,background-color] motion-reduce:transition-none ${index === stepIndex ? "w-10 bg-foreground" : "w-3 bg-foreground/25"}`}
                  />
                </Button>
              ))}
            </nav>
            <div className="flex gap-2">
              <Button variant="tertiary" onPress={() => setStepIndex(stepIndex - 1)} isDisabled={stepIndex === 0}>
                <LuArrowLeft aria-hidden="true" />
                Back
              </Button>
              <Button onPress={isLastStep ? onClose : () => setStepIndex(stepIndex + 1)}>
                {isLastStep ? "Get started" : "Next"}
                <LuArrowRight aria-hidden="true" />
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export default ChartbrewV6WelcomeModal;
