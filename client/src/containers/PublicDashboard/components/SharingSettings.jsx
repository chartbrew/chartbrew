import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Divider, Input, Spacer, Switch, Textarea, Tooltip, RadioGroup, Radio,
  Drawer, DrawerHeader, DrawerBody, DrawerFooter, DrawerContent, Checkbox, Spinner,
  Listbox, ListboxItem,
  Alert,
} from "@heroui/react";
import { LuChevronsRight, LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuPlus, LuX, LuTrash2, LuShare2, LuRefreshCcw, LuPalette } from "react-icons/lu";

import { SITE_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useDispatch, useSelector } from "react-redux";
import { updateTeam } from "../../../slices/team";
import toast from "react-hot-toast";
import { 
  getProject, selectProject, updateProject, createSharePolicy, generateShareToken, 
  updateSharePolicy, deleteSharePolicy 
} from "../../../slices/project";
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
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [sharePolicies, setSharePolicies] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (project && project.id) {
      setNewBrewName(project.brewName);
      setNewPassword(project.password);
      _initializeSharing();
    }
  }, [project]);

  useEffect(() => {
    if (selectedPolicy) {
      setParameters(selectedPolicy.params || []);
      setAllowParams(selectedPolicy.allow_params || false);
      setExpirationDate(selectedPolicy.expires_at || "");
      _generateTokenForPolicy(selectedPolicy);
    }
  }, [selectedPolicy]);

  const _initializeSharing = async () => {
    // Initialize with new SharePolicies system only
    const hasSharePolicies = project?.SharePolicies && project.SharePolicies.length > 0;
    
    if (hasSharePolicies) {
      setSharePolicies(project.SharePolicies);
      if (project.SharePolicies.length > 0) {
        setSelectedPolicy(project.SharePolicies[0]);
      }
    } else {
      setSharePolicies([]);
    }
  };

  const _onChangeBrewName = (value) => {
    setNewBrewName(value);
  };

  const _onCopyUrl = () => {
    setUrlCopied(true);
    const url = project.SharePolicies ? _getEmbedUrl() : `${SITE_HOST}/report/${newBrewName}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    const embedCode = project.SharePolicies ? _getSignedEmbedString() : _getEmbedString();
    navigator.clipboard.writeText(embedCode);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setEmbedCopied(false);
    }, 2000);
  };

  const _getEmbedString = () => {
    return `<iframe src="${SITE_HOST}/report/${newBrewName}${embedTheme !== "os" ? `?theme=${embedTheme}` : ""}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  const _onTogglePublic = (value) => {
    dispatch(updateProject({ project_id: project.id, data: { public: value } }))
      .then(() => {
        toast.success("The report can now be shared!");
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
          window.location.href = `${SITE_HOST}/report/${project.payload.brewName}`;
        } else {
          toast.success("The dashboard URL is saved!");
        }
      })
  };

  const _generateTokenForPolicy = async (policy) => {
    if (!policy) return;
    
    setShareLoading(true);
    try {
      const data = await dispatch(generateShareToken({
        project_id: project.id,
        data: {
          sharePolicyId: policy.id,
          share_policy: {
            params: policy.params,
            allow_params: policy.allow_params,
          },
          exp: expirationDate,
        },
      }));
      setShareToken(data?.payload?.token);
    } catch (error) {
      toast.error("Failed to generate share token");
    }
    setShareLoading(false);
  };

  const _onCreateNewPolicy = async () => {
    setShareLoading(true);
    try {
      const result = await dispatch(createSharePolicy({ 
        project_id: project.id 
      }));
      
      if (result.payload) {
        const newPolicies = [...sharePolicies, result.payload];
        setSharePolicies(newPolicies);
        setSelectedPolicy(result.payload);
        toast.success("New share link created!");
      }
    } catch (error) {
      toast.error("Failed to create share policy");
    }
    setShareLoading(false);
  };

  const _onUpdatePolicy = async () => {
    if (!selectedPolicy) return;
    
    setIsUpdating(true);
    try {
      const updateData = {
        params: parameters.filter(p => p.key && p.value),
        allow_params: allowParams,
        expires_at: !expirationDate ? null : expirationDate,
      };

      const result = await dispatch(updateSharePolicy({
        project_id: project.id,
        policy_id: selectedPolicy.id,
        data: updateData,
      }));

      if (result.payload) {
        const updatedPolicies = sharePolicies.map(p => 
          p.id === selectedPolicy.id ? result.payload : p
        );
        setSharePolicies(updatedPolicies);
        setSelectedPolicy(result.payload);
        toast.success("Share link updated!");
        
        // Regenerate token with new settings using the specific policy
        const tokenData = await dispatch(generateShareToken({
          project_id: project.id,
          data: {
            sharePolicyId: result.payload.id,
            exp: expirationDate,
          },
        }));
        setShareToken(tokenData?.payload?.token);
      }
    } catch (error) {
      toast.error("Failed to update share policy");
    }
    setIsUpdating(false);
  };

  const _onDeletePolicy = async (policyId) => {
    setShareLoading(true);
    try {
      await dispatch(deleteSharePolicy({
        project_id: project.id,
        policy_id: policyId,
      }));

      const updatedPolicies = sharePolicies.filter(p => p.id !== policyId);
      setSharePolicies(updatedPolicies);
      
      if (selectedPolicy?.id === policyId) {
        setSelectedPolicy(updatedPolicies.length > 0 ? updatedPolicies[0] : null);
      }
      
      toast.success("Share link deleted!");
    } catch (error) {
      toast.error("Failed to delete share policy");
    }
    setShareLoading(false);
  };

  const _hasUnsavedChanges = () => {
    if (!selectedPolicy) return false;
    
    // Filter out incomplete parameters (where key or value are empty)
    const filterCompleteParams = (params) => {
      if (!Array.isArray(params)) return [];
      return params.filter(
        (param) => param && param.key && param.value
      );
    };

    const filteredParameters = filterCompleteParams(parameters);
    const filteredPolicyParams = filterCompleteParams(selectedPolicy?.params);
    const changedParams = JSON.stringify(filteredParameters) !== JSON.stringify(filteredPolicyParams);
    const changedAllowParams = allowParams !== selectedPolicy?.allow_params;
    const changedExpirationDate = expirationDate !== selectedPolicy?.expires_at && (expirationDate !== "" || expirationDate !== null);
    return changedExpirationDate || changedParams || changedAllowParams;
  };

  const _getEmbedUrl = () => {
    if (!project.brewName) return "";
    
    // For SharePolicy system with token
    if (shareToken) {
      let url = `${SITE_HOST}/report/${project.brewName}?token=${shareToken}${embedTheme !== "os" ? `&theme=${embedTheme}` : ""}`;
      
      // If URL parameters are allowed and we have parameters, show example
      if (allowParams && parameters && parameters.length > 0) {
        const validParams = parameters.filter(p => p.key && p.value);
        if (validParams.length > 0) {
          const paramString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
          url += `&${paramString}`;
        }
      }
      
      return url;
    }
    
    // Default URL without token
    return `${SITE_HOST}/report/${project?.brewName}${embedTheme !== "os" ? `?theme=${embedTheme}` : ""}`;
  };

  const _getSignedEmbedString = () => {
    if (!project.brewName) return "";
    
    // Use the same URL logic as _getEmbedUrl
    const url = _getEmbedUrl();
    return `<iframe src="${url}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  const _renderPolicyList = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center">
          <Button
            size="sm"
            variant="flat"
            onPress={_onCreateNewPolicy}
            startContent={<LuPlus />}
            isLoading={shareLoading}
          >
            New Link
          </Button>
        </div>
        
        {sharePolicies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <LuShare2 className="mx-auto mb-2" size={24} />
            <div className="text-sm">No share links created yet</div>
            <div className="text-xs">Create your first share link to get started</div>
          </div>
        ) : (
          <Listbox
            aria-label="Share policies"
            selectionMode="single"
            selectedKeys={selectedPolicy ? [selectedPolicy.id.toString()] : []}
            onSelectionChange={(keys) => {
              const selectedId = Array.from(keys)[0];
              if (selectedId) {
                const policy = sharePolicies.find(p => p.id.toString() === selectedId);
                setSelectedPolicy(policy);
              }
            }}
            variant="faded"
            hideSelectedIcon
          >
            {sharePolicies.map((policy, index) => (
              <ListboxItem
                key={policy.id.toString()}
                className={`mb-2 ${selectedPolicy?.id === policy.id ? "bg-content3" : ""}`}
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => _onDeletePolicy(policy.id)}
                  >
                    <LuTrash2 size={14} />
                  </Button>
                }
              >
                <div>
                  <div className="flex flex-row items-center gap-2">
                    <div className="font-medium">Link {index + 1}</div>
                  </div>
                  <Spacer y={0.5} />
                  <div className="text-xs text-gray-500">
                    {policy.expires_at ? `Expires on ${new Date(policy.expires_at).toLocaleDateString()}` : "Never expires"}
                  </div>
                </div>
              </ListboxItem>
            ))}
          </Listbox>
        )}
      </div>
    );
  };

  const _renderPolicyDetails = () => {
    if (!selectedPolicy) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <LuShare2 className="mx-auto mb-2" size={24} />
            <div>Select a share link to configure</div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {shareToken && (
          <>
            <div className="space-y-4">
              <div>
                <Input
                  label="Direct Link"
                  labelPlacement="outside"
                  value={_getEmbedUrl()}
                  fullWidth
                  readOnly
                  size="sm"
                  endContent={
                    <div className="flex flex-row items-center gap-1">
                      <Button isIconOnly size="sm" variant="flat" onPress={() => window.open(_getEmbedUrl(), "_blank")}>
                        <LuExternalLink />
                      </Button>
                      <Button isIconOnly size="sm" variant="flat" onPress={_onCopyUrl}>
                        {urlCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                      </Button>
                    </div>
                  }
                />
              </div>
              <Spacer y={2} />
              <div>
                <Textarea
                  label="Embedding Code"
                  value={_getSignedEmbedString()}
                  fullWidth
                  readOnly
                  size="sm"
                  endContent={
                    <Button isIconOnly size="sm" variant="flat" onPress={_onCopyEmbed}>
                      {embedCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                    </Button>
                  }
                />
              </div>
            </div>
          </>
        )}

        <div>
          <RadioGroup
            label="Theme"
            orientation="horizontal"
            size="sm"
            value={embedTheme}
            onValueChange={setEmbedTheme}
          >
            <Radio value="os">System default</Radio>
            <Radio value="dark">Dark</Radio>
            <Radio value="light">Light</Radio>
          </RadioGroup>
        </div>

        <div>
          <div className="flex flex-row justify-between items-center mb-2">
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm font-medium">Parameters</div>
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
          
          <div className="space-y-2">
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
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setParameters(parameters.filter((_, i) => i !== index));
                  }}
                >
                  <LuX size={14} />
                </Button>
              </div>
            ))}
            {parameters.length === 0 && (
              <div className="text-gray-500 text-sm italic">No parameters added</div>
            )}
          </div>

          <div className="flex flex-row items-center gap-2 mt-3">
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

        <div>
          <div className="text-sm font-medium mb-2">Link Expiration</div>
          <div className="text-gray-500 text-xs mb-2">
            Set a date and time for the link to expire. If no date is set, the link will never expire.
          </div>
          <Input
            type="datetime-local"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            size="sm"
          />
          {expirationDate && (
            <Button
              size="sm"
              variant="light"
              className="mt-2"
              onPress={() => {
                setExpirationDate("");
              }}
              startContent={<LuX size={16} />}
            >
              Clear expiration date
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Drawer
      backdrop="blur"
      isOpen={open}
      onClose={onClose}
      size="3xl"
      classNames={{
        base: "sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium",
      }}
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
                endContent={<LuPalette size={18} />}
                onPress={() => navigate(`/report/${newBrewName}/edit`)}
              >
                Edit visuals
              </Button>
            </div>
          </DrawerHeader>
        )}
        <DrawerBody>
          <div className="font-medium text-gray-500">Dashboard visibility</div>
          <div className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div className="flex items-center">
              <Switch
                isSelected={project.public}
                onValueChange={_onTogglePublic}
                size="sm"
              >
                Allow sharing
              </Switch>
              <Spacer x={1} />
              <Tooltip
                content={(
                  <>
                    <p>{"Allow sharing the report with anyone with or without a Chartbrew account."}</p>
                    <Spacer y={2} />
                    <p>{"When disabled, the report can only be seen by members of your team if logged in."}</p>
                  </>
                )}
                className="max-w-xs"
              >
                <div><LuInfo size={16} /></div>
              </Tooltip>
            </div>
            <div className="flex items-center">
              <Switch
                isSelected={project.passwordProtected}
                onValueChange={_onTogglePassword}
                isDisabled={passwordLoading}
                size="sm"
              >
                Require password to view
              </Switch>
              <Spacer x={1} />
              <Tooltip
                content="When enabled, the report will require the viewers outside of your team to enter a password before viewing"
                className="max-w-xs"
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
                  isDisabled={!project.passwordProtected}
                  variant="bordered"
                  fullWidth
                />
              </Row>
              <Row>
                <Button
                  color="primary"
                  onPress={() => _onSavePassword(newPassword)}
                  isDisabled={
                    !project.passwordProtected
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

          <div className="font-medium text-gray-500">Customize your Report URL</div>
          <Input
            id="share-url-text"
            placeholder="Enter your custom dashboard URL"
            labelPlacement="outside"
            startContent={(
              <div className="text-sm text-gray-500">
                {`${SITE_HOST}/report/`}
              </div>
            )}
            value={newBrewName}
            onChange={(e) => _onChangeBrewName(e.target.value)}
            color={urlError ? "error" : "default"}
            description={urlError}
            variant="bordered"
            fullWidth
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

          <div className="flex flex-row items-center justify-between">
            <div className="font-medium text-gray-500">Share Links</div>
            {_hasUnsavedChanges() && (
              <div>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={_onUpdatePolicy}
                  isLoading={isUpdating}
                  startContent={<LuRefreshCcw size={16} />}
                >
                  Regenerate link
                </Button>
              </div>
            )}
          </div>
          
          {shareLoading && (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" aria-label="Loading" />
            </div>
          )}

          {/* Two-panel layout */}
          {!shareLoading && (
            <div className="grid grid-cols-12 gap-4">
              {/* Left panel - Share policies list */}
              <div className="col-span-12 md:col-span-4 border-b md:border-b-0 md:border-r pr-4 overflow-y-auto max-h-96">
                {_renderPolicyList()}
              </div>
              
              {/* Right panel - Selected policy details */}
              <div className="col-span-12 md:col-span-8 pl-4 overflow-y-auto max-h-96">
                {_renderPolicyDetails()}
              </div>
            </div>
          )}

          {!project?.public && sharePolicies?.length > 0 && (
            <div className="mt-2">
              <Alert
                variant="flat"
                title="Report not shareable"
                description="Toggle 'Allow sharing' to make it shareable. Right now, only team members can view it."
              />
            </div>
          )}
          
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
