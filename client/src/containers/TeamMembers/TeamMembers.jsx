import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Chip, Button, Checkbox, Divider, Dropdown, Modal, Spacer, Table, Tooltip, CircularProgress,
  TableHeader, TableColumn, TableBody, TableRow, TableCell, DropdownMenu, DropdownItem,
  DropdownTrigger, ModalHeader, ModalBody, ModalFooter, ModalContent, Code,
} from "@heroui/react";
import _ from "lodash";
import toast from "react-hot-toast";
import { useParams } from "react-router";
import { LuContact, LuFolderKey, LuInfo, LuStar, LuUser, LuX, LuCircleX } from "react-icons/lu";

import {
  getTeam, getTeamMembers, updateTeamRole, deleteTeamMember, selectTeam, selectTeamMembers,
} from "../../slices/team";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import InviteMembersForm from "../../components/InviteMembersForm";
import canAccess from "../../config/canAccess";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import Segment from "../../components/Segment";

/*
  Contains Pending Invites and All team members with functionality to delete/change role
*/
function TeamMembers(props) {
  const {
    cleanErrors, user, style, projects,
  } = props;

  const [loading, setLoading] = useState(true);
  const [changedMember, setChangedMember] = useState(null);
  const [deleteMember, setDeleteMember] = useState("");
  const [projectModal, setProjectModal] = useState(false);
  const [projectAccess, setProjectAccess] = useState({});
  const [changedRole, setChangedRole] = useState({});

  const team = useSelector(selectTeam);
  const teamMembers = useSelector(selectTeamMembers);

  const params = useParams();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();
    _getTeam();
  }, []);

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
    dispatch(getTeam(params.teamId))
      .then(() => {
        dispatch(getTeamMembers({ team_id: params.teamId }));
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

  if (!team) {
    return (
      <Container size="sm" justify="center">
        <CircularProgress size="lg" aria-label="Loading team" />
      </Container>
    );
  }

  return (
    <div style={style}>
      {_canAccess("teamAdmin") && (
        <Segment className={"bg-content1"}>
          <InviteMembersForm />
        </Segment>
      )}

      <Spacer y={4} />

      <Segment className={"bg-content1"}>
        <Row>
          <Text size="h4">{"Team members"}</Text>
        </Row>
        <Spacer y={2} />

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
                      <Text b>{member.name}</Text>
                      <Text size="sm" className={"text-foreground-500"}>{member.email}</Text>
                    </TableCell>
                    <TableCell key="role">
                      {memberRole.role === "teamOwner" && <Chip color="primary" variant="flat" size="sm" startContent={<LuStar size={18} />}>Team Owner</Chip>}
                      {memberRole.role === "teamAdmin" && <Chip color="success" variant="flat" size="sm" startContent={<LuStar size={18} />}>Team Admin</Chip>}
                      {memberRole.role === "projectAdmin" && <Chip color="secondary" variant="flat" size="sm" startContent={<LuUser size={18} />}>Client admin</Chip>}
                      {memberRole.role === "projectEditor" && <Chip color="warning" variant="flat" size="sm" startContent={<LuUser size={18} />}>Client editor</Chip>}
                      {memberRole.role === "projectViewer" && <Chip color="default" variant="flat" size="sm" startContent={<LuUser size={18} />}>Client viewer</Chip>}
                    </TableCell>
                    <TableCell key="projectAccess">
                      {memberRole.role !== "teamOwner" && memberRole.role !== "teamAdmin" ? memberRole?.projects?.length : ""}
                      {memberRole.role === "teamOwner" || memberRole.role === "teamAdmin" ? "All" : ""}
                    </TableCell>
                    <TableCell key="export">
                      {(memberRole.canExport || (memberRole.role.indexOf("team") > -1)) && <Chip color="success" variant={"flat"} size="sm">Yes</Chip>}
                      {(!memberRole.canExport && memberRole.role.indexOf("team") === -1) && <Chip color="danger" variant={"flat"} size="sm">No</Chip>}
                    </TableCell>
                    <TableCell key="actions">
                      <div>
                        <Row className={"gap-2"}>
                          {_canAccess("teamAdmin") && memberRole.role !== "teamOwner" && memberRole !== "teamAdmin" && (
                            <>
                              <Tooltip content="Change dashboard access">
                                <Button
                                  variant="light"
                                  isIconOnly
                                  auto
                                  onClick={() => _openProjectAccess(member)}
                                  size="sm"
                                >
                                  <LuFolderKey />
                                </Button>
                              </Tooltip>
                            </>
                          )}
                          {_canAccess("teamAdmin") && user.id !== member.id && (
                            <>
                              <Tooltip content="Change member role">
                                <div>
                                  <Dropdown aria-label="Select a role">
                                    <DropdownTrigger>
                                      <Button variant="light" auto isIconOnly size="sm">
                                        <LuContact />
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
                                            <Text>Team Admin</Text>
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
                                            <Text>Client admin</Text>
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
                                            <Text>Client editor</Text>
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
                                            <Text>Client viewer</Text>
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
                                  onClick={() => _onDeleteConfirmation(member.id)}
                                  isIconOnly
                                  color="danger"
                                  size="sm"
                                >
                                  <LuCircleX />
                                </Button>
                              </Tooltip>
                            )}
                        </Row>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Segment>

      {/* Remove user modal */}
      <Modal isOpen={!!deleteMember} backdrop="blur" onClose={() => setDeleteMember(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to remove the user from the team?</Text>
          </ModalHeader>
          <ModalBody>
            <p>{"This action will remove the user from the team and restrict them from accessing the dashboards."}</p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setDeleteMember(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={loading}
              onClick={() => _onDeleteTeamMember(deleteMember)}
              endContent={<LuX />}
            >
              Remove
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Project access modal */}
      <Modal isOpen={projectModal} onClose={() => setProjectModal(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Assign project access</Text>
          </ModalHeader>
          <ModalBody>
            {changedMember && projectAccess[changedMember.id] && (
              <>
                <Row>
                  <Text>{"Tick the projects you want to give the user access to. The unticked projects cannot be accessed by this user."}</Text>
                </Row>
                <Row wrap="wrap" align={"center"}>
                  <Text>{"You are currently giving"}</Text>
                  <Spacer x={1} />
                  <Code>{`${projectAccess[changedMember.id].role}`}</Code>
                  <Spacer x={1} />
                  <Text>{`access to ${changedMember.name}`}</Text>
                  <Spacer x={1} />
                  <Text>{"for the following projects:"}</Text>
                </Row>
                <Spacer y={0.5} />

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

                <Spacer y={1} />
                <Divider />
                <Spacer y={1} />

                <Row align="center">
                  <Text size={"lg"} b>
                    {"Data export permissions "}
                  </Text>
                  <Spacer x={0.5} />
                  <Tooltip
                    content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
                  >
                    <div><LuInfo /></div>
                  </Tooltip>
                </Row>
                <Row>
                  <Checkbox
                    isSelected={changedRole.canExport}
                    onChange={_onChangeExport}
                  >
                    Allow data export
                  </Checkbox>
                </Row>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setProjectModal(false)}
            >
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

TeamMembers.defaultProps = {
  style: {},
};

TeamMembers.propTypes = {
  user: PropTypes.object.isRequired,
  style: PropTypes.object,
  cleanErrors: PropTypes.func.isRequired,
  projects: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    projects: state.project.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TeamMembers);
