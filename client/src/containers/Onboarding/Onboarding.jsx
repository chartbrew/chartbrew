import React, { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";

import { getHome } from "../../api/observations";
import InviteMembersForm from "../../components/InviteMembersForm";
import { getProjects } from "../../slices/project";
import CupLoader from "../../components/CupLoader";
import SimpleNavbar from "../../components/SimpleNavbar";
import {
  createTeam,
  discoverBusinessProfile,
  getTeams,
  saveActiveTeam,
  saveTeamOnboarding,
} from "../../slices/team";
import { selectUser } from "../../slices/user";
import OnboardingPreferences from "./components/OnboardingPreferences";
import OnboardingAi from "./components/OnboardingAi";
import OnboardingBusiness from "./components/OnboardingBusiness";
import OnboardingReport from "./components/OnboardingReport";
import OnboardingTeam from "./components/OnboardingTeam";
import {
  buildOnboardingCompletion,
  findOwnedOnboardingTeam,
  getOnboardingEntry,
  getOnboardingPreferences,
  getOnboardingAiSettings,
  isTeamOwner,
  shouldLoadOnboardingTeam,
  getReportPreparationState,
} from "./onboardingState";

function Onboarding() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const previewRequest = useRef(0);
  const profileSave = useRef(Promise.resolve());
  const { isNewTeam, requestedTeamId } = getOnboardingEntry(location.search);
  const [currentStep, setCurrentStep] = useState(1);
  const [owningTeam, setOwningTeam] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [teamDraft, setTeamDraft] = useState(null);
  const [branding, setBranding] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [previewWebsite, setPreviewWebsite] = useState(null);
  const [preferencesDraft, setPreferencesDraft] = useState(null);
  const preferences = preferencesDraft || getOnboardingPreferences(owningTeam);
  const [aiDraft, setAiDraft] = useState(null);
  const aiSettings = aiDraft || getOnboardingAiSettings(owningTeam);
  const [loading, setLoading] = useState(!isNewTeam);
  const [pending, setPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [preparingReport, setPreparingReport] = useState(false);
  const [reportFailed, setReportFailed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return undefined;
    if (!shouldLoadOnboardingTeam({ isNewTeam, requestedTeamId, owningTeam })) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    dispatch(getTeams()).then((action) => {
      if (!active) return;
      setLoading(false);
      if (action.error) {
        setError("We could not load your team. Reload the page to try again.");
        return;
      }
      const teams = action.payload || [];
      const nextTeam = findOwnedOnboardingTeam(teams, user.id, requestedTeamId);
      if (!nextTeam || !isTeamOwner(nextTeam, user.id) || nextTeam.onboardingCompletedAt) {
        navigate("/", { replace: true });
        return;
      }
      setOwningTeam(nextTeam);
      if (nextTeam.TeamBusinessProfile) {
        setPreviewWebsite(nextTeam.TeamBusinessProfile.websiteUrl || null);
        setBusinessProfile({
          businessName: nextTeam.TeamBusinessProfile.businessName || "",
          description: nextTeam.TeamBusinessProfile.description || "",
          logoMimeType: nextTeam.TeamBusinessProfile.logoMimeType || null,
          metadata: nextTeam.TeamBusinessProfile.metadata || {},
          websiteUrl: nextTeam.TeamBusinessProfile.websiteUrl || "",
        });
      }
      dispatch(saveActiveTeam(nextTeam));
    });
    return () => { active = false; };
  }, [dispatch, isNewTeam, navigate, owningTeam, requestedTeamId, user?.id]);

  const handleDiscover = async (websiteUrl) => {
    setDiscovering(true);
    setError("");
    const action = await dispatch(discoverBusinessProfile({
      team_id: owningTeam?.id, websiteUrl,
    }));
    if (action.error) {
      setDiscovering(false);
      return null;
    }
    return action.payload;
  };

  useEffect(() => {
    if (!previewWebsite || !owningTeam?.id) return undefined;
    let active = true;
    let timer;
    const finish = (preview) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      if (preview) setReportPreview(preview);
      if (preparingReport) {
        setDiscovering(false);
        setPreparingReport(false);
        if (preview) setCurrentStep(2);
        else {
          setReportFailed(true);
          setError("We could not prepare your report. Try again or continue without it.");
        }
      }
    };
    const deadline = setTimeout(() => finish(null), 120000);
    const poll = async () => {
      try {
        const home = await getHome(owningTeam.id);
        if (!active) return;
        const state = getReportPreparationState(home, previewWebsite);
        if (state === "ready") {
          finish(home.reportPreview);
          return;
        }
        if (state === "failed") {
          finish(null);
          return;
        }
      } catch (pollError) {
        // Retry temporary connection failures until the deadline.
      }
      if (active) timer = setTimeout(poll, 2000);
    };
    poll();
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); };
  }, [owningTeam?.id, previewWebsite, preparingReport]);

  const handleBusinessStep = async (profile, skipReport = false) => {
    const request = ++previewRequest.current;
    setReportFailed(false);
    setError("");
    setDiscovering(true);
    let targetTeam = owningTeam;
    if (profile?.websiteUrl && !targetTeam && !skipReport) {
      const action = await dispatch(createTeam({ name: profile.businessName || "New team" }));
      if (action.error || !action.payload?.id) {
        setError(action.error?.message || "Unable to create the team");
        setDiscovering(false);
        return;
      }
      targetTeam = action.payload;
      setOwningTeam(targetTeam);
      dispatch(saveActiveTeam(targetTeam));
      navigate(`/start?team=${targetTeam.id}`, { replace: true });
    }
    setPreviewWebsite(null);
    setReportPreview(null);
    setBusinessProfile(profile);
    setBranding(profile);
    if (!profile?.websiteUrl || skipReport) {
      setDiscovering(false);
      setPreparingReport(false);
      setCurrentStep(2);
      return;
    }
    setPreparingReport(true);
    if (targetTeam) {
      const teamId = targetTeam.id;
      profileSave.current = profileSave.current.then(() => dispatch(saveTeamOnboarding({
        team_id: teamId, data: { businessProfile: profile },
      })));
      const action = await profileSave.current;
      if (request !== previewRequest.current) return;
      if (action.error) {
        setDiscovering(false);
        setPreparingReport(false);
        setReportFailed(true);
        setError("We could not prepare your report. Try again or continue without it.");
        return;
      }
      setPreviewWebsite(profile.websiteUrl);
    }
  };

  const handleSave = async (complete) => {
    const { businessProfile: approvedProfile, teamName, useCases } = teamDraft;
    setPending(true);
    setError("");
    await profileSave.current;
    let targetTeam = owningTeam;
    if (isNewTeam && !targetTeam) {
      const createAction = await dispatch(createTeam({ name: teamName, useCases }));
      if (createAction.error || !createAction.payload?.id) {
        setPending(false);
        setError(createAction.error?.message || "Unable to create the team");
        return;
      }
      targetTeam = createAction.payload;
      setOwningTeam(targetTeam);
      dispatch(saveActiveTeam(targetTeam));
      navigate(`/start?team=${targetTeam.id}`, { replace: true });
    }
    const data = {
      ...buildOnboardingCompletion(approvedProfile, aiSettings),
      ...preferences,
      complete,
      name: teamName,
      useCases,
    };
    const action = await dispatch(saveTeamOnboarding({ team_id: targetTeam.id, data }));
    if (action.error) {
      setPending(false);
      setError(action.error.message);
      return;
    }
    setOwningTeam(action.payload);
    dispatch(saveActiveTeam(action.payload));
    if (!complete) {
      const projectsAction = await dispatch(getProjects({ team_id: targetTeam.id }));
      setPending(false);
      if (projectsAction.error) {
        setError("We could not load your dashboards. Try again.");
        return;
      }
      setCurrentStep(5);
      return;
    }
    const teamsAction = await dispatch(getTeams());
    const refreshedTeam = teamsAction.payload?.find((team) => team.id === targetTeam.id)
      || action.payload;
    dispatch(saveActiveTeam(refreshedTeam));
    window.location.href = "/";
  };

  if (!loading && error && !isNewTeam && !owningTeam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p role="alert">{error}</p>
        <Button onPress={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  if (loading || (!isNewTeam && !owningTeam)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <CupLoader label="Loading team setup" />
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-surface-secondary">
      <SimpleNavbar />
      <OnboardingReport
        branding={branding}
        preview={reportPreview?.websiteUrl === branding?.websiteUrl ? reportPreview : null}
        ready={currentStep > 1}
      />
      <main className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-8 md:py-14">
        {currentStep === 1 ? (
          <OnboardingBusiness
            error={error}
            initialProfile={businessProfile}
            isDiscovering={discovering}
            isPreparingReport={preparingReport}
            reportFailed={reportFailed}
            onCancel={isNewTeam ? () => navigate("/") : undefined}
            onContinue={handleBusinessStep}
            onDiscover={handleDiscover}
          />
        ) : currentStep === 2 ? (
          <OnboardingTeam
            businessProfile={businessProfile}
            error={error}
            initialTeamDraft={teamDraft}
            isPending={pending}
            onBack={(draft) => {
              setBusinessProfile(draft.businessProfile);
              setTeamDraft({
                teamName: draft.teamName,
                useCases: draft.useCases,
              });
              setError("");
              setCurrentStep(1);
            }}
            onPreviewChange={setBranding}
            onContinue={(draft) => {
              setTeamDraft(draft);
              setBusinessProfile(draft.businessProfile);
              setError("");
              setCurrentStep(3);
            }}
            team={owningTeam}
          />
        ) : currentStep === 3 ? (
          <OnboardingAi
            error={error}
            isPending={pending}
            onBack={() => {
              setError("");
              setCurrentStep(2);
            }}
            onChange={setAiDraft}
            onContinue={() => setCurrentStep(4)}
            settings={aiSettings}
            teamId={owningTeam?.id}
          />
        ) : currentStep === 4 ? (
          <OnboardingPreferences
            error={error}
            isPending={pending}
            onBack={() => { setError(""); setCurrentStep(3); }}
            onChange={setPreferencesDraft}
            onContinue={() => handleSave(false)}
            settings={preferences}
          />
        ) : (
          <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 md:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step 5 of 5</div>
            <h1 className="mt-2 text-balance text-3xl font-bold">Invite your teammates</h1>
            <div className="mt-8">
              <InviteMembersForm showHeading={false} teamOnly />
            </div>
            {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
            <div className="mt-8 flex items-center justify-between gap-2">
              <Button
                isDisabled={pending}
                onPress={() => { setError(""); setCurrentStep(4); }}
                variant="outline"
              >
                Back
              </Button>
              <Button isPending={pending} onPress={() => handleSave(true)} size="lg" variant="primary">
                Finish setup
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Onboarding;
