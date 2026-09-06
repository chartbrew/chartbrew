import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip } from "@heroui/react";
import { LuChevronUp, LuX } from "react-icons/lu";
import { useSelector } from "react-redux";

import { searchAiContext } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import AiAccessNotice from "./AiAccessNotice";
import AiAvailabilityStatus from "./AiAvailabilityStatus";
import AiChat from "./AiChat";
import AiContextPicker from "./AiContextPicker";
import { canSubmitAiMessage } from "./aiAvailability";
import useAiChat from "./hooks/useAiChat";
import useAiAvailability from "./hooks/useAiAvailability";

const EMPTY_CONTEXT = {
  multiSelect: [],
  singleSelect: null,
};

function HomeAsk({ focused, onFocusChange, teamId }) {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [saved, setSaved] = useState(false);
  const [showAccessNotice, setShowAccessNotice] = useState(false);
  const [selectedContext, setSelectedContext] = useState(EMPTY_CONTEXT);
  const [contextSearch, setContextSearch] = useState("");
  const [contextEntities, setContextEntities] = useState([]);
  const [contextLoadError, setContextLoadError] = useState("");
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const chat = useAiChat({ context: selectedContext.multiSelect, teamId });
  const conversationStarted = chat.messages.length > 0;
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const isTeamAdmin = ["teamAdmin", "teamOwner"].includes(teamRole);
  const {
    availability,
    error: availabilityError,
    isLoading: isAvailabilityLoading,
    reload: reloadAvailability,
  } = useAiAvailability({ teamId });
  const isAccessNoticeVisible = showAccessNotice && availability?.enabled !== true;
  const questionPlaceholder = teamRole === "projectViewer"
    ? "Ask about existing reports and metrics"
    : "Ask anything about your data";

  useEffect(() => {
    if (!isContextPickerOpen || !teamId) return undefined;
    let isActive = true;
    const timeout = setTimeout(async () => {
      setIsContextLoading(true);
      setContextLoadError("");
      try {
        const response = await searchAiContext(teamId, {
          limit: 30,
          query: contextSearch.trim(),
        });
        if (isActive) setContextEntities(response.context || []);
      } catch (error) {
        if (isActive) {
          setContextEntities([]);
          setContextLoadError(error.message);
        }
      } finally {
        if (isActive) setIsContextLoading(false);
      }
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [contextSearch, isContextPickerOpen, teamId]);

  const onSave = async () => {
    const result = await chat.save();
    setSaved(Boolean(result));
  };

  const onSubmit = (message) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return false;
    }
    setShowAccessNotice(false);
    onFocusChange(true);
    chat.sendMessage(message || selectedContext.multiSelect.map((entity) => entity.label).join("\n"));
    return true;
  };

  const onChangeAction = (action) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return null;
    }
    setShowAccessNotice(false);
    return chat.changeAction(action);
  };

  const onConfirmAction = (action) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return null;
    }
    setShowAccessNotice(false);
    return chat.confirmAction(action);
  };

  const onChartAction = (action) => {
    return chat.runChartAction(action);
  };

  const clearChat = () => {
    chat.clear();
    setSaved(false);
    setSelectedContext(EMPTY_CONTEXT);
    setContextSearch("");
    setIsContextPickerOpen(false);
    onFocusChange(false);
  };

  const selectedContextChips = selectedContext.multiSelect.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2">
      {selectedContext.multiSelect.map((entity) => (
        <Chip color="accent" key={`${entity.entity_type}-${entity.id}`} size="sm" variant="soft">
          <Chip.Label>{entity.label}</Chip.Label>
          <button
            aria-label={`Remove ${entity.label}`}
            className="inline-flex shrink-0 rounded-full p-0.5 text-foreground outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              setSelectedContext((current) => ({
                ...current,
                multiSelect: current.multiSelect.filter((item) => !(
                  item.id === entity.id && item.entity_type === entity.entity_type
                )),
              }));
            }}
            type="button"
          >
            <LuX aria-hidden size={14} />
          </button>
        </Chip>
      ))}
    </div>
  ) : null;

  return (
    <div className={focused
      ? "flex h-full min-h-0 min-w-0 flex-col gap-3"
      : conversationStarted
        ? "flex min-w-0 flex-col gap-3"
      : `flex min-w-0 flex-col gap-3${isAccessNoticeVisible ? "" : " lg:h-[18rem]"}`}
    >
      {conversationStarted ? (
        <div className="flex shrink-0 flex-row justify-end">
          <Button onPress={clearChat} size="sm" variant="tertiary">
            <LuChevronUp aria-hidden />
            Close answer
          </Button>
        </div>
      ) : null}
      <AiAccessNotice
        availability={availability}
        canManagePlatform={user.admin === true}
        canManageTeam={isTeamAdmin}
        error={availabilityError}
        isLoading={isAvailabilityLoading}
        isRequested={showAccessNotice}
        onRetry={reloadAvailability}
      />
      {saved ? (
        <p className="text-sm text-success">Conversation saved.</p>
      ) : null}
      <AiChat
        fill={focused || !conversationStarted}
        framed
        id="home-ask"
        isLoading={chat.isLoading}
        leadingContent={selectedContextChips}
        leadingControl={(
          <AiContextPicker
            contentClassName="w-80"
            contextEntities={contextEntities}
            contextSearch={contextSearch}
            error={contextLoadError}
            getContextLabel={(entity) => entity.label || entity.name}
            isLoading={chat.isLoading}
            isOpen={isContextPickerOpen}
            isSearching={isContextLoading}
            onOpenChange={setIsContextPickerOpen}
            placement="top start"
            selectedContext={selectedContext}
            setContextSearch={setContextSearch}
            setSelectedContext={setSelectedContext}
            showTriggerLabel
            triggerSize="sm"
            triggerVariant="outline"
          />
        )}
        messages={chat.messages}
        onAtTyped={() => setIsContextPickerOpen(true)}
        onChangeAction={onChangeAction}
        onChartAction={onChartAction}
        onConfirmAction={onConfirmAction}
        onSave={onSave}
        onSubmit={onSubmit}
        placeholder={questionPlaceholder}
        progressEvents={chat.progressEvents}
        selectedContext={selectedContext}
        showSave={Boolean(chat.sessionId)}
        status={(
          <AiAvailabilityStatus
            availability={availability}
            canManagePlatform={user.admin === true}
            canManageTeam={isTeamAdmin}
          />
        )}
        suggestions={conversationStarted ? [] : [
          "Summarize recent changes",
          "Which metrics need attention?",
          "Check data freshness",
        ]}
        toolDisplayNames={chat.toolDisplayNames}
        teamId={teamId}
      />
    </div>
  );
}

HomeAsk.propTypes = {
  focused: PropTypes.bool.isRequired,
  onFocusChange: PropTypes.func.isRequired,
  teamId: PropTypes.number.isRequired,
};

export default HomeAsk;
