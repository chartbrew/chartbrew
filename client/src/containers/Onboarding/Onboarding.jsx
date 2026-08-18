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
  getInitialOnboardingStep,
  getOnboardingEntry,
  isTeamOwner,
} from "./onboardingState";

function Onboarding() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const initialized = useRef(false);
  const { isNewTeam, requestedTeamId, welcome } = getOnboardingEntry(location.search);
  const [currentStep, setCurrentStep] = useState(1);
  const [owningTeam, setOwningTeam] = useState(null);
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
      setCurrentStep(getInitialOnboardingStep(nextTeam));
      dispatch(saveActiveTeam(nextTeam));
      setLoading(false);
    });
  }, [dispatch, isNewTeam, navigate, requestedTeamId, user?.id]);

  const handleTeamStep = async ({ teamName, useCases }) => {
    setPending(true);
    setError("");
    const action = isNewTeam && !owningTeam
      ? await dispatch(createTeam({ name: teamName, useCases }))
      : await dispatch(saveTeamOnboarding({
        team_id: owningTeam.id,
        data: { name: teamName, useCases },
      }));
    setPending(false);
    if (action.error || !action.payload?.id) {
      setError(action.error?.message || "Unable to save team setup");
      return;
    }
    setOwningTeam(action.payload);
    dispatch(saveActiveTeam(action.payload));
    navigate(`/start?team=${action.payload.id}`, { replace: true });
    setCurrentStep(2);
  };

  const handleDiscover = async (websiteUrl) => {
    setDiscovering(true);
    setError("");
    const action = await dispatch(discoverBusinessProfile({
      team_id: owningTeam.id, websiteUrl,
    }));
    setDiscovering(false);
    if (action.error) {
      setError(action.error.message);
      return null;
    }
    return action.payload;
  };

  const handleFinish = async ({ businessProfile, aiContextAllowed }) => {
    setPending(true);
    setError("");
    const data = buildOnboardingCompletion(businessProfile, aiContextAllowed);
    const action = await dispatch(saveTeamOnboarding({ team_id: owningTeam.id, data }));
    if (action.error) {
      setPending(false);
      setError(action.error.message);
      return;
    }
    const teamsAction = await dispatch(getTeams());
    const refreshedTeam = teamsAction.payload?.find((team) => team.id === owningTeam.id)
      || action.payload;
    dispatch(saveActiveTeam(refreshedTeam));
    window.location.href = "/connections/new";
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
          <OnboardingTeam
            isNewTeam={isNewTeam}
            isPending={pending}
            onCancel={() => navigate("/")}
            onContinue={handleTeamStep}
            team={owningTeam}
            welcome={welcome}
          />
        ) : (
          <OnboardingBusiness
            error={error}
            isDiscovering={discovering}
            isPending={pending}
            onDiscover={handleDiscover}
            onFinish={handleFinish}
          />
        )}
        {currentStep === 1 && error ? (
          <p className="mt-3 text-sm text-danger">{error}</p>
        ) : null}
      </main>
    </div>
  );
}

export default Onboarding;
