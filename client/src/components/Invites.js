import React, { useState, useEffect } from "react";
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
function Invites(props) {
  const [showpendings, setShowpendings] = useState(false);
  const [error, setError] = useState(false);
  const [successResend, setSuccessResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentInviteId, setSentInviteId] = useState("");

  const {
    match, user, resendTeamInvite, declineTeamInvite, showHeader, addTeamMember,
    getTeamInvites, getPendingInvites
  } = props;

  useEffect(() => {
    // get pending Invites for the team
    if (match.params.teamId) {
      getTeamInvites(match.params.teamId)
        .then((invites) => {
          if (invites && invites[0].length > 0) {
            showHeader();
            setShowpendings(true);
          }
        });
    } else {
      // get pending invites for the specific user
      getPendingInvites(user.data.id);
    }
  }, []);

  const _addTeamMember = (userId, token) => {
    addTeamMember(userId, token)
      .then(() => {
        setLoading(false);
        setError(false);
      }).catch(() => {
        setLoading(false);
        setError(true);
      });
  };

  const _removeTeamInvite = (teamId, token) => {
    declineTeamInvite(teamId, token)
      .then(() => {
        if (user.pendingInvites && user.pendingInvites[0]) {
          showHeader();
          setShowpendings(true);
        }
        setLoading(false);
        setError(false);
      }).catch(() => {
        setLoading(false);
        setError(true);
      });
  };

  const _resendTeamInvite = (invite) => {
    resendTeamInvite(invite)
      .then((invite) => {
        setLoading(false);
        setError(false);
        setSuccessResend(true);
        setSentInviteId(invite.id);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  const renderManageTeamInvites = (invite) => {
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
                setLoading(true);
                _removeTeamInvite(invite.team_id, invite.token);
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
                setLoading(true);
                _resendTeamInvite(invite);
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
              onDismiss={() => {
                setSuccessResend(false);
                setSentInviteId("");
              }}
            />
          </Container>
        )}
      </Card>
    );
  };

  const renderUserPendingInvite = (invite) => {
    return (
      <Message key={invite.id} styles={{ padding: "1em" }}>
        <Icon name="attention" color="violet" />
        {"You've been invited to "}
        <strong style={{ color: primary }}>{invite.Team.name}</strong>
        <Button
          size="small"
          loading={loading}
          onClick={() => {
            setLoading(true);
            _removeTeamInvite(invite.team_id, invite.token);
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
            setLoading(true);
            _addTeamMember(user.data.id, invite.token);
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
  };

  return (
    <div style={styles.container}>
      {match.params.teamId
        ? (
          <Segment>
            <Header as="h3" style={{ paddingBottom: 10 }}> Pending team invites </Header>
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
                    return renderManageTeamInvites(invite);
                  })}
              </Card.Group>
            </Container>
          </Segment>
        )
        : (
          <Container text textAlign="left">
            {user.pendingInvites && user.pendingInvites[0]
          && user.pendingInvites[0].map((invite, index) => {
            return renderUserPendingInvite(invite, index);
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
