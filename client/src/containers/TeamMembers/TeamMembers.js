import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Dimmer, Message, Segment, Button, Divider, Dropdown, Checkbox, Grid,
  Loader, Container, Header, Modal, List, TransitionablePortal, Popup, Icon, Label,
} from "semantic-ui-react";
import _ from "lodash";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import { useWindowSize } from "react-use";
import { createMedia } from "@artsy/fresnel";

import {
  getTeam as getTeamAction,
  getTeamMembers as getTeamMembersAction,
  updateTeamRole as updateTeamRoleAction,
  deleteTeamMember as deleteTeamMemberAction,
} from "../../actions/team";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import InviteMembersForm from "../../components/InviteMembersForm";
import canAccess from "../../config/canAccess";

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const { Media } = AppMedia;

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
  const [error, setError] = useState(false);
  const [deleteMember, setDeleteMember] = useState("");
  const [projectModal, setProjectModal] = useState(false);
  const [projectAccess, setProjectAccess] = useState({});
  const [changedRole, setChangedRole] = useState({});

  const { width } = useWindowSize();

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
    setError(false);
    setChangedMember(member);
    updateTeamRole({ role: newRole }, member.id, team.id)
      .then(() => {
        setLoading(false);
      }).catch(() => {
        setLoading(false);
        setError(true);
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
        setError(true);
        setDeleteMember(false);
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  if (!team) {
    return (
      <Container text style={styles.container}>
        <Dimmer active={!team}>
          <Loader />
        </Dimmer>
      </Container>
    );
  }

  return (
    <div style={style}>
      {_canAccess("admin")
        && (
        <div>
          <Divider hidden />
        </div>
        )}

      {_canAccess("admin")
        && (
        <div>
          <InviteMembersForm />
          <Divider hidden />
        </div>
        )}

      <Segment>
        <Header as="h3">{"Team members"}</Header>

        <Container fluid>
          <List relaxed divided size="large" selection>
            {teamMembers && teamMembers.map((member) => {
              let memberRole = "guest";
              for (let i = 0; i < member.TeamRoles.length; i++) {
                if (member.TeamRoles[i].team_id === team.id) {
                  memberRole = member.TeamRoles[i].role;
                  break;
                }
              }

              return (
                <List.Item key={member.id}>
                  <List.Content floated="right">
                    {_canAccess("admin") && (
                      <Button
                        icon={width < 768 ? "key" : null}
                        content={width < 768 ? null : "Project access"}
                        onClick={() => _openProjectAccess(member)}
                        size="small"
                      />
                    )}
                    {_canAccess("admin") && user.id !== member.id && (
                      <Dropdown
                        text={width < 768 ? null : "Edit role"}
                        floating={width >= 768}
                        labeled={width >= 768}
                        button
                        icon="eye"
                        className="small icon"
                        direction="left"
                      >
                        <Dropdown.Menu>
                          {user.id !== member.id && memberRole !== "member"
                            && (_canAccess("owner") || (_canAccess("admin") && memberRole !== "owner"))
                            && (
                            <Dropdown.Item
                              onClick={() => _onChangeRole("member", member)}
                            >
                              <strong>Member</strong>
                              <Media greaterThan="mobile">
                                <p>{"Can only view projects and charts. Cannot update chart or connection data."}</p>
                              </Media>
                            </Dropdown.Item>
                            )}
                          {user.id !== member.id && memberRole !== "editor"
                            && (_canAccess("owner") || (_canAccess("admin") && memberRole !== "owner"))
                            && (
                            <Dropdown.Item
                              onClick={() => _onChangeRole("editor", member)}
                            >
                              <strong>Editor</strong>
                              <Media greaterThan="mobile">
                                <p>{"Create, edit, remove charts. Can also create new connections."}</p>
                              </Media>
                            </Dropdown.Item>
                            )}
                          {user.id !== member.id && memberRole !== "admin"
                            && (_canAccess("owner") || (_canAccess("admin") && memberRole !== "owner"))
                            && (
                            <Dropdown.Item
                              onClick={() => _onChangeRole("admin", member)}
                            >
                              <strong>Admin</strong>
                              <Media greaterThan="mobile">
                                <p>{"Full access, but can't delete the team."}</p>
                              </Media>
                            </Dropdown.Item>
                            )}
                        </Dropdown.Menu>
                      </Dropdown>
                    )}
                    {user.id !== member.id
                      && (_canAccess("owner") || (_canAccess("admin") && memberRole !== "owner"))
                      && (
                      <Button
                        onClick={() => _onDeleteConfirmation(member.id)}
                        floated="right"
                        icon="trash"
                        basic
                        size="small"
                      />
                      )}
                  </List.Content>

                  <List.Content>
                    {user.id === member.id
                      ? (
                        <List.Header>
                          <strong>{"(You) "}</strong>
                          {member.name}
                          {" "}
                          {member.surname}
                          {" "}
                          <Label size="small">{`${memberRole}`}</Label>
                        </List.Header>
                      )
                      : (
                        <List.Header>
                          {" "}
                          {member.name}
                          {" "}
                          {member.surname}
                          {" "}
                          <Label size="small">{`${memberRole}`}</Label>
                        </List.Header>
                      )}
                    <List.Description>{member.email}</List.Description>
                  </List.Content>
                  {error && changedMember && member.id === changedMember.id
                    && (
                    <Container textAlign="center">
                      <Message
                        content="Something went wrong, please try again!"
                        negative
                        onDismiss={() => {
                          setError(false);
                          setChangedMember(null);
                        }}
                      />
                    </Container>
                    )}
                </List.Item>
              );
            })}
          </List>
        </Container>
      </Segment>

      {/* Remove user modal */}
      <TransitionablePortal open={!!deleteMember}>
        <Modal
          open={!!deleteMember}
          size="small"
          basic
          onClose={() => setDeleteMember(false)}
        >
          <Modal.Header>
            Are you sure you want to remove the user from the team?
          </Modal.Header>
          <Modal.Content>
            <p>{"This action will remove the user from the team and restrict them from accessing the dashboards."}</p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => setDeleteMember(false)}
            >
              Cancel
            </Button>
            <Button
              negative
              loading={loading}
              onClick={() => _onDeleteTeamMember(deleteMember)}
            >
              Remove
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      <TransitionablePortal open={projectModal}>
        <Modal open={projectModal} onClose={() => setProjectModal(false)}>
          <Modal.Header>
            Assign project access
          </Modal.Header>
          <Modal.Content>
            {changedMember && projectAccess[changedMember.id] && (
              <div>
                <p>{"Tick the projects you want to give the user access to. The unticked projects cannot be accessed by this user."}</p>
                <p>
                  {"You are currently giving"}
                  <strong>{` ${projectAccess[changedMember.id].role} `}</strong>
                  {"access to"}
                  <strong>{` ${changedMember.name} `}</strong>
                  {"for the following projects:"}
                </p>
                <Grid columns={2} stackable>
                  {projects && projects.map((project) => (
                    <Grid.Column key={project.id}>
                      <Checkbox
                        toggle
                        label={project.name}
                        checked={
                          _.indexOf(projectAccess[changedMember.id].projects, project.id) > -1
                        }
                        onClick={() => _onChangeProjectAccess(project.id)}
                      />
                    </Grid.Column>
                  ))}
                </Grid>

                <Divider />
                <Header as="h4">
                  {"Data export permissions "}
                  <Popup
                    trigger={<Icon style={{ fontSize: 16, verticalAlign: "baseline" }} name="question circle" />}
                    content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
                  />
                </Header>
                <Checkbox
                  toggle
                  label="Allow data export"
                  checked={changedRole.canExport}
                  onClick={_onChangeExport}
                />
              </div>
            )}
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Close"
              onClick={() => setProjectModal(false)}
            />
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

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
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: 20,
    paddingLeft: 30,
  },
};

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
