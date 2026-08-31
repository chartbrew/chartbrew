import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, TextField,
} from "@heroui/react";

import { getBusinessProfileReview } from "../onboardingState";

function OnboardingBusiness({
  error = "",
  initialProfile = null,
  isDiscovering = false,
  onCancel,
  onContinue = () => {},
  onDiscover = () => {},
}) {
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.websiteUrl || "");

  useEffect(() => {
    if (initialProfile?.websiteUrl) setWebsiteUrl(initialProfile.websiteUrl);
  }, [initialProfile]);

  const discover = async () => {
    const profile = await onDiscover(websiteUrl);
    const review = getBusinessProfileReview(profile, websiteUrl);
    if (!review) return;
    onContinue(review);
  };

  return (
    <div className="w-full max-w-xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 1 of 2</div>
      <h1 className="mt-2 text-balance font-tw text-3xl font-bold tracking-tight">
        Add your business website
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        We will use it to fill in your team details.
      </p>

      <TextField name="onboarding-business-website" className="mt-8 w-full gap-2">
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
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onCancel ? (
          <Button onPress={onCancel} variant="outline">Cancel</Button>
        ) : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button onPress={() => onContinue(null)} variant="tertiary">
            Skip for now
          </Button>
          <Button
            variant="primary"
            onPress={discover}
            isPending={isDiscovering}
            isDisabled={!websiteUrl.trim()}
          >
            Continue
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
  onCancel: PropTypes.func,
  onContinue: PropTypes.func,
  onDiscover: PropTypes.func,
};

export default OnboardingBusiness;
