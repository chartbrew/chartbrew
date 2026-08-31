import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion, Button, Checkbox, Input, InputGroup, Label,
  ListBox, Spinner, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip,
} from "@heroui/react";
import {
  LuCopy, LuCopyCheck, LuExternalLink, LuGlobe, LuInfo, LuLink, LuPlus,
  LuRefreshCcw, LuShare2, LuTrash2, LuTriangleAlert, LuX,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";
import { toast } from "react-hot-toast";

import { 
  createSharePolicy, createShareString, generateShareToken, updateChart, 
  updateSharePolicy, deleteSharePolicy 
} from "../../../../slices/chart";
import { SITE_HOST } from "../../../../config/settings";
import { ButtonSpinner } from "../../../../components/ButtonSpinner";

function LinksEmbedTab({ chart, isOpen, onActionChange }) {
  const [shareLoading, setShareLoading] = useState(false);
  const [embedTheme, setEmbedTheme] = useState("os");
  const [iframeCopied, setIframeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [parameters, setParameters] = useState([]);
  const [allowParams, setAllowParams] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [isLegacy, setIsLegacy] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [sharePolicies, setSharePolicies] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    if (isOpen && chart) {
      _initializeSharing();
    }
  }, [chart, isOpen]);

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
    // Determine if we're in legacy mode
    const hasChartshares = chart?.Chartshares && chart.Chartshares.length > 0;
    const hasSharePolicies = chart?.SharePolicies && chart.SharePolicies.length > 0;
    
    if (hasChartshares && !hasSharePolicies) {
      setIsLegacy(true);
      // For legacy mode, generate token using old method
      if (chart.SharePolicy) {
        setParameters(chart.SharePolicy.params || []);
        setAllowParams(chart.SharePolicy.allow_params || false);
      }
      _onGenerateShareToken();
    } else if (hasSharePolicies) {
      setIsLegacy(false);
      setSharePolicies(chart.SharePolicies);
      if (chart.SharePolicies.length > 0) {
        setSelectedPolicy(chart.SharePolicies[0]);
      }
    } else {
      setIsLegacy(false);
      setSharePolicies([]);
    }
  };

  const _onToggleShareable = async (selected) => {
    if (selected) {
      if (!chart.Chartshares || chart.Chartshares.length === 0) {
        setShareLoading(true);
        await dispatch(createShareString({ project_id: params.projectId, chart_id: chart.id }));
        _onGenerateShareToken();
      }
    }

    await dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { shareable: selected },
      justUpdates: true,
    }));

    setShareLoading(false);
  };

  const _onCreateSharingString = async () => {
    setShareLoading(true);
    await dispatch(createShareString({ project_id: params.projectId, chart_id: chart.id }));
    _onGenerateShareToken();
    setShareLoading(false);
  };

  const _onGenerateShareToken = async () => {
    setShareLoading(true);
    const data = await dispatch(generateShareToken({
      project_id: params.projectId,
      chart_id: chart.id,
      data: {
        exp: expirationDate,
      },
    }));
    setShareToken(data?.payload?.token);
    setShareLoading(false);
  };

  const _generateTokenForPolicy = async (policy) => {
    if (!policy) return;
    
    setShareLoading(true);
    try {
      const data = await dispatch(generateShareToken({
        project_id: params.projectId,
        chart_id: chart.id,
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

      if (data?.payload?.sharePolicy) {
        const securePolicy = data.payload.sharePolicy;
        setSharePolicies((currentPolicies) => currentPolicies.map((currentPolicy) => {
          return currentPolicy.id === securePolicy.id ? securePolicy : currentPolicy;
        }));
        setSelectedPolicy(securePolicy);
      }

      return data?.payload?.token || "";
    } catch (error) {
      toast.error("Failed to generate share token");
      return "";
    } finally {
      setShareLoading(false);
    }
  };

  const _onGenerateSecureLink = async () => {
    const token = await _generateTokenForPolicy(selectedPolicy);
    if (token) {
      toast.success("New link generated. Replace the old link wherever it is used.");
    }
  };

  const _onCreateNewPolicy = async () => {
    setShareLoading(true);
    try {
      const result = await dispatch(createSharePolicy({ 
        project_id: params.projectId, 
        chart_id: chart.id 
      }));
      
      if (result.payload) {
        const newPolicies = [...sharePolicies, result.payload];
        setSharePolicies(newPolicies);
        setSelectedPolicy(result.payload);
        setIsLegacy(false);
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
        project_id: params.projectId,
        chart_id: chart.id,
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
          project_id: params.projectId,
          chart_id: chart.id,
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
    if (sharePolicies.length === 1) {
      toast.error("Cannot delete the last share policy");
      return;
    }

    setShareLoading(true);
    try {
      await dispatch(deleteSharePolicy({
        project_id: params.projectId,
        chart_id: chart.id,
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

  const _onCopyIframe = () => {
    const iframeText = document.getElementById("iframe-text");
    navigator.clipboard.writeText(iframeText.value)
    setIframeCopied(true);
    setTimeout(() => {
      setIframeCopied(false);
    }, 2000);

    toast.success("Copied to your clipboard");
  };

  const _onCopyUrl = () => {
    const urlText = document.getElementById("url-text");
    navigator.clipboard.writeText(urlText.value)
    setUrlCopied(true);
    setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
    
    toast.success("Copied to your clipboard");
  };

  const _getEmbedUrl = () => {
    if (!selectedPolicy?.share_string && (!chart.Chartshares || !chart.Chartshares[0])) return "";
    
    // Use SharePolicy share_string if available (new system), otherwise fall back to Chartshares (legacy)
    const shareString = selectedPolicy?.share_string || (chart.Chartshares && chart.Chartshares[0].shareString);
    let url = `${SITE_HOST}/chart/${shareString}/share?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}`;
    
    // If URL parameters are allowed and we have parameters, show example
    if (allowParams && parameters && parameters.length > 0) {
      const validParams = parameters.filter(p => p.key && p.value);
      if (validParams.length > 0) {
        const paramString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
        url += `&${paramString}`;
      }
    }
    
    return url;
  };

  const _getEmbedString = () => {
    if (!selectedPolicy?.share_string && (!chart.Chartshares || !chart.Chartshares[0])) return "";
    
    // Use SharePolicy share_string if available (new system), otherwise fall back to Chartshares (legacy)
    const shareString = selectedPolicy?.share_string || (chart.Chartshares && chart.Chartshares[0].shareString);
    let url = `${SITE_HOST}/chart/${shareString}/share?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}`;
    
    // If URL parameters are allowed and we have parameters, show example
    if (allowParams && parameters && parameters.length > 0) {
      const validParams = parameters.filter(p => p.key && p.value);
      if (validParams.length > 0) {
        const paramString = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
        url += `&${paramString}`;
      }
    }
    
    return `<iframe src="${url}" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0" style="background-color: #ffffff"></iframe>`;
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
    const filteredPolicyParams = filterCompleteParams(selectedPolicy.params);

    const changedParams = JSON.stringify(filteredParameters) !== JSON.stringify(filteredPolicyParams);
    const changedAllowParams = allowParams !== selectedPolicy.allow_params;
    const changedExpirationDate = (expirationDate || "") !== (selectedPolicy.expires_at || "");
    return changedExpirationDate || changedParams || changedAllowParams;
  };

  useEffect(() => {
    if (!onActionChange) return undefined;
    onActionChange({
      hasUnsaved: _hasUnsavedChanges(),
      isUpdating,
      onSave: _onUpdatePolicy,
    });
    return undefined;
  }, [allowParams, expirationDate, isUpdating, onActionChange, parameters, selectedPolicy]);

  const _renderPolicyList = () => {
    if (isLegacy) {
      return (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-2">Legacy Share Link</div>
            <div className="text-xs">
              This chart is using legacy sharing links. You can enable signed links for better control and security.
            </div>
          </div>
          <Button
            size="sm"
            variant="tertiary" onPress={_onCreateNewPolicy}
            isPending={shareLoading}
          >
            {shareLoading ? <ButtonSpinner /> : <LuPlus />}
            Enable secure links
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">Share links</div>
          <Button
            size="sm"
            variant="tertiary"
            onPress={_onCreateNewPolicy}
            isPending={shareLoading}
          >
            {shareLoading ? <ButtonSpinner /> : <LuPlus />}
            New
          </Button>
        </div>

        {sharePolicies.length === 0 ? (
          <div className="rounded-xl bg-surface-secondary/60 px-4 py-8 text-center text-foreground-500">
            <LuShare2 className="mx-auto mb-2" size={22} />
            <div className="text-sm font-medium text-foreground">No share links yet</div>
            <div className="mt-1 text-xs">Create a link to get started</div>
          </div>
        ) : (
          <ListBox
            aria-label="Share policies"
            selectionMode="single"
            selectedKeys={selectedPolicy ? new Set([selectedPolicy.id.toString()]) : new Set()}
            onSelectionChange={(keys) => {
              if (keys === "all") {
                return;
              }
              const selectedId = keys.size > 0 ? Array.from(keys)[0] : null;
              if (selectedId) {
                const policy = sharePolicies.find((p) => p.id.toString() === String(selectedId));
                setSelectedPolicy(policy);
              }
            }}
            className="w-full gap-2"
          >
            {sharePolicies.map((policy, index) => (
              <ListBox.Item
                key={policy.id.toString()}
                id={policy.id.toString()}
                textValue={`Link ${index + 1}`}
                className={`rounded-xl border px-3 py-2.5 ${selectedPolicy?.id === policy.id
                  ? "border-primary bg-primary/10"
                  : "border-transparent bg-surface-secondary/70"}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <LuLink
                      aria-hidden
                      className={`mt-0.5 shrink-0 ${selectedPolicy?.id === policy.id ? "text-primary" : "text-foreground-400"}`}
                      size={16}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium">Link {index + 1}</div>
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
                              This link will be restricted soon for security reasons. Generate a new one.
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-foreground-500">
                        {policy.allow_params ? "URL params allowed" : "No URL params"}
                        {" · "}
                        {policy.expires_at ? `Expires ${new Date(policy.expires_at).toLocaleDateString()}` : "Never expires"}
                      </div>
                    </div>
                  </div>
                  <div
                    className="shrink-0"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      color="danger"
                      onPress={() => _onDeletePolicy(policy.id)}
                      isDisabled={sharePolicies.length === 1}
                    >
                      <LuTrash2 size={14} />
                    </Button>
                  </div>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        )}
      </div>
    );
  };

  const _renderPolicyDetails = () => {
    if (isLegacy) {
      return (
        <div className="space-y-4">
          <div className="text-sm font-medium">Legacy Share Link Settings</div>
          <div className="text-sm text-gray-600">
            This chart uses legacy sharing. Consider upgrading to secure links for better control.
          </div>
          {/* Legacy settings would go here */}
        </div>
      );
    }

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
      <div className="flex flex-col gap-5 pb-2">
        {selectedPolicy.token_version < 2 && (
          <div className="rounded-xl bg-warning/10 p-4" role="status">
            <div className="flex items-start gap-3">
              <LuTriangleAlert className="mt-0.5 shrink-0 text-warning" size={18} aria-hidden />
              <div className="min-w-0">
                <div className="text-sm font-semibold">This link will be restricted soon</div>
                <p className="mt-1 text-sm leading-5 text-foreground-500">
                  Generate a new link and replace this one wherever it is used.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
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

        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-foreground">Appearance</div>
          <ToggleButtonGroup
            aria-label="Appearance"
            disallowEmptySelection
            fullWidth
            selectedKeys={new Set([embedTheme])}
            selectionMode="single"
            size="sm"
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next) setEmbedTheme(next);
            }}
          >
            <ToggleButton id="os">System default</ToggleButton>
            <ToggleButton id="light">
              <ToggleButtonGroup.Separator />
              Light
            </ToggleButton>
            <ToggleButton id="dark">
              <ToggleButtonGroup.Separator />
              Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {shareToken && (
          <div className="flex flex-col gap-4">
            <TextField name="chart-sharing-direct-link" className="w-full">
              <Label className="text-sm font-semibold">Direct link</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  id="url-text"
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
            </TextField>
            <TextField name="chart-sharing-embed-code" className="w-full">
              <Label className="text-sm font-semibold">Embed code</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.TextArea
                  id="iframe-text"
                  value={_getEmbedString()}
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
                    onPress={_onCopyIframe}
                  >
                    {iframeCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
            </TextField>
          </div>
        )}

        <Accordion className="bg-surface-secondary/50" variant="surface">
          <Accordion.Item id="chart-sharing-advanced" textValue="Advanced options">
            <Accordion.Heading>
              <Accordion.Trigger>
                Advanced options
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="flex flex-col gap-5 pb-4 pt-1">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">Parameters</div>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <div className="text-foreground-400"><LuInfo size={16} /></div>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          Parameters allow you to pass data to variables in your chart&apos;s datasets.
                        </Tooltip.Content>
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
                      Add
                    </Button>
                  </div>
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
                      <div className="text-sm text-foreground-500">No parameters added</div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                      id="chart-sharing-allow-params"
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
                        <div className="text-foreground-400"><LuInfo size={16} /></div>
                      </Tooltip.Trigger>
                      <Tooltip.Content className="max-w-xs">
                        When enabled, parameters and variables can be passed directly in the URL like ?param1=value1&param2=value2. This will mean that everyone who has the URL can change the parameters and variables in the chart.
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-foreground">Link expiration</div>
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
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>
    );
  };

  const hasSharingCode = (chart.Chartshares?.length || 0) > 0
    || (chart.SharePolicies?.length || 0) > 0;
  const linksEnabled = chart.shareable || chart.public;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${linksEnabled ? "bg-primary/10" : "bg-surface-secondary"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${linksEnabled ? "bg-primary text-white" : "bg-surface-tertiary text-foreground-500"}`}>
            <LuGlobe size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Public sharing</div>
            <div className="mt-0.5 text-xs text-foreground-500">
              Anyone with a link can view this chart.
            </div>
          </div>
        </div>
        <Switch
          id="chart-sharing-enable"
          aria-label="Public sharing"
          isSelected={chart.shareable}
          isDisabled={shareLoading}
          onChange={_onToggleShareable}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>

      {shareLoading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <Spinner size="sm" aria-label="Loading sharing settings" />
        </div>
      )}

      {!shareLoading && !linksEnabled && (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-surface-secondary/50 px-6 py-10 text-center">
          <div className="max-w-sm">
            <LuShare2 className="mx-auto mb-3 text-foreground-400" size={26} aria-hidden />
            <div className="text-sm font-semibold text-foreground">Public sharing is off</div>
            <div className="mt-1 text-sm text-foreground-500">
              Turn it on to create links and embed code.
            </div>
          </div>
        </div>
      )}

      {!shareLoading && linksEnabled && !hasSharingCode && (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-surface-secondary/50 px-6 py-10 text-center">
          <div>
            <LuShare2 className="mx-auto mb-3 text-foreground-400" size={26} aria-hidden />
            <div className="text-sm font-semibold text-foreground">Create a sharing link</div>
            <Button className="mt-4" onPress={_onCreateSharingString} variant="primary" size="sm">
              <LuPlus />
              Create link
            </Button>
          </div>
        </div>
      )}

      {!shareLoading && linksEnabled && hasSharingCode && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.4fr)]">
          <div>{_renderPolicyList()}</div>
          <div>{_renderPolicyDetails()}</div>
        </div>
      )}
    </div>
  );
}

LinksEmbedTab.defaultProps = {
  onActionChange: null,
};

LinksEmbedTab.propTypes = {
  chart: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onActionChange: PropTypes.func,
};

export default LinksEmbedTab;
