import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip, Label, ListBox, Popover } from "@heroui/react";
import { LuChartNoAxesColumn, LuClock, LuMessageSquare, LuPlus } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";

import AiAccessNotice from "../../Ai/AiAccessNotice";
import AiAvailabilityStatus from "../../Ai/AiAvailabilityStatus";
import AiChat from "../../Ai/AiChat";
import { canSubmitAiMessage } from "../../Ai/aiAvailability";
import useAiChat from "../../Ai/hooks/useAiChat";
import useAiAvailability from "../../Ai/hooks/useAiAvailability";
import { getAiConversations } from "../../../api/ai";
import { selectActiveAiConversation } from "../../../slices/ui";
import { getChart } from "../../../slices/chart";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import { didAiUpdateActiveChart } from "../chartStudioState";
import ChartbrewAiIcon from "../../../components/ChartbrewAiIcon";

function ChartStudioChat({ chartId, projectId, disabled = false }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const submittedPrompt = useRef(false);
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [accessRequested, setAccessRequested] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const [selectionError, setSelectionError] = useState(null);
  const [retry, setRetry] = useState(0);
  const active = useSelector(selectActiveAiConversation);
  const selection = new URLSearchParams(location.search).get("conversation");
  const requestBusy = active?.busy && String(active.studio_chart_id) === String(chartId)
    && String(active.userId) === String(user.id) && String(active.teamId) === String(team?.id);
  const wasBusy = useRef(Boolean(requestBusy));
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const context = useMemo(() => [{ entity_type: "chart", id: chartId }], [chartId]);
  const chat = useAiChat({ activeChartId: chartId, context, teamId: team?.id });
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

  const selectConversation = (id, replace = false) => {
    const query = new URLSearchParams(location.search);
    query.set("conversation", id);
    navigate({ pathname: location.pathname, search: query.toString() }, {
      replace,
      state: { ...location.state, openChat: true },
    });
    setListOpen(false);
  };

  useEffect(() => {
    if (!team?.id) return undefined;
    let cancelled = false;
    setSelectionReady(false);
    setSelectionError(null);
    (async () => {
      try {
        if (!selection) {
          if (location.state?.chartPrompt) {
            selectConversation("new", true);
            return;
          }
          const { conversations: recent } = await getAiConversations(team.id, { studioChartId: chartId, limit: 1 });
          if (!cancelled) selectConversation(recent[0]?.id || "new", true);
          return;
        }
        if (selection === "new") chat.clear();
        else if (selection !== chat.aiConversationId) {
          const loaded = await chat.load(selection);
          if (!loaded) return;
        }
        if (!cancelled) setSelectionReady(true);
      } catch (_error) {
        if (!cancelled) setSelectionError("Could not load conversations. Try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [chartId, team?.id, selection, retry, chat.load]);

  useEffect(() => {
    if (chat.aiConversationId && selection === "new") selectConversation(chat.aiConversationId, true);
  }, [chat.aiConversationId]);

  useEffect(() => {
    if (wasBusy.current && !requestBusy && !chat.isLoading) {
      if (selection && selection !== "new") {
        setSelectionReady(false);
        chat.load(selection).then((loaded) => {
          if (selectionRef.current === selection) setSelectionReady(Boolean(loaded));
        });
      }
      else if (active?.id) selectConversation(active.id, true);
      dispatch(getChart({ project_id: projectId, chart_id: chartId }));
    }
    if (requestBusy && !chat.isLoading) wasBusy.current = true;
    else if (!chat.isLoading) wasBusy.current = false;
  }, [requestBusy, chat.isLoading]);

  const loadConversations = async (more = false) => {
    setListLoading(true);
    setListError(null);
    try {
      const { conversations: page } = await getAiConversations(team.id, {
        studioChartId: chartId, limit: 20, offset: more ? conversations.length : 0,
      });
      setConversations((current) => more ? [...current, ...page] : page);
      setHasMore(page.length === 20);
    } catch (_error) {
      setListError("Could not load conversations. Try again.");
    } finally {
      setListLoading(false);
    }
  };

  const busy = chat.isLoading || Boolean(requestBusy);
  const loadError = selectionError || (!selectionReady ? chat.error : null);

  const refreshAfterChange = async (orchestration) => {
    if (!didAiUpdateActiveChart(orchestration, chartId)) return orchestration;
    try {
      await dispatch(getChart({ project_id: projectId, chart_id: chartId })).unwrap();
    } catch (_error) {
      toast.error("The chart changed, but this editor could not refresh it. Reload the page to see the saved change.");
    }
    return orchestration;
  };

  const onSubmit = (message) => {
    if (busy || !selectionReady) return false;
    if (disabled || !canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return false;
    }
    setAccessRequested(false);
    chat.sendMessage(message).then(refreshAfterChange);
    return true;
  };

  useEffect(() => {
    const prompt = location.state?.chartPrompt;
    if (!prompt || submittedPrompt.current || disabled || !selectionReady || busy || !team?.id
      || !canSubmitAiMessage(availability)) return;
    submittedPrompt.current = true;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { ...location.state, chartPrompt: null },
    });
    chat.sendMessage(`Build this chart: ${prompt}`).then(refreshAfterChange);
  }, [availability, disabled, team?.id, location.state?.chartPrompt, selectionReady, busy]);

  const onChangeAction = (action) => {
    if (busy || !selectionReady) return null;
    if (disabled || !canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return null;
    }
    setAccessRequested(false);
    return chat.changeAction(action);
  };

  const onConfirmAction = async (action) => {
    if (busy || !selectionReady) return null;
    if (disabled || !canSubmitAiMessage(availability)) {
      setAccessRequested(true);
      return null;
    }
    setAccessRequested(false);
    return refreshAfterChange(await chat.confirmAction(action));
  };

  return (
    <div className="chart-studio-chat flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <LuMessageSquare aria-hidden className="mr-1 shrink-0 text-muted" size={16} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium" title={chat.title || "New conversation"}>
          {chat.title || (selection && selection !== "new" ? "Conversation" : "New conversation")}
        </h3>
        <Button
          aria-label="New conversation"
          isDisabled={busy}
          isIconOnly
          onPress={() => selectConversation("new")}
          size="sm"
          title="New conversation"
          variant="ghost"
        >
          <LuPlus aria-hidden size={18} />
        </Button>
        <Popover
          isOpen={listOpen}
          onOpenChange={(open) => {
            setListOpen(open);
            if (open) loadConversations();
          }}
        >
          <Button
            aria-label="Conversation history"
            isDisabled={busy}
            isIconOnly
            size="sm"
            title="Conversation history"
            variant="ghost"
          >
            <LuClock aria-hidden size={18} />
          </Button>
          <Popover.Content className="w-80 max-w-[calc(100vw-2rem)]" placement="bottom end">
            <Popover.Dialog>
              <Popover.Heading className="px-2 text-sm text-muted">Previous conversations</Popover.Heading>
              <div className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {conversations.length > 0 ? (
                  <ListBox
                    aria-label="Previous conversations"
                    disallowEmptySelection
                    onSelectionChange={(keys) => selectConversation([...keys][0])}
                    selectedKeys={selection ? [selection] : []}
                    selectionMode="single"
                  >
                    {conversations.map((item) => (
                      <ListBox.Item id={item.id} key={item.id} textValue={item.title}>
                        <ListBox.ItemIndicator />
                        <Label className="min-w-0 flex-1 truncate" title={item.title}>{item.title}</Label>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                ) : null}
                {!listLoading && !listError && conversations.length === 0 ? (
                  <p className="py-2 text-sm text-muted">No conversations yet. Start a new conversation.</p>
                ) : null}
                {listError ? <p className="text-sm text-danger" role="alert">{listError}</p> : null}
                {hasMore || listError || listLoading ? (
                  <Button
                    isPending={listLoading}
                    onPress={() => loadConversations(!listError && hasMore)}
                    size="sm"
                    variant="tertiary"
                  >
                    {listError ? "Retry" : "Load more"}
                  </Button>
                ) : null}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      {loadError ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-danger">{loadError}</p>
          <Button onPress={() => setRetry((value) => value + 1)} size="sm" variant="secondary">
            Retry
          </Button>
        </div>
      ) : null}
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
        history={chat.history}
        emptyState={!selectionReady ? (
          <p className="text-sm text-muted">{loadError ? "Select a conversation or start a new one." : "Loading conversation…"}</p>
        ) : canSubmitAiMessage(availability) ? (
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
        isLoading={busy || !selectionReady}
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
        selectedContext={{ multiSelect: chat.selectedContext, singleSelect: null }}
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
  disabled: PropTypes.bool,
  chartId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};

export default ChartStudioChat;
