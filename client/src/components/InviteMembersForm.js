import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Segment, Dropdown, Container, Message, Header, Divider, Form, Button, Icon
} from "semantic-ui-react";

import { email } from "../config/validations";

import { inviteMembers } from "../actions/team";

/*
  Contains the team members invitation functionality
*/
class InviteMembersForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      currentValues: [],
      members: [],
      incorrectMail: false,
      success: false,
      inviteError: false,
      sentInvites: [],
      undeliveredInvites: [],
    };
  }

  inviteMembers = () => {
    const {
      team, match, inviteMembers, user,
    } = this.props;
    const { members, sentInvites, undeliveredInvites } = this.state;
    const teamId = team.id
      ? team.id : match.params.teamId;
    this.setState({
      incorrectMail: false, inviteError: false, success: false
    });
    this.setState({ loading: true, sentInvites: [], undeliveredInvites: [] });
    members.forEach((email) => {
      inviteMembers(
        user.data.id,
        email.value,
        teamId
      ).then(() => {
        this.setState({
          loading: false,
          incorrectMail: false,
          success: true,
          members: [],
          sentInvites: [...sentInvites, email.value]
        });
      }).catch(() => {
        this.setState({
          inviteError: true,
          loading: false,
          undeliveredInvites: [...undeliveredInvites, email.value]
        });
      });
    });
  }

  handleEmail = (e, { value }) => this.setState({ currentValues: value })

  handleAddition = (e, { value }) => {
    const { members } = this.state;

    // check if email is correct
    if (email(value)) {
      this.setState({ incorrectMail: true });
    } else {
      this.setState({
        incorrectMail: false,
        members: [{ text: value, value }, ...members],
      });
    }
  }

  render() {
    const {
      style, match, skipTeamInvite,
    } = this.props;
    const {
      members, currentValues, incorrectMail, success, sentInvites,
      inviteError, undeliveredInvites, loading,
    } = this.state;

    return (
      <div style={style}>
        <Header attached="top" as="h3">Invite New Members</Header>
        <Segment attached>
          <Form onSubmit={this.inviteMembers}>
            <Form.Field style={{ paddingTop: 10 }}>
              <Dropdown
                options={members}
                placeholder="Enter emails"
                search
                selection
                fluid
                multiple
                allowAdditions
                value={currentValues}
                onAddItem={this.handleAddition}
                onChange={this.handleEmail}
              />
            </Form.Field>
            {incorrectMail
              && (
              <Container textAlign="center" style={{ margin: "1em" }}>
                <Message negative> Make sure the email is valid </Message>
              </Container>
              )}
            {success
              && (
              <Container style={{ margin: "1em" }}>
                <Message positive>
                  <Message.List>
                    {sentInvites.map((invite) => {
                      return (
                        <Message.Content key={invite}>
                          <Icon name="checkmark" circular />
                          {invite}
                        </Message.Content>
                      );
                    })}
                  </Message.List>
                </Message>
              </Container>
              )}
            {inviteError && (
              <Container style={{ margin: "1em" }}>
                <Message negative>
                  <Message.List>
                    {undeliveredInvites.map((invite) => {
                      return (
                        <Message.Content key={invite}>
                          <Icon name="delete" circular />
                          {invite}
                        </Message.Content>
                      );
                    })}
                  </Message.List>
                </Message>
              </Container>
            )}
            <Form.Field>
              {!match.params.teamId
                && (
                <Button
                  floated="left"
                  compact
                  size="large"
                  basic
                  onClick={() => skipTeamInvite()}
                >
                  Skip for now
                </Button>
                )}
              <Button
                loading={loading}
                disabled={!members[0]}
                compact
                size="large"
                type="submit"
                floated="right"
                primary
              >
                Send Invites
              </Button>
            </Form.Field>
            <Divider hidden />
            <Divider hidden />
          </Form>
        </Segment>
      </div>
    );
  }
}
//
// const styles = {
//   container: {
//     flex: 1,
//   },
//   addPadding: {
//     padding: 20,
//     paddingLeft: 30,
//   }
// };

InviteMembersForm.defaultProps = {
  skipTeamInvite: () => {},
  style: {},
};

InviteMembersForm.propTypes = {
  skipTeamInvite: PropTypes.func,
  inviteMembers: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  style: PropTypes.object,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    user: state.user,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    inviteMembers: (userId, email, teamId) => dispatch(inviteMembers(userId, email, teamId)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm));
