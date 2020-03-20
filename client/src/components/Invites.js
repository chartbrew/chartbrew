import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Message, Container, Button, Icon, Card, Segment, Header, Divider,
} from "semantic-ui-react";

import { getPendingInvites } from "../actions/user";
import {
  addTeamMember, declineTeamInvite, getTeamInvites, resendTeamInvite
} from "../actions/team";
import { primary } from "../config/colors";

/*
  Contains the project creation functionality
*/
class Invites extends Component {
  constructor(props) {
    super(props);

    this.state = {
      error: false,
      successResend: false,
      showpendings: false,
    };
  }

  componentDidMount() {
    const {
      match, getTeamInvites, showHeader, getPendingInvites, user
    } = this.props;
    // get pending Invites for the team
    if (match.params.teamId) {
      getTeamInvites(match.params.teamId)
        .then((invites) => {
          if (invites && invites[0].length > 0) {
            showHeader();
            this.setState({ showpendings: true });
          }
        });
    } else {
      // get pending invites for the specific user
      getPendingInvites(user.data.id);
    }
  }

  _addTeamMember(userId, token) {
    const { addTeamMember } = this.props;
    addTeamMember(userId, token)
      .then(() => {
        this.setState({ loading: false, error: false });
      }).catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _removeTeamInvite(teamId, token) {
    const { declineTeamInvite, user, showHeader } = this.props;
    declineTeamInvite(teamId, token)
      .then(() => {
        if (user.pendingInvites && user.pendingInvites[0]) {
          showHeader();
          this.setState({ showpendings: true });
        }
        this.setState({ loading: false, error: false });
      }).catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  _resendTeamInvite(invite) {
    const { resendTeamInvite } = this.props;
    resendTeamInvite(invite)
      .then((invite) => {
        this.setState({
          loading: false, error: false, successResend: true, sentInviteId: invite.id
        });
      }).catch(() => {
        this.setState({ error: true, loading: false });
      });
  }

  renderManageTeamInvites(invite) {
    const { sentInviteId, loading, successResend } = this.state;
    return (
      <Card fluid color={invite.id === sentInviteId ? "" : "blue"} key={invite.id}>
        <Card.Content>
          <Card.Description>
            <b> Team Invite to:  </b>
            {" "}
            {invite.email}
            <Button
              size="medium"
              loading={loading}
              onClick={() => {
                this.setState({ loading: true });
                this._removeTeamInvite(invite.team_id, invite.token);
              }}
              floated="right"
              compact
              color="orange">
              {" Remove"}
            </Button>
            <Button
              size="medium"
              loading={loading}
              onClick={() => {
                this.setState({ loading: true });
                this._resendTeamInvite(invite);
              }}
              floated="right"
              compact
              color="yellow">
              {" Resend"}
            </Button>
          </Card.Description>
        </Card.Content>
        {successResend && invite.id === sentInviteId && (
          <Container textAlign="center" fluid>
            <Message
              content="Team invite was resent!"
              positive
              onDismiss={() => this.setState({ successResend: false, sentInviteId: "" })}
            />
          </Container>
        )}
      </Card>
    );
  }

  renderUserPendingInvite(invite) {
    const { user } = this.props;
    const { loading } = this.state;

    return (
      <Message key={invite.id} styles={{ padding: "1em" }}>
        <Icon name="attention" color="violet" />
        {"You've been invited to "}
        <strong style={{ color: primary }}>{invite.Team.name}</strong>
        <Button
          size="small"
          loading={loading}
          onClick={() => {
            this.setState({ loading: true });
            this._removeTeamInvite(invite.team_id, invite.token);
          }}
          floated="right"
          compact
          icon
          labelPosition="right"
          color="orange">
          Decline
          <Icon name="delete" />
        </Button>
        <Button
          size="small"
          loading={loading}
          onClick={() => {
            this.setState({ loading: true });
            this._addTeamMember(user.data.id, invite.token);
          }}
          floated="right"
          compact
          icon
          labelPosition="right"
          color="green">
          Accept
          <Icon name="check" />
        </Button>
      </Message>
    );
  }

  render() {
    const { match, user } = this.props;
    const { showpendings, error } = this.state;
    return (
      <div style={styles.container}>
        {match.params.teamId
          ? (
            <Segment attached="top">
              <Header as="h3" style={{ borderBottom: "1px solid #d4d4d5", paddingBottom: 10, top: 0 }}> Pending team invites </Header>
              <Container>
                { !showpendings
                && (
                <Container textAlign="center" text>
                  <i> There are no pending invites </i>
                  <Divider hidden />
                </Container>
                )}
                <Card.Group centered>
                  {user.pendingInvites && user.pendingInvites[0]
                    && user.pendingInvites[0].map((invite) => {
                      return this.renderManageTeamInvites(invite);
                    })}
                </Card.Group>
              </Container>
            </Segment>
          )
          : (
            <Container text textAlign="left">
              {user.pendingInvites && user.pendingInvites[0]
            && user.pendingInvites[0].map((invite, index) => {
              return this.renderUserPendingInvite(invite, index);
            })}
            </Container>
          )}
        {error
          && (
          <Message negative>
            Oups, could not perform the request, please try again
          </Message>
          )}
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1
  }
};
Invites.defaultProps = {
  showHeader: () => {},
};

Invites.propTypes = {
  getPendingInvites: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  addTeamMember: PropTypes.func.isRequired,
  declineTeamInvite: PropTypes.func.isRequired,
  getTeamInvites: PropTypes.func.isRequired,
  resendTeamInvite: PropTypes.func.isRequired,
  showHeader: PropTypes.func,
  match: PropTypes.object.isRequired,
};

const mapStateToProps = state => {
  return {
    user: state.user
  };
};

const mapDispatchToProps = dispatch => {
  return {
    getPendingInvites: userId => dispatch(getPendingInvites(userId)),
    addTeamMember: (userId, token) => dispatch(addTeamMember(userId, token)),
    declineTeamInvite: (teamId, token) => dispatch(declineTeamInvite(teamId, token)),
    getTeamInvites: teamId => dispatch(getTeamInvites(teamId)),
    resendTeamInvite: invite => dispatch(resendTeamInvite(invite)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Invites));
