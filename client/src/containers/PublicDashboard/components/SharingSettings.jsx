import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Divider, Input, Spacer, Switch, Textarea, Tooltip, RadioGroup, Radio,
  Drawer, DrawerHeader, DrawerBody, DrawerFooter, DrawerContent, Checkbox, Spinner,
} from "@heroui/react";
import { LuChevronsRight, LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuSettings, LuPlus, LuX } from "react-icons/lu";

import { SITE_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useDispatch, useSelector } from "react-redux";
import { updateTeam } from "../../../slices/team";
import toast from "react-hot-toast";
import { getProject, selectProject, updateProject, createSharePolicy, generateShareToken } from "../../../slices/project";
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
  const [shareToken, setShareToken] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [parameters, setParameters] = useState([]);
  const [allowParams, setAllowParams] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (project && project.id) {
      setNewBrewName(project.brewName);
      setNewPassword(project.password);
      
      // Initialize SharePolicy states
      if (project.SharePolicy) {
        setParameters(project.SharePolicy.params || []);
        setAllowParams(project.SharePolicy.allow_params || false);
        if (project.SharePolicy && !shareToken) {
          _onGenerateShareToken();
        }
      }
    }
  }, [project]);

  const _onChangeBrewName = (value) => {
    setNewBrewName(value);
  };

  const _onCopyUrl = () => {
    setUrlCopied(true);
    const url = project.SharePolicy ? _getEmbedUrl() : `${SITE_HOST}/b/${newBrewName}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    const embedCode = project.SharePolicy ? _getSignedEmbedString() : _getEmbedString();
    navigator.clipboard.writeText(embedCode);
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
    setPasswordLoading(true);
    dispatch(updateProject({ project_id: project.id, data: { passwordProtected: value } }))
      .then(() => {
        if (value) {
          toast.success("The report is now password protected!");
        } else {
          toast.success("The report is no longer password protected!");
        }

        setPasswordLoading(false);
      })
      .catch(() => {
        setPasswordLoading(false);
      });
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

  const _onCreateSharePolicy = async () => {
    setShareLoading(true);
    await dispatch(createSharePolicy({ project_id: project.id }));
    _onGenerateShareToken();
    setShareLoading(false);
  };

  const _onGenerateShareToken = async () => {
    setShareLoading(true);
    const data = await dispatch(generateShareToken({
      project_id: project.id,
      data: {
        exp: expirationDate,
      },
    }));
    setShareToken(data?.payload?.token);
    setShareLoading(false);
  };

  const _onSaveSharePolicy = async () => {
    setShareLoading(true);
    const data = await dispatch(generateShareToken({
      project_id: project.id,
      data: {
        share_policy: {
          params: parameters,
          allow_params: allowParams,
        },
        exp: expirationDate,
      },
    }));
    setShareToken(data?.payload?.token);
    setShareLoading(false);
  };

  const _hasUnsavedChanges = () => {
    // Filter out incomplete parameters (where key or value are empty)
    const filterCompleteParams = (params) => {
      if (!Array.isArray(params)) return [];
      return params.filter(
        (param) => param && param.key && param.value
      );
    };

    const filteredParameters = filterCompleteParams(parameters);
    const filteredProjectParams = filterCompleteParams(project?.SharePolicy?.params);

    const changedParams = JSON.stringify(filteredParameters) !== JSON.stringify(filteredProjectParams);
    const changedAllowParams = allowParams !== project?.SharePolicy?.allow_params;
    return expirationDate || changedParams || changedAllowParams;
  };

  const _getEmbedUrl = () => {
    if (!project.brewName) return "";
    let url = `${SITE_HOST}/b/${newBrewName}${embedTheme !== "os" ? `?theme=${embedTheme}` : ""}`;
    
    // If SharePolicy exists and we have a token, add it to the URL
    if (project.SharePolicy && shareToken) {
      url += `${url.includes("?") ? "&" : "?"}token=${shareToken}`;
      
      // If URL parameters are allowed and we have parameters, show example
      if (allowParams && parameters && parameters.length > 0) {
        const validParams = parameters.filter(p => p.key && p.value);
        if (validParams.length > 0) {
          const paramString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
          url += `&${paramString}`;
        }
      }
    }
    
    return url;
  };

  const _getSignedEmbedString = () => {
    if (!project.brewName) return "";
    let url = `${SITE_HOST}/b/${newBrewName}${embedTheme !== "os" ? `?theme=${embedTheme}` : ""}`;
    
    // If SharePolicy exists and we have a token, add it to the URL
    if (project.SharePolicy && shareToken) {
      url += `${url.includes("?") ? "&" : "?"}token=${shareToken}`;
      
      // If URL parameters are allowed and we have parameters, show example
      if (allowParams && parameters && parameters.length > 0) {
        const validParams = parameters.filter(p => p.key && p.value);
        if (validParams.length > 0) {
          const paramString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
          url += `&${paramString}`;
        }
      }
    }
    
    return `<iframe src="${url}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  return (
    <Drawer
      backdrop="blur"
      isOpen={open}
      onClose={onClose}
      size="xl"
      classNames={{
        base: "sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium",
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
                isDisabled={!project.public || passwordLoading}
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

          {shareLoading && (
            <div className="flex items-center justify-center">
              <Spinner variant="simple" size="sm" aria-label="Managing share policy" />
            </div>
          )}

          {project.SharePolicy && !shareLoading && (
            <div className="flex flex-col gap-2">
              <div>
                <div className="flex flex-row justify-between items-center">
                  <div className="flex flex-row items-center gap-2">
                    <div className="font-medium text-gray-500">{"Parameters"}</div>
                    <Tooltip content="Parameters allow you to pass data to variables in your dashboard's charts.">
                      <div className="text-gray-500"><LuInfo size={16} /></div>
                    </Tooltip>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setParameters([...parameters, { key: "", value: "" }]);
                    }}
                    startContent={<LuPlus />}
                  >
                    Add parameter
                  </Button>
                </div>
                <Spacer y={1} />
                <div className="flex flex-col gap-2">
                  {parameters?.map((param, index) => (
                    <div key={index} className="flex flex-row items-center gap-2">
                      <Input
                        value={param.key}
                        onChange={(e) => {
                          const newParameters = parameters.map((p, i) =>
                            i === index ? { ...p, key: e.target.value } : p
                          );
                          setParameters(newParameters);
                        }}
                        size="sm"
                        variant="bordered"
                        placeholder="Parameter name"
                      />
                      <Input
                        value={param.value}
                        onChange={(e) => {
                          const newParameters = parameters.map((p, i) =>
                            i === index ? { ...p, value: e.target.value } : p
                          );
                          setParameters(newParameters);
                        }}
                        size="sm"
                        variant="bordered"
                        placeholder="Parameter value"
                      />
                    </div>
                  ))}
                </div>
                {parameters.length === 0 && (
                  <div className="text-gray-500 text-xs italic">{"No parameters added"}</div>
                )}
                <Spacer y={2} />
                <div className="flex flex-row items-center gap-2">
                  <Checkbox
                    isSelected={allowParams}
                    onValueChange={() => {
                      setAllowParams(!allowParams);
                    }}
                    size="sm"
                  >
                    Allow parameters in the URL
                  </Checkbox>
                  <Tooltip
                    content="When enabled, parameters and variables can be passed directly in the URL like ?param1=value1&param2=value2. This will mean that everyone who has the URL can change the parameters and variables in the dashboard."
                    className="max-w-xs"
                  >
                    <div className="text-gray-500"><LuInfo size={16} /></div>
                  </Tooltip>
                </div>
              </div>

              <Spacer y={2} />
              <div>
                <div className="font-medium text-gray-500">{"Set links to expire"}</div>
                <div className="text-gray-500 text-xs italic">{"Set a date and time for the link to expire. If no date is set, the link will never expire."}</div>
                <Input
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
                <Spacer y={1} />
                {expirationDate && (
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => {
                      setExpirationDate("");
                    }}
                    startContent={<LuX size={16} />}
                  >
                    Clear expiration date
                  </Button>
                )}
              </div>
              {_hasUnsavedChanges() && (
                <>
                  <Spacer y={2} />
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => {
                      _onSaveSharePolicy();
                    }}
                  >
                    Refresh sharing links
                  </Button>
                </>
              )}
            </div>
          )}

          {!project.SharePolicy && !shareLoading && (
            <div>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => {
                  _onCreateSharePolicy();
                }}
              >
                Enable signed links
              </Button>
              <Spacer y={1} />
              <div className="text-gray-500 text-xs">
                {"This dashboard is using legacy sharing links. You can enable signed links to better control and secure the dashboard. Please be aware that this operation will break existing links you already shared or embedded on other websites."}
              </div>
            </div>
          )}

          <Spacer y={1} />
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
              value={project.SharePolicy ? _getSignedEmbedString() : _getEmbedString()}
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
