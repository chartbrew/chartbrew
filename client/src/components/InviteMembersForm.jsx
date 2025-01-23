import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Button, Tooltip, Spacer, Checkbox, Input, Accordion, Radio, AccordionItem, RadioGroup, Chip,
} from "@heroui/react";
import _ from "lodash";
import { LuCheck, LuCheckCheck, LuCopy, LuInfo, LuX } from "react-icons/lu";
import { useParams } from "react-router";

import { generateInviteUrl } from "../slices/team";
import Row from "./Row";
import Text from "./Text";
import { selectTeam } from "../slices/team";
import { selectProjects } from "../slices/project";

/*
  Contains the team members invitation functionality
*/
function InviteMembersForm(props) {
  const [loading, setLoading] = useState(false);
  const [projectAccess, setProjectAccess] = useState([]);
  const [exportAllowed, setExportAllowed] = useState(false);
  const [role, setRole] = useState("teamAdmin");
  const [inviteUrl, setInviteUrl] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);

  const {
    style, selectedProjects,
  } = props;

  const team = useSelector(selectTeam);
  const projects = useSelector(selectProjects);
  const params = useParams();
  const dispatch = useDispatch();

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

  const _onGenerateUrl = () => {
    const teamId = team.id
      ? team.id : params.teamId;

    setLoading(true);

    dispatch(generateInviteUrl({
      team_id: teamId,
      projects: projectAccess,
      canExport: exportAllowed,
      role,
    }))
      .then((data) => {
        setInviteUrl(data.payload);
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
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  };

  return (
    <div style={style}>
      <Row>
        <Text size="h4">Invite team members</Text>
      </Row>
      {!selectedProjects && (
        <>
          <Spacer y={4} />
          <Row align="center">
            <Text b>
              {"Select a role"}
            </Text>
          </Row>
          <Spacer y={2} />
          <Row>
            <RadioGroup defaultValue="teamAdmin" value={role} onValueChange={(option) => setRole(option)}>
              <Radio
                value="teamAdmin"
                description={"Access to all projects, connections, datasets, but can't delete the team or interact with the team's billing"}
              >
                Team Admin
              </Radio>
              <Radio
                value="projectAdmin"
                description={"Can manage all charts and reports in the selected dashboards. Can also edit tagged datasets and queries."}
              >
                Client Admin
              </Radio>
              <Radio
                value="projectEditor"
                description={"Can view and edit all charts and reports in the selected dashboard. Can also edit tagged datasets but cannot edit data queries."}
              >
                Client Editor
              </Radio>
              <Radio
                value="projectViewer"
                description={"Can view all charts and reports in the selected dashboard"}
              >
                Client Viewer
              </Radio>
            </RadioGroup>
          </Row>
          <Spacer y={4} />

          {role !== "teamAdmin" && (
            <Row>
              <Accordion
                variant="bordered"
              >
                <AccordionItem
                  title="Select dashboard access"
                  subtitle={projectAccess.length > 0 ? `${projectAccess.length} dashboard${projectAccess.length > 1 ? "s" : ""} selected` : "No dashboards selected yet"}
                >
                  <div className="grid grid-cols-12 gap-1 pb-4">
                    <div className="col-span-12 pb-4 flex flex-row">
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
                    {projects && projects.filter((p) => !p.ghost).map((project) => (
                      <div className="col-span-12 sm:col-span-4" key={project.id}>
                        <Checkbox
                          isSelected={
                            _.indexOf(projectAccess, project.id) > -1
                          }
                          onChange={() => _onChangeProjectAccess(project.id)}
                        >
                          {project.name}
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                </AccordionItem>
              </Accordion>
            </Row>
          )}
        </>
      )}

      {role !== "teamAdmin" && (
        <>
          <Spacer y={4} />
          <Row align="center">
            <Text b>
              {"Data export permissions "}
            </Text>
            <Spacer x={1} />
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
            >
              Allow data export
            </Checkbox>
          </Row>
        </>
      )}

      <Spacer y={4} />
      <Row>
        <Button
          isLoading={loading}
          onClick={_onGenerateUrl}
          color="primary"
          size="sm"
        >
          {loading ? "Generating..." : "Generate invite link"}
        </Button>
      </Row>

      {inviteUrl && (
        <>
          <Spacer y={4} />
          <Row>
            <Input
              label="Share this link with your team"
              id="url-text"
              value={inviteUrl}
              readOnly
              variant="bordered"
              endContent={(
                <Button
                  color={urlCopied ? "success" : "default"}
                  onClick={_onCopyUrl}
                  size="sm"
                  isIconOnly
                  variant="light"
                >
                  {urlCopied ? <LuCheck /> : <LuCopy />}
                </Button>
              )}
              className="max-w-[400px]"
            />
          </Row>
          <Spacer y={2} />
          <Row wrap="wrap" align="center">
            <Chip color="warning" variant={"flat"} size="sm">
              {`${role} role`}
            </Chip>
            {role !== "teamAdmin" && (
              <>
                <Spacer x={1} />
                <Chip color="primary" variant={"flat"} size="sm">
                  {`Access to ${projectAccess.length} dashboard${projectAccess.length !== 1 ? "s" : ""}`}
                </Chip>
                <Spacer x={1} />
                <Chip color="success" variant={"flat"} size="sm">
                  {exportAllowed ? "Data export allowed" : "Data export not allowed"}
                </Chip>
              </>
            )}
          </Row>
        </>
      )}
    </div>
  );
}

InviteMembersForm.defaultProps = {
  style: {},
  selectedProjects: null,
};

InviteMembersForm.propTypes = {
  match: PropTypes.object.isRequired,
  selectedProjects: PropTypes.array,
  style: PropTypes.object,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(InviteMembersForm);
