import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";

import SimpleNavbar from "../../components/SimpleNavbar";
import {
  createTeam,
  discoverBusinessProfile,
  getTeams,
  saveActiveTeam,
  saveTeamOnboarding,
} from "../../slices/team";
import { selectUser } from "../../slices/user";
import OnboardingBusiness from "./components/OnboardingBusiness";
import OnboardingTeam from "./components/OnboardingTeam";
import {
  buildOnboardingCompletion,
  findOwnedOnboardingTeam,
  getOnboardingEntry,
  isTeamOwner,
} from "./onboardingState";

function Onboarding() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const initialized = useRef(false);
  const { isNewTeam, requestedTeamId } = getOnboardingEntry(location.search);
  const [currentStep, setCurrentStep] = useState(1);
  const [owningTeam, setOwningTeam] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [teamDraft, setTeamDraft] = useState(null);
  const [loading, setLoading] = useState(!isNewTeam);
  const [pending, setPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || initialized.current) return;
    initialized.current = true;
    if (isNewTeam) {
      setLoading(false);
      return;
    }
    dispatch(getTeams()).then((action) => {
      const teams = action.payload || [];
      const nextTeam = findOwnedOnboardingTeam(teams, user.id, requestedTeamId);
      if (!nextTeam || !isTeamOwner(nextTeam, user.id) || nextTeam.onboardingCompletedAt) {
        navigate("/", { replace: true });
        return;
      }
      setOwningTeam(nextTeam);
      if (nextTeam.TeamBusinessProfile) {
        setBusinessProfile({
          businessName: nextTeam.TeamBusinessProfile.businessName || "",
          description: nextTeam.TeamBusinessProfile.description || "",
          logoMimeType: nextTeam.TeamBusinessProfile.logoMimeType || null,
          metadata: nextTeam.TeamBusinessProfile.metadata || {},
          websiteUrl: nextTeam.TeamBusinessProfile.websiteUrl || "",
        });
      }
      dispatch(saveActiveTeam(nextTeam));
      setLoading(false);
    });
  }, [dispatch, isNewTeam, navigate, requestedTeamId, user?.id]);

  const handleDiscover = async (websiteUrl) => {
    setDiscovering(true);
    setError("");
    const action = await dispatch(discoverBusinessProfile({
      team_id: owningTeam?.id, websiteUrl,
    }));
    setDiscovering(false);
    if (action.error) {
      setError(action.error.message);
      return null;
    }
    return action.payload;
  };

  const handleBusinessStep = (profile) => {
    setBusinessProfile(profile);
    setError("");
    setCurrentStep(2);
  };

  const handleFinish = async ({ businessProfile: approvedProfile, teamName, useCases }) => {
    setPending(true);
    setError("");
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
      ...buildOnboardingCompletion(approvedProfile),
      name: teamName,
      useCases,
    };
    const action = await dispatch(saveTeamOnboarding({ team_id: targetTeam.id, data }));
    if (action.error) {
      setPending(false);
      setError(action.error.message);
      return;
    }
    const teamsAction = await dispatch(getTeams());
    const refreshedTeam = teamsAction.payload?.find((team) => team.id === targetTeam.id)
      || action.payload;
    dispatch(saveActiveTeam(refreshedTeam));
    window.location.href = "/";
  };

  if (loading || (!isNewTeam && !owningTeam)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner variant="simple" aria-label="Loading team setup" size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <SimpleNavbar />
      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 py-8 md:py-14">
        {currentStep === 1 ? (
          <OnboardingBusiness
            error={error}
            initialProfile={businessProfile}
            isDiscovering={discovering}
            onCancel={isNewTeam ? () => navigate("/") : undefined}
            onContinue={handleBusinessStep}
            onDiscover={handleDiscover}
          />
        ) : (
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
            onContinue={handleFinish}
            team={owningTeam}
          />
        )}
      </main>
    </div>
  );
}

export default Onboarding;
