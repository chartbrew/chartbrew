import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Description, Modal, Switch } from "@heroui/react";
import { LuArrowLeft, LuArrowRight, LuPlay } from "react-icons/lu";
import toast from "react-hot-toast";

import { completeTutorial } from "../../../slices/user";
import { selectTeam, updateTeam } from "../../../slices/team";
import {
  CHARTBREW_V6_WELCOME_TUTORIAL, shouldShowChartbrewV6Welcome,
} from "./chartbrewV6Welcome";
import { TEAM_AI_TOOLTIP } from "../../Ai/aiEnablementCopy";
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
  description: "Build with AI, follow the metrics that matter, and share reports that feel like yours. See what's new in the launch video.",
  video: overviewVideo,
  image: overviewImage,
  alt: "Chartbrew v6 video overview",
}, {
  label: "Report themes",
  title: "Make every report your own",
  description: "Choose from six report themes in light and dark, or save your own preset for the team. Copy or download chart images for updates without making your charts public.",
  image: reportsImage,
  alt: "The same report in Chartbrew, Neutral, Forest, Ocean, Rose, and Citrus themes",
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
  label: "Chart Studio",
  title: "From a question to a finished chart",
  description: "Ask AI to build or change a chart. Refine it with a live preview, inspect the data, and restore an earlier version from History.",
  image: studioImage,
  alt: "Chart Studio showing an AI conversation, the chart data, and saved history",
}];

function ChartbrewV6WelcomeModal() {
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const videoRef = useRef(null);
  const user = useSelector((state) => state.user);
  const team = useSelector(selectTeam);
  const dispatch = useDispatch();
  const canManageAi = team?.TeamRoles?.some((member) => (
    member.user_id === user.data?.id && ["teamOwner", "teamAdmin"].includes(member.role)
  ));
  const showAiSettings = canManageAi && (team.aiEnabled === false || team.aiSuggestionsEnabled === false);
  const tourSteps = showAiSettings ? [...steps, {
    label: "AI settings",
    title: "Choose how your team uses AI",
    description: "Use AI to build charts, explore your data, and find useful next steps.",
    settings: true,
  }] : steps;
  const activeStep = tourSteps[Math.min(stepIndex, tourSteps.length - 1)];
  const isLastStep = stepIndex >= tourSteps.length - 1;
  const isOpen = !dismissed && !user.loading && shouldShowChartbrewV6Welcome(user.data, team);

  const changeStep = (index) => {
    if (index === stepIndex) return;

    setIsVideoPlaying(false);
    setStepIndex(index);
  };

  const playVideo = () => {
    videoRef.current?.play().catch((error) => {
      if (error.name !== "AbortError") {
        toast.error("Could not play the video. Please try again.");
      }
    });
  };

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

  const getStarted = async () => {
    if (isSaving) return;
    if (!showAiSettings) {
      onClose();
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      await dispatch(updateTeam({
        team_id: team.id,
        data: { aiEnabled, aiSuggestionsEnabled },
      })).unwrap();
      onClose();
    } catch {
      setSaveError("Could not save your AI settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
            {!activeStep.settings && (
              <div className="relative aspect-video shrink-0 overflow-hidden bg-background">
                {activeStep.video ? (
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="none"
                    poster={activeStep.image}
                    src={activeStep.video}
                    aria-label={activeStep.alt}
                    className="h-full w-full bg-[#101010] object-contain"
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onEnded={() => setIsVideoPlaying(false)}
                  />
                ) : (
                  <img
                    key={activeStep.image}
                    src={activeStep.image}
                    alt={activeStep.alt}
                    className="h-full w-full object-contain"
                  />
              )}
              {activeStep.video && !isVideoPlaying && (
                <Button
                  isIconOnly
                  aria-label="Play the v6 video"
                  onPress={playVideo}
                  className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white text-black shadow-lg hover:bg-white/90 sm:h-24 sm:w-24"
                >
                  <LuPlay aria-hidden="true" className="ml-1 size-9 fill-current sm:size-10" />
                </Button>
              )}
            </div>
            )}
            <div aria-live="polite" aria-atomic="true" className={`flex flex-col gap-3 px-6 sm:px-8 ${activeStep.settings ? "pt-10" : ""}`}>
              <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{activeStep.title}</h2>
              <p className="text-base leading-7 text-muted">{activeStep.description}</p>
            </div>
            {activeStep.settings && (
              <div className="flex flex-col gap-6 px-6 sm:px-8">
                <Switch isSelected={aiEnabled} onChange={setAiEnabled} isDisabled={isSaving}>
                  <Switch.Content>
                    <Switch.Control className="[--switch-control-bg:var(--surface-secondary)]">
                      <Switch.Thumb />
                    </Switch.Control>
                    Enable Chartbrew AI
                  </Switch.Content>
                  <Description>Ask questions about your data and create or change charts.</Description>
                </Switch>
                <Switch isSelected={aiSuggestionsEnabled} onChange={setAiSuggestionsEnabled} isDisabled={isSaving}>
                  <Switch.Content>
                    <Switch.Control className="[--switch-control-bg:var(--surface-secondary)]">
                      <Switch.Thumb />
                    </Switch.Control>
                    Personalized suggestions
                  </Switch.Content>
                  <Description>Suggest questions from each member&apos;s recent work and permitted AI memories. Requires Chartbrew AI.</Description>
                </Switch>
                <p className="text-sm leading-6 text-muted">{TEAM_AI_TOOLTIP}</p>
                {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-5 sm:px-8">
            <nav aria-label="Tour steps" className="flex items-center">
              {tourSteps.map((step, index) => (
                <Button
                  key={step.label}
                  isIconOnly
                  isDisabled={isSaving}
                  variant="ghost"
                  aria-label={`Step ${index + 1}: ${step.label}`}
                  aria-current={index === stepIndex ? "step" : undefined}
                  onPress={() => changeStep(index)}
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
              <Button variant="tertiary" onPress={() => changeStep(stepIndex - 1)} isDisabled={isSaving || stepIndex === 0}>
                <LuArrowLeft aria-hidden="true" />
                Back
              </Button>
              <Button isPending={isSaving} onPress={isLastStep ? getStarted : () => changeStep(stepIndex + 1)}>
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
