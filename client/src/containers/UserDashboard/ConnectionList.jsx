import { Avatar, Button, Card, Checkbox, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, Tooltip } from "@heroui/react"
import React, { useState } from "react"
import { LuCopy, LuEllipsis, LuInfo, LuPencilLine, LuPlug, LuPlus, LuSearch, LuTags, LuTrash } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux"
import { Link, useNavigate } from "react-router"
import { toast } from "react-hot-toast"

import { selectTeam } from "../../slices/team"
import canAccess from "../../config/canAccess"
import { selectUser } from "../../slices/user"
import connectionImages from "../../config/connectionImages"
import { duplicateConnection, removeConnection, saveConnection, selectConnections } from "../../slices/connection"
import { useTheme } from "../../modules/ThemeContext"
import { selectProjects } from "../../slices/project"
import { selectDatasets } from "../../slices/dataset"
import getDatasetDisplayName from "../../modules/getDatasetDisplayName"

function ConnectionList() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [connectionToEdit, setConnectionToEdit] = useState(null);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [modifyingConnection, setModifyingConnection] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState(false);
  const [deleteRelatedDatasets, setDeleteRelatedDatasets] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [viewingDuplicateModal, setViewingDuplicateModal] = useState(null);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const connections = useSelector(selectConnections);
  const projects = useSelector(selectProjects);
  const datasets = useSelector(selectDatasets);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDark } = useTheme();

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.id, teamRoles);
  };

  const _getFilteredConnections = () => {
    if (!connectionSearch) return connections || [];

    const filteredConnections = connections.filter((c) => {
      return c.name.toLowerCase().indexOf(connectionSearch.toLowerCase()) > -1;
    });

    return filteredConnections || [];
  };

  const _onEditConnectionTags = async () => {
    setModifyingConnection(true);

    const projectIds = connectionToEdit.project_ids || [];

    await dispatch(saveConnection({
      team_id: team.id,
      connection: { id: connectionToEdit.id, project_ids: projectIds },
    }));

    setModifyingConnection(false);
    setConnectionToEdit(null);
  };

  const _getConnectionTags = (projectIds) => {
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

  const _onDeleteConnection = () => {
    setDeletingConnection(true);
    dispatch(removeConnection({
      team_id: team.id,
      connection_id: connectionToDelete.id,
      removeDatasets: deleteRelatedDatasets
    }))
      .then(() => {
        setDeletingConnection(false);
        setConnectionToDelete(null);
      })
      .catch(() => {
        setDeletingConnection(false);
      });
  };

  const _getRelatedDatasets = (connectionId) => {
    return datasets.filter((d) => d.DataRequests?.find((dr) => dr.connection_id === connectionId));
  };

  const _onDuplicateConnection = (connection) => {
    if (!duplicateName) {
      toast.error("Please enter a name for the new connection");
      return;
    }

    setDuplicateLoading(true);
    dispatch(duplicateConnection({
      team_id: team.id,
      connection_id: connection.id,
      name: duplicateName,
    }))
      .then((response) => {
        if (response?.error) {
          toast.error("Failed to duplicate connection");
        }
        else {
          toast.success("Connection duplicated successfully");
        }

        setDuplicateLoading(false);
        setViewingDuplicateModal(null);
        setDuplicateName("");
      })
      .catch(() => {
        setDuplicateLoading(false);
        setViewingDuplicateModal(null);
        setDuplicateName("");
        toast.error("Failed to duplicate connection");
      });
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            Data connections
          </div>
          <div className="text-sm text-foreground-500">
            {"Connect your data sources to Chartbrew"}
          </div>
        </div>

        {_canAccess("teamAdmin", team.TeamRoles) && (
          <Button
            color="primary"
            endContent={<LuPlus />}
            onPress={() => navigate("/connections/new")}
            isDisabled={user.temporary}
          >
            Create connection
          </Button>
        )}
      </div>
      <div className="h-2" />
      <div className={"flex flex-row items-center gap-4"}>
        <Input
          type="text"
          placeholder="Search connections"
          variant="bordered"
          endContent={<LuSearch />}
          className="max-w-[300px]"
          labelPlacement="outside"
          onChange={(e) => setConnectionSearch(e.target.value)}
        />
      </div>
      <div className="h-4" />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {_getFilteredConnections()?.map((connection) => (
          <div key={connection.id}>
            <Card
              className="h-full w-full border-1 border-solid border-content3 p-4 shadow-none transition-colors hover:bg-content2/40"
            >
              <Card.Content>
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-2">
                    <Avatar src={connectionImages(isDark)[connection.subType]} />
                    <Link to={`/connections/${connection.id}`} className="text-lg font-semibold text-foreground! font-tw cursor-pointer">{connection.name}</Link>
                  </div>
                  <div>
                    {_getRelatedDatasets(connection.id).length > 0 && (
                      <Tooltip content="Datasets are using this connection.">
                        <Chip size="sm" variant="flat" color="success" radius="sm">
                          Active
                        </Chip>
                      </Tooltip>
                    )}
                    {_getRelatedDatasets(connection.id).length === 0 && (
                      <Tooltip content="No datasets are using this connection yet.">
                        <Chip size="sm" variant="flat" color="danger" radius="sm">
                          Inactive
                        </Chip>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Card.Content>
              <Card.Content>
                <div className="flex flex-row items-center flex-wrap gap-1">
                  {_getConnectionTags(connection.project_ids).slice(0, 3).map((tag) => (
                    <Chip key={tag} size="sm" variant="flat" color="primary" radius="sm" className="cursor-pointer" onClick={() => setConnectionToEdit(connection)}>
                      {tag}
                    </Chip>
                  ))}
                  {_getConnectionTags(connection.project_ids).length > 3 && (
                    <span className="text-xs">{`+${_getConnectionTags(connection.project_ids).length - 3} more`}</span>
                  )}
                </div>
              </Card.Content>
              <Card.Content>
                <div className="flex flex-row items-center justify-between">
                  <span className="text-xs text-foreground-500">{`${_getRelatedDatasets(connection.id).length} datasets`}</span>
                  <span className="text-xs text-foreground-500">Created on {new Date(connection.createdAt).toLocaleDateString()}</span>
                </div>
              </Card.Content>
              <Card.Footer>
                <Button
                  variant="flat"
                  size="sm"
                  onPress={() => navigate(`/connections/${connection.id}`)}
                  fullWidth
                >
                  View connection
                </Button>
                <div className="w-1" />
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      variant="flat"
                      size="sm"
                      fullWidth
                      isIconOnly
                    >
                      <LuEllipsis />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu variant="flat">
                    <DropdownItem
                      onPress={() => navigate(`/connections/${connection.id}`)}
                      startContent={<LuPencilLine />}
                    >
                      Edit connection
                    </DropdownItem>
                    <DropdownItem
                      onPress={() => setConnectionToEdit(connection)}
                      startContent={<LuTags />}
                    >
                      Edit tags
                    </DropdownItem>
                    <DropdownItem
                      onPress={() => {
                        setViewingDuplicateModal(connection);
                        setDuplicateName(connection.name);
                      }}
                      startContent={<LuCopy />}
                    >
                      Duplicate connection
                    </DropdownItem>
                    <DropdownItem
                      onPress={() => setConnectionToDelete(connection)}
                      startContent={<LuTrash />}
                      color="danger"
                    >
                      Delete
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Card.Footer>
            </Card>
          </div>
        ))}
      </div>

      {_getFilteredConnections()?.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <LuPlug size={24} />
          <span className="text-foreground-500 text-sm">No connections found</span>
          <div className="h-1" />
          {connections?.length === 0 && _canAccess("teamAdmin", team.TeamRoles) && (
            <Button
              color="primary"
              onPress={() => navigate("/connections/new")}
            >
              Create your first connection
            </Button>
          )}
        </div>
      )}

      <div className="h-4" />
      <Modal>
        <Modal.Backdrop isOpen={!!connectionToDelete?.id} onOpenChange={(nextOpen) => { if (!nextOpen) setConnectionToDelete(null); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Are you sure you want to delete this connection?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div>
                  {"Just a heads-up that all the datasets and charts that use this connection will stop working. This action cannot be undone."}
                </div>
                {_getRelatedDatasets(connectionToDelete?.id).length === 0 && (
                  <div className="flex flex-row items-center">
                    <div className="italic">No related datasets found</div>
                  </div>
                )}
                {_getRelatedDatasets(connectionToDelete?.id).length > 0 && (
                  <div className="flex flex-row items-center">
                    <div>Related datasets:</div>
                  </div>
                )}
                <div className="flex flex-row flex-wrap items-center gap-1">
                  {_getRelatedDatasets(connectionToDelete?.id).slice(0, 10).map((dataset) => (
                    <Chip
                      key={dataset.id}
                      size="sm"
                      variant="flat"
                      color="primary"
                    >
                      {getDatasetDisplayName(dataset)}
                    </Chip>
                  ))}
                  {_getRelatedDatasets(connectionToDelete?.id).length > 10 && (
                    <span className="text-xs">{`+${_getRelatedDatasets(connectionToDelete?.id).length - 10} more`}</span>
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer className="justify-between">
                <Checkbox
                  onChange={() => setDeleteRelatedDatasets(!deleteRelatedDatasets)}
                  isSelected={deleteRelatedDatasets}
                  size="sm"
                >
                  Delete related datasets
                </Checkbox>
                <div className="flex flex-row items-center gap-1">
                  <Button
                    slot="close"
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onPress={() => _onDeleteConnection()}
                    isPending={deletingConnection}
                  >
                    Delete
                    <LuTrash />
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal>
        <Modal.Backdrop isOpen={!!connectionToEdit} onOpenChange={(nextOpen) => { if (!nextOpen) setConnectionToEdit(null); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Edit tags
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-row flex-wrap items-center gap-2">
                  {projects.filter((p) => !p.ghost).map((project) => (
                    <Chip
                      key={project.id}
                      radius="sm"
                      variant={connectionToEdit?.project_ids?.includes(project.id) ? "solid" : "flat"}
                      color="primary"
                      className="cursor-pointer"
                      onClick={() => {
                        if (connectionToEdit?.project_ids?.includes(project.id)) {
                          setConnectionToEdit({ ...connectionToEdit, project_ids: connectionToEdit?.project_ids?.filter((p) => p !== project.id) });
                        }
                        else {
                          setConnectionToEdit({ ...connectionToEdit, project_ids: [...(connectionToEdit?.project_ids || []), project.id] });
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
                  {"Use tags to grant dashboard members access to these connections. Tagged connections can be used by members to create their own datasets within the associated dashboards."}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onPress={() => _onEditConnectionTags()}
                  isPending={modifyingConnection}
                >
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={!!viewingDuplicateModal} onOpenChange={(nextOpen) => { if (!nextOpen) setViewingDuplicateModal(null); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Duplicate connection
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Input
                  placeholder="New connection name"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  variant="secondary"
                />
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => _onDuplicateConnection(viewingDuplicateModal)}
                  isPending={duplicateLoading}
                >
                  Duplicate
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default ConnectionList
