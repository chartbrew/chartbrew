import React, { useState } from "react";
import { Switch, Tooltip } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { LuInfo } from "react-icons/lu";

import { selectTeam, updateTeam } from "../../slices/team";
import { TEAM_AI_TOOLTIP } from "../Ai/aiEnablementCopy";
import EnableAiPromptModal from "./EnableAiPromptModal";
import TeamAiDataControls from "./TeamAiDataControls";

function TeamAiSettings() {
  const [enablingAi, setEnablingAi] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  const toggleAi = async (selected) => {
    const response = await dispatch(updateTeam({ team_id: team.id, data: { aiEnabled: selected } }));
    if (response?.error) {
      toast.error("Chartbrew AI settings could not be updated");
      return false;
    }
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
              <Tooltip.Trigger>
                <button
                  aria-label="Learn about Chartbrew AI"
                  className="inline-flex size-7 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-foreground"
                  type="button"
                >
                  <LuInfo aria-hidden size={17} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-sm">{TEAM_AI_TOOLTIP}</Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      </section>

      <TeamAiDataControls />
    </div>
  );
}

export default TeamAiSettings;
