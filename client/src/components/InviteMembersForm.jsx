import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Tooltip, Checkbox, Input, Accordion, Radio, RadioGroup, Chip, Label,
} from "@heroui/react";
import _ from "lodash";
import { LuCheck, LuCheckCheck, LuCopy, LuInfo, LuX } from "react-icons/lu";

import { ButtonSpinner } from "./ButtonSpinner";
import { generateInviteUrl } from "../slices/team";
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

  const { selectedProjects = null } = props;

  const team = useSelector(selectTeam);
  const projects = useSelector(selectProjects);
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
    setLoading(true);

    dispatch(generateInviteUrl({
      team_id: team.id,
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
    <div>
      <div className="text-lg font-semibold font-tw">Invite team members</div>
      <div className="text-sm text-gray-500">Generate a link that can be used to invite team members to your team.</div>
      {!selectedProjects && (
        <>
          <div className="h-4" />
          <div className="font-bold">{"Select a role"}</div>
          <div className="h-2" />
          <div>
            <RadioGroup size="sm" defaultValue="teamAdmin" value={role} onValueChange={(option) => setRole(option)}>
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
                description={"Can view and edit all charts and reports in the selected dashboard. Cannot view or edit any dataset queries."}
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
          </div>
          <div className="h-4" />

          {role !== "teamAdmin" && (
            <div>
              <Accordion variant="surface">
                <Accordion.Item
                  id="invite-dashboard-access"
                  textValue="Select dashboard access"
                >
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <div className="flex flex-1 flex-col items-start gap-0.5 text-start">
                        <span className="font-medium">Select dashboard access</span>
                        <span className="text-sm text-default-500">
                          {projectAccess.length > 0
                            ? `${projectAccess.length} dashboard${projectAccess.length > 1 ? "s" : ""} selected`
                            : "No dashboards selected yet"}
                        </span>
                      </div>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                  <div className="grid grid-cols-12 gap-1 pb-4">
                    <div className="col-span-12 pb-4 flex flex-row">
                      <Button
                        size="sm"
                        variant="ghost"
                        startContent={<LuCheckCheck />}
                        onPress={_onSelectAllProjects}
                      >
                        Select all
                      </Button>
                      <div className="w-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        startContent={<LuX />}
                        onPress={_onDeselectAllProjects}
                      >
                        Deselect all
                      </Button>
                    </div>
                    {projects && projects.filter((p) => !p.ghost).map((project) => (
                      <div className="col-span-12 sm:col-span-4" key={project.id}>
                        <Checkbox
                          id={`invite-project-${project.id}`}
                          isSelected={_.indexOf(projectAccess, project.id) > -1}
                          onChange={(selected) => {
                            const wasSelected = _.indexOf(projectAccess, project.id) > -1;
                            if (selected !== wasSelected) _onChangeProjectAccess(project.id);
                          }}
                        >
                          <Checkbox.Control className="size-4 shrink-0">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <Label htmlFor={`invite-project-${project.id}`} className="text-sm">{project.name}</Label>
                          </Checkbox.Content>
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>
          )}
        </>
      )}

      {role !== "teamAdmin" && (
        <>
          <div className="h-4" />
          <div className="flex flex-row items-center gap-1">
            <div className="font-bold">
              {"Data export permissions "}
            </div>
            <div className="w-1" />
            <Tooltip>
              <Tooltip.Trigger>
                <div><LuInfo /></div>
              </Tooltip.Trigger>
              <Tooltip.Content>
                The data export can contain sensitive information from your queries that is not necessarily visible on your charts. Only allow the data export when you intend for the users to view this data.
              </Tooltip.Content>
            </Tooltip>
          </div>
          <div className="h-1" />
          <div>
            <Checkbox
              id="invite-export-allowed"
              isSelected={exportAllowed}
              onChange={(isSelected) => setExportAllowed(isSelected)}
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="invite-export-allowed" className="text-sm">Allow data export</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        </>
      )}

      <div className="h-4" />
      <div>
        <Button
          isPending={loading}
          onPress={_onGenerateUrl}
          color="primary"
          size="sm"
          startContent={loading ? <ButtonSpinner /> : undefined}
        >
          {loading ? "Generating..." : "Generate invite link"}
        </Button>
      </div>

      {inviteUrl && (
        <>
          <div className="h-4" />
          <div>
            <Input
              label="Share this link with your team"
              id="url-text"
              value={inviteUrl}
              readOnly
              variant="secondary"
              endContent={(
                <Button
                  onPress={_onCopyUrl}
                  size="sm"
                  isIconOnly
                  variant={urlCopied ? "primary" : "tertiary"}
                >
                  {urlCopied ? <LuCheck /> : <LuCopy />}
                </Button>
              )}
              className="max-w-md"
            />
          </div>
          <div className="h-2" />
          <div className="flex flex-wrap items-center gap-1">
            <Chip color="warning" variant="soft" size="sm">
              {`${role} role`}
            </Chip>
            {role !== "teamAdmin" && (
              <>
                <div className="w-1" />
                <Chip variant="primary" size="sm">
                  {`Access to ${projectAccess.length} dashboard${projectAccess.length !== 1 ? "s" : ""}`}
                </Chip>
                <div className="w-1" />
                <Chip color="success" variant="soft" size="sm">
                  {exportAllowed ? "Data export allowed" : "Data export not allowed"}
                </Chip>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

InviteMembersForm.propTypes = {
  match: PropTypes.object.isRequired,
  selectedProjects: PropTypes.array,
};

export default InviteMembersForm;
