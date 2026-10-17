import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, ProgressBar, TextField,
} from "@heroui/react";

import { getBusinessProfileReview, getOnboardingLoadingLabel } from "../onboardingState";

function OnboardingBusiness({
  error = "",
  initialProfile = null,
  isDiscovering = false,
  isPreparingReport = false,
  reportFailed = false,
  onCancel,
  onContinue = () => {},
  onDiscover = () => {},
}) {
  const [websiteUnavailable, setWebsiteUnavailable] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const loadingLabel = getOnboardingLoadingLabel(isPreparingReport, loadingSeconds);

  useEffect(() => {
    setLoadingSeconds(0);
    if (!isDiscovering) return undefined;
    const timer = setInterval(() => setLoadingSeconds((seconds) => seconds + 8), 8000);
    return () => clearInterval(timer);
  }, [isDiscovering, isPreparingReport]);
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.websiteUrl || "");

  useEffect(() => {
    if (initialProfile?.websiteUrl) setWebsiteUrl(initialProfile.websiteUrl);
  }, [initialProfile]);

  const discover = async () => {
    setWebsiteUnavailable(false);
    const profile = await onDiscover(websiteUrl);
    const review = getBusinessProfileReview(profile, websiteUrl);
    if (!review) {
      setWebsiteUnavailable(true);
      return;
    }
    onContinue(review);
  };

  return (
    <div className="w-full max-w-xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 1 of 5</div>
      <h1 className="mt-2 text-balance text-3xl font-bold">
        Add your business website
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        We will use it to fill in your team details.
      </p>

      <TextField isDisabled={isDiscovering} name="onboarding-business-website" className="mt-8 w-full gap-2">
        <Label className="font-semibold">Business website</Label>
        <Input
          autoFocus
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          placeholder="example.com"
          fullWidth
          size="lg"
          variant="secondary"
          onKeyDown={(event) => {
            if (event.key === "Enter" && websiteUrl.trim() && !isDiscovering) discover();
          }}
        />
      </TextField>
      {isDiscovering ? (
        <div className="mt-6 rounded-2xl bg-surface-secondary p-5">
          <p className="mb-3 text-sm font-medium" role="status">
            <span key={loadingLabel} className="onboarding-loading-message">{loadingLabel}</span>
          </p>
          <ProgressBar isIndeterminate aria-label={loadingLabel}>
            <ProgressBar.Track>
              <ProgressBar.Fill className="motion-reduce:animate-none" />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      ) : null}
      {websiteUnavailable ? (
        <p className="mt-3 text-sm text-muted" role="status">
          We could not contact your website. You can enter your business details manually.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onCancel ? (
          <Button isDisabled={isDiscovering} onPress={onCancel} variant="outline">Cancel</Button>
        ) : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            isDisabled={isDiscovering}
            onPress={websiteUnavailable ? discover : () => onContinue(reportFailed ? initialProfile : null, reportFailed)}
            variant="tertiary"
          >
            {websiteUnavailable ? "Try again" : reportFailed ? "Continue with these details" : "Skip for now"}
          </Button>
          <Button
            variant="primary"
            onPress={websiteUnavailable
              ? () => onContinue(getBusinessProfileReview({}, websiteUrl), true)
              : discover}
            isPending={isDiscovering}
            isDisabled={(!websiteUnavailable && !websiteUrl.trim()) || isDiscovering}
          >
            {isDiscovering ? "Preparing" : websiteUnavailable ? "Enter details manually" : reportFailed ? "Try again" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

OnboardingBusiness.propTypes = {
  error: PropTypes.string,
  initialProfile: PropTypes.object,
  isDiscovering: PropTypes.bool,
  isPreparingReport: PropTypes.bool,
  reportFailed: PropTypes.bool,
  onCancel: PropTypes.func,
  onContinue: PropTypes.func,
  onDiscover: PropTypes.func,
};

export default OnboardingBusiness;
