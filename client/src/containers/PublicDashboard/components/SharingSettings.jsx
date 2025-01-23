import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Divider, Input, Spacer, Switch, Textarea, Tooltip, RadioGroup, Radio,
  Drawer, DrawerHeader, DrawerBody, DrawerFooter, DrawerContent,
} from "@heroui/react";
import { LuChevronsRight, LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuSettings } from "react-icons/lu";

import { SITE_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useDispatch, useSelector } from "react-redux";
import { updateTeam } from "../../../slices/team";
import toast from "react-hot-toast";
import { getProject, selectProject, updateProject } from "../../../slices/project";
import { useNavigate } from "react-router";

const urlPathRegex = /^[a-zA-Z0-9\-._~!$&'()*+,;=:@]+$/;

function SharingSettings(props) {
  const {
    open = false, onClose, onReport = false,
  } = props;

  const project = useSelector(selectProject);

  const [newBrewName, setNewBrewName] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [embedTheme, setEmbedTheme] = useState("os");
  const [urlError, setUrlError] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (project && project.id) {
      setNewBrewName(project.brewName);
      setNewPassword(project.password);
    }
  }, [project]);

  const _onChangeBrewName = (value) => {
    setNewBrewName(value);
  };

  const _onCopyUrl = () => {
    setUrlCopied(true);
    navigator.clipboard.writeText(`${SITE_HOST}/b/${newBrewName}`);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    navigator.clipboard.writeText(`<iframe src="${SITE_HOST}/b/${newBrewName}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setEmbedCopied(false);
    }, 2000);
  };

  const _getEmbedString = () => {
    return `<iframe src="${SITE_HOST}/b/${newBrewName}${embedTheme !== "os" ? `?theme=${embedTheme}` : ""}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  const _onTogglePublic = (value) => {
    dispatch(updateProject({ project_id: project.id, data: { public: value } }))
      .then(() => {
        toast.success("The report is now public!");
      })
      .catch(() => { });
  };

  const _onTogglePassword = (value) => {
    dispatch(updateProject({ project_id: project.id, data: { passwordProtected: value } }))
      .then(() => {
        if (value) {
          toast.success("The report is now password protected!");
        } else {
          toast.success("The report is no longer password protected!");
        }
      })
      .catch(() => { });
  };

  const _onSavePassword = (value) => {
    dispatch(updateProject({ project_id: project.id, data: { password: value } }))
      .then((newProject) => {
        if (newProject?.error) {
          toast.error("Failed to update password");
          return;
        }

        toast.success("New password saved!");
      })
  };

  const _onToggleBranding = (value) => {
    dispatch(updateTeam({ team_id: project.team_id, data: { showBranding: value } }))
      .then((newTeam) => {
        if (newTeam?.error) {
          toast.error("Failed to update branding settings");
          return;
        }

        toast.success("The branding settings are saved!");

        dispatch(getProject({ project_id: project.id }));
      })
  };

  const _onSaveBrewName = (newBrewName) => {
    if (!newBrewName) return;

    if (!urlPathRegex.test(newBrewName)) {
      setUrlError("The route contains invalid characters. Try removing the '/'");
      return;
    }

    setUrlLoading(true);

    const processedName = encodeURI(newBrewName);
    dispatch(updateProject({ project_id: project.id, data: { brewName: processedName } }))
      .then((project) => {
        setUrlLoading(false);

        if (project?.error) {
          setUrlError("This dashboard URL is already taken. Please try another one.");
          return;
        }

        if (onReport) {
          window.location.href = `${SITE_HOST}/b/${project.payload.brewName}`;
        } else {
          toast.success("The dashboard URL is saved!");
        }
      })
  };

  return (
    <Drawer
      backdrop="blur"
      isOpen={open}
      onClose={onClose}
      size="xl"
      classNames={{
        base: "data-[placement=right]:sm:m-2 data-[placement=left]:sm:m-2 rounded-medium",
      }}
      style={{ marginTop: onReport ? "" : "54px" }}
      hideCloseButton={!onReport}
    >
      <DrawerContent>
        {onReport && (
          <DrawerHeader>
            <Text size="h3">Sharing settings</Text>
          </DrawerHeader>
        )}
        {!onReport && (
          <DrawerHeader
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-content1/50 backdrop-saturate-150 backdrop-blur-lg"
          >
            <Tooltip content="Close">
              <Button
                isIconOnly
                onPress={onClose}
                size="sm"
                variant="light"
              >
                <LuChevronsRight />
              </Button>
            </Tooltip>
            <div className="flex flex-row items-center gap-2">
              <Button
                onPress={_onCopyUrl}
                size="sm"
                variant="flat"
                endContent={<LuCopy size={18} />}
              >
                Copy URL
              </Button>
              <Button
                size="sm"
                variant="flat"
                endContent={<LuSettings size={18} />}
                onPress={() => navigate(`/b/${newBrewName}`)}
              >
                Edit visuals
              </Button>
            </div>
          </DrawerHeader>
        )}
        <DrawerBody>
          <div className="font-medium text-gray-500">Dashboard visibility</div>
          <div className="flex flex-row items-center justify-between flex-wrap">
            <div className="flex items-center">
              <Switch
                isSelected={project.public}
                onValueChange={_onTogglePublic}
                size="sm"
              >
                Public
              </Switch>
              <Spacer x={1} />
              <Tooltip
                content={(
                  <>
                    <p>{"A public report can be viewed by anyone with or without a Chartbrew account."}</p>
                    <p>{"A private report can only be seen by members of your team"}</p>
                  </>
                )}
              >
                <div><LuInfo size={16} /></div>
              </Tooltip>
            </div>
            <div className="flex items-center">
              <Switch
                isSelected={project.passwordProtected}
                onValueChange={_onTogglePassword}
                isDisabled={!project.public}
                size="sm"
              >
                Require password to view
              </Switch>
              <Spacer x={1} />
              <Tooltip
                content="Public reports will require the viewers outside of your team to enter a password before viewing"
              >
                <div><LuInfo size={16} /></div>
              </Tooltip>
            </div>
          </div>
          {project.passwordProtected && (
            <>
              <Row>
                <Input
                  label="Report password"
                  placeholder="Enter a password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  isDisabled={!project.public || !project.passwordProtected}
                  variant="bordered"
                  fullWidth
                />
              </Row>
              <Row>
                <Button
                  color="primary"
                  onClick={() => _onSavePassword(newPassword)}
                  isDisabled={
                    !project.public
                    || !project.passwordProtected
                    || !newPassword
                    || project.password === newPassword
                  }
                  size="sm"
                >
                  Save password
                </Button>
              </Row>
            </>
          )}

          <Divider />

          <div className="font-medium text-gray-500">Dashboard URL</div>
          <Input
            id="share-url-text"
            placeholder="Enter your custom dashboard URL"
            labelPlacement="outside"
            startContent={(
              <div className="text-sm text-gray-500">
                {`${SITE_HOST}/b/`}
              </div>
            )}
            value={newBrewName}
            onChange={(e) => _onChangeBrewName(e.target.value)}
            color={urlError ? "error" : "default"}
            description={urlError}
            variant="bordered"
            fullWidth
            endContent={(
              <div className="flex flex-row items-center gap-1">
                <Button
                  size="sm"
                  variant="light"
                  onClick={() => window.open(`${SITE_HOST}/b/${newBrewName}`, "_blank")}
                  isIconOnly
                >
                  <LuExternalLink size={18} />
                </Button>
                <Button
                  isIconOnly
                  color={urlCopied ? "success" : "default"}
                  onClick={_onCopyUrl}
                  size="sm"
                  variant="light"
                >
                  {urlCopied ? <LuCopyCheck size={18} /> : <LuCopy size={18} />}
                </Button>
              </div>
            )}
          />
          <Row>
            <Button
              color="primary"
              onPress={() => _onSaveBrewName(newBrewName)}
              isDisabled={!newBrewName || urlLoading}
              isLoading={urlLoading}
              size="sm"
            >
              {onReport ? "Save URL and reload" : "Save URL"}
            </Button>
          </Row>

          <Divider />

          <div>
            <div className="font-medium text-gray-500">Embed this dashboard</div>
            <Spacer y={1} />
            <RadioGroup
              orientation="horizontal"
              size="sm"
              value={embedTheme}
              onValueChange={setEmbedTheme}
            >
              <Radio value="os" checked={embedTheme === "os"}>
                System default theme
              </Radio>
              <Radio value="dark" checked={embedTheme === "dark"}>
                Dark
              </Radio>
              <Radio value="light" checked={embedTheme === "light"}>
                Light
              </Radio>
            </RadioGroup>
          </div>
          <Row>
            <Textarea
              label="Embedding code"
              id="iframe-text"
              value={_getEmbedString()}
              fullWidth
              variant="bordered"
              readOnly
            />
          </Row>
          {!project.public && (
            <>
              <Row align="center">
                <LuInfo className="text-secondary" />
                <Spacer x={1} />
                <Text size="sm" className={"italic"}>
                  {"The embedding only works when the report is public"}
                </Text>
              </Row>
            </>
          )}
          <Row>
            <Button
              startContent={embedCopied ? <LuCopyCheck /> : <LuCopy />}
              color={embedCopied ? "success" : "primary"}
              variant={embedCopied ? "flat" : "solid"}
              onClick={_onCopyEmbed}
              size="sm"
            >
              {embedCopied ? "Copied to clipboard" : "Copy to clipboard"}
            </Button>
          </Row>

          <Divider />

          <Row align="center">
            <Switch
              isSelected={project.Team && project.Team.showBranding}
              onValueChange={_onToggleBranding}
              size="sm"
            >
              Show Chartbrew branding
            </Switch>
          </Row>
        </DrawerBody>
        <DrawerFooter>
          <Button
            onPress={onClose}
            variant="flat"
          >
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

SharingSettings.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onReport: PropTypes.bool,
};

export default SharingSettings;
