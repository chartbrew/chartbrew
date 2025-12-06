import { Autocomplete, AutocompleteItem, Avatar, AvatarGroup, Button, Chip, CircularProgress, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import React, { useState } from "react"
import { LuCalendarDays, LuCopy, LuDatabase, LuEllipsis, LuInfo, LuListFilter, LuMonitorX, LuPencilLine, LuPlug, LuPlus, LuSearch, LuTags, LuTrash, LuX } from "react-icons/lu";
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

function DatasetList() {
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
        dataset.legend.toLowerCase().indexOf(searchFilter.search.toLowerCase()) > -1;

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
      <Spacer y={8} />

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
        <Spacer y={4} />
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
              label="Dashboard (Tags)"
              placeholder="Search by dashboard"
              labelPlacement="outside"
              onSelectionChange={(key) => setSearchFilter({ ...searchFilter, project_id: key })}
              selectedKey={searchFilter.project_id}
              aria-label="Search datasets by dashboard"
              size="sm"
            >
              <AutocompleteItem
                key="all"
                textValue="All projects"
              >
                All projects
              </AutocompleteItem>
              {projects.filter((p) => !p.ghost).map((project) => (
                <AutocompleteItem
                  key={project.id}
                  textValue={project.name}
                >
                  {project.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
          <div>
            <Autocomplete
              label="Connection"
              placeholder="Search by connection"
              labelPlacement="outside"
              onSelectionChange={(key) => setSearchFilter({ ...searchFilter, connection_id: key })}
              selectedKey={searchFilter.connection_id}
              aria-label="Search datasets by connection"
              size="sm"
            >
              <AutocompleteItem key="all" textValue="All connections">
                All connections
              </AutocompleteItem>
              {connections.map((connection) => (
                <AutocompleteItem key={connection.id} textValue={connection.name}>
                  {connection.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
          <div>
            <Select
              label="Status"
              placeholder="Select status"
              labelPlacement="outside"
              onSelectionChange={(keys) => setSearchFilter({ ...searchFilter, status: keys.currentKey })}
              selectedKeys={[searchFilter.status]}
              aria-label="Search datasets by status"
              size="sm"
              isClearable={false}
            >
              <SelectItem key="all" textValue="All statuses">
                All
              </SelectItem>
              <SelectItem key="published" textValue="Published">
                Published
              </SelectItem>
              <SelectItem key="draft" textValue="Draft">
                Draft
              </SelectItem>
            </Select>
          </div>
        </div>

        <Spacer y={4} />
        <div className="flex flex-row items-center justify-between">
          <div className="text-sm text-foreground-500">
            {`Showing ${_getFilteredDatasets().length} of ${datasets.length} datasets`}
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

      <Spacer y={4} />

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
          <Spacer y={4} />
        </div>
      )}

      <div className="border-1 border-solid border-content3 rounded-lg">
        <Table
          shadow="none"
          radius="sm"
          isStriped
          className="max-h-[65vh]"
          aria-label="Dataset list"
          selectionMode="multiple"
          onSelectionChange={(keys) => {
            if (keys === "all") {
              setSelectedDatasets(datasets.map((d) => d.id));
            } else {
              setSelectedDatasets(Array.from(keys));
            }
          }}
          onRowAction={() => {}}
        >
          <TableHeader>
            <TableColumn key="name">Dataset name</TableColumn>
            <TableColumn key="connections" textValue="Connections" align="center" justify="center">
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
            <TableColumn key="createdAt" textValue="Created at" align="center" justify="center">
              <div className="flex flex-row items-center justify-center gap-1">
                <LuCalendarDays />
                <span>Created</span>
              </div>
            </TableColumn>
            <TableColumn key="actions" align="center" hideHeader />
          </TableHeader>
          <TableBody
            emptyContent={
              connections.length === 0 && _canAccess("teamAdmin", team.TeamRoles) ? (
                <div className="flex flex-col items-center gap-1">
                  <LuDatabase size={24} />
                  <span>You need to create a connection to get started</span>
                  <Spacer y={1} />
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
            }
          >
            {_getFilteredDatasets().map((dataset) => (
              <TableRow key={dataset.id}>
                <TableCell key="name">
                  <div className="flex flex-row items-center gap-2">
                    <Link to={`/datasets/${dataset.id}`} className="cursor-pointer">
                      <span className="text-foreground font-medium">{dataset.legend}</span>
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
                    <AvatarGroup max={3} isBordered size="sm">
                      {dataset?.DataRequests?.map((dr) => (
                        <Avatar
                          src={dr.Connection ? connectionImages(isDark)[dr?.Connection?.subType] : null}
                          showFallback={<LuPlug />}
                          size="sm"
                          isBordered
                          key={dr.id}
                          icon={!dr.Connection ? <LuMonitorX /> : null}
                        />
                      ))}
                    </AvatarGroup>
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
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                        >
                          <LuEllipsis />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        variant="flat"
                        disabledKeys={!_canAccess("teamAdmin", team.TeamRoles) ? ["tags", "delete"] : []}
                      >
                        <DropdownItem
                          onPress={() => navigate(`/datasets/${dataset.id}`)}
                          startContent={<LuPencilLine />}
                          key="dataset"
                          textValue="Edit dataset"
                        >
                          Edit dataset
                        </DropdownItem>
                        <DropdownItem
                          key="duplicate"
                          onPress={() => {
                            setDatasetToDuplicate(dataset);
                            setDuplicateDatasetName(dataset.legend);
                          }}
                          startContent={<LuCopy />}
                          textValue="Duplicate dataset"
                        >
                          Duplicate dataset
                        </DropdownItem>
                        <DropdownItem
                          key="tags"
                          onPress={() => setDatasetToEdit(dataset)}
                          startContent={<LuTags />}
                          showDivider
                          textValue="Edit tags"
                        >
                          Edit tags
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          onPress={() => _onPressDeleteDataset(dataset)}
                          startContent={<LuTrash />}
                          color="danger"
                          textValue="Delete"
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Modal isOpen={datasetToDelete?.id} onClose={() => setDatasetToDelete(null)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Are you sure you want to delete this dataset?</div>
          </ModalHeader>
          <ModalBody>
            <div>
              {"Just a heads-up that all the charts that use this dataset will stop working. This action cannot be undone."}
            </div>
            {fetchingRelatedCharts && (
              <div className="flex flex-row items-center gap-1">
                <CircularProgress size="sm" aria-label="Checking related charts" />
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
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDatasetToDelete(null)}
              auto
            >
              Cancel
            </Button>
            <Button
              auto
              color="danger"
              endContent={<LuTrash />}
              onPress={() => _onDeleteDataset()}
              isLoading={deletingDataset}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={!!datasetToEdit} onClose={() => setDatasetToEdit(null)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Edit tags</div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-row flex-wrap items-center gap-2">
              {projects.filter((p) => !p.ghost).map((project) => (
                <Chip
                  key={project.id}
                  radius="sm"
                  variant={datasetToEdit?.project_ids?.includes(project.id) ? "solid" : "flat"}
                  color="primary"
                  className="cursor-pointer"
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
            <Spacer y={1} />
            <div className="flex gap-1 bg-content2 p-2 mb-2 rounded-lg text-foreground-500 text-sm">
              <div>
                <LuInfo />
              </div>
              {"Assign tags to datasets to control which dashboards can use them. Members can create charts from these datasets within dashboards associated with the selected tags."}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDatasetToEdit(null)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onPress={() => _onEditDatasetTags()}
              isLoading={modifyingDataset}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!datasetToDuplicate} onClose={() => setDatasetToDuplicate(null)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Duplicate dataset</div>
          </ModalHeader>
          <ModalBody>
            <Input
              label="New dataset name"
              placeholder="Dataset name"
              value={duplicateDatasetName}
              onChange={(e) => setDuplicateDatasetName(e.target.value)}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => setDatasetToDuplicate(null)}
              variant="bordered"
            >
              Cancel
            </Button>
            <Button
              onPress={() => _onDuplicateDataset()}
              isLoading={duplicateDatasetLoading}
              color="primary"
            >
              Duplicate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={showDeleteAllDrafts} onClose={() => setShowDeleteAllDrafts(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Delete draft datasets</div>
          </ModalHeader>
          <ModalBody>
            <div>
              {"Are you sure you want to delete draft datasets?"}
            </div>
            <div>
              {"This action cannot be undone."}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setShowDeleteAllDrafts(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => _onDeleteDrafts()}
              isLoading={deletingDatasets}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={showDeleteDatasets} onClose={() => setShowDeleteDatasets(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Delete selected datasets</div>
          </ModalHeader>
          <ModalBody>
            <div>
              {"Are you sure you want to delete selected datasets?"}
            </div>
            <div>
              {"If the datasets are used in any charts, they will stop working."}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setShowDeleteDatasets(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => _onDeleteDatasets()}
              isLoading={deletingDatasets}
            >
              Delete selected
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default DatasetList
