import React, { useState } from "react";
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
function InviteMembersForm(props) {
  const [members, setMembers] = useState([]);
  const [currentValues, setCurrentValues] = useState([]);
  const [incorrectMail, setIncorrectMail] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sentInvites, setSentInvites] = useState([]);
  const [inviteError, setInviteError] = useState(false);
  const [undeliveredInvites, setUndeliveredInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const {
    style, match, skipTeamInvite, team, inviteMembers, user
  } = props;

  const onInviteMembers = () => {
    const teamId = team.id
      ? team.id : match.params.teamId;

    setIncorrectMail(false);
    setInviteError(false);
    setSuccess(false);
    setLoading(true);
    setSentInvites([]);
    setUndeliveredInvites([]);

    members.forEach((email) => {
      inviteMembers(
        user.data.id,
        email.value,
        teamId
      ).then(() => {
        setLoading(false);
        setIncorrectMail(false);
        setSuccess(true);
        setMembers([]);
        setSentInvites([...sentInvites, email.value]);
      }).catch(() => {
        setInviteError(true);
        setLoading(false);
        setUndeliveredInvites([...undeliveredInvites, email.value]);
      });
    });
  };

  const handleEmail = (e, { value }) => setCurrentValues(value);

  const handleAddition = (e, { value }) => {
    // check if email is correct
    if (email(value)) {
      setIncorrectMail(true);
    } else {
      setIncorrectMail(false);
      setMembers([{ text: value, value }, ...members]);
    }
  };

  return (
    <div style={style}>
      <Segment>
        <Header as="h3">Invite New Members</Header>
        <Form onSubmit={onInviteMembers}>
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
              onAddItem={handleAddition}
              onChange={handleEmail}
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
