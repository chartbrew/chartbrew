import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card, Chip } from "@heroui/react";
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
  const sourceName = provider?.name || source?.name || current.name;
  const logo = getSourceDefinitionLogo(provider || source, isDark);
  const canSetUp = Boolean(current.connection_id) || SOURCE_DEFINITIONS
    .some((source) => source.id === (current.source_id || "mcp") && canCreateSourceConnections(source));
  // Build local links from references, never from assistant-authored prose.
  let setupUrl = null;
  if (current.connection_id) setupUrl = `/connections/${encodeURIComponent(current.connection_id)}`;
  else if (["native_setup", "manual_mcp_setup"].includes(current.state)) {
    setupUrl = `/connections/new?type=${encodeURIComponent(current.source_id || "mcp")}`;
  }

  let status = "Not connected";
  if (pending) status = "Connecting";
  else if (connected) status = "Connected";
  else if (current.state === "admin_required") status = "Admin needed";
  else if (current.state === "unsupported") status = "Unavailable";

  let setupLabel = `Set up ${sourceName}`;
  if (review) setupLabel = "Review tool access";
  else if (connected) setupLabel = "Open connection";

  let description = source?.setupDescription
    || `Connect ${sourceName} to Chartbrew to use its data in your charts. Complete setup in a new tab, then return here to continue your request.`;
  if (oauth) {
    description = `Connect your ${sourceName} account to Chartbrew through ${sourceName}'s MCP server. This lets Chartbrew request data using the tools you approve.`;
  } else if (current.state === "manual_mcp_setup") {
    description = `To use ${current.name} in Chartbrew, you need its MCP server address and sign-in details. Automatic setup is not available. Open setup to enter them, not this chat.`;
  } else if (review) {
    description = `${current.name} needs approval before Chartbrew can use its data. Open the connection and approve the read-only tools you want to use, then return here.`;
  } else if (connected) {
    description = `${current.name} is connected to Chartbrew. Continue your request to check the available data and build your charts.`;
  } else if (current.state === "admin_required") {
    description = `Ask a team owner or admin to connect ${current.name} to Chartbrew, then return here to continue.`;
  } else if (current.state === "unsupported") {
    description = `Chartbrew cannot set up ${current.name} here. Choose another data source to continue.`;
  }
  if (!canSetUp && (oauth || setupUrl)) description = "This connection is not available for setup. Choose another source.";

  return (
    <Card className="my-3 w-full gap-3 rounded-[2rem] bg-foreground/[0.055] p-3 shadow-none dark:bg-foreground/[0.08]" aria-label={`${current.name} connection`}>
      <Card.Header className="flex flex-row flex-wrap items-center justify-between gap-3 px-2 py-1">
        <div className="flex min-w-0 items-center gap-3">
          {logo ? <img src={logo} alt="" className="size-7 shrink-0 object-contain" /> : null}
          <Card.Title className="break-words text-base">{current.name}</Card.Title>
        </div>
        <Chip size="sm" variant="soft" color={connected ? "success" : "default"}>{status}</Chip>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4 rounded-[1.25rem] bg-surface p-4">
        <Card.Description className="text-sm leading-relaxed text-foreground">{description}</Card.Description>
        {oauth && canSetUp ? (
          <p className="text-sm leading-relaxed text-muted">
            {`Chartbrew will save this conversation and open ${sourceName} sign-in. You will return to the connection page to approve tools. Your chat stays saved.`}
          </p>
        ) : null}
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <Card.Footer className="flex flex-wrap gap-2">
          {oauth && canSetUp ? (
            <Button className="h-auto min-h-10 whitespace-normal rounded-lg py-2" isDisabled={isLoading} isPending={pending} onPress={connect} variant="primary">
              {pending ? "Connecting…" : error ? "Try again" : `Connect ${sourceName}`}
              <LuExternalLink size={16} className="shrink-0" aria-hidden />
            </Button>
          ) : null}
          {setupUrl && (!oauth || error) && canSetUp ? (
            <Button
              className="h-auto min-h-10 whitespace-normal rounded-lg py-2"
              variant={oauth || (connected && !review) ? "secondary" : "primary"}
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
      </Card.Content>
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
