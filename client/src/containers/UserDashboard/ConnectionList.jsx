import { Avatar, Button, Checkbox, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
import React, { useState } from "react"
import { LuCalendarDays, LuEllipsis, LuInfo, LuPencilLine, LuPlus, LuSearch, LuTags, LuTrash } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux"
import { Link, useNavigate } from "react-router-dom"

import { selectTeam } from "../../slices/team"
import canAccess from "../../config/canAccess"
import { selectUser } from "../../slices/user"
import connectionImages from "../../config/connectionImages"
import { removeConnection, saveConnection, selectConnections } from "../../slices/connection"
import { useTheme } from "../../modules/ThemeContext"
import { selectProjects } from "../../slices/project"
import { selectDatasets } from "../../slices/dataset"

function ConnectionList() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [connectionToEdit, setConnectionToEdit] = useState(null);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [modifyingConnection, setModifyingConnection] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState(false);
  const [deleteRelatedDatasets, setDeleteRelatedDatasets] = useState(false);

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

  return (
    (<div className="flex flex-col">
      <div className={"flex flex-row items-center gap-4"}>
        {_canAccess("teamAdmin", team.TeamRoles) && (
          <Button
            color="primary"
            endContent={<LuPlus />}
            onClick={() => navigate(`/${team.id}/connection/new`)}
            isDisabled={user.temporary}
          >
            Create connection
          </Button>
        )}
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
      <Spacer y={4} />
      <Table shadow="none" isStriped className="border-1 border-solid border-content3 rounded-xl" aria-label="Connection list">
        <TableHeader>
          <TableColumn key="name">Connection</TableColumn>
          <TableColumn key="tags" className="tutorial-tags">
            <div className="flex flex-row items-center gap-1">
              <LuTags />
              <span>Tags</span>
            </div>
          </TableColumn>
          <TableColumn key="created" textValue="Created">
            <div className="flex flex-row items-center gap-1">
              <LuCalendarDays />
              <span>Created</span>
            </div>
          </TableColumn>
          <TableColumn key="actions" align="center" hideHeader>Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {_getFilteredConnections()?.map((connection) => (
            <TableRow key={connection.id}>
              <TableCell key="name">
                <div className="flex flex-row items-center gap-4">
                  <Avatar
                    src={connectionImages(isDark)[connection.subType]}
                    size="sm"
                    isBordered
                  />
                  <Link to={`/${team.id}/connection/${connection.id}`} className="cursor-pointer">
                    <span className="text-foreground font-medium">{connection.name}</span>
                  </Link>
                </div>
              </TableCell>
              <TableCell key="tags">
                {_getConnectionTags(connection.project_ids).length > 0 && (
                  <div
                    className="flex flex-row flex-wrap items-center gap-1 cursor-pointer hover:saturate-200 transition-all"
                    onClick={() => setConnectionToEdit(connection)}
                  >
                    {_getConnectionTags(connection.project_ids).slice(0, 3).map((tag) => (
                      <Chip
                        key={tag}
                        size="sm"
                        variant="flat"
                        color="primary"
                      >
                        {tag}
                      </Chip>
                    ))}
                    {_getConnectionTags(connection.project_ids).length > 3 && (
                      <span className="text-xs">{`+${_getConnectionTags(connection.project_ids).length - 3} more`}</span>
                    )}
                  </div>
                )}
                {_getConnectionTags(connection.project_ids).length === 0 && (
                  <Button
                    variant="light"
                    startContent={<LuPlus size={18} />}
                    size="sm"
                    className="opacity-0 hover:opacity-100"
                    onClick={() => setConnectionToEdit(connection)}
                  >
                    Add tag
                  </Button>
                )}
              </TableCell>
              <TableCell key="created">
                <div>{new Date(connection.createdAt).toLocaleDateString()}</div>
              </TableCell>
              <TableCell key="actions">
                {_canAccess("teamAdmin", team.TeamRoles) && (
                  <div className="flex flex-row justify-end items-center">
                    <Dropdown aria-label="Select a connection option">
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                        >
                          <LuEllipsis />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu variant="flat">
                        <DropdownItem
                          onClick={() => navigate(`/${team.id}/connection/${connection.id}`)}
                          startContent={<LuPencilLine />}
                        >
                          Edit connection
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => setConnectionToEdit(connection)}
                          startContent={<LuTags />}
                          showDivider
                        >
                          Edit tags
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => setConnectionToDelete(connection)}
                          startContent={<LuTrash />}
                          color="danger"
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Spacer y={2} />
      <Modal isOpen={connectionToDelete?.id} onClose={() => setConnectionToDelete(null)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Are you sure you want to delete this connection?</div>
          </ModalHeader>
          <ModalBody>
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
                  {dataset.legend}
                </Chip>
              ))}
              {_getRelatedDatasets(connectionToDelete?.id).length > 10 && (
                <span className="text-xs">{`+${_getRelatedDatasets(connectionToDelete?.id).length - 10} more`}</span>
              )}
            </div>
          </ModalBody>
          <ModalFooter className="justify-between">
            <Checkbox
              onChange={() => setDeleteRelatedDatasets(!deleteRelatedDatasets)}
              isSelected={deleteRelatedDatasets}
              size="sm"
            >
              Delete related datasets
            </Checkbox>
            <div className="flex flex-row items-center gap-1">
              <Button
                variant="bordered"
                onClick={() => setConnectionToDelete(null)}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                color="danger"
                endContent={<LuTrash />}
                onClick={() => _onDeleteConnection()}
                isLoading={deletingConnection}
              >
                Delete
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={!!connectionToEdit} onClose={() => setConnectionToEdit(null)} size="xl">
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
            <Spacer y={1} />
            <div className="flex gap-1 bg-content2 p-2 mb-2 rounded-lg text-foreground-500 text-sm">
              <div>
                <LuInfo />
              </div>
              {"Use tags to grant dashboard members access to these connections. Tagged connections can be used by members to create their own datasets within the associated dashboards."}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setConnectionToEdit(null)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onEditConnectionTags()}
              isLoading={modifyingConnection}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>)
  );
}

export default ConnectionList
