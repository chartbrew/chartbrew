import React from "react";
import PropTypes from "prop-types";
import { Button, Description, Switch } from "@heroui/react";

import { AI_DATA_DISCLOSURE } from "../../Ai/aiEnablementCopy";
import useAiAvailability from "../../Ai/hooks/useAiAvailability";

function OnboardingAi({
  error = "",
  isPending = false,
  onBack,
  onChange,
  onContinue,
  settings,
  teamId,
}) {
  const { availability } = useAiAvailability({ teamId });

  return (
    <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 3 of 5</div>
      <h1 className="mt-2 text-balance text-3xl font-bold">Choose your AI settings</h1>

      <div className="mt-8">
        <Switch
          id="onboarding-ai-enabled"
          isDisabled={isPending}
          isSelected={settings.aiEnabled}
          onChange={(aiEnabled) => onChange({ ...settings, aiEnabled })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="font-semibold">Enable Chartbrew AI</span>
          </Switch.Content>
          <Description className="mt-2 text-sm leading-6 text-muted">
            Ask questions about your data, create charts, and explore changes.
          </Description>
        </Switch>
        {availability?.disabledBy === "platform" ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            AI is off for this platform. Your choice will apply when a platform administrator enables it.
          </p>
        ) : null}
      </div>

      <section className="mt-6 space-y-2 text-sm leading-6" aria-labelledby="onboarding-ai-data-heading">
        <h2 className="font-semibold" id="onboarding-ai-data-heading">{AI_DATA_DISCLOSURE.title}</h2>
        <p className="text-muted">{AI_DATA_DISCLOSURE.details}</p>
        <p className="text-muted">{AI_DATA_DISCLOSURE.permissions}</p>
        <p>{AI_DATA_DISCLOSURE.guidance}</p>
      </section>

      <div className="mt-6 border-t border-divider pt-6">
        <Switch
          id="onboarding-ai-suggestions"
          isDisabled={isPending || !settings.aiEnabled}
          isSelected={settings.aiEnabled && settings.aiSuggestionsEnabled}
          onChange={(aiSuggestionsEnabled) => onChange({ ...settings, aiSuggestionsEnabled })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="font-semibold">Personalized suggestions</span>
          </Switch.Content>
          <Description className="mt-2 text-sm leading-6 text-muted">
            Suggest questions on Home from each member&apos;s recent work and saved AI memories they can access.
          </Description>
        </Switch>
        {!settings.aiEnabled ? (
          <p className="mt-2 text-sm text-muted">Enable Chartbrew AI to use personalized suggestions.</p>
        ) : null}
      </div>

      <p className="mt-6 text-sm text-muted">You can change these choices later in AI settings.</p>
      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="mt-8 flex items-center justify-between gap-2">
        <Button isDisabled={isPending} onPress={onBack} variant="outline">Back</Button>
        <Button isPending={isPending} onPress={onContinue} size="lg" variant="primary">
          Continue
        </Button>
      </div>
    </div>
  );
}

OnboardingAi.propTypes = {
  error: PropTypes.string,
  isPending: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  settings: PropTypes.shape({
    aiEnabled: PropTypes.bool.isRequired,
    aiSuggestionsEnabled: PropTypes.bool.isRequired,
  }).isRequired,
  teamId: PropTypes.number,
};

export default OnboardingAi;
