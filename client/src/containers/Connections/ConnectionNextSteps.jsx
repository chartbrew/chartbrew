import React, { useEffect } from "react";
import {
  Button,
  Card,
  Surface,
} from "@heroui/react";
import {
  LuBrainCircuit,
  LuChartArea,
  LuLayers,
  LuLayoutDashboard,
} from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";

import canAccess from "../../config/canAccess";
import getConnectionLogo from "../../modules/getConnectionLogo";
import {
  getChartTemplate,
  listChartTemplates,
  selectActiveChartTemplate,
  selectChartTemplates,
  selectChartTemplateResult,
} from "../../slices/chartTemplate";
import { getConnection, selectConnections } from "../../slices/connection";
import { getProjects, selectProjects } from "../../slices/project";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { showAiModal } from "../../slices/ui";
import { useTheme } from "../../modules/ThemeContext";
import ChartTemplateSetup from "./components/ChartTemplateSetup";
import { findSourceForConnection } from "../../sources";

function ConnectionNextSteps() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const params = useParams();
  const { isDark } = useTheme();

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const connections = useSelector(selectConnections);
  const projects = useSelector(selectProjects);
  const template = useSelector(selectActiveChartTemplate);
  const templates = useSelector(selectChartTemplates);
  const result = useSelector(selectChartTemplateResult);
  const templateLoading = useSelector((state) => state.chartTemplate.loading);
  const templateError = useSelector((state) => state.chartTemplate.error);

  const connection = connections.find((item) => `${item.id}` === `${params.connectionId}`);
  const source = findSourceForConnection(connection);
  const hasChartTemplates = Boolean(source?.capabilities?.nextSteps?.chartTemplates);
  const SourceChartTemplateSetup = source?.frontend?.ChartTemplateSetup;
  const usesCustomChartTemplateSetup = Boolean(SourceChartTemplateSetup);
  const canUseAi = user?.id && team?.TeamRoles && canAccess("teamAdmin", user.id, team.TeamRoles);

  useEffect(() => {
    if (team?.id && params.connectionId) {
      dispatch(getConnection({ team_id: team.id, connection_id: params.connectionId }));
      dispatch(getProjects({ team_id: team.id }));
    }
  }, [dispatch, params.connectionId, team?.id]);

  useEffect(() => {
    if (team?.id && hasChartTemplates && source?.id) {
      dispatch(listChartTemplates({ team_id: team.id, source: source.id }))
        .then((response) => {
          if (usesCustomChartTemplateSetup) return;

          const firstTemplate = response.payload?.[0];
          if (firstTemplate) {
            dispatch(getChartTemplate({
              team_id: team.id,
              source: firstTemplate.source,
              slug: firstTemplate.slug,
            }));
          }
        });
    }
  }, [dispatch, hasChartTemplates, source?.id, team?.id, usesCustomChartTemplateSetup]);

  const _onAskAi = () => {
    dispatch(showAiModal());
  };

  const _onBuildFromScratch = () => {
    navigate(`/datasets/new?connection_id=${params.connectionId}`);
  };

  const _loadTemplate = (templateSummary) => {
    if (!team?.id || !templateSummary?.source || !templateSummary?.slug) return;
    dispatch(getChartTemplate({
      team_id: team.id,
      source: templateSummary.source,
      slug: templateSummary.slug,
    }));
  };

  const _onNavigateHome = () => {
    navigate("/");
  };

  const _renderGenericNextSteps = () => (
    <Surface className="rounded-3xl border border-divider p-5" variant="default">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xl font-semibold">Your connection is ready</p>
          <p className="text-sm text-foreground-500">Create a dataset to start visualizing this source.</p>
        </div>
        <div className="flex flex-col gap-4 w-full">
          <div
            className="cursor-pointer rounded-2xl"
            onClick={_onBuildFromScratch}
          >
            <Card className="flex h-auto flex-col border border-divider shadow-none transition-all duration-200 hover:border-accent/40 hover:ring-1 hover:ring-accent/40 sm:flex-row">
              <div className="flex shrink-0 items-center justify-center overflow-hidden p-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
                  <LuLayers size={32} className="text-accent" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <Card.Header className="gap-1">
                  <Card.Title className="text-base">Create a dataset</Card.Title>
                  <Card.Description>
                    Start by creating a dataset from scratch. This gives you full control over how your data is fetched and transformed.
                  </Card.Description>
                </Card.Header>
                <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-muted">Start from scratch</span>
                  </div>
                  <Button
                    variant="tertiary"
                    onClick={(e) => e.stopPropagation()}
                    onPress={_onBuildFromScratch}
                  >
                    Create dataset
                  </Button>
                </Card.Footer>
              </div>
            </Card>
          </div>

          {canUseAi && (
            <div
              className="cursor-pointer rounded-2xl"
              onClick={_onAskAi}
            >
              <Card className="flex h-auto flex-col border border-divider shadow-none transition-all duration-200 hover:border-secondary/40 hover:ring-1 hover:ring-secondary/35 sm:flex-row">
                <div className="flex shrink-0 items-center justify-center overflow-hidden p-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-secondary/30 bg-secondary/10">
                    <LuBrainCircuit size={32} className="text-secondary" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <Card.Header className="gap-1">
                    <Card.Title className="text-base">Create with AI</Card.Title>
                    <Card.Description>
                      Let AI suggest queries and chart ideas so you can move faster when exploring a new data source.
                    </Card.Description>
                  </Card.Header>
                  <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-muted">AI-assisted setup</span>
                    </div>
                    <Button
                      variant="tertiary"
                      onClick={(e) => e.stopPropagation()}
                      onPress={_onAskAi}
                    >
                      Create with AI
                    </Button>
                  </Card.Footer>
                </div>
              </Card>
            </div>
          )}

          <div
            className="cursor-pointer rounded-2xl"
            onClick={_onNavigateHome}
          >
            <Card className="flex h-auto flex-col border border-divider shadow-none transition-all duration-200 hover:border-success/40 hover:ring-1 hover:ring-success/35 sm:flex-row">
              <div className="flex shrink-0 items-center justify-center overflow-hidden p-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-success/30 bg-success/10">
                  <LuLayoutDashboard size={32} className="text-success" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <Card.Header className="gap-1">
                  <Card.Title className="text-base">Return to dashboards</Card.Title>
                  <Card.Description>
                    Go back to your workspace home to open existing dashboards or switch projects without creating a dataset yet.
                  </Card.Description>
                </Card.Header>
                <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-muted">Workspace home</span>
                  </div>
                  <Button
                    variant="tertiary"
                    onClick={(e) => e.stopPropagation()}
                    onPress={_onNavigateHome}
                  >
                    Return to dashboards
                  </Button>
                </Card.Footer>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Surface>
  );

  if (!connection) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <span className="text-sm text-foreground-500">Loading connection...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto 2xl:mx-0">
      <Surface className="rounded-3xl border border-divider p-5" variant="default">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-row items-center gap-3">
            <img
              alt={connection.subType || connection.type}
              className="h-14 w-14 rounded-lg object-contain"
              src={getConnectionLogo(connection, isDark)}
            />
            <div>
              <p className="text-xl font-semibold">{connection.name}</p>
              <p className="text-sm text-foreground-500">
                {usesCustomChartTemplateSetup ? "What do you want to track?" : "Choose how you want to start building."}
              </p>
            </div>
          </div>
          <Button variant="tertiary" onPress={_onBuildFromScratch}>
            <LuChartArea />
            Build from scratch
          </Button>
        </div>
      </Surface>

      <div className="h-4" />
      {!hasChartTemplates && _renderGenericNextSteps()}

      {hasChartTemplates && (
        <>
          {!usesCustomChartTemplateSetup && templates.length > 1 && (
            <Surface className="mb-4 rounded-3xl border border-divider p-4" variant="default">
              <div className="flex flex-row flex-wrap gap-2">
                {templates.map((templateSummary) => (
                  <Button
                    key={templateSummary.id}
                    variant={template?.slug === templateSummary.slug ? "secondary" : "tertiary"}
                    onPress={() => _loadTemplate(templateSummary)}
                  >
                    {templateSummary.name}
                    <span className="text-xs text-muted">
                      {templateSummary.datasets.length} datasets
                    </span>
                  </Button>
                ))}
              </div>
            </Surface>
          )}

          {SourceChartTemplateSetup ? (
            <SourceChartTemplateSetup
              connection={connection}
              error={templateError || null}
              loading={templateLoading}
              projects={projects}
              teamId={team.id}
              templates={templates}
            />
          ) : (
            <ChartTemplateSetup
              connection={connection}
              error={templateError || null}
              loading={templateLoading}
              projects={projects}
              result={result}
              teamId={team.id}
              template={template}
            />
          )}
        </>
      )}
    </div>
  );
}

export default ConnectionNextSteps;
