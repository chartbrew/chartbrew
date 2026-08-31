import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion, Button, Input, Label, Radio, RadioGroup, TextArea, TextField,
} from "@heroui/react";

import BusinessLogoEditor from "../../../components/BusinessLogoEditor";
import { cn } from "../../../modules/utils";
import { getBusinessProfileLogo } from "../../../slices/team";
import {
  buildBusinessProfile,
  getSuggestedTeamName,
  hasBusinessProfileDetails,
} from "../onboardingState";

const KNOWN_USE_CASES = new Set(["client", "internal", "embedded", "explore"]);
const USE_CASES = [
  { value: "client", label: "Client reporting" },
  { value: "internal", label: "Internal reporting" },
  { value: "embedded", label: "Embed charts in my website" },
  { value: "explore", label: "Explore data" },
  { value: "other", label: "Other" },
];

function shuffleUseCases(useCases) {
  const other = useCases.find((useCase) => useCase.value === "other");
  const rest = useCases.filter((useCase) => useCase.value !== "other");
  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = rest[index];
    rest[index] = rest[swapIndex];
    rest[swapIndex] = current;
  }
  return other ? [...rest, other] : rest;
}
const radioContentClassName = cn(
  "group flex w-full flex-row items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-foreground transition-colors duration-150",
  "border-divider bg-content2",
  "data-[hovered=true]:border-accent/40 data-[hovered=true]:bg-accent/5",
  "data-[selected=true]:border-accent data-[selected=true]:bg-accent/15 data-[selected=true]:text-accent",
  "data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent/35",
);
const radioControlClassName = cn(
  "size-5 shrink-0 rounded-full border border-border bg-default shadow-none",
  "group-data-[selected=true]:border-accent group-data-[selected=true]:bg-accent",
);
const radioIndicatorClassName = cn(
  "before:bg-transparent",
  "group-data-[selected=true]:before:scale-50 group-data-[selected=true]:before:bg-accent-foreground",
);

