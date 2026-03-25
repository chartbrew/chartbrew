import { Autocomplete, Avatar, Button, Chip, ProgressCircle, Dropdown, EmptyState, Input, Label, ListBox, Modal, Pagination, SearchField, Select, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useFilter } from "@heroui/react";
import React, { useEffect, useMemo, useState } from "react"
import { LuCalendarDays, LuCopy, LuEllipsis, LuInfo, LuLayers, LuListFilter, LuMonitorX, LuPencilLine, LuPlug, LuPlus, LuSearch, LuTags, LuTrash, LuX } from "react-icons/lu";
import { Link, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import connectionImages from "../../config/connectionImages";
import { selectTeam } from "../../slices/team";
import { selectConnections } from "../../slices/connection";
import { deleteDataset, deleteDrafts, duplicateDataset, getDatasets, getRelatedCharts, selectDatasets, updateDataset } from "../../slices/dataset";
import { useTheme } from "../../modules/ThemeContext";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import { selectProjects } from "../../slices/project";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";

const DATASETS_PER_PAGE = 25;

function DatasetList() {
  const { contains } = useFilter({ sensitivity: "base" });
  const [modifyingDataset, setModifyingDataset] = useState(false);
  const [datasetToEdit, setDatasetToEdit] = useState(null);
  const [deletingDataset, setDeletingDataset] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [fetchingRelatedCharts, setFetchingRelatedCharts] = useState(false);
  const [relatedCharts, setRelatedCharts] = useState([]);
  const [datasetToDuplicate, setDatasetToDuplicate] = useState(null);
  const [duplicateDatasetName, setDuplicateDatasetName] = useState("");
  const [duplicateDatasetLoading, setDuplicateDatasetLoading] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [showDeleteAllDrafts, setShowDeleteAllDrafts] = useState(false);
  const [deletingDatasets, setDeletingDatasets] = useState(false);
  const [showDeleteDatasets, setShowDeleteDatasets] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState({
    project_id: "all",
    search: "",
    status: "all",
    connection_id: "all",
  });

  const team = useSelector(selectTeam);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasets);
  const user = useSelector(selectUser);
  const projects = useSelector(selectProjects);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const _onCreateDataset = () => {
    navigate("/datasets/new");
  };

  const _getActiveFilterCount = () => {
    let count = 0;
    if (searchFilter.search && searchFilter.search.trim() !== "") count++;
    if (searchFilter.project_id && searchFilter.project_id !== "all") count++;
    if (searchFilter.connection_id && searchFilter.connection_id !== "all") count++;
    if (searchFilter.status && searchFilter.status !== "all") count++;
    return count;
  };

  const _onClearAllFilters = () => {
    setSearchFilter({
      project_id: "all",
      search: "",
      status: "all",
      connection_id: "all",
    });
  };

  const _getFilteredDatasets = () => {
    return datasets.filter((dataset) => {
      // Search filter - check if search text is in legend
      const matchesSearch = !searchFilter.search ||
        getDatasetDisplayName(dataset).toLowerCase().indexOf(searchFilter.search.toLowerCase()) > -1;

      // Project filter - check if dataset has the selected project in project_ids
      // Treat undefined/null as "all"
      const projectFilter = searchFilter.project_id || "all";
      const matchesProject = projectFilter === "all" ||
        (dataset.project_ids && dataset.project_ids.includes(projectFilter));

      // Connection filter - check if any DataRequest has the selected connection
      // Treat undefined/null as "all"
      const connectionFilter = searchFilter.connection_id || "all";
      const matchesConnection = connectionFilter === "all" ||
        (dataset.DataRequests && dataset.DataRequests.some(dr =>
          `${dr.Connection?.id}` === connectionFilter
        ));

      // Status filter - show published datasets or drafts based on selection
      const matchesStatus = searchFilter.status === "all" ||
        (searchFilter.status === "published" && !dataset.draft) ||
        (searchFilter.status === "draft" && dataset.draft);

      // All filters must match (AND logic)
      return matchesSearch && matchesProject && matchesConnection && matchesStatus;
    });
  };

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.id, teamRoles);
  };

  const _getDatasetTags = (projectIds) => {
    const tags = [];
    if (!projects || !projectIds) return tags;
    projectIds.forEach((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        tags.push(project.name);
      }
    });

    return tags;
  };

  const _onEditDatasetTags = async () => {
    setModifyingDataset(true);

    const projectIds = datasetToEdit.project_ids || [];

    await dispatch(updateDataset({
      team_id: team.id,
      dataset_id: datasetToEdit.id,
      data: { project_ids: projectIds },
    }));

    setModifyingDataset(false);
    setDatasetToEdit(null);
  };

  const _onPressDeleteDataset = (dataset) => {
    setFetchingRelatedCharts(true);
    setDatasetToDelete(dataset);
    setRelatedCharts([]);

    dispatch(getRelatedCharts({ team_id: team.id, dataset_id: dataset.id }))
      .then((charts) => {
        setRelatedCharts(charts.payload);
        setFetchingRelatedCharts(false);
      })
      .catch(() => {
        setFetchingRelatedCharts(false);
      });
  };

  const _onDeleteDataset = () => {
    setDeletingDataset(true);
    dispatch(deleteDataset({ team_id: team.id, dataset_id: datasetToDelete.id }))
      .then(() => {
        setDeletingDataset(false);
        setDatasetToDelete(null);
      })
      .catch(() => {
        setDeletingDataset(false);
      });
  };

  const _onDuplicateDataset = () => {
    setDuplicateDatasetLoading(true);
    dispatch(duplicateDataset({
      team_id: team.id,
      dataset_id: datasetToDuplicate.id,
      name: duplicateDatasetName,
    }))
      .then((response) => {
        if (response?.error) {
          toast.error("Failed to duplicate dataset");
        }
        else {
          toast.success("Dataset duplicated successfully");
        }

        setDuplicateDatasetLoading(false);
        setDatasetToDuplicate(null);
        setDuplicateDatasetName("");
      })
      .catch(() => {
        setDuplicateDatasetLoading(false);
        setDatasetToDuplicate(null);
        setDuplicateDatasetName("");
        toast.error("Failed to duplicate dataset");
      });
  };

  const _onDeleteDrafts = async() => {
    setDeletingDatasets(true);
    const response = await dispatch(deleteDrafts({ team_id: team.id }))

    if (response?.error) {
      toast.error("Failed to delete drafts");
    }
    else {
      toast.success("Draft datasets deleted successfully");
      await dispatch(getDatasets({ team_id: team.id }));
      setShowDeleteAllDrafts(false);
    }

    setDeletingDatasets(false);
  };

  const _onDeleteDatasets = async() => {
    setDeletingDatasets(true);
    let errorsDetected = false;
    const deletionPromises = [];
    selectedDatasets.forEach(async (datasetId) => {
      deletionPromises.push(dispatch(deleteDataset({ team_id: team.id, dataset_id: datasetId })));
    });

    const deletionResults = await Promise.all(deletionPromises);
    deletionResults.forEach((result) => {
      if (result?.error) {
        errorsDetected = true;
      }
    });

    if (errorsDetected) {
      toast.error("Failed to delete some of the datasets");
    }
    else {
      toast.success("Datasets deleted successfully");
      await dispatch(getDatasets({ team_id: team.id }));
      setSelectedDatasets([]);
      setShowDeleteDatasets(false);
    }

    setDeletingDatasets(false);
  };

  const filteredDatasets = _getFilteredDatasets();
  const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / DATASETS_PER_PAGE));
  const pageStart = filteredDatasets.length === 0 ? 0 : ((currentPage - 1) * DATASETS_PER_PAGE) + 1;
  const pageEnd = Math.min(currentPage * DATASETS_PER_PAGE, filteredDatasets.length);
  const paginatedDatasets = filteredDatasets.slice(
    (currentPage - 1) * DATASETS_PER_PAGE,
    currentPage * DATASETS_PER_PAGE
  );

  const selectedDatasetKeys = useMemo(
    () => new Set(selectedDatasets.map((id) => `${id}`)),
    [selectedDatasets]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            Datasets
          </div>
          <div className="text-sm text-foreground-500">
            {"Query and transform data from your connections"}
          </div>
        </div>
        {_canAccess("teamAdmin", team.TeamRoles) && (
          <Button
            color="primary"
            endContent={<LuPlus />}
            onPress={() => _onCreateDataset()}
            isDisabled={connections.length === 0}
          >
            Create dataset
          </Button>
        )}
      </div>
      <div className="h-8" />

      <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center gap-2">
            <LuListFilter strokeWidth={1.5} />
            <span className="text-sm">Filters</span>
            {_getActiveFilterCount() > 0 && (
              <Chip size="sm" variant="flat" rounded="sm">
                {_getActiveFilterCount()}
              </Chip>
            )}
          </div>
          {_getActiveFilterCount() > 0 && (
            <Button
              variant="light"
              size="sm"
              onPress={_onClearAllFilters}
              startContent={<LuX size={14} />}
            >
              Clear all
            </Button>
          )}
        </div>
        <div className="h-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <div>
            <Input
              label="Search"
              type="text"
              placeholder="Search datasets"
              endContent={<LuSearch />}
              labelPlacement="outside"
              onChange={(e) => setSearchFilter({ ...searchFilter, search: e.target.value })}
              value={searchFilter.search}
              size="sm"
            />
          </div>
          <div>
            <Autocomplete
              placeholder="Search by dashboard"
              onChange={(value) => setSearchFilter({ ...searchFilter, project_id: value })}
              value={searchFilter.project_id || null}
              selectionMode="single"
              variant="secondary"
              aria-label="Search datasets by dashboard"
              size="sm"
            >
              <Label>Dashboard (Tags)</Label>
              <Autocomplete.Trigger>
                <Autocomplete.Value />
                <Autocomplete.Indicator />
              </Autocomplete.Trigger>
              <Autocomplete.Popover>
                <Autocomplete.Filter filter={contains}>
                  <SearchField autoFocus name="dataset-project-search" variant="secondary">
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Search dashboards..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                    <ListBox.Item id="all" textValue="All projects">
                      All projects
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {projects.filter((p) => !p.ghost).map((project) => (
                      <ListBox.Item key={project.id} id={project.id} textValue={project.name}>
                        {project.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Autocomplete.Filter>
              </Autocomplete.Popover>
            </Autocomplete>
          </div>
          <div>
            <Autocomplete
              placeholder="Search by connection"
              onChange={(value) => setSearchFilter({ ...searchFilter, connection_id: value })}
              value={searchFilter.connection_id || null}
              selectionMode="single"
              variant="secondary"
              aria-label="Search datasets by connection"
              size="sm"
            >
              <Label>Connection</Label>
              <Autocomplete.Trigger>
                <Autocomplete.Value />
                <Autocomplete.Indicator />
              </Autocomplete.Trigger>
              <Autocomplete.Popover>
                <Autocomplete.Filter filter={contains}>
                  <SearchField autoFocus name="dataset-connection-search" variant="secondary">
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Search connections..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                    <ListBox.Item id="all" textValue="All connections">
                      All connections
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {connections.map((connection) => (
                      <ListBox.Item key={connection.id} id={connection.id} textValue={connection.name}>
                        {connection.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Autocomplete.Filter>
              </Autocomplete.Popover>
            </Autocomplete>
          </div>
          <div>
            <Select
              placeholder="Select status"
              onChange={(value) => setSearchFilter({ ...searchFilter, status: value })}
              value={searchFilter.status || null}
              selectionMode="single"
              variant="secondary"
              aria-label="Search datasets by status"
              size="sm"
              isClearable={false}
            >
              <Label>Status</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="All statuses">
                    All
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="published" textValue="Published">
                    Published
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="draft" textValue="Draft">
                    Draft
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        <div className="h-4" />
        <div className="flex flex-row items-center justify-between">
          <div className="text-sm text-foreground-500">
            {`Showing ${pageStart}-${pageEnd} of ${filteredDatasets.length} datasets`}
          </div>
          {(searchFilter.status === "draft" || searchFilter.status === "all") && (
            <Button
              variant="bordered"
              size="sm"
              onPress={() => {
                setShowDeleteAllDrafts(true);
              }}
              className="border-1"
            >
              Delete all drafts
            </Button>
          )}
        </div>
      </div>

      <div className="h-4" />

      {selectedDatasets.length > 0 && (
        <div>
          <Button
            variant="flat"
            size="sm"
            onPress={() => setShowDeleteDatasets(true)}
            color="danger"
            startContent={<LuTrash size={16} />}
          >
            Delete selected
          </Button>
          <div className="h-4" />
        </div>
      )}

      <div className="border-1 border-solid border-content3 rounded-lg">
        <Table className="shadow-none rounded-sm">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Dataset list"
              className="min-w-full even:[&_tbody>tr]:bg-content2/30"
              selectionMode="multiple"
              selectedKeys={selectedDatasetKeys}
              onSelectionChange={(keys) => {
                const paginatedDatasetIds = paginatedDatasets.map((dataset) => `${dataset.id}`);
                if (keys === "all") {
                  setSelectedDatasets((prev) => {
                    const prevIds = prev.map((id) => `${id}`);
                    return [...new Set([...prevIds, ...paginatedDatasetIds])];
                  });
                } else {
                  const nextPageSelection = Array.from(keys).map((key) => `${key}`);
                  setSelectedDatasets((prev) => {
                    const offPageSelections = prev
                      .map((id) => `${id}`)
                      .filter((id) => !paginatedDatasetIds.includes(id));

                    return [...new Set([...offPageSelections, ...nextPageSelection])];
                  });
                }
              }}
            >
              <TableHeader>
                <TableColumn key="name" isRowHeader textValue="Dataset name">
                  Dataset name
                </TableColumn>
                <TableColumn key="connections" textValue="Connections" className="text-center">
                  <div className="flex flex-row items-center justify-center gap-1">
                    <LuPlug />
                    <span>Connections</span>
                  </div>
                </TableColumn>
                <TableColumn key="tags" textValue="Tags">
                  <div className="flex flex-row items-center gap-1">
                    <LuTags />
                    <span>Tags</span>
                  </div>
                </TableColumn>
                <TableColumn key="createdAt" textValue="Created at" className="text-center">
                  <div className="flex flex-row items-center justify-center gap-1">
                    <LuCalendarDays />
                    <span>Created</span>
                  </div>
                </TableColumn>
                <TableColumn key="actions" className="w-12 text-center" textValue="Actions" />
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  connections.length === 0 && _canAccess("teamAdmin", team.TeamRoles) ? (
                    <div className="flex flex-col items-center gap-1">
                      <LuLayers size={24} />
                      <span>You need to create a connection to get started</span>
                      <div className="h-1" />
                      <Button
                        onPress={() => navigate("/connections/new")}
                        color="primary"
                      >
                        Create your first connection
                      </Button>
                    </div>
                  ) : (
                    "No datasets found"
                  )
                )}
              >
                {paginatedDatasets.map((dataset) => {
              const dataRequests = dataset?.DataRequests || [];
              const drStackMax = 3;
              const drStackOverflow = dataRequests.length > drStackMax
                ? dataRequests.length - (drStackMax - 1)
                : 0;
              const drStackVisible = drStackOverflow > 0
                ? dataRequests.slice(0, drStackMax - 1)
                : dataRequests.slice(0, drStackMax);

              return (
              <TableRow key={`${dataset.id}`} id={`${dataset.id}`}>
                <TableCell key="name">
                  <div className="flex flex-row items-center gap-2">
                    <Link to={`/datasets/${dataset.id}`} className="cursor-pointer">
                      <span className="text-foreground font-medium">{getDatasetDisplayName(dataset)}</span>
                    </Link>
                    {dataset.draft && (
                      <Chip size="sm" variant="flat" color="secondary">
                        Draft
                      </Chip>
                    )}
                  </div>
                </TableCell>
                <TableCell key="connections">
                  <div className="flex flex-row items-center">
                    <div className="flex flex-row -space-x-2 rtl:space-x-reverse">
                      {drStackVisible.map((dr, idx) => (
                        <Avatar
                          key={dr.id}
                          size="sm"
                          className="ring-2 ring-background shrink-0"
                          style={{ zIndex: idx }}
                        >
                          {dr.Connection ? (
                            <Avatar.Image src={connectionImages(isDark)[dr.Connection.subType]} alt="" />
                          ) : null}
                          <Avatar.Fallback>
                            {!dr.Connection ? <LuMonitorX /> : <LuPlug />}
                          </Avatar.Fallback>
                        </Avatar>
                      ))}
                      {drStackOverflow > 0 && (
                        <Avatar size="sm" className="ring-2 ring-background shrink-0" style={{ zIndex: drStackVisible.length }}>
                          <Avatar.Fallback>{`+${drStackOverflow}`}</Avatar.Fallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell key="tags">
                  {_getDatasetTags(dataset.project_ids).length > 0 && (
                    <div
                      className="flex flex-row flex-wrap items-center gap-1 cursor-pointer hover:saturate-200 transition-all"
                      onClick={() => {
                        if (_canAccess("teamAdmin", team.TeamRoles)) {
                          setDatasetToEdit(dataset);
                        }
                      }}
                    >
                      {_getDatasetTags(dataset.project_ids).slice(0, 3).map((tag) => (
                        <Chip
                          key={tag}
                          size="sm"
                          variant="flat"
                          color="primary"
                        >
                          {tag}
                        </Chip>
                      ))}
                      {_getDatasetTags(dataset.project_ids).length > 3 && (
                        <span className="text-xs">{`+${_getDatasetTags(dataset.project_ids).length - 3} more`}</span>
                      )}
                    </div>
                  )}
                  {_getDatasetTags(dataset.project_ids).length === 0 && (
                    <Button
                      variant="light"
                      startContent={<LuPlus size={18} />}
                      size="sm"
                      className="opacity-0 hover:opacity-100"
                      onPress={() => {
                        if (_canAccess("teamAdmin", team.TeamRoles)) {
                          setDatasetToEdit(dataset);
                        }
                      }}
                    >
                      Add tag
                    </Button>
                  )}
                </TableCell>
                <TableCell key="createdAt">
                    <div>{new Date(dataset.createdAt).toLocaleDateString()}</div>
                </TableCell>
                <TableCell key="actions">
                  <div className="flex flex-row items-center justify-end">
                    <Dropdown aria-label="Select a dataset option">
                      <Dropdown.Trigger>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                        >
                          <LuEllipsis />
                        </Button>
                      </Dropdown.Trigger>
                      <Dropdown.Popover>
                        <Dropdown.Menu
                          variant="flat"
                          disabledKeys={!_canAccess("teamAdmin", team.TeamRoles) ? ["tags", "delete"] : []}
                        >
                          <Dropdown.Item
                            id="dataset"
                            onPress={() => navigate(`/datasets/${dataset.id}`)}
                            startContent={<LuPencilLine />}
                            textValue="Edit dataset"
                          >
                            Edit dataset
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="duplicate"
                            onPress={() => {
                              setDatasetToDuplicate(dataset);
                              setDuplicateDatasetName(getDatasetDisplayName(dataset));
                            }}
                            startContent={<LuCopy />}
                            textValue="Duplicate dataset"
                          >
                            Duplicate dataset
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="tags"
                            onPress={() => setDatasetToEdit(dataset)}
                            startContent={<LuTags />}
                            showDivider
                            textValue="Edit tags"
                          >
                            Edit tags
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="delete"
                            onPress={() => _onPressDeleteDataset(dataset)}
                            startContent={<LuTrash />}
                            variant="danger"
                            textValue="Delete"
                          >
                            Delete
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  </div>
                </TableCell>
              </TableRow>
              );
                })}
              </TableBody>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
      {filteredDatasets.length > DATASETS_PER_PAGE && (
        <>
          <div className="h-3" />
          <div className="flex justify-start px-4 py-2 border-1 border-solid border-content3 rounded-lg bg-content1">
            <Pagination
              total={totalPages}
              page={currentPage}
              onChange={setCurrentPage}
              size="sm"
              aria-label="Dataset list pagination"
            />
          </div>
        </>
      )}
      <Modal.Backdrop isOpen={!!datasetToDelete?.id} onOpenChange={(open) => {
        if (!open) setDatasetToDelete(null);
      }}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Are you sure you want to delete this dataset?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div>
              {"Just a heads-up that all the charts that use this dataset will stop working. This action cannot be undone."}
            </div>
            {fetchingRelatedCharts && (
              <div className="flex flex-row items-center gap-1">
                <ProgressCircle size="sm" aria-label="Checking related charts" />
                <span className="italic">Checking related charts...</span>
              </div>
            )}
            {!fetchingRelatedCharts && relatedCharts.length === 0 && (
              <div className="flex flex-row items-center">
                <span className="italic">No related charts found</span>
              </div>
            )}
            {!fetchingRelatedCharts && relatedCharts.length > 0 && (
              <div className="flex flex-row items-center">
                <span>Related charts:</span>
              </div>
            )}
            <div className="flex flex-row flex-wrap items-center gap-1">
              {relatedCharts.slice(0, 10).map((chart) => (
                <Chip
                  key={chart.id}
                  size="sm"
                  variant="flat"
                  color="primary"
                >
                  {chart.name}
                </Chip>
              ))}
              {relatedCharts.length > 10 && (
                <span className="text-xs">{`+${relatedCharts.length - 10} more`}</span>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setDatasetToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => _onDeleteDataset()}
              isPending={deletingDataset}
            >
              <LuTrash size={18} />
              Delete
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Modal.Backdrop isOpen={!!datasetToEdit} onOpenChange={(open) => {
        if (!open) setDatasetToEdit(null);
      }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-xl">
          <Modal.Header>
            <Modal.Heading>Edit tags</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-row flex-wrap items-center gap-2">
              {projects.filter((p) => !p.ghost).map((project) => (
                <Chip
                  key={project.id}
                  variant={datasetToEdit?.project_ids?.includes(project.id) ? "solid" : "flat"}
                  color="primary"
                  className="rounded-sm cursor-pointer"
                  onClick={() => {
                    if (datasetToEdit?.project_ids?.includes(project.id)) {
                      setDatasetToEdit({ ...datasetToEdit, project_ids: datasetToEdit?.project_ids?.filter((p) => p !== project.id) });
                    } else {
                      setDatasetToEdit({ ...datasetToEdit, project_ids: [...(datasetToEdit?.project_ids || []), project.id] });
                    }
                  }}
                >
                  {project.name}
                </Chip>
              ))}
            </div>
            <div className="h-1" />
            <div className="flex gap-1 bg-content2 p-2 mb-2 rounded-lg text-foreground-500 text-sm">
              <div>
                <LuInfo />
              </div>
              {"Assign tags to datasets to control which dashboards can use them. Members can create charts from these datasets within dashboards associated with the selected tags."}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setDatasetToEdit(null)}
            >
              Close
            </Button>
            <Button
              onPress={() => _onEditDatasetTags()}
              isPending={modifyingDataset}
            >
              Save
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={!!datasetToDuplicate} onOpenChange={(open) => {
        if (!open) setDatasetToDuplicate(null);
      }}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Duplicate dataset</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <Input
              label="New dataset name"
              placeholder="Dataset name"
              value={duplicateDatasetName}
              onChange={(e) => setDuplicateDatasetName(e.target.value)}
              variant="bordered"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              onPress={() => setDatasetToDuplicate(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onPress={() => _onDuplicateDataset()}
              isPending={duplicateDatasetLoading}
            >
              Duplicate
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={showDeleteAllDrafts} onOpenChange={setShowDeleteAllDrafts}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Delete draft datasets</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div>
              {"Are you sure you want to delete draft datasets?"}
            </div>
            <div>
              {"This action cannot be undone."}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setShowDeleteAllDrafts(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => _onDeleteDrafts()}
              isPending={deletingDatasets}
            >
              Delete
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={showDeleteDatasets} onOpenChange={setShowDeleteDatasets}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Delete selected datasets</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div>
              {"Are you sure you want to delete selected datasets?"}
            </div>
            <div>
              {"If the datasets are used in any charts, they will stop working."}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setShowDeleteDatasets(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => _onDeleteDatasets()}
              isPending={deletingDatasets}
            >
              Delete selected
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

export default DatasetList
