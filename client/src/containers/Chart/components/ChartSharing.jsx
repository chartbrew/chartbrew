import React, { useEffect, useState } from "react"
import PropTypes from "prop-types"
import {
  Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup,
  Spacer, Spinner, Switch,
} from "@heroui/react"
import { LuCopy, LuCopyCheck, LuPlus } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";
import { toast } from "react-hot-toast";

import { createShareString, generateShareToken, updateChart } from "../../../slices/chart";
import { SITE_HOST } from "../../../config/settings";

function ChartSharing({ chart, isOpen, onClose }) {
  const [shareLoading, setShareLoading] = useState(false);
  const [embedTheme, setEmbedTheme] = useState("os");
  const [iframeCopied, setIframeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [shareToken, setShareToken] = useState("");

  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    if (isOpen && chart?.Chartshares && chart.Chartshares.length > 0 && !shareToken) {
      _onGenerateShareToken();
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
    const data = await dispatch(generateShareToken({ project_id: params.projectId, chart_id: chart.id }));
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
    return `${SITE_HOST}/chart/${shareString}/embedded?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}`;
  };

  const _getEmbedString = () => {
    if (!chart.Chartshares || !chart.Chartshares[0]) return "";
    const shareString = chart.Chartshares && chart.Chartshares[0].shareString;
    return `<iframe src="${SITE_HOST}/chart/${shareString}/embedded?token=${shareToken}${embedTheme ? `&theme=${embedTheme}` : ""}" allowTransparency="true" width="700" height="300" scrolling="no" frameborder="0" style="background-color: #ffffff"></iframe>`;
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
                  <Button isIconOnly size="sm" variant="flat" onPress={_onCopyUrl}>
                    {urlCopied ? <LuCopyCheck className="text-success" /> : <LuCopy />}
                  </Button>
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
