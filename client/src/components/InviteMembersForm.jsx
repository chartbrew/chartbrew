import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Container, Row, Text, Tooltip, Spacer, Grid, Checkbox, Input, Collapse, Radio, Badge,
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
  const [role, setRole] = useState("member");
  const [inviteUrl, setInviteUrl] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);

  const {
    style, match, projects, team, generateInviteUrl, selectedProjects,
  } = props;

  useEffect(() => {
    if (selectedProjects?.length > 0) {
      setProjectAccess(selectedProjects);
    }
  }, [selectedProjects]);

  useEffect(() => {
    if (inviteUrl) {
      setInviteUrl("");
    }
  }, [projectAccess, exportAllowed, role]);

  const onGenerateUrl = () => {
    const teamId = team.id
      ? team.id : match.params.teamId;

    setLoading(true);

    generateInviteUrl(
      teamId,
      projectAccess,
      exportAllowed,
      role,
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
          <Text h3>Invite team members</Text>
        </Row>
        {!selectedProjects && (
          <>
            <Spacer y={0.5} />
            <Row>
              <Collapse
                bordered
                title="Select project access"
                subtitle={projectAccess.length > 0 ? `${projectAccess.length} project${projectAccess.length > 1 ? "s" : ""} selected` : "No projects selected yet"}
                css={{
                  "& .nextui-collapse-title": {
                    fs: 20,
                  },
                }}
              >
                <Grid.Container gap={0.5}>
                  <Grid xs={12} css={{ mb: 10 }}>
                    <Button
                      size="sm"
                      bordered
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
                      bordered
                      auto
                      icon={<CloseSquare />}
                      onClick={_onDeselectAllProjects}
                      color="secondary"
                    >
                      Deselect all
                    </Button>
                  </Grid>
                  {projects && projects.map((project) => (
                    <Grid xs={12} sm={4} key={project.id}>
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
              </Collapse>
            </Row>
          </>
        )}
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
            onChange={(isSelected) => setExportAllowed(isSelected)}
            size="sm"
          />
        </Row>
        <Spacer y={1} />
        <Row align="center">
          <Text size={20} b>
            {"Team role"}
          </Text>
          <Spacer x={0.2} />
          <Tooltip
            content="The team role is applied over all the projects selected above"
            css={{ maxWidth: 400 }}
          >
            <InfoCircle />
          </Tooltip>
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Radio.Group defaultValue="member" size="sm" value={role} onChange={(option) => setRole(option)}>
            <Radio
              value="member"
              description={"Can view charts in assigned projects"}
            >
              Member
            </Radio>
            <Radio
              value="editor"
              description={"Can create, edit, and remove charts and connections in assigned projects"}
            >
              Editor
            </Radio>
            <Radio
              value="admin"
              description={"Full access, but can't delete the team or interact with the team's billing."}
            >
              Admin
            </Radio>
          </Radio.Group>
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
            <Row wrap="wrap" align="center">
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
              <Spacer x={1} />
              <Badge color="warning" disableOutline variant={"flat"}>
                {`${role} role`}
              </Badge>
              <Spacer x={0.3} />
              <Badge color="primary" disableOutline variant={"flat"}>
                {`Access to ${projectAccess.length} project${projectAccess.length !== 1 ? "s" : ""}`}
              </Badge>
              <Spacer x={0.3} />
              <Badge color="success" disableOutline variant={"flat"}>
                {exportAllowed ? "Data export allowed" : "Data export not allowed"}
              </Badge>
            </Row>
          </>
        )}

      </Container>
    </div>
  );
}

InviteMembersForm.defaultProps = {
  style: {},
  selectedProjects: null,
};

InviteMembersForm.propTypes = {
  generateInviteUrl: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  projects: PropTypes.array.isRequired,
  selectedProjects: PropTypes.array,
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
    generateInviteUrl: (teamId, projects, canExport, role) => (
      dispatch(generateInviteUrlAction(teamId, projects, canExport, role))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm));
