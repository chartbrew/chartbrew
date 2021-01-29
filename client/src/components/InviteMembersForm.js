import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Segment, Dropdown, Message, Header, Divider, Form, Button, Icon, Grid, Checkbox
} from "semantic-ui-react";
import _ from "lodash";

import { email } from "../config/validations";

import { inviteMembers as inviteMembersAction } from "../actions/team";

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
  const [projectAccess, setProjectAccess] = useState([]);

  const {
    style, match, projects, team, inviteMembers, user
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
        teamId,
        projectAccess,
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

  const _onChangeProjectAccess = (projectId) => {
    const newAccess = [].concat(projectAccess) || [];
    const isFound = _.indexOf(projectAccess, projectId);

    if (isFound === -1) {
      newAccess.push(projectId);
    } else {
      newAccess.splice(isFound, 1);
    }

    setProjectAccess(newAccess);
  };

  return (
    <div style={style}>
      <Segment>
        <Header as="h3">Invite new members</Header>
        <Form>
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
            <Form.Field textAlign="center">
              <Message negative> Make sure the email is valid </Message>
            </Form.Field>
            )}
          {success
            && (
            <Form.Field>
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
            </Form.Field>
            )}
          {inviteError && (
            <Form.Field>
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
            </Form.Field>
          )}
        </Form>

        <Header as="h4">Select which projects the user will be part of:</Header>

        <Grid columns={2} stackable>
          {projects && projects.map((project) => (
            <Grid.Column key={project.id}>
              <Checkbox
                toggle
                label={project.name}
                checked={
                  _.indexOf(projectAccess, project.id) > -1
                }
                onClick={() => _onChangeProjectAccess(project.id)}
              />
            </Grid.Column>
          ))}
        </Grid>

        <Button
          loading={loading}
          disabled={!members[0]}
          compact
          size="large"
          onClick={onInviteMembers}
          floated="right"
          primary
        >
          Send Invites
        </Button>
        <Divider hidden />
        <Divider hidden />
      </Segment>
    </div>
  );
}

InviteMembersForm.defaultProps = {
  style: {},
};

InviteMembersForm.propTypes = {
  inviteMembers: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  projects: PropTypes.array.isRequired,
  style: PropTypes.object,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    user: state.user,
    projects: state.project.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    inviteMembers: (userId, email, teamId, projects) => (
      dispatch(inviteMembersAction(userId, email, teamId, projects))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm));
