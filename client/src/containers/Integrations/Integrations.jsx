import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Separator } from "@heroui/react";
import { useNavigate } from "react-router";
import { LuArrowRight } from "react-icons/lu";
import { VscMcp } from "react-icons/vsc";

import WebhookIntegrationsList from "./components/WebhookIntegrationsList";
import {
  getTeamIntegrations,
} from "../../slices/integration";
import { selectTeam } from "../../slices/team";
import SlackIntegrationsList from "./components/SlackIntegrationsList";

function Integrations() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const team = useSelector(selectTeam);
  const initRef = useRef(false);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      dispatch(getTeamIntegrations({ team_id: team?.id }));
      initRef.current = true;
    }
  }, [team]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            Integrations
          </div>
          <div className="text-sm text-foreground-500">
            {"Create and manage your integrations with external services"}
          </div>
        </div>
      </div>

      <div className="h-4" />

      <div className="flex flex-col bg-surface p-4 rounded-3xl border border-divider">
        <WebhookIntegrationsList
          teamId={team?.id}
        />
        <div className="h-8" />
        <Separator />
        <div className="h-8" />
        <SlackIntegrationsList
          teamId={team?.id}
        />
        <div className="h-8" />
        <Separator />
        <div className="h-8" />

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <VscMcp aria-hidden size={24} />
              Connect your AI app with MCP
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              Use Chartbrew data in Codex, Claude, and other AI apps. Find setup guides and
              manage connected clients in MCP settings.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => navigate("/settings/mcp")}
          >
            Open MCP settings
            <LuArrowRight aria-hidden />
          </Button>
        </section>
      </div>
    </div>
  );
}

export default Integrations;
