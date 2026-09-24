import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Chip } from "@heroui/react";
import { LuChartNoAxesColumn } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import AiAccessNotice from "../../Ai/AiAccessNotice";
import AiAvailabilityStatus from "../../Ai/AiAvailabilityStatus";
import AiChat from "../../Ai/AiChat";
import { canSubmitAiMessage } from "../../Ai/aiAvailability";
import useAiChat from "../../Ai/hooks/useAiChat";
import useAiAvailability from "../../Ai/hooks/useAiAvailability";
import { runQuery } from "../../../slices/chart";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import { didAiUpdateActiveChart } from "../chartStudioState";
import ChartbrewAiIcon from "../../../components/ChartbrewAiIcon";

function ChartStudioChat({ chartId, projectId }) {
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [accessRequested, setAccessRequested] = useState(false);
  const context = useMemo(() => [{ entity_type: "chart", id: chartId }], [chartId]);
  const chat = useAiChat({ context, teamId: team?.id });
  const messages = useMemo(() => chat.messages.map((message) => ({
    ...message,
    chartPreviews: [],
  })), [chat.messages]);
  const {
    availability,
    error: availabilityError,
    isLoading: isAvailabilityLoading,
    reload: reloadAvailability,
  } = useAiAvailability({ teamId: team?.id });
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const isTeamAdmin = ["teamAdmin", "teamOwner"].includes(teamRole);

  const refreshAfterChange = async (orchestration) => {
    if (!didAiUpdateActiveChart(orchestration, chartId)) return orchestration;
    try {
      await dispatch(runQuery({
        project_id: projectId,
        chart_id: chartId,
        noSource: false,
        skipParsing: false,
        getCache: true,
      })).unwrap();
    } catch (_error) {
      toast.error("The chart changed, but this editor could not refresh it. Reload the page to see the saved change.");
    }
    return orchestration;
  };

  const onSubmit = (message) => {
    if (!canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return false;
    }
    setAccessRequested(false);
    chat.sendMessage(message).then(refreshAfterChange);
    return true;
  };

  const onChangeAction = (action) => {
    if (!canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return null;
    }
    setAccessRequested(false);
    return chat.changeAction(action);
  };

  const onConfirmAction = async (action) => {
    if (!canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return null;
    }
    setAccessRequested(false);
    return refreshAfterChange(await chat.confirmAction(action));
  };

  return (
    <div className="chart-studio-chat flex h-full min-h-0 flex-col gap-3 p-3">
      <AiAccessNotice
        availability={availability}
        canManagePlatform={user.admin === true}
        canManageTeam={isTeamAdmin}
        error={availabilityError}
        isLoading={isAvailabilityLoading}
        isRequested={accessRequested || availability?.enabled === false || Boolean(availabilityError)}
        onRetry={reloadAvailability}
      />
      <AiChat
        conversationId={chat.aiConversationId}
        emptyState={canSubmitAiMessage(availability) ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
            <ChartbrewAiIcon size={24} className="shrink-0" />
            <div className="max-w-60 space-y-2">
              <h3 className="text-sm font-semibold">Explore this chart</h3>
              <p className="text-sm text-muted">
                Ask about the data or describe a change you want to make.
              </p>
            </div>
          </div>
        ) : null}
        fill
        fillComposer={false}
        framed
        id={`chart-studio-chat-${chartId}`}
        isLoading={chat.isLoading}
        leadingControl={(
          <Chip size="sm" variant="soft">
            <LuChartNoAxesColumn aria-hidden size={14} />
            <Chip.Label>This chart</Chip.Label>
          </Chip>
        )}
        messages={messages}
        onChangeAction={onChangeAction}
        onConfirmAction={onConfirmAction}
        onEnsureSaved={chat.save}
        onSubmit={onSubmit}
        placeholder="Ask about this chart…"
        progressEvents={chat.progressEvents}
        selectedContext={{ multiSelect: context, singleSelect: null }}
        status={(
          <AiAvailabilityStatus
            availability={availability}
            canManagePlatform={user.admin === true}
            canManageTeam={isTeamAdmin}
          />
        )}
        suggestions={[]}
        teamId={team?.id}
        toolDisplayNames={chat.toolDisplayNames}
      />
    </div>
  );
}

ChartStudioChat.propTypes = {
  chartId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};

export default ChartStudioChat;
