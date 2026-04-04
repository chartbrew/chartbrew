import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Chip, Button, Checkbox, Separator, Dropdown, Modal, Table, Tooltip, ProgressCircle,
  TextField, InputGroup,
  Label,
  EmptyState,
} from "@heroui/react";
import _ from "lodash";
import toast from "react-hot-toast";
import { LuFolderKey, LuInfo, LuStar, LuUser, LuUsers, LuX, LuCircleX, LuKeyRound, LuIdCard, LuCircleCheck } from "react-icons/lu";

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

  const [loading, setLoading] = useState(false);
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
    const newAccess = [...(projectAccess[changedMember.id]?.projects || [])];
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

  const _onChangeExport = (canExport) => {
    dispatch(updateTeamRole({
      data: { canExport },
      memberId: changedMember.id,
      team_id: team.id,
    }))
      .then(() => {
        const newChangedRole = _.clone(changedRole);
        newChangedRole.canExport = canExport;
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
      <div className="bg-surface p-4 rounded-3xl border border-divider">
        <div className="text-lg font-semibold font-tw">{"Team members"}</div>
        <div className="text-sm text-gray-500">{"Manage your team members and their roles"}</div>
        <div className="h-4" />

        {_canAccess("teamAdmin") && (
          <Table className="shadow-none min-h-[200px]">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Team members"
                className="min-w-full even:[&_tbody>tr]:bg-content2/30"
              >
                <Table.Header>
                  <Table.Column id="member" isRowHeader>
                    Member
                  </Table.Column>
                  <Table.Column id="role">
                    Role
                  </Table.Column>
                  <Table.Column id="projectAccess">
                    Projects
                  </Table.Column>
                  <Table.Column id="export">
                    Can export
                  </Table.Column>
                  <Table.Column id="actions" className="w-12">
                    <span className="sr-only">Actions</span>
                  </Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <EmptyState className="flex h-full w-full min-h-[160px] flex-col items-center justify-center gap-2 text-center">
                      <LuUsers className="size-6 text-muted" aria-hidden />
                      <span className="text-sm text-muted">No team members</span>
                    </EmptyState>
                  )}
                >
                  {(teamMembers || []).map((member) => {
                let memberRole = {};
                for (let i = 0; i < member.TeamRoles.length; i++) {
                  if (member.TeamRoles[i].team_id === team.id) {
                    memberRole = member.TeamRoles[i];
                    break;
                  }
                }

                return (
                  <Table.Row key={member.id} id={String(member.id)}>
                    <Table.Cell className="flex flex-col">
                      <div className="font-bold">{member.name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </Table.Cell>
                    <Table.Cell>
                      {memberRole.role === "teamOwner" && <Chip variant="primary" size="sm"><LuStar size={14} />Team Owner</Chip>}
                      {memberRole.role === "teamAdmin" && <Chip color="success" variant="soft" size="sm"><LuStar size={14} />Team Admin</Chip>}
                      {memberRole.role === "projectAdmin" && <Chip variant="secondary" size="sm"><LuUser size={14} />Client admin</Chip>}
                      {memberRole.role === "projectEditor" && <Chip color="warning" variant="soft" size="sm"><LuUser size={14} />Client editor</Chip>}
                      {memberRole.role === "projectViewer" && <Chip color="default" variant="soft" size="sm"><LuUser size={14} />Client viewer</Chip>}
                    </Table.Cell>
                    <Table.Cell>
                      {memberRole?.role !== "teamOwner" && memberRole?.role !== "teamAdmin" ? memberRole?.projects?.length : ""}
                      {memberRole?.role === "teamOwner" || memberRole?.role === "teamAdmin" ? "All" : ""}
                    </Table.Cell>
                    <Table.Cell>
                      {(memberRole?.canExport || (memberRole?.role?.indexOf("team") > -1)) && <Chip color="success" variant="soft" size="sm">Yes</Chip>}
                      {(!memberRole?.canExport && memberRole?.role?.indexOf("team") === -1) && <Chip color="danger" variant="soft" size="sm">No</Chip>}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-row items-center gap-1">
                        {_canAccess("teamAdmin") && memberRole.role !== "teamOwner" && memberRole.role !== "teamAdmin" && (
                          <>
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  variant="ghost"
                                  isIconOnly
                                  onPress={() => _openProjectAccess(member)}
                                  size="sm"
                                >
                                  <LuFolderKey />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Change dashboard access</Tooltip.Content>
                            </Tooltip>
                          </>
                        )}
                        {_canAccess("teamOwner") && memberRole.role === "teamAdmin" && (
                          <>
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  variant="ghost"
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
                              </Tooltip.Trigger>
                              <Tooltip.Content>Transfer ownership</Tooltip.Content>
                            </Tooltip>
                          </>
                        )}
                        {_canAccess("teamAdmin") && user.id !== member.id && memberRole.role !== "teamOwner" && (
                          <>
                            <Tooltip>
                              <Tooltip.Trigger>
                                <div>
                                  <Dropdown aria-label="Select a role">
                                    <Dropdown.Trigger>
                                      <Button variant="ghost" isIconOnly size="sm">
                                        <LuIdCard />
                                      </Button>
                                    </Dropdown.Trigger>
                                    <Dropdown.Popover>
                                      <Dropdown.Menu
                                        onAction={(key) => _onChangeRole(key, member)}
                                        selectedKeys={[memberRole.role]}
                                        selectionMode="single"
                                        aria-label="Change member role"
                                      >
                                        {user.id !== member.id
                                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                          && (
                                            <Dropdown.Item
                                              id="teamAdmin"
                                              textValue="Team Admin"
                                              className="max-w-[400px]"
                                            >
                                              <div className="flex flex-col gap-1 py-0.5">
                                                <span className="font-medium">Team Admin</span>
                                                <span className="text-xs text-default-500">Full access, but can&apos;t delete the team</span>
                                              </div>
                                            </Dropdown.Item>
                                          )}
                                        {user.id !== member.id
                                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                          && (
                                            <Dropdown.Item
                                              id="projectAdmin"
                                              textValue="Client admin"
                                              className="max-w-[400px]"
                                            >
                                              <div className="flex flex-col gap-1 py-0.5">
                                                <span className="font-medium">Client admin</span>
                                                <span className="text-xs text-default-500">Can create, edit, and remove charts in assigned dashboards. The admins can also edit the tagged dataset configurations, including the query.</span>
                                              </div>
                                            </Dropdown.Item>
                                          )}
                                        {user.id !== member.id
                                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                          && (
                                            <Dropdown.Item
                                              id="projectEditor"
                                              textValue="Client editor"
                                              className="max-w-[400px]"
                                            >
                                              <div className="flex flex-col gap-1 py-0.5">
                                                <span className="font-medium">Client editor</span>
                                                <span className="text-xs text-default-500">Can create, edit, and remove charts in assigned dashboards. The editors can also edit the tagged dataset configurations, but cannot edit the query.</span>
                                              </div>
                                            </Dropdown.Item>
                                          )}
                                        {user.id !== member.id
                                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                                          && (
                                            <Dropdown.Item
                                              id="projectViewer"
                                              textValue="Client viewer"
                                              className="max-w-[400px]"
                                            >
                                              <div className="flex flex-col gap-1 py-0.5">
                                                <span className="font-medium">Client viewer</span>
                                                <span className="text-xs text-default-500">Can view charts in assigned projects, but cannot edit or remove anything.</span>
                                              </div>
                                            </Dropdown.Item>
                                          )}
                                      </Dropdown.Menu>
                                    </Dropdown.Popover>
                                  </Dropdown>
                                </div>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Change member role</Tooltip.Content>
                            </Tooltip>
                          </>
                        )}
                        {user.id !== member.id
                          && (_canAccess("teamOwner") || (_canAccess("teamAdmin") && memberRole.role !== "teamOwner"))
                          && (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  variant="ghost"
                                  onPress={() => _onDeleteConfirmation(member.id)}
                                  isIconOnly
                                  color="danger"
                                  size="sm"
                                >
                                  <LuCircleX />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Remove user from the team</Tooltip.Content>
                            </Tooltip>
                          )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </div>

      <div className="h-4" />
      
      {_canAccess("teamAdmin") && (
        <div className="bg-surface p-4 rounded-3xl border border-divider">
          <InviteMembersForm />
        </div>
      )}

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
                            id={`team-member-${changedMember.id}-project-${project.id}`}
                            isSelected={_.indexOf(projectAccess[changedMember.id].projects, project.id) > -1}
                            onChange={(selected) => {
                              const wasSelected = _.indexOf(projectAccess[changedMember.id].projects, project.id) > -1;
                              if (selected !== wasSelected) _onChangeProjectAccess(project.id);
                            }}
                            variant="secondary"
                          >
                            <Checkbox.Control className="size-4 shrink-0">
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Checkbox.Content>
                              <Label htmlFor={`team-member-${changedMember.id}-project-${project.id}`} className="text-sm">{project.name}</Label>
                            </Checkbox.Content>
                          </Checkbox>
                        </div>
                      ))}
                    </div>

                    <div className="h-2" />
                    <Separator />
                    <div className="h-2" />

                    <div className="flex flex-row items-center gap-1">
                      <div className="text-lg font-semibold font-tw">{"Data export permissions "}</div>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <div><LuInfo /></div>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data.
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                    <div>
                      <Checkbox
                        id={`team-member-export-${changedMember.id}`}
                        isSelected={changedRole.canExport}
                        onChange={_onChangeExport}
                        variant="secondary"
                      >
                        <Checkbox.Control className="size-4 shrink-0">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <Label htmlFor={`team-member-export-${changedMember.id}`} className="text-sm">Allow data export</Label>
                        </Checkbox.Content>
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
                  <TextField className="w-full" name="transfer-confirmation">
                    <Label>
                      Type <span className="font-bold">transfer</span> to confirm
                    </Label>
                    <InputGroup variant="secondary" fullWidth>
                      <InputGroup.Input
                        value={transferConfirmation}
                        onChange={(e) => setTransferConfirmation(e.target.value)}
                      />
                      {transferConfirmation === "transfer" && (
                        <InputGroup.Suffix className="pr-2">
                          <LuCircleCheck size={18} className="text-success" aria-hidden />
                        </InputGroup.Suffix>
                      )}
                    </InputGroup>
                  </TextField>
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
