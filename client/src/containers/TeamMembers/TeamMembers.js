import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Badge, Button, Checkbox, Container, Divider, Dropdown, Grid, Loading,
  Modal, Row, Spacer, Table, Text, Tooltip, useTheme,
} from "@nextui-org/react";
import _ from "lodash";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import {
  CloseSquare, InfoCircle, Password, People,
} from "react-iconly";

import {
  getTeam as getTeamAction,
  getTeamMembers as getTeamMembersAction,
  updateTeamRole as updateTeamRoleAction,
  deleteTeamMember as deleteTeamMemberAction,
} from "../../actions/team";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import InviteMembersForm from "../../components/InviteMembersForm";
import canAccess from "../../config/canAccess";

/*
  Contains Pending Invites and All team members with functionality to delete/change role
*/
function TeamMembers(props) {
  const {
    cleanErrors, getTeam, getTeamMembers, match, updateTeamRole, team,
    user, style, teamMembers, deleteTeamMember, projects,
  } = props;

  const [loading, setLoading] = useState(true);
  const [changedMember, setChangedMember] = useState(null);
  const [deleteMember, setDeleteMember] = useState("");
  const [projectModal, setProjectModal] = useState(false);
  const [projectAccess, setProjectAccess] = useState({});
  const [changedRole, setChangedRole] = useState({});

  const { isDark } = useTheme();

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
    getTeam(match.params.teamId)
      .then((team) => {
        getTeamMembers(team.id);
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _onChangeRole = (newRole, member) => {
    setLoading(true);
    setChangedMember(member);
    updateTeamRole({ role: newRole }, member.id, team.id)
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
    const newAccess = projectAccess[changedMember.id].projects || [];
    const isFound = _.indexOf(projectAccess[changedMember.id].projects, projectId);

    if (isFound === -1) {
      newAccess.push(projectId);
    } else {
      newAccess.splice(isFound, 1);
    }

    updateTeamRole({
      projects: newAccess,
    }, changedMember.id, team.id)
      .then(() => {
        toast.success("Updated the user access 👨‍🎓");
      })
      .catch(() => {
        toast.error("Oh no! There's a server issue 🙈 Please try again");
      });
  };

  const _onChangeExport = () => {
    updateTeamRole({
      canExport: !changedRole.canExport,
    }, changedMember.id, team.id)
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
    deleteTeamMember(memberId, team.id)
      .then(() => {
        getTeamMembers(team.id);
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
      <Container sm justify="center">
        <Loading type="spinner" size="lg" />
      </Container>
    );
  }

  return (
    <div style={style}>
      {_canAccess("admin") && (
        <div>
          <InviteMembersForm />
          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />
        </div>
      )}

      <Container>
        <Row>
          <Text h3>{"Team members"}</Text>
        </Row>

        <Table selectionMode="none" shadow={false} bordered headerLined>
          <Table.Header>
            <Table.Column key="member">Member</Table.Column>
            <Table.Column key="role">Role</Table.Column>
            <Table.Column key="projectAccess">Projects</Table.Column>
            <Table.Column key="export">Can export</Table.Column>
            <Table.Column key="actions">Actions</Table.Column>
          </Table.Header>
          <Table.Body>
            {teamMembers && teamMembers.map((member) => {
              let memberRole = {};
              for (let i = 0; i < member.TeamRoles.length; i++) {
                if (member.TeamRoles[i].team_id === team.id) {
                  memberRole = member.TeamRoles[i];
                  break;
                }
              }

              return (
                <Table.Row key={member.id}>
                  <Table.Cell key="member">
                    <Text>{member.name}</Text>
                    <Text small css={{ color: "$accents6" }}>{member.email}</Text>
                  </Table.Cell>
                  <Table.Cell key="role">
                    {memberRole.role === "owner" && <Badge color="primary">Owner</Badge>}
                    {memberRole.role === "admin" && <Badge color="success">Admin</Badge>}
                    {memberRole.role === "editor" && <Badge color="secondary">Editor</Badge>}
                    {memberRole.role === "member" && <Badge color="default">Member</Badge>}
                  </Table.Cell>
                  <Table.Cell key="projectAccess">
                    {!memberRole.projects || memberRole.projects.length === 0 ? "None" : memberRole.projects.length}
                  </Table.Cell>
                  <Table.Cell key="export">
                    {memberRole.canExport && <Badge color="success" variant={"flat"}>Yes</Badge>}
                    {!memberRole.canExport && <Badge color="error" variant={"flat"}>No</Badge>}
                  </Table.Cell>
                  <Table.Cell key="actions">
                    <Container css={{ pl: 0, pr: 0 }}>
                      <Row>
                        {_canAccess("admin") && (
                          <>
                            <Tooltip content="Adjust project access">
                              <Button
                                light
                                color="primary"
                                icon={<Password />}
                                auto
                                onClick={() => _openProjectAccess(member)}
                              />
                            </Tooltip>
                            <Spacer x={0.2} />
                          </>
                        )}
                        {_canAccess("admin") && user.id !== member.id && (
                          <>
                            <Tooltip content="Change member role">
                              <Dropdown>
                                <Dropdown.Button light auto icon={<People />} color="secondary" />
                                <Dropdown.Menu
                                  onAction={(key) => _onChangeRole(key, member)}
                                  selectedKeys={[memberRole.role]}
                                  selectionMode="single"
                                >
                                  {user.id !== member.id
                                    && (_canAccess("owner") || (_canAccess("admin") && memberRole.role !== "owner"))
                                    && (
                                      <Dropdown.Item key="admin" css={{ height: "fit-content", lineHeight: 1, pb: 5 }}>
                                        <Text>Admin</Text>
                                        <Text small css={{ color: "$accents6", wordWrap: "break-word" }}>
                                          {"Full access, but can't delete the team"}
                                        </Text>
                                      </Dropdown.Item>
                                    )}
                                  {user.id !== member.id
                                    && (_canAccess("owner") || (_canAccess("admin") && memberRole.role !== "owner"))
                                    && (
                                      <Dropdown.Item key="editor" css={{ height: "max-content", lineHeight: 1, pb: 5 }}>
                                        <Text>Editor</Text>
                                        <Text small css={{ color: "$accents6", wordWrap: "break-word" }}>
                                          {"Can create, edit, and remove charts and connections in assigned projects"}
                                        </Text>
                                      </Dropdown.Item>
                                    )}
                                  {user.id !== member.id
                                    && (_canAccess("owner") || (_canAccess("admin") && memberRole.role !== "owner"))
                                    && (
                                      <Dropdown.Item key="member" css={{ height: "fit-content", lineHeight: 1, pb: 5 }}>
                                        <Text>Member</Text>
                                        <Text small css={{ color: "$accents6", wordWrap: "break-word" }}>
                                          {"Can view charts in assigned projects"}
                                        </Text>
                                      </Dropdown.Item>
                                    )}
                                </Dropdown.Menu>
                              </Dropdown>
                            </Tooltip>
                            <Spacer x={0.2} />
                          </>
                        )}
                        {user.id !== member.id
                          && (_canAccess("owner") || (_canAccess("admin") && memberRole !== "owner"))
                          && (
                            <Tooltip content="Remove user from the team">
                              <Button
                                light
                                auto
                                onClick={() => _onDeleteConfirmation(member.id)}
                                icon={<CloseSquare />}
                                color="error"
                              />
                            </Tooltip>
                          )}
                      </Row>
                    </Container>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </Container>

      {/* Remove user modal */}
      <Modal open={!!deleteMember} blur onClose={() => setDeleteMember(false)}>
        <Modal.Header>
          <Text h4>Are you sure you want to remove the user from the team?</Text>
        </Modal.Header>
        <Modal.Body>
          <p>{"This action will remove the user from the team and restrict them from accessing the dashboards."}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            auto
            onClick={() => setDeleteMember(false)}
          >
            Cancel
          </Button>
          <Button
            auto
            color="error"
            disabled={loading}
            onClick={() => _onDeleteTeamMember(deleteMember)}
            iconRight={loading ? <Loading type="points" /> : <CloseSquare />}
          >
            Remove
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Project access modal */}
      <Modal open={projectModal} onClose={() => setProjectModal(false)} width="700px">
        <Modal.Header>
          <Text h4>Assign project access</Text>
        </Modal.Header>
        <Modal.Body>
          {changedMember && projectAccess[changedMember.id] && (
            <Container>
              <Row>
                <Text>{"Tick the projects you want to give the user access to. The unticked projects cannot be accessed by this user."}</Text>
              </Row>
              <Spacer y={0.5} />
              <Row wrap="wrap">
                <Text>{"You are currently giving"}</Text>
                <Spacer x={0.2} />
                <Badge color="primary">{`${projectAccess[changedMember.id].role}`}</Badge>
                <Spacer x={0.2} />
                <Text>{`access to ${changedMember.name}`}</Text>
                <Spacer x={0.2} />
                <Text>{"for the following projects:"}</Text>
              </Row>
              <Spacer y={0.5} />

              <Grid.Container gap={0.5}>
                {projects && projects.map((project) => (
                  <Grid xs={12} sm={6} key={project.id}>
                    <Checkbox
                      label={project.name}
                      isSelected={
                        _.indexOf(projectAccess[changedMember.id].projects, project.id) > -1
                      }
                      onChange={() => _onChangeProjectAccess(project.id)}
                      size="sm"
                    />
                  </Grid>
                ))}
              </Grid.Container>

              <Spacer y={0.5} />
              <Divider />
              <Spacer y={0.5} />

              <Row align="center">
                <Text size={20} b>
                  {"Data export permissions "}
                </Text>
                <Spacer x={0.2} />
                <Tooltip
                  content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
                  css={{ zIndex: 99999 }}
                >
                  <InfoCircle />
                </Tooltip>
              </Row>
              <Spacer y={0.5} />
              <Row>
                <Checkbox
                  label="Allow data export"
                  isSelected={changedRole.canExport}
                  onChange={_onChangeExport}
                  size="sm"
                />
              </Row>
            </Container>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            auto
            flat
            color="warning"
            onClick={() => setProjectModal(false)}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={isDark ? "dark" : "light"}
      />
    </div>
  );
}

TeamMembers.defaultProps = {
  style: {},
};

TeamMembers.propTypes = {
  getTeam: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  teamMembers: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
  style: PropTypes.object,
  getTeamMembers: PropTypes.func.isRequired,
  updateTeamRole: PropTypes.func.isRequired,
  deleteTeamMember: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  projects: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    teamMembers: state.team.teamMembers,
    user: state.user.data,
    projects: state.project.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeam: id => dispatch(getTeamAction(id)),
    getTeamMembers: teamId => dispatch(getTeamMembersAction(teamId)),
    updateTeamRole: (role, memberId, teamId) => (
      dispatch(updateTeamRoleAction(role, memberId, teamId))
    ),
    deleteTeamMember: (memberId, teamId) => (
      dispatch(deleteTeamMemberAction(memberId, teamId))
    ),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(TeamMembers));
