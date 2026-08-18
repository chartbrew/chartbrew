import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Label, Switch, TextArea, TextField,
} from "@heroui/react";

import { buildBusinessProfile, getBusinessProfileReview } from "../onboardingState";

function OnboardingBusiness({
  error = "",
  isDiscovering = false,
  isPending = false,
  onDiscover = () => {},
  onFinish = () => {},
}) {
  const [mode, setMode] = useState("website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [aiContextAllowed, setAiContextAllowed] = useState(false);

  const discover = async () => {
    const profile = await onDiscover(websiteUrl);
    const review = getBusinessProfileReview(profile, websiteUrl);
    if (!review) return;
    setWebsiteUrl(review.websiteUrl);
    setBusinessName(review.businessName);
    setDescription(review.description);
    setLogo(review.logo);
    setMetadata(review.metadata);
    setMode("review");
  };

  const finish = () => {
    onFinish({
      aiContextAllowed,
      businessProfile: buildBusinessProfile({
        businessName, description, logo, metadata, websiteUrl,
      }),
    });
  };

  return (
    <div className="w-full max-w-xl rounded-3xl bg-surface p-6 md:p-8">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">Step 2 of 2</div>
      <h1 className="mt-2 font-tw text-2xl font-bold">
        {mode === "website" ? "Add your business website" : "Review your business profile"}
      </h1>

      {mode === "website" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Chartbrew can find your logo and business description.
          </p>
          <div className="h-8" />
          <TextField name="onboarding-business-website" className="w-full gap-2">
            <Label className="font-semibold">Business website</Label>
            <Input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="example.com"
              fullWidth
              size="lg"
              variant="secondary"
              onKeyDown={(event) => {
                if (event.key === "Enter" && websiteUrl.trim()) discover();
              }}
            />
          </TextField>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button onPress={() => setMode("review")} variant="ghost">
              Add details manually
            </Button>
            <Button onPress={() => onFinish({ aiContextAllowed: false })} variant="secondary">
              Skip for now
            </Button>
            <Button
              color="primary"
              onPress={discover}
              isPending={isDiscovering}
              isDisabled={!websiteUrl.trim()}
            >
              Find business details
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-8 flex items-start gap-4">
            {logo?.data ? (
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-divider bg-content1 p-2">
                <img
                  alt="Business logo"
                  className="max-h-full max-w-full object-contain"
                  src={`data:${logo.mimeType};base64,${logo.data}`}
                />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <TextField name="onboarding-business-name" className="w-full gap-2">
                <Label className="font-semibold">Business name</Label>
                <Input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Business name"
                  variant="secondary"
                />
              </TextField>
              <TextField name="onboarding-business-website-review" className="w-full gap-2">
                <Label className="font-semibold">Business website</Label>
                <Input
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="example.com"
                  variant="secondary"
                />
              </TextField>
            </div>
          </div>
          <TextField name="onboarding-business-description" className="mt-4 w-full gap-2">
            <Label className="font-semibold">Business description</Label>
            <TextArea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does your business do?"
              rows={5}
              variant="secondary"
            />
          </TextField>
          <Switch className="mt-6" isSelected={aiContextAllowed} onChange={setAiContextAllowed}>
            <Switch.Content>
              <Switch.Control><Switch.Thumb /></Switch.Control>
              Allow Chartbrew AI to use this business profile when it is relevant
            </Switch.Content>
          </Switch>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button onPress={() => setMode("website")} variant="ghost">Back</Button>
            <Button
              color="primary"
              size="lg"
              onPress={finish}
              isPending={isPending}
              isDisabled={!websiteUrl.trim() && !businessName.trim() && !description.trim()}
            >
              Start using Chartbrew
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

OnboardingBusiness.propTypes = {
  error: PropTypes.string,
  isDiscovering: PropTypes.bool,
  isPending: PropTypes.bool,
  onDiscover: PropTypes.func,
  onFinish: PropTypes.func,
};

export default OnboardingBusiness;
