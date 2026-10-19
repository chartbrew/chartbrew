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
import logo from "../../../assets/chartbrew-mark.svg";
import studioImage from "../../../assets/v6/studio.jpg";
import activityImage from "../../../assets/v6/activity.jpg";
import mapsImage from "../../../assets/v6/maps.jpg";
import reportsImage from "../../../assets/v6/reports.jpg";

const steps = [{
  label: "Chart Studio",
  title: "Meet your new Chart Studio",
  description: "Build and refine charts with a live preview, data, and settings in one place. Ask AI for help, continue a chart conversation, or restore an earlier version from History.",
  image: studioImage,
  alt: "Chart Studio with the chart assistant, live preview, and dataset settings",
}, {
  label: "Watched metrics",
  title: "Keep track of what changed",
  description: "Watch your key metrics and review changes from Home and Activity. Compare reporting periods, run KPI reviews, and receive scheduled email summaries.",
  image: activityImage,
  alt: "Activity showing metric changes and links to watched metrics and KPI reviews",
}, {
  label: "Maps & scatter charts",
  title: "See your data from a new angle",
  description: "Plot values on geographic maps or compare numbers in scatter charts. Updated charts bring clearer labels, tooltips, and layouts across screen sizes.",
  image: mapsImage,
  alt: "A geographic chart with countries shaded by number of visits",
}, {
  label: "Reports & sharing",
  title: "Make every report your own",
  description: "Choose a report theme or save a preset for your team. Copy or download chart images for presentations and updates, without making your charts public.",
  image: reportsImage,
  alt: "Report editor with six themes, color controls, and a dashboard preview",
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
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
          <Modal.CloseTrigger aria-label="Close the v6 tour" />
          <Modal.Header className="flex-row items-center gap-3 px-6 py-5 pr-12 sm:px-8 sm:pr-12">
            <img src={logo} alt="" className="size-8 shrink-0" />
            <Modal.Heading className="text-xl font-semibold">What&apos;s new in Chartbrew v6</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-6 px-6 pb-6 sm:px-8">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-border bg-background p-3 sm:p-4">
              <img
                src={activeStep.image}
                alt={activeStep.alt}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>
            <div aria-live="polite" aria-atomic="true" className="flex min-h-36 flex-col gap-3 sm:min-h-32">
              <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{activeStep.title}</h2>
              <p className="max-w-2xl text-base leading-7 text-muted">{activeStep.description}</p>
            </div>
            <nav aria-label="Tour steps" className="flex gap-2">
              {steps.map((step, index) => (
                <Button
                  key={step.label}
                  variant="ghost"
                  aria-label={`Step ${index + 1}: ${step.label}`}
                  aria-current={index === stepIndex ? "step" : undefined}
                  onPress={() => setStepIndex(index)}
                  className="h-8 min-w-0 flex-1 px-0"
                >
                  <span className={`h-1 w-full rounded-full ${index === stepIndex ? "bg-accent" : "bg-default"}`} />
                </Button>
              ))}
            </nav>
          </Modal.Body>
          <Modal.Footer className="flex items-center justify-between gap-2 border-t border-border px-6 py-4 sm:px-8">
            <span className="text-sm tabular-nums text-muted">{`${stepIndex + 1} of ${steps.length}`}</span>
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
