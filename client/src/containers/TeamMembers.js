import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Dimmer, Message, Segment, Popup, Button, Divider,
  Loader, Container, Header, Modal, List, TransitionablePortal,
} from "semantic-ui-react";
import {
  getTeam, getTeamMembers, updateTeamRole, deleteTeamMember
} from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Invites from "../components/Invites";
import InviteMembersForm from "../components/InviteMembersForm";
import canAccess from "../config/canAccess";

/*
  Contains Pending Invites and All team members with functionality to delete/change role
*/
class TeamMembers extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      changedMemberId: "",
      error: false,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
    this._getTeam();
  }

  _getTeam = () => {
    const { getTeam, getTeamMembers, match } = this.props;
    getTeam(match.params.teamId)
      .then((team) => {
        getTeamMembers(team.id);
      })
      .then(() => {
        this.setState({ loading: false });
      })
      .catch(() => {
        this.setState({ loading: false });
      });
  }

  _onChangeRole = (newRole, memberId) => {
    const { updateTeamRole, team } = this.props;

    this.setState({
      loading: true, error: false, changedMemberId: memberId
    });
    updateTeamRole(newRole, memberId, team.id)
      .then(() => {
        this.setState({ loading: false });
      }).catch(() => {
        this.setState({ loading: false, error: true });
      });
  }

  _onDeleteConfirmation = (memberId) => {
    this.setState({ deleteMember: memberId });
  }

  _onDeleteTeamMember = (memberId) => {
    const { deleteTeamMember, getTeamMembers, team } = this.props;

    // deleting from teamRole
    this.setState({ loading: true });
    deleteTeamMember(memberId, team.id)
      .then(() => {
        getTeamMembers(team.id);
        this.setState({ loading: false, deleteMember: false });
      })
      .catch(() => {
        this.setState({
          loading: false,
          error: true,
          changedMemberId: memberId,
          deleteMember: false
        });
      });
  }

  _canAccess = (role) => {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  render() {
    const {
      team, style, teamMembers, user,
    } = this.props;
    const {
      error, changedMemberId, loading, deleteMember,
    } = this.state;

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
        {this._canAccess("admin")
          && (
          <div>
            <Invites />
            <Divider hidden />
          </div>
          )}

        {this._canAccess("admin")
          && (
          <div>
            <InviteMembersForm />
            <Divider hidden />
          </div>
          )}

        <Header as="h3" attached="top">{"Team members"}</Header>
        <Segment attached>
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
                      {user.id !== member.id && memberRole !== "member"
                        && (this._canAccess("owner") || (this._canAccess("admin") && memberRole !== "owner"))
                        && (
                        <Popup
                          trigger={(
                            <Button
                              onClick={() => this._onChangeRole("member", member.id)}
                              compact
                            >
                              Make Member
                            </Button>
                          )}
                          header="Member"
                          content="It's a read-only user, that can't edit or create projects"
                        />
                        )}
                      {user.id !== member.id && memberRole !== "editor"
                        && (this._canAccess("owner") || (this._canAccess("admin") && memberRole !== "owner"))
                        && (
                        <Popup
                          trigger={(
                            <Button
                              onClick={() => this._onChangeRole("editor", member.id)}
                              compact
                            >
                              Make Editor
                            </Button>
                          )}
                          header="Editor"
                          content="The Editors can create, edit and remove charts. They can also create new connections, but can't remove any."
                        />
                        )}
                      {user.id !== member.id && memberRole !== "admin"
                        && (this._canAccess("owner") || (this._canAccess("admin") && memberRole !== "owner"))
                        && (
                        <Popup
                          trigger={(
                            <Button
                              onClick={() => this._onChangeRole("admin", member.id)}
                              compact
                            >
                              Make Admin
                            </Button>
                          )}
                          header="Admin"
                          content="Has an abilitity to add team users, create projects, edit connections"
                        />
                        )}
                      {user.id !== member.id
                        && (this._canAccess("owner") || (this._canAccess("admin") && memberRole !== "owner"))
                        && (
                        <Button
                          onClick={() => this._onDeleteConfirmation(member.id)}
                          floated="right"
                          compact
                          color="orange"
                        >
                          Remove from the team
                        </Button>
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
                          </List.Header>
                        )
                        : (
                          <List.Header>
                            {" "}
                            {member.name}
                            {" "}
                            {member.surname}
                            {" "}
                          </List.Header>
                        )}
                      <List.Description>{memberRole}</List.Description>
                    </List.Content>
                    {error && member.id === changedMemberId
                      && (
                      <Container textAlign="center">
                        <Message content="Something went wrong, please try again!" negative onDismiss={() => this.setState({ error: false, changedMemberId: "" })} />
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
            onClose={() => this.setState({ deleteMember: false })}
          >
            <Modal.Header>
              Are you sure you want to remove the user from the team?
            </Modal.Header>
            <Modal.Content>
              <p>{"This action will remove the user from the team and restrict them from accessing the dashboard again."}</p>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => this.setState({ deleteMember: false })}
              >
                Cancel
              </Button>
              <Button
                negative
                loading={loading}
                onClick={() => this._onDeleteTeamMember(deleteMember)}
              >
                Remove
              </Button>
            </Modal.Actions>
          </Modal>
        </TransitionablePortal>
      </div>
    );
  }
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
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    teamMembers: state.team.teamMembers,
    user: state.user.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getTeam: id => dispatch(getTeam(id)),
    getTeamMembers: teamId => dispatch(getTeamMembers(teamId)),
    updateTeamRole: (role, memberId, teamId) => dispatch(updateTeamRole(role, memberId, teamId)),
    deleteTeamMember: (memberId, teamId) => dispatch(deleteTeamMember(memberId, teamId)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(TeamMembers));
