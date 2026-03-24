import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Chip, Button, Checkbox, Separator, Dropdown, Modal, Table, Tooltip, ProgressCircle,
  TableHeader, TableColumn, TableBody, TableRow, TableCell, DropdownMenu, DropdownItem,
  DropdownTrigger,
  Input,
} from "@heroui/react";
import _ from "lodash";
import toast from "react-hot-toast";
import { LuFolderKey, LuInfo, LuStar, LuUser, LuX, LuCircleX, LuKeyRound, LuIdCard, LuCircleCheck } from "react-icons/lu";

import {
  getTeam, getTeamMembers, updateTeamRole, deleteTeamMember, selectTeam, selectTeamMembers,
  transferOwnership,
  selectTeams,
} from "../../slices/team";
import InviteMembersForm from "../../components/InviteMembersForm";
import canAccess from "../../config/canAccess";
import { selectProjects } from "../../slices/project";
import { selectUser } from "../../slices/user";

/*
  Contains Pending Invites and All team members with functionality to delete/change role
*/
function TeamMembers(props) {
  const { style = {} } = props;

  const [loading, setLoading] = useState(true);
  const [changedMember, setChangedMember] = useState(null);
  const [deleteMember, setDeleteMember] = useState("");
  const [projectModal, setProjectModal] = useState(false);
  const [projectAccess, setProjectAccess] = useState({});
  const [changedRole, setChangedRole] = useState({});
  const [transferOwnershipMember, setTransferOwnershipMember] = useState(null);
  const [transfering, setTransfering] = useState(false);
  const [transferConfirmation, setTransferConfirmation] = useState("");

  const team = useSelector(selectTeam);
  const teamMembers = useSelector(selectTeamMembers);
  const projects = useSelector(selectProjects);
  const user = useSelector(selectUser);
  const teams = useSelector(selectTeams);

  const dispatch = useDispatch();

  useEffect(() => {
    if (projects && projects.length > 0 && team && team.TeamRoles) {
      const tempAccess = {};
      team.TeamRoles.map((teamRole) => {
        tempAccess[teamRole.user_id] = teamRole;
        return teamRole;
      });

      setProjectAccess(tempAccess);
    }
  }, [projects, team]);

  const _getTeam = () => {
    dispatch(getTeam(team.id))
      .then(() => {
        dispatch(getTeamMembers({ team_id: team.id }));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _onChangeRole = (newRole, member) => {
    setLoading(true);
    setChangedMember(member);
    dispatch(updateTeamRole({ data: { role: newRole }, memberId: member.id, team_id: team.id }))
      .then(() => {
        setLoading(false);
      }).catch(() => {
        setLoading(false);
        toast.error("Something went wrong. Please try again");
      });
  };

  const _openProjectAccess = (member) => {
    if (member.TeamRoles) {
      let selectedTeamRole;
      member.TeamRoles.map((teamRole) => {
        if (teamRole.team_id === team.id) {
          selectedTeamRole = teamRole;
        }
        return teamRole;
      });
      if (selectedTeamRole) setChangedRole(selectedTeamRole);
    }

    setChangedMember(member);
    setProjectModal(true);
  };

  const _onChangeProjectAccess = (projectId) => {
    const newAccess = [...projectAccess[changedMember.id].projects] || [];
    const isFound = _.indexOf(projectAccess[changedMember.id].projects, projectId);

    if (isFound === -1) {
      newAccess.push(projectId);
    } else {
      newAccess.splice(isFound, 1);
    }

    dispatch(updateTeamRole({
      data: { projects: newAccess },
      memberId: changedMember.id,
      team_id: team.id
    }))
      .then(() => {
        const newProjectAccess = _.cloneDeep(projectAccess);
        newProjectAccess[changedMember.id].projects = newAccess;
        setProjectAccess(newProjectAccess);
        toast.success("Updated the user access 🔑");
      })
      .catch(() => {
        toast.error("Oh no! There's a server issue. Please try again");
      });
  };

  const _onChangeExport = () => {
    dispatch(updateTeamRole({
      data: { canExport: !changedRole.canExport },
      memberId: changedMember.id,
      team_id: team.id,
    }))
      .then(() => {
        const newChangedRole = _.clone(changedRole);
        newChangedRole.canExport = !changedRole.canExport;
        setChangedRole(newChangedRole);
        _getTeam();
        toast.success("Updated export settings 📊");
      })
      .catch(() => {
        toast.error("Oh no! There's a server issue 🙈 Please try again");
      });
  };

  const _onDeleteConfirmation = (memberId) => {
    setDeleteMember(memberId);
  };

  const _onDeleteTeamMember = (memberId) => {
    // deleting from teamRole
    setLoading(true);
    dispatch(deleteTeamMember({ memberId: memberId, team_id: team.id }))
      .then(() => {
        dispatch(getTeamMembers({ team_id: team.id }));
        setLoading(false);
        setDeleteMember(false);
      })
      .catch(() => {
        setLoading(false);
        toast.error("Something went wrong. Please try again");
        setDeleteMember(false);
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _teamsOwned = () => {
    // go through all the teams and get all the teams that the user is a teamOwner of
    const teamsOwned = teams.filter((t) => t.TeamRoles.some((tr) => tr.user_id === user.id && tr.role === "teamOwner"));
    return teamsOwned;
  };

  const _onTransferOwnership = async () => {
    setTransfering(true);
    const response = await dispatch(transferOwnership({ team_id: team.id, newOwnerId: transferOwnershipMember.id }));

    if (response?.error) {
      toast.error("Something went wrong. Please try again");
    } else {
      toast.success("Ownership transferred successfully");
      window.location.reload();
    }

    setTransfering(false);
  };

  if (!team) {
    return (
      <div>
        <ProgressCircle size="lg" aria-label="Loading team" />
      </div>
    );
  }

  return (
    <div style={style}>
      {_canAccess("teamAdmin") && (
        <div className="bg-content1 p-4 rounded-lg border border-divider">
          <InviteMembersForm />
        </div>
      )}

      <div className="h-8" />

      <div className="bg-content1 p-4 rounded-lg border border-divider">
        <div className="text-lg font-semibold font-tw">{"Team members"}</div>
        <div className="text-sm text-gray-500">{"Manage your team members and their roles"}</div>
        <div className="h-4" />

        {_canAccess("teamAdmin") && (
          <Table shadow="none" isStriped aria-label="Team members">
            <TableHeader>
              <TableColumn key="member">Member</TableColumn>
              <TableColumn key="role">Role</TableColumn>
              <TableColumn key="projectAccess">Projects</TableColumn>
              <TableColumn key="export">Can export</TableColumn>
              <TableColumn key="actions" hideHeader>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {teamMembers?.length > 0 && teamMembers.map((member) => {
                let memberRole = {};
                for (let i = 0; i < member.TeamRoles.length; i++) {
                  if (member.TeamRoles[i].team_id === team.id) {
                    memberRole = member.TeamRoles[i];
                    break;
                  }
                }

                return (
                  <TableRow key={member.id}>
                    <TableCell key="member" className="flex flex-col">
                      <div className="font-bold">{member.name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </TableCell>
                    <TableCell key="role">
                      {memberRole.role === "teamOwner" && <Chip color="primary" variant="flat" size="sm" startContent={<LuStar size={14} />}>Team Owner</Chip>}
                      {memberRole.role === "teamAdmin" && <Chip color="success" variant="flat" size="sm" startContent={<LuStar size={14} />}>Team Admin</Chip>}
                      {memberRole.role === "projectAdmin" && <Chip color="secondary" variant="flat" size="sm" startContent={<LuUser size={14} />}>Client admin</Chip>}
                      {memberRole.role === "projectEditor" && <Chip color="warning" variant="flat" size="sm" startContent={<LuUser size={14} />}>Client editor</Chip>}
                      {memberRole.role === "projectViewer" && <Chip color="default" variant="flat" size="sm" startContent={<LuUser size={14} />}>Client viewer</Chip>}
                    </TableCell>
                    <TableCell key="projectAccess">
                      {memberRole?.role !== "teamOwner" && memberRole?.role !== "teamAdmin" ? memberRole?.projects?.length : ""}
                      {memberRole?.role === "teamOwner" || memberRole?.role === "teamAdmin" ? "All" : ""}
                    </TableCell>
                    <TableCell key="export">
                      {(memberRole?.canExport || (memberRole?.role?.indexOf("team") > -1)) && <Chip color="success" variant={"flat"} size="sm">Yes</Chip>}
                      {(!memberRole?.canExport && memberRole?.role?.indexOf("team") === -1) && <Chip color="danger" variant={"flat"} size="sm">No</Chip>}
                    </TableCell>
                    <TableCell key="actions">
                      <div className="flex flex-row items-center gap-1">
                        {_canAccess("teamAdmin") && memberRole.role !== "teamOwner" && memberRole.role !== "teamAdmin" && (
                          <>
                            <Tooltip content="Change dashboard access">
                              <Button
                                variant="light"
                                isIconOnly
                                onPress={() => _openProjectAccess(member)}
                                size="sm"
                              >
                                <LuFolderKey />
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {_canAccess("teamOwner") && memberRole.role === "teamAdmin" && (
                          <>
                            <Tooltip content="Transfer ownership">
                              <Button
                                variant="light"
                                isIconOnly
                                onPress={() => {
                                  if (_teamsOwned().length < 2) {
                                    toast.error("You need to own at least one other team to transfer ownership", { position: "bottom-right" });
                                    return;
                                  }

                                  setTransferOwnershipMember(member);
                                }}
                                size="sm"
                              >
                                <LuKeyRound />
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {_canAccess("teamAdmin") && user.id !== member.id && memberRole.role !== "teamOwner" && (
                          <>
                            <Tooltip content="Change member role">
                              <div>
                                <Dropdown aria-label="Select a role">
                                  <DropdownTrigger>
                                    <Button variant="light" auto isIconOnly size="sm">
                                      <LuIdCard />
                                    </Button>
                                  </DropdownTrigger>
                                  <DropdownMenu
                                    onAction={(key) => _onChangeRole(key, member)}
                                    selectedKeys={[memberRole.role]}
                                    selectionMode="single"
                                    aria-label="Change member role"
                                  >
                                    {user.id !== member.id
                                      && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                      && (
                                        <DropdownItem
                                          key="teamAdmin"
                                          textValue="Team Admin"
                                          description={"Full access, but can't delete the team"}
                                          className="max-w-[400px]"
                                        >
                                          Team Admin
                                        </DropdownItem>
                                      )}
                                    {user.id !== member.id
                                      && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                      && (
                                        <DropdownItem
                                          key="projectAdmin"
                                          textValue="Client admin"
                                          description={"Can create, edit, and remove charts in assigned dashboards. The admins can also edit the tagged dataset configurations, including the query."}
                                          className="max-w-[400px]"
                                        >
                                          Client admin
                                        </DropdownItem>
                                      )}
                                    {user.id !== member.id
                                      && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                      && (
                                        <DropdownItem
                                          key="projectEditor"
                                          textValue="Client editor"
                                          description={"Can create, edit, and remove charts in assigned dashboards. The editors can also edit the tagged dataset configurations, but cannot edit the query."}
                                          className="max-w-[400px]"
                                        >
                                          Client editor
                                        </DropdownItem>
                                      )}
                                    {user.id !== member.id
                                      && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                      && (
                                        <DropdownItem
                                          key="projectViewer"
                                          textValue="Client viewer"
                                          description={"Can view charts in assigned projects, but cannot edit or remove anything."}
                                          className="max-w-[400px]"
                                        >
                                          Client viewer
                                        </DropdownItem>
                                      )}
                                  </DropdownMenu>
                                </Dropdown>
                              </div>
                            </Tooltip>
                          </>
                        )}
                        {user.id !== member.id
                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                          && (
                            <Tooltip content="Remove user from the team">
                              <Button
                                variant="light"
                                onPress={() => _onDeleteConfirmation(member.id)}
                                isIconOnly
                                color="danger"
                                size="sm"
                              >
                                <LuCircleX />
                              </Button>
                            </Tooltip>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Remove user modal */}
      <Modal>
        <Modal.Backdrop variant="blur" isOpen={!!deleteMember} onOpenChange={(nextOpen) => { if (!nextOpen) setDeleteMember(false); }}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold">
                  Are you sure you want to remove the user from the team?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{"This action will remove the user from the team and restrict them from accessing the dashboards."}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={loading}
                  onPress={() => _onDeleteTeamMember(deleteMember)}
                >
                  Remove
                  <LuX />
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Project access modal */}
      <Modal>
        <Modal.Backdrop isOpen={projectModal} onOpenChange={setProjectModal}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-4xl">
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold">
                  Assign project access
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {changedMember && projectAccess[changedMember.id] && (
                  <>
                    <div>{"Tick the projects you want to give the user access to. The unticked projects cannot be accessed by this user."}</div>
                    <div className="flex flex-wrap items-center gap-1">
                      <div>{"You are currently giving"}</div>
                      <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{`${projectAccess[changedMember.id].role}`}</code>
                      <div>{`access to ${changedMember.name}`}</div>
                      <div>{"for the following projects:"}</div>
                    </div>
                    <div className="h-2" />

                    <div className="grid grid-cols-12 gap-1">
                      {projects && projects.filter((p) => !p.ghost).map((project) => (
                        <div className="col-span-12 sm:col-span-6 md:col-span-4" key={project.id}>
                          <Checkbox
                            isSelected={
                              _.indexOf(projectAccess[changedMember.id].projects, project.id) > -1
                            }
                            onChange={() => _onChangeProjectAccess(project.id)}
                          >
                            {project.name}
                          </Checkbox>
                        </div>
                      ))}
                    </div>

                    <div className="h-2" />
                    <Separator />
                    <div className="h-2" />

                    <div className="flex flex-row items-center gap-1">
                      <div className="text-lg font-semibold font-tw">{"Data export permissions "}</div>
                      <Tooltip
                        content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
                      >
                        <div><LuInfo /></div>
                      </Tooltip>
                    </div>
                    <div>
                      <Checkbox
                        isSelected={changedRole.canExport}
                        onChange={_onChangeExport}
                      >
                        Allow data export
                      </Checkbox>
                    </div>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  slot="close"
                  variant="secondary"
                >
                  Done
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Transfer ownership modal */}
      <Modal>
        <Modal.Backdrop isOpen={!!transferOwnershipMember} onOpenChange={(nextOpen) => { if (!nextOpen) setTransferOwnershipMember(null); }}>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Are you sure you want to transfer ownership?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div>
                  {`You are about to transfer ownership of the team to ${transferOwnershipMember?.name}.`}
                </div>
                <div>
                  {`This action will make ${transferOwnershipMember?.name} the new owner of the team. They will have full access to the team and all its resources, while you will become an admin.`}
                </div>
                <div>
                  <Input
                    label={<div>Type <span className="font-bold">transfer</span> to confirm</div>}
                    value={transferConfirmation}
                    onChange={(e) => setTransferConfirmation(e.target.value)}
                    variant="secondary"
                    endContent={transferConfirmation === "transfer" && <LuCircleCheck size={18} className="text-success" />}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">Cancel</Button>
                <Button
                  variant="primary"
                  isPending={transfering}
                  onPress={_onTransferOwnership}
                  isDisabled={transferConfirmation !== "transfer"}
                >
                  Transfer ownership
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

TeamMembers.defaultProps = {
  style: {},
};

TeamMembers.propTypes = {
  style: PropTypes.object,
};

export default TeamMembers;
