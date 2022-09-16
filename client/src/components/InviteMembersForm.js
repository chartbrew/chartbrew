import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Container, Row, Text, Tooltip, Spacer, Grid, Checkbox, Input,
} from "@nextui-org/react";
import _ from "lodash";
import { CloseSquare, InfoCircle, TickSquare } from "react-iconly";
import { FaClipboard } from "react-icons/fa";

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
      <Container>
        <Row>
          <Text h3>Invite new members</Text>
        </Row>
        <Spacer y={1} />
        <Row align="center">
          <Text size={20} b>
            {"Project access "}
          </Text>
          <Spacer x={0.2} />
          <Tooltip
            content="The newly invited users will only be able to access the projects you select below. The project access can be changed later as well."
            css={{ maxWidth: 400 }}
          >
            <InfoCircle />
          </Tooltip>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Button
            size="sm"
            light
            icon={<TickSquare />}
            onClick={_onSelectAllProjects}
            auto
            color="primary"
          >
            Select all
          </Button>
          <Spacer x={0.2} />
          <Button
            size="sm"
            light
            auto
            icon={<CloseSquare />}
            onClick={_onDeselectAllProjects}
            color="secondary"
          >
            Deselect all
          </Button>
        </Row>
        <Spacer y={0.5} />
        <Grid.Container gap={0.5}>
          {projects && projects.map((project) => (
            <Grid xs={12} sm={6} key={project.id}>
              <Checkbox
                label={project.name}
                isSelected={
                  _.indexOf(projectAccess, project.id) > -1
                }
                onChange={() => _onChangeProjectAccess(project.id)}
                size="sm"
              />
            </Grid>
          ))}
        </Grid.Container>
        <Spacer y={1} />
        <Row align="center">
          <Text size={20} b>
            {"Data export permissions "}
          </Text>
          <Spacer x={0.2} />
          <Tooltip
            content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
            css={{ maxWidth: 400 }}
          >
            <InfoCircle />
          </Tooltip>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Checkbox
            label="Allow data export"
            isSelected={exportAllowed}
            onSelect={() => setExportAllowed(!exportAllowed)}
            size="sm"
          />
        </Row>

        <Spacer y={1} />
        <Row>
          <Button
            disabled={loading}
            onClick={onGenerateUrl}
            auto
          >
            {loading ? "Generating..." : "Generate invite link"}
          </Button>
        </Row>
        <Spacer y={0.5} />

        {inviteUrl && (
          <>
            <Row>
              <Input
                label="Share this link with your team"
                id="url-text"
                value={inviteUrl}
                fullWidth
                bordered
              />
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Button
                iconRight={urlCopied ? <TickSquare /> : <FaClipboard />}
                color={urlCopied ? "success" : "primary"}
                onClick={_onCopyUrl}
                bordered
                size="sm"
                auto
              >
                {urlCopied ? "Copied" : "Copy to clipboard"}
              </Button>
            </Row>
          </>
        )}

      </Container>
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
