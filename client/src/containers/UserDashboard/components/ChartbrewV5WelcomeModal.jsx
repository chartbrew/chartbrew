import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Modal, ProgressBar,
} from "@heroui/react";
import {
  LuArrowLeft,
  LuArrowRight, LuChartNoAxesCombined, LuLayoutDashboard, LuAppWindow, LuTrendingUp,
} from "react-icons/lu";

import { completeTutorial } from "../../../slices/user";
import step1Image from "../../../assets/step1_v5.webp";
import step2Image from "../../../assets/step2_v5.webp";
import step3Image from "../../../assets/step3_v5.webp";
import step4Image from "../../../assets/step4_v5.webp";

const CHARTBREW_V5_WELCOME_TUTORIAL = "chartbrewV5Welcome";
const CHARTBREW_V5_WELCOME_CUTOFF = "2026-04-07T15:00:00.000+03:00";

const chartbrewV5WelcomeSteps = [{
  eyebrow: "Chartbrew v5",
  title: "A complete UI overhaul",
  description: "Chartbrew v5 refreshes the entire app, especially improving the dashboard, chart editor, and dataset setup so the app feels cleaner, faster, and easier to scan.",
  icon: LuAppWindow,
  imageLabel: "UI overhaul image placeholder",
  image: step1Image,
  accentClassName: "from-cyan-500/20 via-emerald-400/10 to-transparent",
}, {
  eyebrow: "Build faster",
  title: "A clearer path from dataset to chart",
  description: "The chart creation flow now makes it easier to pick a dataset, configure the display, and land the chart in a dashboard. The metrics and dimensions can now be set in the editor.",
  icon: LuChartNoAxesCombined,
  imageLabel: "Dataset to chart flow image placeholder",
  image: step2Image,
  accentClassName: "from-amber-500/20 via-orange-400/10 to-transparent",
}, {
  eyebrow: "Less setup noise",
  title: "Simpler dataset query editing",
  description: "Datasets are trully re-usable now! Datasets will only hold information about the query, data requests, and joins. The visualization layer is completely decoupled and held by the chart settings now.",
  icon: LuLayoutDashboard,
  imageLabel: "Dataset setup image placeholder",
  image: step3Image,
  accentClassName: "from-sky-500/20 via-indigo-400/10 to-transparent",
}, {
  eyebrow: "More context",
  title: "Better dashboard insights",
  description: "Dashboard and dataset cards now show more useful update information, plus a new area for features, tips, and tutorials. This is only the beginning, expect lots of new improvements soon!",
  icon: LuTrendingUp,
  imageLabel: "Dashboard insights image placeholder",
  image: step4Image,
  accentClassName: "from-lime-500/20 via-teal-400/10 to-transparent",
}];

function shouldShowChartbrewV5Welcome(userData) {
  if (!userData?.id || userData?.tutorials?.[CHARTBREW_V5_WELCOME_TUTORIAL]) {
    return false;
  }

  const createdAt = Date.parse(userData.createdAt);
  const cutoff = Date.parse(CHARTBREW_V5_WELCOME_CUTOFF);
  if (!Number.isFinite(createdAt) || !Number.isFinite(cutoff)) {
    return false;
  }

  return createdAt < cutoff;
}

function ChartbrewV5WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const dismissedRef = useRef(false);
  const user = useSelector((state) => state.user);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!dismissedRef.current && !user.loading && shouldShowChartbrewV5Welcome(user.data)) {
      setIsOpen(true);
    }
  }, [user]);

  const activeStep = chartbrewV5WelcomeSteps[stepIndex];
  const ActiveIcon = activeStep.icon;
  const progress = ((stepIndex + 1) / chartbrewV5WelcomeSteps.length) * 100;

  const onClose = () => {
    if (dismissedRef.current) return;

    dismissedRef.current = true;
    setIsOpen(false);
    setStepIndex(0);

    if (!user.data?.tutorials?.[CHARTBREW_V5_WELCOME_TUTORIAL]) {
      dispatch(completeTutorial({
        user_id: user.data.id,
        tutorial: { [CHARTBREW_V5_WELCOME_TUTORIAL]: true },
      }));
    }
  };

  const onNext = () => {
    if (stepIndex >= chartbrewV5WelcomeSteps.length - 1) {
      onClose();
      return;
    }

    setStepIndex(stepIndex + 1);
  };

  const onPrevious = () => {
    if (stepIndex <= 0) {
      return;
    }

    setStepIndex(stepIndex - 1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal.Backdrop isDismissable={false}>
        <Modal.Container size="lg">
          <Modal.Dialog className="relative overflow-hidden sm:max-w-2xl">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b ${activeStep.accentClassName}`} />
            <Modal.Header className="relative flex flex-col gap-2 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-surface opacity-90 text-foreground shadow-sm">
                  <ActiveIcon size={24} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground-500">
                    {activeStep.eyebrow}
                  </div>
                  <Modal.Heading className="text-2xl font-semibold font-tw">
                    {activeStep.title}
                  </Modal.Heading>
                </div>
              </div>
            </Modal.Header>
            <Modal.Body className="relative flex flex-col gap-5 px-6 pb-3">
              <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl shadow-lg bg-content1/70">
                <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${activeStep.accentClassName}`} />
                <div className="relative flex flex-col items-center gap-3 text-center text-foreground-500">
                  <img src={activeStep.image} alt={activeStep.imageLabel} className="w-full h-full object-contain" />
                </div>
              </div>

              <p className="max-w-xl text-base leading-7 text-foreground-600">
                {activeStep.description}
              </p>

              <ProgressBar
                aria-label="Chartbrew v5 welcome progress"
                value={progress}
                className="w-full"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </Modal.Body>
            <Modal.Footer className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted">
                {`Step ${stepIndex + 1} of ${chartbrewV5WelcomeSteps.length}`}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="tertiary" onPress={onClose}>
                  Close
                </Button>
                <Button onPress={onPrevious} isIconOnly isDisabled={stepIndex <= 0}>
                  <LuArrowLeft />
                </Button>
                <Button onPress={onNext}>
                  {stepIndex === chartbrewV5WelcomeSteps.length - 1 ? "Start using v5" : "Next"}
                  <LuArrowRight />
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ChartbrewV5WelcomeModal;
