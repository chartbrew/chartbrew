import React, { useEffect, useState } from "react"
import PropTypes from "prop-types"
import {
  Button, Checkbox, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup,
  Spacer, Spinner, Switch,
  Tooltip,
} from "@heroui/react"
import { LuCopy, LuCopyCheck, LuExternalLink, LuInfo, LuPlus, LuX } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";
import { toast } from "react-hot-toast";

import { createSharePolicy, createShareString, generateShareToken, updateChart } from "../../../slices/chart";
import { SITE_HOST } from "../../../config/settings";

function ChartSharing({ chart, isOpen, onClose }) {
  const [shareLoading, setShareLoading] = useState(false);
  const [embedTheme, setEmbedTheme] = useState("os");
  const [iframeCopied, setIframeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [parameters, setParameters] = useState([]);
  const [allowParams, setAllowParams] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");

  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    if (isOpen && chart?.Chartshares && chart.Chartshares.length > 0 && !shareToken) {
      _onGenerateShareToken();
      setParameters(chart?.SharePolicy?.params || []);
      setAllowParams(chart?.SharePolicy?.allow_params || false);
    }
  }, [shareToken, chart, isOpen]);

  const _onToggleShareable = async () => {
    // first, check if the chart has a share string
    if (!chart.Chartshares || chart.Chartshares.length === 0) {
      setShareLoading(true);
      await dispatch(createShareString({ project_id: params.projectId, chart_id: chart.id }));
      _onGenerateShareToken();
    }

    await dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { shareable: !chart.shareable },
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
  };

  const _getEmbedUrl = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    let url = `${SITE_HOST}/chart/${shareString}/embedded?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}`;
    
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
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    let url = `${SITE_HOST}/chart/${shareString}/embedded?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}`;
    
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

  const _onSaveSharePolicy = async () => {
    setShareLoading(true);
    const data = await dispatch(generateShareToken({
      project_id: params.projectId,
      chart_id: chart.id,
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
    const filteredChartParams = filterCompleteParams(chart?.SharePolicy?.params);

    const changedParams = JSON.stringify(filteredParameters) !== JSON.stringify(filteredChartParams);
    const changedAllowParams = allowParams !== chart?.SharePolicy?.allow_params;
    return expirationDate || changedParams || changedAllowParams;
  };

  const _onCreateSharePolicy = async () => {
    setShareLoading(true);
    await dispatch(createSharePolicy({ project_id: params.projectId, chart_id: chart.id }));
    _onGenerateShareToken();
    setShareLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalContent>
        <ModalHeader>
          <div className="font-bold">{"Embed & share your chart"}</div>
        </ModalHeader>
        <ModalBody>
          {shareLoading && (<Spinner variant="simple" size="sm" aria-label="Sharing chart" />)}
          <Switch
            label={chart.shareable ? "Disable sharing" : "Enable sharing"}
            onChange={_onToggleShareable}
            isSelected={chart.shareable}
            size="sm"
          >
            Enable sharing
          </Switch>
          <Spacer y={2} />
          {chart.public && !chart.shareable && (
            <div className="text-primary">
              {"The chart is public. A public chart can be shared even if the sharing toggle is disabled. This gives you more flexibility if you want to hide the chart from the public dashboard but you still want to individually share it."}
            </div>
          )}
          {!chart.public && !chart.shareable && (
            <>
              <Spacer y={2} />
              <div className="text-primary">
                {"The chart is private. A private chart can only be seen by members of the team. If you enable sharing, others outside of your team can see the chart with the sharing code or when embedded on other websites."}
              </div>
            </>
          )}
          {(chart.public || chart.shareable) && (!chart.Chartshares || chart.Chartshares.length === 0) && (
            <>
              <Spacer y={2} />
              <div>
                <Button
                  endContent={<LuPlus />}
                  onPress={_onCreateSharingString}
                  color="primary"
                  size="sm"
                >
                  Create a sharing code
                </Button>
              </div>
            </>
          )}

          {shareLoading && (
            <div className="flex items-center justify-center">
              <Spinner variant="simple" size="sm" aria-label="Creating sharing code" />
            </div>
          )}

          {(chart.shareable || chart.public) && (chart.Chartshares && chart.Chartshares.length > 0) && !shareLoading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <RadioGroup
                  label="Select a theme"
                  orientation="horizontal"
                  size="sm"
                  value={embedTheme}
                  onValueChange={(value) => setEmbedTheme(value)}
                >
                  <Radio value="os" checked={embedTheme === ""}>
                    System default
                  </Radio>
                  <Radio value="dark" checked={embedTheme === "dark"}>
                    Dark
                  </Radio>
                  <Radio value="light" checked={embedTheme === "light"}>
                    Light
                  </Radio>
                </RadioGroup>
              </div>
              <Spacer y={1} />
              {chart.SharePolicy && (
                <>
                  <div>
                    <div className="flex flex-row justify-between items-center">
                      <div className="flex flex-row items-center gap-2">
                        <div className="text-gray-500">{"Parameters"}</div>
                        <Tooltip content="Parameters allow you to pass data to variables in your chart's datasets.">
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
                        content="When enabled, parameters and variables can be passed directly in the URL like ?param1=value1&param2=value2. This will mean that everyone who has the URL can change the parameters and variables in the chart."
                        className="max-w-xs"
                      >
                        <div className="text-gray-500"><LuInfo size={16} /></div>
                      </Tooltip>
                    </div>
                  </div>

                  <Spacer y={2} />
                  <div>
                    <div className="text-gray-500">{"Set links to expire"}</div>
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
                </>
              )}
              {!chart.SharePolicy && (
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
                    {"This chart is using legacy sharing links. You can enable signed links to better control and secure the chart. Please be aware that this operation will break existing links you already shared or embedded on other websites."}
                  </div>
                </div>
              )}
              <Spacer y={1} />
              <Divider />
              <Spacer y={1} />
              <div>
                <Input
                  label={"Embed the chart on your website"}
                  labelPlacement="outside"
                  id="iframe-text"
                  value={_getEmbedString()}
                  fullWidth
                  readOnly
                  endContent={
                    <Button isIconOnly size="sm" variant="flat" onPress={_onCopyIframe}>
                      {iframeCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                    </Button>
                  }
                />
              </div>

              <Spacer y={1} />
              <Input
                label={"Direct link to the chart"}
                labelPlacement="outside"
                value={_getEmbedUrl()}
                id="url-text"
                fullWidth
                readOnly
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
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="bordered"
            onPress={onClose}
            size="sm"
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

ChartSharing.propTypes = {
  chart: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
}

export default ChartSharing
