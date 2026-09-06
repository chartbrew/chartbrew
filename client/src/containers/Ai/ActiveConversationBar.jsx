import React, { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { LuArrowUpRight, LuLoader, LuMessageSquare, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";

import { getAiConversation } from "../../api/ai";
import { selectUser } from "../../slices/user";
import { selectTeam } from "../../slices/team";
import {
  dismissAiConversation, selectActiveAiConversation, selectAiModalOpen,
  selectInlineAiConversationKey, setActiveAiConversation, showAiModal, updateActiveAiConversation,
} from "../../slices/ui";
import { isActiveConversationFor, readActiveConversation, writeActiveConversation } from "./activeConversation";

export default function ActiveConversationBar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const active = useSelector(selectActiveAiConversation);
  const modalOpen = useSelector(selectAiModalOpen);
  const inlineKey = useSelector(selectInlineAiConversationKey);
  const { pathname } = useLocation();
  const [loadedScope, setLoadedScope] = useState(null);
  const scope = user?.id && team?.id ? `${user.id}:${team.id}` : null;
  const inScope = isActiveConversationFor(active, user?.id, team?.id);

  useEffect(() => {
    if (!scope) {
      if (loadedScope) writeActiveConversation(...loadedScope.split(":"), null);
      dispatch(dismissAiConversation());
      setLoadedScope(null);
      return;
    }
    if (!isActiveConversationFor(active, user.id, team.id)) {
      dispatch(setActiveAiConversation(readActiveConversation(user.id, team.id)));
    }
    setLoadedScope(scope);
  }, [scope]);

  useEffect(() => {
    if (!scope || loadedScope !== scope || (active && !inScope)) return;
    writeActiveConversation(user.id, team.id, active);
  }, [active?.id, active?.key, inScope, loadedScope, scope]);

  useEffect(() => {
    if (!inScope || !active?.id || active.busy) return undefined;
    let cancelled = false;
    getAiConversation(active.id, team.id).then(({ conversation }) => {
      if (!cancelled) dispatch(updateActiveAiConversation({ key: active.key, title: conversation.title }));
    }).catch((error) => {
      if (!cancelled && [403, 404].includes(error.status)) dispatch(dismissAiConversation(active.key));
    });
    return () => { cancelled = true; };
  }, [active?.id, active?.key, active?.busy, inScope, team?.id]);

  const publicPage = /^\/(login|signup|passwordReset|b|report|share|google-auth|invite)(\/|$)/.test(pathname)
    || /\/(embedded|share)(\/|$)/.test(pathname);
  if (!inScope || (!active.id && !active.busy) || publicPage || modalOpen || active.key === inlineKey) return null;

  return (
    <div className="active-conversation-bar" role="region" aria-label="Active conversation">
      <Button
        className="active-conversation-bar__open"
        variant="outline"
        isDisabled={!active.id || active.busy}
        onPress={() => dispatch(showAiModal({ conversationId: active.id }))}
        aria-label={`Continue conversation: ${active.title}`}
      >
        {active.busy ? <LuLoader className="animate-spin motion-reduce:animate-none shrink-0" aria-hidden /> : <LuMessageSquare className="shrink-0 text-accent" aria-hidden />}
        <span className="min-w-0 flex-1 truncate text-left">{active.title}</span>
        <LuArrowUpRight className="shrink-0 text-muted" aria-hidden />
      </Button>
      <Button
        className="active-conversation-bar__dismiss"
        variant="outline"
        isIconOnly
        aria-label="Dismiss active conversation"
        onPress={() => dispatch(dismissAiConversation(active.key))}
      >
        <LuX aria-hidden />
      </Button>
    </div>
  );
}