function OnboardingTeam({
  businessProfile = null,
  error = "",
  initialTeamDraft = null,
  isPending = false,
  onBack = () => {},
  onContinue = () => {},
  team = null,
}) {
  const initialUseCase = initialTeamDraft?.useCases || "";
  const [teamName, setTeamName] = useState(
    initialTeamDraft?.teamName || getSuggestedTeamName(businessProfile, team)
  );
  const [selectedUse, setSelectedUse] = useState(
    KNOWN_USE_CASES.has(initialUseCase) ? initialUseCase : initialUseCase ? "other" : ""
  );
  const [otherUse, setOtherUse] = useState(
    initialUseCase && !KNOWN_USE_CASES.has(initialUseCase) ? initialUseCase : ""
  );
  const [websiteUrl, setWebsiteUrl] = useState(businessProfile?.websiteUrl || "");
  const [description, setDescription] = useState(businessProfile?.description || "");
  const [logo, setLogo] = useState(
    Object.prototype.hasOwnProperty.call(businessProfile || {}, "logo")
      ? businessProfile.logo : undefined
  );
  const [savedLogoUrl, setSavedLogoUrl] = useState(null);
  const [showUseCaseError, setShowUseCaseError] = useState(false);
  const [useCases] = useState(() => shuffleUseCases(USE_CASES));
  const metadata = businessProfile?.metadata || {};

  useEffect(() => {
    if (!initialTeamDraft?.teamName) {
      if (businessProfile?.businessName) setTeamName(businessProfile.businessName);
      else if (team?.name) setTeamName(team.name);
    }
  }, [businessProfile?.businessName, initialTeamDraft?.teamName, team]);

  useEffect(() => {
    let active = true;
    setSavedLogoUrl(null);
    if (!team?.id || !businessProfile?.logoMimeType || logo === null) {
      return () => { active = false; };
    }
    getBusinessProfileLogo(team.id)
      .then((dataUrl) => {
        if (active) setSavedLogoUrl(dataUrl);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [businessProfile?.logoMimeType, logo, team?.id]);

  const getDraft = () => {
    const hasBusinessProfile = Boolean(
      businessProfile || websiteUrl.trim() || description.trim() || logo !== undefined
    );
    return {
      businessProfile: hasBusinessProfile ? buildBusinessProfile({
        businessName: teamName,
        description,
        logo,
        metadata,
        websiteUrl,
      }) : null,
      teamName: teamName.trim(),
      useCases: selectedUse === "other" ? otherUse.trim() : selectedUse,
    };
  };

  const handleContinue = () => {
    if (!selectedUse || (selectedUse === "other" && !otherUse.trim())) {
      setShowUseCaseError(true);
      return;
    }
    onContinue(getDraft());
  };

  return (
    <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 2 of 2</div>
      <h1 className="mt-2 text-balance font-tw text-3xl font-bold tracking-tight">
        Set up your team
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-end">
        <BusinessLogoEditor
          businessName={teamName}
          logo={logo}
          onChange={setLogo}
          savedLogoUrl={savedLogoUrl}
        />
        <TextField name="onboarding-team-name" className="w-full gap-2">
          <Label className="font-semibold">Team name</Label>
          <Input
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Enter your team name"
            fullWidth
            size="lg"
            variant="secondary"
          />
        </TextField>
      </div>

      <RadioGroup
        name="onboarding-use-case"
        value={selectedUse}
        onChange={(value) => {
          setSelectedUse(value);
          setShowUseCaseError(false);
          if (value !== "other") setOtherUse("");
        }}
        aria-invalid={showUseCaseError}
        className={cn(
          "mt-7 flex w-full flex-col gap-2 rounded-2xl **:data-[slot=radio]:mt-0",
          showUseCaseError && "ring-2 ring-danger/45"
        )}
        variant="secondary"
      >
        <Label className={cn("font-semibold", showUseCaseError && "text-danger")}>
          What will you use Chartbrew for?
        </Label>
        {useCases.map((useCase) => (
          <Radio key={useCase.value} value={useCase.value} className="m-0 w-full">
            <Radio.Content className={radioContentClassName}>
              <Radio.Control className={radioControlClassName}>
                <Radio.Indicator className={radioIndicatorClassName} />
              </Radio.Control>
              <span className="text-sm font-medium">{useCase.label}</span>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>

      {selectedUse === "other" ? (
        <Input
          className="mt-2"
          value={otherUse}
          onChange={(event) => {
            setOtherUse(event.target.value);
            setShowUseCaseError(false);
          }}
          placeholder="Enter your use case"
          fullWidth
          size="lg"
          variant="secondary"
        />
      ) : null}

      {showUseCaseError ? (
        <p className="mt-2 text-sm text-danger" role="alert">Choose a use case to continue.</p>
      ) : null}

      <Accordion
        aria-label="Business profile"
        className="mt-8 w-full bg-surface-secondary"
        defaultExpandedKeys={hasBusinessProfileDetails(businessProfile) ? ["business-profile"] : []}
        variant="surface"
      >
        <Accordion.Item id="business-profile" textValue="Business profile">
          <Accordion.Heading>
            <Accordion.Trigger>
              <span className="flex-1 text-start font-semibold">Business profile</span>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-5 pb-4">
              <TextField name="onboarding-business-website-review" className="w-full gap-2">
                <Label className="font-semibold">Business website</Label>
                <Input
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="example.com"
                  variant="secondary"
                />
              </TextField>
              <TextField name="onboarding-business-description" className="w-full gap-2">
                <Label className="font-semibold">Business description</Label>
                <TextArea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does your business do?"
                  rows={4}
                  variant="secondary"
                />
              </TextField>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}

      <div className="mt-8 flex items-center justify-between gap-2">
        <Button onPress={() => onBack(getDraft())} variant="outline">Back</Button>
        <Button
          variant="primary"
          size="lg"
          onPress={handleContinue}
          isPending={isPending}
          isDisabled={!teamName.trim()}
        >
          Start using Chartbrew
        </Button>
      </div>
    </div>
  );
}

OnboardingTeam.propTypes = {
  businessProfile: PropTypes.object,
  error: PropTypes.string,
  initialTeamDraft: PropTypes.object,
  isPending: PropTypes.bool,
  onBack: PropTypes.func,
  onContinue: PropTypes.func,
  team: PropTypes.object,
};

export default OnboardingTeam;
