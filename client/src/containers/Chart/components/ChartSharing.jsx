import React, { useEffect, useState } from "react"
import PropTypes from "prop-types"
import {
  Button, Checkbox, Input, Modal, Label,
  Radio, RadioGroup, Spinner, Switch, Tooltip, ListBox,
  Chip,
} from "@heroui/react"
import { LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuPlus, LuX, LuTrash2, LuShare2, LuRefreshCcw } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";
import { toast } from "react-hot-toast";

import { 
  createSharePolicy, createShareString, generateShareToken, updateChart, 
  updateSharePolicy, deleteSharePolicy 
} from "../../../slices/chart";
import { SITE_HOST } from "../../../config/settings";
import { ButtonSpinner } from "../../../components/ButtonSpinner";

function ChartSharing({ chart, isOpen, onClose }) {
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
      _generateTokenForPolicy(selectedPolicy);
    }
  }, [selectedPolicy]);

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
    } catch (error) {
      toast.error("Failed to generate share token");
    }
    setShareLoading(false);
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
    const changedExpirationDate = expirationDate !== selectedPolicy.expires_at && (expirationDate !== "" || expirationDate !== null);
    return changedExpirationDate || changedParams || changedAllowParams;
  };

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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium">Share Links</div>
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

        {sharePolicies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <LuShare2 className="mx-auto mb-2" size={24} />
            <div className="text-sm">No share links created yet</div>
            <div className="text-xs">Create your first share link to get started</div>
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
            className="w-full"
          >
            {sharePolicies.map((policy, index) => (
              <ListBox.Item
                key={policy.id.toString()}
                id={policy.id.toString()}
                textValue={`Link ${index + 1}`}
                className={`mb-2 ${selectedPolicy?.id === policy.id ? "bg-content3" : ""}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-row items-center gap-2">
                      <div className="font-medium">Link {index + 1}</div>
                      <Chip
                        variant="soft"
                        size="sm"
                        className="rounded-sm text-xs" >
                        {policy.allow_params ? "Allow params" : "No URL params"}
                      </Chip>
                    </div>
                    <div className="h-1" />
                    <div className="text-xs text-gray-500">
                      {policy.expires_at ? `Expires on ${new Date(policy.expires_at).toLocaleDateString()}` : "Never expires"}
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
      <div className="space-y-6">
        {shareToken && (
          <>
            <div className="space-y-4">
              <div>
                <Input
                  label="Embed Code"
                  labelPlacement="outside"
                  id="iframe-text"
                  value={_getEmbedString()}
                  fullWidth
                  readOnly
                  size="sm"
                  endContent={
                    <Button isIconOnly size="sm" variant="tertiary" onPress={_onCopyIframe}>
                      {iframeCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                    </Button>
                  }
                />
              </div>
              <div className="h-4" />
              <div>
                <Input
                  label="Direct Link"
                  labelPlacement="outside"
                  value={_getEmbedUrl()}
                  id="url-text"
                  fullWidth
                  readOnly
                  size="sm"
                  endContent={
                    <div className="flex flex-row items-center gap-1">
                      <Button isIconOnly size="sm" variant="tertiary" onPress={() => window.open(_getEmbedUrl(), "_blank")}>
                        <LuExternalLink />
                      </Button>
                      <Button isIconOnly size="sm" variant="tertiary" onPress={_onCopyUrl}>
                        {urlCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                      </Button>
                    </div>
                  }
                />
              </div>
            </div>
          </>
        )}

        <div>
          <RadioGroup
            orientation="horizontal"
            size="sm"
            value={embedTheme}
            onValueChange={(value) => setEmbedTheme(value)}
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
              <Tooltip>
                <Tooltip.Trigger>
                  <div className="text-gray-500"><LuInfo size={16} /></div>
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
              id="chart-sharing-allow-params"
              isSelected={allowParams}
              onChange={(selected) => setAllowParams(selected)}
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-sharing-allow-params" className="text-sm">Allow parameters in the URL</Label>
              </Checkbox.Content>
            </Checkbox>
            <Tooltip>
              <Tooltip.Trigger>
                <div className="text-gray-500"><LuInfo size={16} /></div>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-xs">
                When enabled, parameters and variables can be passed directly in the URL like ?param1=value1&param2=value2. This will mean that everyone who has the URL can change the parameters and variables in the chart.
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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-5xl">
            <Modal.Header className="flex flex-row items-center justify-between">
              <Modal.Heading className="font-bold">
                Embed & share your chart
              </Modal.Heading>
              <Switch
                id="chart-sharing-enable"
                isSelected={chart.shareable}
                onChange={_onToggleShareable}
                size="sm"
                className="mr-4"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label htmlFor="chart-sharing-enable">Enable sharing</Label>
                </Switch.Content>
              </Switch>
            </Modal.Header>
            <Modal.Body>
              {shareLoading && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" aria-label="Loading" />
                </div>
              )}

              {/* Enable/Disable Sharing Toggle */}
              <div>
                {chart.public && !chart.shareable && (
                  <div className="text-primary text-sm mt-2">
                    The chart is public. A public chart can be shared even if the sharing toggle is disabled.
                  </div>
                )}
                {!chart.public && !chart.shareable && (
                  <div className="text-primary text-sm mt-2">
                    The chart is private. Enable sharing to allow others outside your team to see the chart.
                  </div>
                )}
              </div>

              {/* Create sharing string button if needed */}
              {(chart.public || chart.shareable) && (!chart.Chartshares || chart.Chartshares.length === 0) && (!chart.SharePolicies || chart.SharePolicies.length === 0) && (
                <div className="mb-6">
                  <Button
                    onPress={_onCreateSharingString}
                    variant="primary"
                    size="sm"
                  >
                    Create a sharing code
                    <LuPlus />
                  </Button>
                </div>
              )}

              {/* Two-panel layout */}
              {(chart.shareable || chart.public) && ((chart.Chartshares && chart.Chartshares.length > 0) || (chart.SharePolicies && chart.SharePolicies.length > 0)) && !shareLoading && (
                <div className="grid grid-cols-12 gap-2 h-96">
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
            </Modal.Body>
            <Modal.Footer>
              {_hasUnsavedChanges() && (
                <Button
                  size="sm"
                  variant="primary"
                  onPress={_onUpdatePolicy}
                  isPending={isUpdating}
                >
                  <LuRefreshCcw size={16} />
                  Regenerate link
                </Button>
              )}
              <Button
                slot="close"
                variant="secondary"
                size="sm"
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

ChartSharing.propTypes = {
  chart: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default ChartSharing
