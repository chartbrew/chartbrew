import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import {
  Accordion, Button, Chip, ProgressCircle, EmptyState, InputGroup, Table, TextField, cn,
  Tabs,
} from "@heroui/react";
import {
  LuChartArea, LuChevronDown, LuLayers, LuLayoutTemplate, LuPlug, LuPlugZap, LuPlus, LuSearch,
} from "react-icons/lu";

import canAccess from "../../../config/canAccess";
import availableConnections from "../../../modules/availableConnections";
import { selectProjects } from "../../../slices/project";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import { getTeamConnections, selectConnections } from "../../../slices/connection";
import {
  clearChartTemplateResult,
  listChartTemplates,
  selectChartTemplateResult,
  selectChartTemplates,
} from "../../../slices/chartTemplate";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import HeroPaginationNav from "../../../components/HeroPaginationNav";
import { findSourceForConnection } from "../../../sources";

const connectionTypeLabels = availableConnections.reduce((acc, connection) => ({
  ...acc,
  [connection.type]: connection.name,
}), {
  chartmogul: "ChartMogul",
  customerio: "Customer.io",
  mailgun: "Mailgun",
  plausible: "Plausible",
  simpleanalytics: "Simple Analytics",
  strapi: "Strapi",
  stripe: "Stripe Legacy",
  supabase: "Supabase",
  supabaseapi: "Supabase API",
  stripeOfficial: "Stripe",
});

