import React, { useEffect, useState } from "react";
import {
  Button, Input, Label, Switch, TextArea, TextField,
} from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  discoverBusinessProfile,
  getBusinessProfileLogo,
  getTeams,
  saveActiveTeam,
  selectTeam,
  updateBusinessProfile,
} from "../../slices/team";
import { selectUser } from "../../slices/user";
import { buildBusinessProfile } from "../Onboarding/onboardingState";

function BusinessProfileSettings() {
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const profile = team.TeamBusinessProfile || {};
  const isOwner = team.TeamRoles?.some((role) => (
    role.user_id === user.id && role.role === "teamOwner"
  ));
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl || "");
  const [businessName, setBusinessName] = useState(profile.businessName || "");
  const [description, setDescription] = useState(profile.description || "");
  const [metadata, setMetadata] = useState(profile.metadata || {});
  const [logo, setLogo] = useState(null);
  const [savedLogo, setSavedLogo] = useState(null);
  const [aiContextAllowed, setAiContextAllowed] = useState(profile.aiContextAllowed === true);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextProfile = team.TeamBusinessProfile || {};
    setWebsiteUrl(nextProfile.websiteUrl || "");
    setBusinessName(nextProfile.businessName || "");
    setDescription(nextProfile.description || "");
    setMetadata(nextProfile.metadata || {});
    setAiContextAllowed(nextProfile.aiContextAllowed === true);
    setLogo(null);
  }, [team.id, team.TeamBusinessProfile]);

  useEffect(() => {
    let active = true;
    setSavedLogo(null);
    if (!profile.logoMimeType) return () => { active = false; };
    getBusinessProfileLogo(team.id)
      .then((dataUrl) => {
        if (active) setSavedLogo(dataUrl);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [profile.logoMimeType, team.id]);

  const discover = async () => {
    if (!websiteUrl.trim()) return;
    setDiscovering(true);
    const action = await dispatch(discoverBusinessProfile({ team_id: team.id, websiteUrl }));
    setDiscovering(false);
    if (action.error) {
      toast.error(action.error.message);
      return;
    }
    setWebsiteUrl(action.payload.websiteUrl || websiteUrl);
    setBusinessName(action.payload.businessName || businessName);
    setDescription(action.payload.description || description);
    setMetadata(action.payload.metadata || {});
    setLogo(action.payload.logo || null);
    toast.success("Business details found");
  };

  const save = async () => {
    setSaving(true);
    const businessProfile = buildBusinessProfile({
      businessName, description, logo, metadata, websiteUrl,
    });
    const data = { businessProfile };
    if (isOwner) data.aiContextAllowed = aiContextAllowed;
    const action = await dispatch(updateBusinessProfile({ team_id: team.id, data }));
    if (action.error) {
      setSaving(false);
      toast.error(action.error.message);
      return;
    }
    const teamsAction = await dispatch(getTeams());
    const refreshedTeam = teamsAction.payload?.find((item) => item.id === team.id);
    if (refreshedTeam) dispatch(saveActiveTeam(refreshedTeam));
    setSaving(false);
    toast.success("Business profile saved");
  };

  return (
    <section className="rounded-3xl border border-divider bg-surface p-4">
      <h2 className="font-tw text-lg font-semibold">Business profile</h2>
      <div className="mt-4 flex max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField name="team-business-website" className="w-full gap-2">
            <Label>Business website</Label>
            <Input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="example.com"
              variant="secondary"
            />
          </TextField>
          <Button
            className="shrink-0"
            isDisabled={!websiteUrl.trim()}
            isPending={discovering}
            onPress={discover}
            variant="secondary"
          >
            Refresh from website
          </Button>
        </div>
        <div className="flex items-start gap-4">
          {logo?.data || savedLogo ? (
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-divider bg-content1 p-2">
              <img
                alt="Business logo"
                className="max-h-full max-w-full object-contain"
                src={logo?.data ? `data:${logo.mimeType};base64,${logo.data}` : savedLogo}
              />
            </div>
          ) : null}
          <TextField name="team-business-name" className="w-full gap-2">
            <Label>Business name</Label>
            <Input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Business name"
              variant="secondary"
            />
          </TextField>
        </div>
        <TextField name="team-business-description" className="w-full gap-2">
          <Label>Business description</Label>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does your business do?"
            rows={4}
            variant="secondary"
          />
        </TextField>
        {isOwner ? (
          <Switch isSelected={aiContextAllowed} onChange={setAiContextAllowed}>
            <Switch.Content>
              <Switch.Control><Switch.Thumb /></Switch.Control>
              Allow Chartbrew AI to use this business profile when it is relevant
            </Switch.Content>
          </Switch>
        ) : null}
        <div>
          <Button isPending={saving} onPress={save} variant="primary">Save profile</Button>
        </div>
      </div>
    </section>
  );
}

export default BusinessProfileSettings;
