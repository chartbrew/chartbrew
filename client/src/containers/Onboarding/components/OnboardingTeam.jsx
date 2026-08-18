import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, Radio, RadioGroup, TextField,
} from "@heroui/react";

import { cn } from "../../../modules/utils";

const KNOWN_USE_CASES = new Set(["client", "internal", "embedded", "explore"]);
const radioCardClassName = cn(
  "m-0 inline-flex w-full max-w-full cursor-pointer items-center justify-start gap-2 rounded-lg border-2 border-transparent bg-content1 p-2",
  "hover:bg-content2 data-[selected=true]:border-primary",
);

function OnboardingTeam({
  isNewTeam = false,
  isPending = false,
  onCancel,
  onContinue = () => {},
  team = null,
  welcome = false,
}) {
  const [teamName, setTeamName] = useState(team?.name || "");
  const [selectedUse, setSelectedUse] = useState("");
  const [otherUse, setOtherUse] = useState("");

  useEffect(() => {
    if (team?.name) setTeamName(team.name);
    if (team?.useCases) {
      if (KNOWN_USE_CASES.has(team.useCases)) setSelectedUse(team.useCases);
      else {
        setSelectedUse("other");
        setOtherUse(team.useCases);
      }
    }
  }, [team]);

  const handleContinue = () => {
    onContinue({
      teamName: teamName.trim(),
      useCases: selectedUse === "other" ? otherUse.trim() : selectedUse,
    });
  };

  return (
    <div className="w-full max-w-xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">Step 1 of 2</div>
      <h1 className="mt-2 font-tw text-2xl font-bold">
        {welcome ? "Welcome to Chartbrew" : "Set up your team"}
      </h1>
      <div className="h-8" />

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

      <div className="h-8" />
      <div className="font-semibold">What will you use Chartbrew for?</div>
      <div className="h-2" />
      <RadioGroup
        name="onboarding-use-case"
        value={selectedUse}
        onChange={(value) => {
          setSelectedUse(value);
          if (value !== "other") setOtherUse("");
        }}
        aria-label="What will you use Chartbrew for?"
        className="flex w-full flex-col gap-2"
        variant="secondary"
      >
        <Radio value="client" className={radioCardClassName}>
          <Radio.Control><Radio.Indicator /></Radio.Control>
          <Radio.Content><Label>Client reporting</Label></Radio.Content>
        </Radio>
        <Radio value="internal" className={radioCardClassName}>
          <Radio.Control><Radio.Indicator /></Radio.Control>
          <Radio.Content><Label>Internal reporting</Label></Radio.Content>
        </Radio>
        <Radio value="embedded" className={radioCardClassName}>
          <Radio.Control><Radio.Indicator /></Radio.Control>
          <Radio.Content><Label>Embed charts in my website</Label></Radio.Content>
        </Radio>
        <Radio value="explore" className={radioCardClassName}>
          <Radio.Control><Radio.Indicator /></Radio.Control>
          <Radio.Content><Label>Explore data</Label></Radio.Content>
        </Radio>
        <Radio value="other" className={radioCardClassName}>
          <Radio.Control><Radio.Indicator /></Radio.Control>
          <Radio.Content><Label>Other</Label></Radio.Content>
        </Radio>
      </RadioGroup>

      {selectedUse === "other" ? (
        <Input
          className="mt-2"
          value={otherUse}
          onChange={(event) => setOtherUse(event.target.value)}
          placeholder="Enter your use case"
          fullWidth
          size="lg"
          variant="secondary"
        />
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-2">
        {isNewTeam && onCancel ? (
          <Button onPress={onCancel} variant="ghost">Cancel</Button>
        ) : null}
        <Button
          color="primary"
          size="lg"
          onPress={handleContinue}
          isPending={isPending}
          isDisabled={!teamName.trim() || !selectedUse
            || (selectedUse === "other" && !otherUse.trim())}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

OnboardingTeam.propTypes = {
  isNewTeam: PropTypes.bool,
  isPending: PropTypes.bool,
  onCancel: PropTypes.func,
  onContinue: PropTypes.func,
  team: PropTypes.object,
  welcome: PropTypes.bool,
};

export default OnboardingTeam;
