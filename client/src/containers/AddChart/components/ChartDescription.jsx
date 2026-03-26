import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import { useSelector } from "react-redux";
import {
  Button, Chip, ProgressCircle, EmptyState, InputGroup, Table, TextField, cn,
} from "@heroui/react";
import {
  LuLayers, LuPlus, LuSearch,
} from "react-icons/lu";

import canAccess from "../../../config/canAccess";
import availableConnections from "../../../modules/availableConnections";
import { selectProjects } from "../../../slices/project";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import HeroPaginationNav from "../../../components/HeroPaginationNav";

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
  stripe: "Stripe",
  supabase: "Supabase",
  supabaseapi: "Supabase API",
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

  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const projects = useSelector(selectProjects);
  const datasetLoading = useSelector((state) => state.dataset.loading);

  const canCreateDataset = team?.TeamRoles
    ? canAccess("teamAdmin", user.id, team.TeamRoles)
    : false;
  const isBusy = Boolean(creatingDatasetId) || creatingNewDataset;

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

  const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / DATASETS_PER_PAGE));
  const paginatedDatasets = filteredDatasets.slice(
    (currentPage - 1) * DATASETS_PER_PAGE,
    currentPage * DATASETS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const _onSelectDataset = (selectedDataset) => {
    const dataset = typeof selectedDataset === "object"
      ? selectedDataset
      : datasets.find((item) => `${item.id}` === `${selectedDataset}`);

    if (!dataset || !dataset.id) return;
    if (isBusy) return;
    onCreateFromDataset(dataset);
  };

  return (
    <div className="flex flex-col rounded-lg border border-divider bg-content1 p-4">
      <div className="flex flex-col gap-1">
        <div className="font-tw text-2xl font-semibold">
          Create chart from dataset
        </div>
        <div className="text-sm text-foreground-500">
          Select an existing dataset or create a new one to build your chart
        </div>
      </div>
      <div className="h-12" />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
        <div className="w-full md:max-w-sm">
          <TextField aria-label="Search datasets" className="w-full" name="dataset-search">
            <InputGroup fullWidth>
              <InputGroup.Input
                placeholder="Search datasets"
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
      </div>
      <div className="h-8" />

      <div className="text-sm text-foreground-500">
        {`Showing ${filteredDatasets.length} of ${datasets.length} datasets`}
      </div>
      <div className="h-6" />

      <div className="rounded-lg border border-solid border-content3">
        <Table className="shadow-none min-h-[200px] rounded-sm">
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
              const connectionTypes = _getDatasetConnectionTypes(dataset);
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
                      {connectionTypes.length > 0 && connectionTypes.map((connectionType) => (
                        <Chip
                          key={`${dataset.id}-${connectionType}`}
                          size="sm"
                          variant="soft"
                        >
                          {connectionType}
                        </Chip>
                      ))}
                      {connectionTypes.length === 0 && (
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

      {filteredDatasets.length > DATASETS_PER_PAGE && (
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
