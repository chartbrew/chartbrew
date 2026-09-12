import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
import { LuExternalLink } from "react-icons/lu";
import { useDispatch } from "react-redux";

import { getAiConnectionSetup } from "../../api/ai";
import { runSourceAction } from "../../slices/connection";
import { saveAndStartMcpOAuth } from "../../sources/mcp/mcp-oauth";
import SOURCE_DEFINITIONS, { getSourceDefinitionLogo } from "../../sources/definitions";
import { canCreateSourceConnections } from "../../sources/sourceAvailability";
import { useTheme } from "../../modules/ThemeContext";

function AiConnectionCard({ option, teamId, conversationId, onEnsureSaved, onContinue, isLoading }) {
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const [current, setCurrent] = useState(option);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [setupOpened, setSetupOpened] = useState(false);
  const busy = useRef(false);
  const savedId = useRef(conversationId);

  useEffect(() => {
    setCurrent(option);
    savedId.current = conversationId;
    let mounted = true;
    const refresh = () => {
      if (!conversationId || !option.provider_id) return;
      getAiConnectionSetup({ teamId, conversationId, providerId: option.provider_id })
        .then((result) => { if (mounted) { setCurrent(result); setError(null); } })
        .catch((requestError) => { if (mounted) setError(requestError.message); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { mounted = false; window.removeEventListener("focus", refresh); };
  }, [conversationId, option, teamId]);

  const connect = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (!savedId.current) savedId.current = (await onEnsureSaved?.())?.aiConversationId;
      if (!savedId.current) throw new Error("The conversation could not be saved. Try again.");
      const result = await getAiConnectionSetup({
        teamId, conversationId: savedId.current, providerId: current.provider_id, create: true,
      });
      setCurrent(result);
      if (result.state === "connected") return;
      const url = await saveAndStartMcpOAuth({
        save: async () => ({ id: result.connection_id }),
        startOAuth: (connectionId) => dispatch(runSourceAction({
          team_id: teamId, connection_id: connectionId, action: "startOAuth",
          params: { conversationId: savedId.current },
        })).unwrap(),
      });
      window.location.assign(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const connected = current.state === "connected";
  const oauth = current.state === "mcp_oauth_setup";
  const review = current.needs_approval || (current.state === "admin_required" && current.connection_id);
  const source = SOURCE_DEFINITIONS.find((item) => item.id === (current.source_id || "mcp"));
  const provider = source?.providers?.[current.provider_id];
  const logo = getSourceDefinitionLogo(provider || source, isDark);
  const canSetUp = Boolean(current.connection_id) || SOURCE_DEFINITIONS
    .some((source) => source.id === (current.source_id || "mcp") && canCreateSourceConnections(source));
  // Build local links from references, never from assistant-authored prose.
  let setupUrl = null;
  if (current.connection_id) setupUrl = `/connections/${encodeURIComponent(current.connection_id)}`;
  else if (["native_setup", "manual_mcp_setup"].includes(current.state)) {
    setupUrl = `/connections/new?type=${encodeURIComponent(current.source_id || "mcp")}`;
  }

  let setupLabel = "Connect";
  if (review) setupLabel = "Review access";

  let description = null;
  if (current.state === "manual_mcp_setup") {
    description = "Check whether this source offers an MCP server before setting it up.";
  } else if (review) {
    description = "Approve access to the data you want to use.";
  } else if (connected) {
    description = "Connected";
  } else if (current.state === "admin_required") {
    description = "Ask a team owner or admin to connect this source.";
  } else if (current.state === "unsupported") {
    description = "This source is unavailable. Choose another data source.";
  }
  if (!canSetUp && (oauth || setupUrl)) description = "This connection is unavailable. Choose another source.";

  return (
    <Card className="my-3 w-full max-w-lg gap-3 rounded-xl bg-surface p-3 shadow-none" aria-label={`${current.name} connection`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card.Header className="min-w-0 flex-1 flex-row items-center gap-3">
          {logo ? <img src={logo} alt="" className="size-6 shrink-0 object-contain" /> : null}
          <div className="min-w-0">
            <Card.Title className="break-words text-sm">{current.name}</Card.Title>
            {description ? <Card.Description className="text-sm">{description}</Card.Description> : null}
          </div>
        </Card.Header>
        <Card.Footer className="flex flex-wrap gap-2">
          {oauth && canSetUp ? (
            <Button className="h-auto min-h-10 whitespace-normal rounded-lg py-2" isDisabled={isLoading} isPending={pending} onPress={connect} variant="primary">
              {pending ? "Connecting…" : error ? "Try again" : "Connect"}
              <LuExternalLink size={16} className="shrink-0" aria-hidden />
            </Button>
          ) : null}
          {setupUrl && (!connected || review) && (!oauth || error) && canSetUp ? (
            <Button
              className="h-auto min-h-10 whitespace-normal rounded-lg py-2"
              variant={oauth ? "secondary" : "primary"}
              onPress={() => setSetupOpened(true)}
              render={(props) => <a {...props} href={setupUrl} target="_blank" rel="noopener noreferrer" />}
            >
              {oauth ? "Open connection" : setupLabel}
              <LuExternalLink size={16} aria-hidden />
            </Button>
          ) : null}
          {setupOpened && (!connected || review) ? (
            <Button
              className="rounded-lg"
              isDisabled={isLoading || pending}
              onPress={() => onContinue(`I added the connection for ${current.name}. Check connections again and continue my original request.`)}
              variant="secondary"
            >
              I added the connection
            </Button>
          ) : null}
          {connected && !review ? (
            <Button className="rounded-lg" isDisabled={isLoading} onPress={() => onContinue(`Continue my request using ${current.name}.`)} variant="primary">
              Continue request
            </Button>
          ) : null}
        </Card.Footer>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </Card>
  );
}

AiConnectionCard.propTypes = {
  option: PropTypes.object.isRequired,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  conversationId: PropTypes.string,
  onEnsureSaved: PropTypes.func,
  onContinue: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default AiConnectionCard;
