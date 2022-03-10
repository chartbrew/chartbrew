import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Segment, Header, Divider, Button, Icon, Grid, Checkbox, Popup, Input, Form,
} from "semantic-ui-react";
import _ from "lodash";

import { generateInviteUrl as generateInviteUrlAction } from "../actions/team";

/*
  Contains the team members invitation functionality
*/
function InviteMembersForm(props) {
  const [loading, setLoading] = useState(false);
  const [projectAccess, setProjectAccess] = useState([]);
  const [exportAllowed, setExportAllowed] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);

  const {
    style, match, projects, team, generateInviteUrl,
  } = props;

  const onGenerateUrl = () => {
    const teamId = team.id
      ? team.id : match.params.teamId;

    setLoading(true);

    generateInviteUrl(
      teamId,
      projectAccess,
      exportAllowed,
    ).then((url) => {
      setInviteUrl(url);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
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

  const _onSelectAllProjects = () => {
    const newProjects = projects.map((project) => project.id);

    setProjectAccess(newProjects);
  };

  const _onDeselectAllProjects = () => {
    setProjectAccess([]);
  };

  const _onCopyUrl = () => {
    setUrlCopied(true);
    navigator.clipboard.writeText(inviteUrl); // eslint-disable-line
  };

  return (
    <div style={style}>
      <Segment>
        <Header as="h3">Invite new members</Header>

        <Header as="h4">
          {"Project access "}
          <Popup
            trigger={<Icon style={{ fontSize: 16, verticalAlign: "baseline" }} name="question circle" />}
            content="The newly invited users will only be able to access the projects you select below. The project access can be changed later as well."
          />
        </Header>

        <div style={{ marginBottom: 15 }}>
          <Button
            content="Select all"
            size="small"
            basic
            onClick={_onSelectAllProjects}
          />
          <Button
            content="Deselect all"
            size="small"
            basic
            onClick={_onDeselectAllProjects}
          />
        </div>
        <Grid columns={3} stackable>
          {projects && projects.map((project) => (
            <Grid.Column key={project.id}>
              <Checkbox
                label={project.name}
                checked={
                  _.indexOf(projectAccess, project.id) > -1
                }
                onClick={() => _onChangeProjectAccess(project.id)}
              />
            </Grid.Column>
          ))}
        </Grid>

        <Header as="h4">
          {"Data export permissions "}
          <Popup
            trigger={<Icon style={{ fontSize: 16, verticalAlign: "baseline" }} name="question circle" />}
            content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
          />
        </Header>

        <Checkbox
          label="Allow data export"
          checked={exportAllowed}
          onClick={() => setExportAllowed(!exportAllowed)}
        />

        <Divider hidden />
        <Button
          loading={loading}
          compact
          size="large"
          onClick={onGenerateUrl}
          primary
        >
          Generate invite URL
        </Button>
        <Divider hidden />

        {inviteUrl && (
          <Form>
            <Form.Field>
              <label>Share this link with your team</label>
              <Input
                id="url-text"
                value={inviteUrl}
              />
            </Form.Field>
            <Form.Field>
              <Button
                basic
                icon={urlCopied ? "checkmark" : "clipboard"}
                content={urlCopied ? "Copied" : "Copy to clipboard"}
                color={urlCopied ? "green" : null}
                onClick={_onCopyUrl}
                size="small"
              />
            </Form.Field>
          </Form>
        )}

      </Segment>
    </div>
  );
}

InviteMembersForm.defaultProps = {
  style: {},
};

InviteMembersForm.propTypes = {
  generateInviteUrl: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
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
    generateInviteUrl: (teamId, projects, canExport) => (
      dispatch(generateInviteUrlAction(teamId, projects, canExport))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm));
