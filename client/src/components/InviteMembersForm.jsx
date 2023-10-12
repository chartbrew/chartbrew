import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Tooltip, Spacer, Checkbox, Input, Accordion, Radio, AccordionItem, RadioGroup, Chip,
} from "@nextui-org/react";
import _ from "lodash";
import { LuCheckCheck, LuClipboard, LuClipboardCheck, LuInfo, LuX } from "react-icons/lu";

import { generateInviteUrl as generateInviteUrlAction } from "../actions/team";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";

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
    navigator.clipboard.writeText(inviteUrl);
  };

  return (
    <div style={style}>
      <Container>
        <Row>
          <Text size="h4">Invite team members</Text>
        </Row>
        {!selectedProjects && (
          <>
            <Spacer y={1} />
            <Row>
              <Accordion
                variant="bordered"
              >
                <AccordionItem
                  title="Select project access"
                  subtitle={projectAccess.length > 0 ? `${projectAccess.length} project${projectAccess.length > 1 ? "s" : ""} selected` : "No projects selected yet"}
                >
                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-12 mb-4 flex flex-row">
                      <Button
                        size="sm"
                        variant="ghost"
                        startContent={<LuCheckCheck />}
                        onClick={_onSelectAllProjects}
                      >
                        Select all
                      </Button>
                      <Spacer x={1} />
                      <Button
                        size="sm"
                        variant="ghost"
                        startContent={<LuX />}
                        onClick={_onDeselectAllProjects}
                      >
                        Deselect all
                      </Button>
                    </div>
                    {projects && projects.map((project) => (
                      <div className="col-span-12 sm:col-span-4" key={project.id}>
                        <Checkbox
                          isSelected={
                            _.indexOf(projectAccess, project.id) > -1
                          }
                          onChange={() => _onChangeProjectAccess(project.id)}
                          size="sm"
                        >
                          {project.name}
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                </AccordionItem>
              </Accordion>
            </Row>
          </>
        )}
        <Spacer y={4} />
        <Row align="center">
          <Text b>
            {"Data export permissions "}
          </Text>
          <Spacer x={0.2} />
          <Tooltip
            content="The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data."
          >
            <div><LuInfo /></div>
          </Tooltip>
        </Row>
        <Spacer y={1} />
        <Row>
          <Checkbox
            isSelected={exportAllowed}
            onValueChange={(isSelected) => setExportAllowed(isSelected)}
            size="sm"
          >
            Allow data export
          </Checkbox>
        </Row>

        <Spacer y={4} />
        <Row align="center">
          <Text b>
            {"Team role"}
          </Text>
          <Spacer x={1} />
          <Tooltip
            content="The team role is applied over all the projects selected above"
          >
            <div><LuInfo /></div>
          </Tooltip>
        </Row>
        <Spacer y={1} />
        <Row>
          <RadioGroup defaultValue="member" size="sm" value={role} onValueChange={(option) => setRole(option)}>
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
          </RadioGroup>
        </Row>

        <Spacer y={4} />
        <Row>
          <Button
            isLoading={loading}
            onClick={onGenerateUrl}
            color="primary"
            size="sm"
          >
            {loading ? "Generating..." : "Generate invite link"}
          </Button>
        </Row>
        <Spacer y={4} />

        {inviteUrl && (
          <>
            <Row>
              <Input
                label="Share this link with your team"
                id="url-text"
                value={inviteUrl}
                fullWidth
                readOnly
                variant="bordered"
              />
            </Row>
            <Spacer y={2} />
            <Row wrap="wrap" align="center">
              <Button
                endContent={urlCopied ? <LuClipboardCheck /> : <LuClipboard />}
                color={urlCopied ? "success" : "primary"}
                onClick={_onCopyUrl}
                variant={urlCopied ? "flat" : "solid"}
                size="sm"
              >
                {urlCopied ? "Copied" : "Copy to clipboard"}
              </Button>
              <Spacer x={4} />
              <Chip color="warning" variant={"flat"} size="sm">
                {`${role} role`}
              </Chip>
              <Spacer x={1} />
              <Chip color="primary" variant={"flat"} size="sm">
                {`Access to ${projectAccess.length} project${projectAccess.length !== 1 ? "s" : ""}`}
              </Chip>
              <Spacer x={1} />
              <Chip color="success" variant={"flat"} size="sm">
                {exportAllowed ? "Data export allowed" : "Data export not allowed"}
              </Chip>
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

export default connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm);
