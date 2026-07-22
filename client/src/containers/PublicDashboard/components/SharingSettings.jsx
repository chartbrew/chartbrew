import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Separator, Input, InputGroup, Switch, Tooltip, RadioGroup, Radio,
  Drawer, Checkbox, Spinner,
  Alert,
} from "@heroui/react";
import { LuChevronsRight, LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuPlus, LuX, LuTrash2, LuShare2, LuRefreshCcw, LuPalette, LuShare, LuArrowLeft, LuTriangleAlert } from "react-icons/lu";

import { SITE_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
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
      setNewPassword("");
      setShowPasswordForm(project.passwordProtected && !project.password);
      _initializeSharing();
    }
  }, [project]);

  useEffect(() => {
    if (selectedPolicy) {
      setParameters(selectedPolicy.params || []);
      setAllowParams(selectedPolicy.allow_params || false);
      setExpirationDate(selectedPolicy.expires_at || "");
      if (selectedPolicy.token_version >= 2) {
        _generateTokenForPolicy(selectedPolicy);
      } else {
        setShareToken("");
      }
    }
  }, [selectedPolicy?.id]);

  const _initializeSharing = async () => {
    // Initialize with new SharePolicies system only
    const hasSharePolicies = project?.SharePolicies && project.SharePolicies.length > 0;
    
    if (hasSharePolicies) {
      setSharePolicies(project.SharePolicies);
    } else {
      setSharePolicies([]);
    }
  };

  const _onChangeBrewName = (value) => {
    setNewBrewName(value);
  };

  const _getCompleteParams = (params) => {
    if (!Array.isArray(params)) return [];

    return params.filter((param) => param && param.key && param.value);
  };

  const _buildShareUrl = ({
    token = "",
    theme = embedTheme,
    params = parameters,
    paramsAllowed = allowParams,
  } = {}) => {
    if (!project?.brewName) return "";

    const queryParams = [];
    if (token) {
      queryParams.push(`token=${encodeURIComponent(token)}`);
    }

    if (theme !== "os") {
      queryParams.push(`theme=${encodeURIComponent(theme)}`);
    }

    if (paramsAllowed) {
      _getCompleteParams(params).forEach((param) => {
        queryParams.push(`${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`);
      });
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
    return `${SITE_HOST}/report/${project.brewName}${queryString}`;
  };

  const _onCopyUrl = (urlToCopy) => {
    setUrlCopied(true);
    const url = typeof urlToCopy === "string"
      ? urlToCopy
      : shareToken ? _getEmbedUrl() : `${SITE_HOST}/report/${newBrewName}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    const embedCode = shareToken ? _getSignedEmbedString() : _getEmbedString();
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
    if (value) {
      setShowPasswordForm(!project.password);
    } else {
      setShowPasswordForm(false);
      setNewPassword("");
    }

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
        setNewPassword("");
        setShowPasswordForm(false);
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

  const _generateTokenForPolicy = async (policy, options = {}) => {
    if (!policy) return;

    const {
      exp = policy.expires_at,
      preserveLegacy = false,
      updateCurrentToken = true,
    } = options;

    if (updateCurrentToken) {
      setShareLoading(true);
    }

    try {
      const data = await dispatch(generateShareToken({
        project_id: project.id,
        data: {
          sharePolicyId: policy.id,
          share_policy: {
            params: policy.params,
            allow_params: policy.allow_params,
          },
          exp,
          preserveLegacy,
        },
      }));
      const token = data?.payload?.token || "";
      const securePolicy = data?.payload?.sharePolicy;

      if (securePolicy) {
        setSharePolicies((currentPolicies) => currentPolicies.map((currentPolicy) => {
          return currentPolicy.id === securePolicy.id ? securePolicy : currentPolicy;
        }));
        if (selectedPolicy?.id === securePolicy.id) {
          setSelectedPolicy(securePolicy);
        }
      }

      if (updateCurrentToken) {
        setShareToken(token);
      }

      return token;
    } catch (error) {
      toast.error("Failed to generate share token");
      return "";
    } finally {
      if (updateCurrentToken) {
        setShareLoading(false);
      }
    }
  };

  const _onGenerateSecureLink = async () => {
    const token = await _generateTokenForPolicy(selectedPolicy);
    if (token) {
      toast.success("New link generated. Replace the old link wherever it is used.");
    }
  };

  const _getUrlForPolicy = async (policy) => {
    const token = await _generateTokenForPolicy(policy, {
      exp: policy.expires_at,
      preserveLegacy: policy.token_version < 2,
      updateCurrentToken: false,
    });

    if (!token) return "";

    return _buildShareUrl({
      token,
      params: policy.params,
      paramsAllowed: policy.allow_params,
    });
  };

  const _onOpenPolicyUrl = async (policy) => {
    const newWindow = window.open("about:blank", "_blank");
    setShareLoading(true);
    const url = await _getUrlForPolicy(policy);
    setShareLoading(false);

    if (!url) {
      if (newWindow) newWindow.close();
      return;
    }

    if (newWindow) {
      newWindow.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };

  const _onCopyPolicyUrl = async (policy) => {
    setShareLoading(true);
    const url = await _getUrlForPolicy(policy);
    setShareLoading(false);

    if (url) {
      _onCopyUrl(url);
    }
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
    
    const filteredParameters = _getCompleteParams(parameters);
    const filteredPolicyParams = _getCompleteParams(selectedPolicy?.params);
    const changedParams = JSON.stringify(filteredParameters) !== JSON.stringify(filteredPolicyParams);
    const changedAllowParams = allowParams !== selectedPolicy?.allow_params;
    const changedExpirationDate = expirationDate !== selectedPolicy?.expires_at && (expirationDate !== "" || expirationDate !== null);
    return changedExpirationDate || changedParams || changedAllowParams;
  };

  const _getEmbedUrl = () => {
    return _buildShareUrl({ token: shareToken });
  };

  const _getSignedEmbedString = () => {
    if (!project.brewName) return "";
    
    // Use the same URL logic as _getEmbedUrl
    const url = _getEmbedUrl();
    return `<iframe src="${url}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
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
        {selectedPolicy.token_version < 2 && (
          <div
            className="rounded-lg border border-warning/30 bg-warning/10 p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <LuTriangleAlert className="mt-0.5 shrink-0 text-warning" size={18} aria-hidden />
              <div className="min-w-0">
                <div className="text-sm font-semibold">This link will be restricted soon</div>
                <p className="mt-1 text-sm leading-5 text-foreground-600">
                  For security reasons, generate a new link and replace this one wherever it is used.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onPress={_onGenerateSecureLink}
                  isPending={shareLoading}
                >
                  {shareLoading ? <ButtonSpinner /> : <LuRefreshCcw size={16} />}
                  Generate new link
                </Button>
              </div>
            </div>
          </div>
        )}

        {shareToken && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-medium">Direct Link</div>
              <div>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    value={_getEmbedUrl()}
                    readOnly
                    size="sm"
                    variant="secondary"
                    className="min-w-0"
                  />
                  <InputGroup.Suffix className="border-none pr-1">
                    <div className="flex flex-row items-center gap-1">
                      <Button
                        isIconOnly
                        aria-label="Open direct link in new tab"
                        size="sm"
                        variant="tertiary"
                        onPress={() => window.open(_getEmbedUrl(), "_blank")}
                      >
                        <LuExternalLink />
                      </Button>
                      <Button isIconOnly aria-label="Copy direct link" size="sm" variant="tertiary" onPress={_onCopyUrl}>
                        {urlCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                      </Button>
                    </div>
                  </InputGroup.Suffix>
                </InputGroup>
              </div>
              <div className="h-2" />
              <div className="text-sm font-medium">Embedding Code</div>
              <div>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.TextArea
                    value={_getSignedEmbedString()}
                    readOnly
                    rows={4}
                    size="sm"
                    variant="secondary"
                    className="min-w-0 resize-none"
                  />
                  <InputGroup.Suffix className="border-none self-start pr-1 pt-1">
                    <Button
                      isIconOnly
                      aria-label="Copy embed code"
                      size="sm"
                      variant="tertiary"
                      onPress={_onCopyEmbed}
                    >
                      {embedCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                    </Button>
                  </InputGroup.Suffix>
                </InputGroup>
              </div>
            </div>
          </>
        )}

        <div>
          <div className="text-sm font-medium mb-1">Theme</div>
          <RadioGroup
            name="sharing-embed-theme"
            orientation="horizontal"
            value={embedTheme}
            variant="secondary"
            onChange={setEmbedTheme}
          >
            <Radio value="os">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                System default
              </Radio.Content>
            </Radio>
            <Radio value="dark">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                Dark
              </Radio.Content>
            </Radio>
            <Radio value="light">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                Light
              </Radio.Content>
            </Radio>
          </RadioGroup>
        </div>

        <div>
          <div className="flex flex-row justify-between items-center mb-2">
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm font-medium">Parameters</div>
              <Tooltip>
                <Tooltip.Trigger>
                  <div className="text-gray-500"><LuInfo size={16} /></div>
                </Tooltip.Trigger>
                <Tooltip.Content>{"Parameters allow you to pass data to variables in your dashboard's charts."}</Tooltip.Content>
              </Tooltip>
            </div>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                setParameters([...parameters, { key: "", value: "" }]);
              }}
            >
              <LuPlus />
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
                  variant="secondary"
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
                  variant="secondary"
                  placeholder="Parameter value"
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
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
              id="sharing-settings-allow-params"
              isSelected={allowParams}
              onChange={(selected) => setAllowParams(selected)}
              variant="secondary"
            >
              <Checkbox.Content>
                <Checkbox.Control className="size-4 shrink-0">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                Allow parameters in the URL
              </Checkbox.Content>
            </Checkbox>
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <div className="text-gray-500"><LuInfo size={16} /></div>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-xs">
                When enabled, parameters and variables can be passed directly in the URL like ?param1=value1&param2=value2. This will mean that everyone who has the URL can change the parameters and variables in the dashboard.
              </Tooltip.Content>
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
            variant="secondary"
          />
          {expirationDate && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onPress={() => {
                setExpirationDate("");
              }}
            >
              <LuX size={16} />
              Clear expiration date
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="min-w-lg">
          {onReport && (
            <Drawer.Header className="flex flex-row items-center justify-between gap-2">
              <Text size="h3">Sharing settings</Text>
              <Drawer.CloseTrigger aria-label="Close" />
            </Drawer.Header>
          )}
          {!onReport && (
            <Drawer.Header
              className="flex flex-row items-center border-b border-divider gap-2 justify-between bg-surface/50 backdrop-saturate-150 backdrop-blur-lg pb-4"
            >
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    onPress={onClose}
                    size="sm"
                    variant="tertiary"
                  >
                    <LuChevronsRight />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Close</Tooltip.Content>
              </Tooltip>
              <div className="flex flex-row items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => navigate(`/report/${newBrewName}/edit`)}
                >
                  Edit report visuals
                  <LuPalette size={18} />
                </Button>
              </div>
            </Drawer.Header>
          )}
          <Drawer.Body className="flex flex-col gap-2 p-1 pb-10">
            <div className="font-medium text-gray-500">Dashboard visibility</div>
            <div className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div className="flex items-center">
                <Switch
                  id="sharing-settings-allow-public"
                  isSelected={project.public}
                  onChange={_onTogglePublic}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Allow sharing
                  </Switch.Content>
                </Switch>
                <div className="w-1" />
                <Tooltip>
                  <Tooltip.Trigger>
                    <div><LuInfo size={16} /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-xs">
                    <>
                      <p>{"Allow sharing the report with anyone with or without a Chartbrew account."}</p>
                      <div className="h-2" />
                      <p>{"When disabled, the report can only be seen by members of your team if logged in."}</p>
                    </>
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <div className="flex items-center">
                <Switch
                  id="sharing-settings-require-password"
                  isSelected={project.passwordProtected}
                  onChange={_onTogglePassword}
                  isReadOnly={passwordLoading}
                  aria-busy={passwordLoading}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Require password to view
                  </Switch.Content>
                </Switch>
                <div className="w-1" />
                <Tooltip>
                  <Tooltip.Trigger>
                    <div><LuInfo size={16} /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-xs">
                    When enabled, the report will require the viewers outside of your team to enter a password before viewing
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </div>
            {project.passwordProtected && project.password && !showPasswordForm && (
              <Alert status="success" className="shadow-none mt-2 border border-divider">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Password is set</Alert.Title>
                  <Alert.Description>
                    Viewers outside your team need the report password to open this dashboard.
                  </Alert.Description>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setNewPassword("");
                        setShowPasswordForm(true);
                      }}
                    >
                      <LuRefreshCcw size={16} />
                      Set new password
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            )}
            {project.passwordProtected && (!project.password || showPasswordForm) && (
              <>
                <Row>
                  <Input
                    label="Report password"
                    placeholder="Enter a password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    isDisabled={!project.passwordProtected}
                    variant="secondary"
                    fullWidth
                  />
                </Row>
                <Row>
                  <Button
                    variant="primary"
                    onPress={() => _onSavePassword(newPassword)}
                    isDisabled={
                      !project.passwordProtected
                      || !newPassword
                    }
                    size="sm"
                  >
                    Save password
                  </Button>
                </Row>
              </>
            )}

            <div className="h-1" />
            <Separator />
            <div className="h-1" />

            <div className="font-medium text-gray-500">Customize your Report URL</div>
            <InputGroup variant="secondary">
              <InputGroup.Prefix>
                <div className="text-sm text-gray-500">
                  {`${SITE_HOST}/report/`}
                </div>
              </InputGroup.Prefix>
              <InputGroup.Input
                id="share-url-text"
                placeholder="Enter your custom dashboard URL"
                value={newBrewName}
                onChange={(e) => _onChangeBrewName(e.target.value)}
                color={urlError ? "error" : "default"}
                description={urlError}
                variant="secondary"
                fullWidth
              />
            </InputGroup>
            <Row>
              <Button
                variant="primary"
                onPress={() => _onSaveBrewName(newBrewName)}
                isDisabled={!newBrewName}
                isPending={urlLoading}
                size="sm"
              >
                {urlLoading ? <ButtonSpinner /> : null}
                {onReport ? "Save URL and reload" : "Save URL"}
              </Button>
            </Row>

            <div className="h-1" />
            <Separator />
            <div className="h-1" />

            <div className="flex flex-col gap-2">
              <div className="font-medium text-gray-500">Share Links</div>

              <div className="flex items-center">
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={_onCreateNewPolicy}
                  isPending={shareLoading}
                >
                  {shareLoading ? <ButtonSpinner /> : <LuPlus />}
                  New Link
                </Button>
              </div>
              <div className="h-1" />

              {sharePolicies.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <LuShare className="mx-auto mb-2" size={24} />
                  <div className="text-sm">No share links created yet</div>
                  <div className="text-xs">Create your first share link to get started</div>
                </div>
              )}

              {sharePolicies.length > 0 && (
                <div className="border border-divider rounded-3xl p-2">
                  {!selectedPolicy && sharePolicies.map((policy, index) => (
                    <div
                      key={policy.id}
                      className="flex flex-row items-center justify-between cursor-pointer hover:bg-content2 rounded-medium p-2"
                      onClick={() => setSelectedPolicy(policy)}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <span>Link {index + 1}</span>
                          {policy.token_version < 2 && (
                            <Tooltip delay={0}>
                              <Tooltip.Trigger>
                                <span
                                  aria-label={`Link ${index + 1} needs a security update`}
                                  className="inline-flex text-warning"
                                  role="img"
                                >
                                  <LuTriangleAlert size={16} />
                                </span>
                              </Tooltip.Trigger>
                              <Tooltip.Content className="max-w-xs">
                                This link will be restricted soon for security reasons. Please generate a new one as soon as possible.
                              </Tooltip.Content>
                            </Tooltip>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {policy.expires_at ? `Expires on ${new Date(policy.expires_at).toLocaleDateString()}` : "Never expires"}
                        </div>
                      </div>
                      <div
                        className="flex flex-row items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <Button
                          isIconOnly
                          aria-label={`Open Link ${index + 1}`}
                          size="sm"
                          variant="tertiary"
                          onPress={() => _onOpenPolicyUrl(policy)}
                        >
                          <LuExternalLink size={16} />
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`Copy Link ${index + 1}`}
                          size="sm"
                          variant="tertiary"
                          onPress={() => _onCopyPolicyUrl(policy)}
                        >
                          {urlCopied ? <LuCopyCheck className="text-success" /> : <LuCopy size={16} />}
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`Delete Link ${index + 1}`}
                          size="sm"
                          variant="danger-soft"
                          onPress={() => _onDeletePolicy(policy.id)}
                        >
                          <LuTrash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}


                  {selectedPolicy && (
                    <div>
                      <div
                        key={selectedPolicy.id}
                        className="flex flex-row items-center gap-1 hover:cursor-pointer text-accent mt-2"
                        onClick={() => setSelectedPolicy(null)}
                      >
                        <div><LuArrowLeft size={16} /></div>
                        <div className="text-sm">Back to all links</div>
                      </div>

                      <div className="h-4" />
                      <Separator />
                      <div className="h-4" />

                      {_renderPolicyDetails()}

                      {_hasUnsavedChanges() && (
                        <div className="mt-4 mb-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onPress={_onUpdatePolicy}
                            isPending={isUpdating}
                          >
                            {isUpdating ? <ButtonSpinner /> : <LuRefreshCcw size={16} />}
                            Save & Regenerate links
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {shareLoading && (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" aria-label="Loading" />
              </div>
            )}

            {!project?.public && sharePolicies?.length > 0 && (
              <div className="mt-2">
                <Alert status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Report not shareable</Alert.Title>
                    <Alert.Description>Toggle &apos;Allow sharing&apos; to make it shareable. Right now, only team members can view it.</Alert.Description>
                  </Alert.Content>
                </Alert>
              </div>
            )}

            <div className="h-1" />
            <Separator />
            <div className="h-1" />

            <Row align="center">
              <Switch
                id="sharing-settings-branding"
                isSelected={project.Team && project.Team.showBranding}
                onChange={_onToggleBranding}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Show Chartbrew branding
                </Switch.Content>
              </Switch>
            </Row>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              onPress={onClose}
              variant="tertiary"
            >
              Close
            </Button>
          </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

SharingSettings.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onReport: PropTypes.bool,
};

export default SharingSettings;
