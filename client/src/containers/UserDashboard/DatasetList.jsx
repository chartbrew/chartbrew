import { Avatar, AvatarGroup, Button, Chip, CircularProgress, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import React, { useState } from "react"
import { LuCopy, LuEllipsis, LuInfo, LuPencilLine, LuPlug, LuPlus, LuSearch, LuTags, LuTrash } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import connectionImages from "../../config/connectionImages";
import { selectTeam } from "../../slices/team";
import { selectConnections } from "../../slices/connection";
import { deleteDataset, duplicateDataset, getRelatedCharts, selectDatasets, updateDataset } from "../../slices/dataset";
import { useTheme } from "../../modules/ThemeContext";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import { selectProjects } from "../../slices/project";

function DatasetList() {
  const [datasetSearch, setDatasetSearch] = useState("");
  const [showDatasetDrafts, setShowDatasetDrafts] = useState(false);
  const [modifyingDataset, setModifyingDataset] = useState(false);
  const [datasetToEdit, setDatasetToEdit] = useState(null);
  const [deletingDataset, setDeletingDataset] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [fetchingRelatedCharts, setFetchingRelatedCharts] = useState(false);
  const [relatedCharts, setRelatedCharts] = useState([]);
  const [datasetToDuplicate, setDatasetToDuplicate] = useState(null);
  const [duplicateDatasetName, setDuplicateDatasetName] = useState("");
  const [duplicateDatasetLoading, setDuplicateDatasetLoading] = useState(false);

  const team = useSelector(selectTeam);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasets);
  const user = useSelector(selectUser);
  const projects = useSelector(selectProjects);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const _onCreateDataset = () => {
    navigate(`/${team.id}/dataset/new`);
  };

  const _getFilteredDatasets = () => {
    if (!datasetSearch) return datasets.filter((d) => !d.draft || showDatasetDrafts);

    const filteredDatasets = datasets.filter((d) => {
      return d.legend.toLowerCase().indexOf(datasetSearch.toLowerCase()) > -1 && (!d.draft || showDatasetDrafts);
    });

    return filteredDatasets;
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

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center gap-4">
        {connections.length > 0 && (
          <Button
            color="primary"
            endContent={<LuPlus />}
            onPress={() => _onCreateDataset()}
          >
            Create dataset
          </Button>
        )}
        <Input
          type="text"
          placeholder="Search datasets"
          variant="bordered"
          endContent={<LuSearch />}
          className="max-w-[300px]"
          labelPlacement="outside"
          onChange={(e) => setDatasetSearch(e.target.value)}
        />
        <Switch
          isSelected={showDatasetDrafts}
          onChange={() => setShowDatasetDrafts(!showDatasetDrafts)}
          size="sm"
        >
          <span className="text-sm">Show drafts</span>
        </Switch>
      </div>
      <Spacer y={4} />
      <Table shadow="none" isStriped className="border-1 border-solid border-content3 rounded-xl" aria-label="Dataset list">
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
          <TableColumn key="actions" align="center" hideHeader />
        </TableHeader>
        <TableBody>
          {_getFilteredDatasets().map((dataset) => (
            <TableRow key={dataset.id}>
              <TableCell key="name">
                <div className="flex flex-row items-center gap-2">
                  <Link to={`/${team.id}/dataset/${dataset.id}`} className="cursor-pointer">
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
                        src={connectionImages(isDark)[dr?.Connection?.subType]}
                        showFallback={<LuPlug />}
                        size="sm"
                        isBordered
                        key={dr.id}
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
                        onPress={() => navigate(`/${team.id}/dataset/${dataset.id}`)}
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
    </div>
  );
}

export default DatasetList
