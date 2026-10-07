import React, { useState } from "react";
import { Button, Switch, Tooltip } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { LuInfo, LuRefreshCw } from "react-icons/lu";

import { refreshHomeSuggestions } from "../../api/observations";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { selectTeam, updateTeam } from "../../slices/team";
import { TEAM_AI_TOOLTIP } from "../Ai/aiEnablementCopy";
import EnableAiPromptModal from "./EnableAiPromptModal";
import TeamAiDataControls from "./TeamAiDataControls";
import useAiAvailability from "../Ai/hooks/useAiAvailability";
import { selectUser } from "../../slices/user";

function TeamAiSettings() {
  const [enablingAi, setEnablingAi] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const { availability, reload } = useAiAvailability({ teamId: team.id });
  const canManage = team.TeamRoles?.some((role) => role.user_id === user.id && ["teamOwner", "teamAdmin"].includes(role.role));
  const aiAvailable = team.aiEnabled !== false && availability?.enabled === true;

  const refreshSuggestions = async () => {
    if (refreshingSuggestions) return;
    setRefreshingSuggestions(true);
    try {
      await refreshHomeSuggestions(team.id);
      toast.success("Refresh requested. Check Home for your suggestions shortly.");
    } catch (error) {
      toast.error(error.message || "Suggestions could not be refreshed. Try again.");
    } finally {
      setRefreshingSuggestions(false);
    }
  };

  const toggleSuggestions = async (selected) => {
    if (savingSuggestions) return;
    setSavingSuggestions(true);
    try {
      const response = await dispatch(updateTeam({ team_id: team.id, data: { aiSuggestionsEnabled: selected } }));
      if (response?.error) throw new Error();
      toast.success(selected ? "Personalized suggestions enabled" : "Personalized suggestions disabled");
    } catch (error) {
      toast.error("Suggestions could not be updated. Try again.");
    } finally {
      setSavingSuggestions(false);
    }
  };

  const toggleAi = async (selected) => {
    const response = await dispatch(updateTeam({ team_id: team.id, data: { aiEnabled: selected } }));
    if (response?.error) {
      toast.error("Chartbrew AI settings could not be updated");
      return false;
    }
    reload();
    toast.success(selected ? "Chartbrew AI enabled" : "Chartbrew AI disabled");
    return true;
  };

  const closeEnableAiPrompt = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("enableAi");
    setSearchParams(nextParams, { replace: true });
  };

  const confirmEnableAi = async () => {
    setEnablingAi(true);
    const enabled = await toggleAi(true);
    setEnablingAi(false);
    if (enabled) closeEnableAiPrompt();
  };

  return (
    <div className="flex flex-col gap-4">
      <EnableAiPromptModal
        isOpen={searchParams.get("enableAi") === "team" && team.aiEnabled === false}
        isPending={enablingAi}
        onCancel={closeEnableAiPrompt}
        onConfirm={confirmEnableAi}
        scope="team"
      />

      <section className="rounded-3xl border border-divider bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="team-settings-ai-enabled"
              isSelected={team.aiEnabled !== false}
              onChange={toggleAi}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Enable Chartbrew AI
              </Switch.Content>
            </Switch>
            <Tooltip>
              <Tooltip.Trigger
                render={(triggerProps) => (<button {...triggerProps}
                  aria-label="Learn about Chartbrew AI"
                  className="inline-flex size-7 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-foreground"
                  type="button"
                >
                  <LuInfo aria-hidden size={17} />
                </button>)}
              />
              <Tooltip.Content className="max-w-sm">{TEAM_AI_TOOLTIP}</Tooltip.Content>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Switch
            id="team-settings-ai-suggestions"
            isSelected={aiAvailable && team.aiSuggestionsEnabled !== false}
            isDisabled={!aiAvailable || !canManage || savingSuggestions}
            onChange={toggleSuggestions}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Personalized suggestions
            </Switch.Content>
          </Switch>
          <Tooltip>
            <Tooltip.Trigger
              render={(triggerProps) => (<button {...triggerProps} aria-label="About personalized suggestions" className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-secondary" type="button">
                <LuInfo aria-hidden size={17} />
              </button>)}
            />
            <Tooltip.Content className="max-w-sm">Suggest next steps on Home from each person's recent work and permitted memories.</Tooltip.Content>
          </Tooltip>
          <Button
            aria-label="Refresh my suggestions"
            className="ml-2"
            isDisabled={!aiAvailable || team.aiSuggestionsEnabled === false || savingSuggestions}
            isPending={refreshingSuggestions}
            onPress={refreshSuggestions}
            size="sm"
            variant="secondary"
          >
            {refreshingSuggestions ? <ButtonSpinner /> : <LuRefreshCw aria-hidden />}
            Refresh
          </Button>
        </div>
        {team.aiEnabled === false ? (
          <p className="mt-2 text-sm text-muted">Enable Chartbrew AI to use personalized suggestions.</p>
        ) : availability?.disabledBy === "platform" ? (
          <p className="mt-2 text-sm text-muted">Ask a platform administrator to enable Chartbrew AI in Platform settings.</p>
        ) : null}
      </section>

      <TeamAiDataControls />
    </div>
  );
}

export default TeamAiSettings;