const _formatConnectionType = (type) => {
  if (!type) return "Unknown source";
  if (connectionTypeLabels[type]) return connectionTypeLabels[type];

  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const _formatLastModified = (dateValue) => {
  if (!dateValue) return "Recently";
  return moment(dateValue).fromNow();
};

const DATASETS_PER_PAGE = 25;

function ChartDescription(props) {
  const {
    datasets,
    creatingDatasetId,
    creatingNewDataset,
    onCreateFromDataset,
    onCreateDataset,
  } = props;

  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("datasets");
  const [expandedTemplateKeys, setExpandedTemplateKeys] = useState(new Set());

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const params = useParams();
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const projects = useSelector(selectProjects);
  const connections = useSelector(selectConnections);
  const chartTemplates = useSelector(selectChartTemplates);
  const templateResult = useSelector(selectChartTemplateResult);
  const datasetLoading = useSelector((state) => state.dataset.loading);
  const templateLoading = useSelector((state) => state.chartTemplate.loading);
  const templateError = useSelector((state) => state.chartTemplate.error);

  const canCreateDataset = team?.TeamRoles
    ? canAccess("teamAdmin", user.id, team.TeamRoles)
    : false;
  const isBusy = Boolean(creatingDatasetId) || creatingNewDataset;
  const projectId = params.projectId ? parseInt(params.projectId, 10) : null;

  const _getDatasetTags = (dataset) => {
    if (!projects || !dataset?.project_ids) return [];

    return dataset.project_ids.reduce((tags, projectId) => {
      const project = projects.find((item) => item.id === projectId);
      if (project) tags.push(project.name);
      return tags;
    }, []);
  };

  const _getDatasetConnectionTypes = (dataset) => {
    const connectionTypes = dataset?.DataRequests?.map((request) => (
      _formatConnectionType(request?.Connection?.subType || request?.Connection?.type)
    )) || [];

    return [...new Set(connectionTypes)];
  };

  const _getDatasetConnections = (dataset) => {
    const connections = dataset?.DataRequests?.map((request) => (
      request?.Connection?.name
    )) || [];

    return [...new Set(connections)];
  };

  const filteredDatasets = [...datasets]
    .filter((dataset) => {
      if (!searchValue.trim()) return true;

      const search = searchValue.trim().toLowerCase();
      const haystack = [
        getDatasetDisplayName(dataset),
        ..._getDatasetTags(dataset),
        ..._getDatasetConnectionTypes(dataset),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .sort((a, b) => (
      new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    ));

  const enrichedTemplates = useMemo(() => {
    return [...chartTemplates]
      .map((template) => {
        const requiredConnection = template.requiredConnection || {};
        const matchingConnections = connections.filter((connection) => (
          connection.type === requiredConnection.type
          && connection.subType === requiredConnection.subType
        ));

        return {
          ...template,
          connection: matchingConnections[0] || null,
          isAvailable: matchingConnections.length > 0,
        };
      })
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [chartTemplates, connections]);

  const filteredTemplates = enrichedTemplates.filter((template) => {
    if (!searchValue.trim()) return true;

    const search = searchValue.trim().toLowerCase();
    const haystack = [
      template.name,
      template.description,
      _formatConnectionType(template.requiredConnection?.subType || template.source),
      `${template.datasets?.length || 0} datasets`,
      `${template.charts?.length || 0} charts`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / DATASETS_PER_PAGE));
  const paginatedDatasets = filteredDatasets.slice(
    (currentPage - 1) * DATASETS_PER_PAGE,
    currentPage * DATASETS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!team?.id) return;

    dispatch(listChartTemplates({ team_id: team.id }));
    dispatch(getTeamConnections({ team_id: team.id }));
  }, [dispatch, team?.id]);

  const _onSelectDataset = (selectedDataset) => {
    const dataset = typeof selectedDataset === "object"
      ? selectedDataset
      : datasets.find((item) => `${item.id}` === `${selectedDataset}`);

    if (!dataset || !dataset.id) return;
    if (isBusy) return;
    onCreateFromDataset(dataset);
  };

  const _onCreateTemplateConnection = (template) => {
    if (!template?.isAvailable) {
      navigate(`/connections/new?type=${template.requiredConnection?.subType || template.source}`);
    }
  };

  const _onExpandedTemplatesChange = (keys) => {
    dispatch(clearChartTemplateResult());
    setExpandedTemplateKeys(keys);
  };

  const _getTemplateKey = (template) => template.id || `${template.source}-${template.slug}`;

  const _renderTemplateList = () => (
    <div className="rounded-3xl border border-divider">
      {templateLoading && filteredTemplates.length === 0 && (
        <div className="flex min-h-40 w-full items-center justify-center">
          <ProgressCircle aria-label="Loading templates" />
        </div>
      )}

      {!templateLoading && filteredTemplates.length === 0 && (
        <EmptyState className="flex min-h-40 w-full flex-col items-center justify-center gap-2 text-center">
          <LuLayoutTemplate className="size-6 text-muted" aria-hidden />
          <span className="text-sm text-muted">No templates found</span>
        </EmptyState>
      )}

      {filteredTemplates.length > 0 && (
        <Accordion
          className="w-full"
          expandedKeys={expandedTemplateKeys}
          variant="surface"
          onExpandedChange={_onExpandedTemplatesChange}
        >
          {filteredTemplates.map((template) => {
            const templateKey = _getTemplateKey(template);
            const isUnavailable = !template.isAvailable;
            const connectionLabel = _formatConnectionType(template.requiredConnection?.subType || template.source);
            const isExpanded = expandedTemplateKeys.has(templateKey);
            const templateSource = template.connection ? findSourceForConnection(template.connection) : null;
            const TemplateChartSetup = templateSource?.frontend?.ChartTemplateSetup;
            const canRenderTemplateSetup = isExpanded
              && template.connection
              && projectId
              && canCreateDataset
              && TemplateChartSetup;

            return (
              <Accordion.Item
                key={templateKey}
                id={templateKey}
                className={cn(
                  "rounded-3xl",
                  isUnavailable ? "bg-content2/20" : "bg-surface"
                )}
              >
                <Accordion.Heading>
                  <Accordion.Trigger className="flex w-full items-start gap-3 p-4 text-left">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg border border-divider bg-content2/40 text-foreground-500",
                        isUnavailable ? "opacity-60" : ""
                      )}
                    >
                      {isUnavailable ? <LuPlugZap size={18} /> : <LuChartArea size={18} />}
                    </span>
                    <span className={cn("flex min-w-0 flex-1 flex-col gap-2", isUnavailable ? "opacity-60" : "")}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{template.name}</span>
                        <Chip size="sm" variant={template.isAvailable ? "soft" : "secondary"}>
                          {connectionLabel}
                        </Chip>
                        {template.connection && (
                          <Chip size="sm" variant="soft" color="accent">
                            <LuPlug size={14} />
                            <Chip.Label>{template.connection.name}</Chip.Label>
                          </Chip>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-2 text-xs text-foreground-500">
                        <span>{`${template.datasets?.length || 0} datasets`}</span>
                        <span>{`${template.charts?.length || 0} charts`}</span>
                      </span>
                    </span>
                    <Accordion.Indicator className="mt-1 text-muted">
                      <LuChevronDown size={16} />
                    </Accordion.Indicator>
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="px-4 pb-4 pt-0">
                    <div className="flex flex-col gap-4">
                      <div className="text-sm text-foreground-500">
                        {template.description}
                      </div>
                      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 text-xs text-foreground-500">
                          <Chip size="sm" variant="secondary">
                            <Chip.Label>{`${template.datasets?.length || 0} datasets`}</Chip.Label>
                          </Chip>
                          <Chip size="sm" variant="secondary">
                            <Chip.Label>{`${template.charts?.length || 0} charts`}</Chip.Label>
                          </Chip>
                        </div>
                        {isUnavailable && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => _onCreateTemplateConnection(template)}
                            isDisabled={isBusy}
                          >
                            <LuPlugZap size={16} />
                            Create connection
                          </Button>
                        )}
                        {!isUnavailable && !canCreateDataset && (
                          <Chip size="sm" variant="secondary">
                            <Chip.Label>Admin access required</Chip.Label>
                          </Chip>
                        )}
                      </div>

                      {canRenderTemplateSetup && (
                        <div className="border-t border-divider pt-4">
                          <TemplateChartSetup
                            connection={template.connection}
                            error={templateError || null}
                            fixedProjectId={projectId}
                            loading={templateLoading}
                            projects={projects}
                            result={templateResult}
                            teamId={team.id}
                            template={template}
                            templates={[template]}
                            title={`Create from ${template.name}`}
                          />
                        </div>
                      )}
                    </div>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </div>
  );

  return (
    <div className="flex flex-col rounded-3xl border border-divider bg-surface p-4">
      <div className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="font-tw text-2xl font-semibold">
            Create a new chart
          </div>
          <div className="text-sm text-foreground-500">
            Start from an existing dataset, template, or build from scratch
          </div>
        </div>
        <div>
          {canCreateDataset && (
            <Button size="sm"
              isDisabled={creatingNewDataset}
              onPress={onCreateDataset}
            >
              {creatingNewDataset ? <ButtonSpinner /> : <LuPlus size={16} />}
              Start from scratch
            </Button>
          )}
        </div>
      </div>
      <div className="h-4" />
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key)}>
        <Tabs.ListContainer className="max-w-md">
          <Tabs.List>
            <Tabs.Tab id="datasets">
              <Tabs.Indicator />
              Datasets
            </Tabs.Tab>
            <Tabs.Tab id="templates">
              <Tabs.Indicator />
              Templates
              <Chip size="sm" variant="soft" color="accent" className="ml-2">
                <Chip.Label>New!</Chip.Label>
              </Chip>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="h-4" />

      <div className="flex flex-row items-center gap-3">
        <div className="w-full md:max-w-sm">
          <TextField aria-label={`Search ${activeTab}`} className="w-full" name={`${activeTab}-search`}>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input
                placeholder={`Search ${activeTab}`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="text-sm"
              />
              <InputGroup.Suffix className="pr-2">
                <LuSearch size={16} className="text-muted" aria-hidden />
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
        </div>
        <div className="text-sm text-foreground-500">
          {activeTab === "datasets"
            ? `Showing ${filteredDatasets.length} of ${datasets.length} datasets`
            : `Showing ${filteredTemplates.length} of ${chartTemplates.length} templates`}
        </div>
      </div>
      <div className="h-4" />

      {activeTab === "templates" && _renderTemplateList()}

      {activeTab === "datasets" && (
        <div className="rounded-3xl">
          <Table className="shadow-none min-h-[200px] border border-divider">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Dataset picker"
                className="min-w-full"
                selectionMode="single"
                onRowAction={(key) => _onSelectDataset(key)}
              >
                <Table.Header>
                  <Table.Column id="name" isRowHeader>Dataset</Table.Column>
                  <Table.Column id="source">Source</Table.Column>
                  <Table.Column id="tags">Tags</Table.Column>
                  <Table.Column id="createdBy">Created by</Table.Column>
                  <Table.Column id="modified">Last modified</Table.Column>
                  <Table.Column id="actions" className="w-12 text-center">
                    <span className="sr-only">Actions</span>
                  </Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    datasetLoading ? (
                      <div className="flex min-h-40 w-full items-center justify-center">
                        <ProgressCircle aria-label="Loading datasets" />
                      </div>
                    ) : (
                      <EmptyState className="flex min-h-40 w-full flex-col items-center justify-center gap-2 text-center">
                        <LuLayers className="size-6 text-muted" aria-hidden />
                        <span className="text-sm text-muted">No datasets found</span>
                      </EmptyState>
                    )
                  )}
                >
                  {paginatedDatasets.map((dataset) => {
                    const tags = _getDatasetTags(dataset);
                    const connectionNames = _getDatasetConnections(dataset);
                    const isCreatingChart = creatingDatasetId === dataset.id;

                    return (
                      <Table.Row key={dataset.id} id={String(dataset.id)}>
                        <Table.Cell>
                          <div className={cn(`min-w-0 ${isBusy && !isCreatingChart ? "opacity-60" : ""} cursor-pointer hover:underline`)}>
                            <div className="truncate text-sm font-medium text-foreground text-wrap min-w-[200px]">
                              {getDatasetDisplayName(dataset)}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className={`flex flex-wrap gap-1 ${isBusy && !isCreatingChart ? "opacity-60" : ""}`}>
                            {connectionNames.length > 0 && connectionNames.map((connectionName) => (
                              <Chip
                                key={`${dataset.id}-${connectionName}`}
                                size="sm"
                                variant="soft"
                              >
                                {connectionName}
                              </Chip>
                            ))}
                            {connectionNames.length === 0 && (
                              <span className="text-sm text-foreground-400">Unknown source</span>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className={`flex flex-wrap gap-1 ${isBusy && !isCreatingChart ? "opacity-60" : ""}`}>
                            {tags.length > 0 && tags.slice(0, 3).map((tag) => (
                              <Chip key={`${dataset.id}-${tag}`} size="sm" variant="soft" >
                                {tag}
                              </Chip>
                            ))}
                            {tags.length > 3 && (
                              <span className="self-center text-xs text-foreground-500">
                                {`+${tags.length - 3} more`}
                              </span>
                            )}
                            {tags.length === 0 && (
                              <span className="text-sm text-foreground-400">No tags</span>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className={`text-sm text-foreground ${isBusy && !isCreatingChart ? "opacity-60" : ""}`}>
                            you
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className={`text-sm text-foreground ${isBusy && !isCreatingChart ? "opacity-60" : ""}`}>
                            {_formatLastModified(dataset.updatedAt || dataset.createdAt)}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex justify-end">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() => _onSelectDataset(dataset)}
                              isDisabled={(isBusy && !isCreatingChart) || isCreatingChart}
                              aria-label={`Create chart from ${getDatasetDisplayName(dataset)}`}
                            >
                              {isCreatingChart ? <ButtonSpinner /> : <LuPlus size={16} />}
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      )}

      {activeTab === "datasets" && filteredDatasets.length > DATASETS_PER_PAGE && (
        <>
          <div className="h-6" />
          <div className="flex justify-center">
            <HeroPaginationNav
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              size="sm"
              className="justify-center"
              ariaLabel="Dataset pagination"
            />
          </div>
        </>
      )}

      <div className="h-2" />
    </div>
  );
}

ChartDescription.propTypes = {
  creatingDatasetId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  creatingNewDataset: PropTypes.bool,
  datasets: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    legend: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    project_ids: PropTypes.array,
    DataRequests: PropTypes.array,
  })).isRequired,
  onCreateDataset: PropTypes.func.isRequired,
  onCreateFromDataset: PropTypes.func.isRequired,
};

ChartDescription.defaultProps = {
  creatingDatasetId: null,
  creatingNewDataset: false,
};

export default ChartDescription;
