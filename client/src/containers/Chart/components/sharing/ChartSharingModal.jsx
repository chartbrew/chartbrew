import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Modal, Tabs } from "@heroui/react";
import { LuCopy, LuDownload, LuImage, LuLink, LuRefreshCcw } from "react-icons/lu";
import { useSelector } from "react-redux";

import { selectProject } from "../../../../slices/project";
import { selectTeam } from "../../../../slices/team";
import LinksEmbedTab from "./LinksEmbedTab";
import ShareImageTab from "./ShareImageTab";

function ChartSharingModal({
  canExportImage,
  canManageLinks,
  chart,
  getSourceSize,
  isOpen,
  onClose,
}) {
  const project = useSelector(selectProject) || {};
  const team = useSelector(selectTeam) || {};
  const firstTab = canManageLinks ? "links" : "image";
  const [selectedTab, setSelectedTab] = useState(firstTab);
  const [imageVisited, setImageVisited] = useState(firstTab === "image");
  const [linkAction, setLinkAction] = useState(null);
  const [imageAction, setImageAction] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTab(firstTab);
      setImageVisited(firstTab === "image");
    } else {
      setLinkAction(null);
      setImageAction(null);
    }
  }, [firstTab, isOpen]);

  const handleTabChange = (key) => {
    const nextTab = `${key}`;
    setSelectedTab(nextTab);
    if (nextTab === "image") setImageVisited(true);
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="h-[min(88dvh,820px)] w-[calc(100vw-2rem)] overflow-hidden sm:max-w-6xl">
            <Modal.CloseTrigger />
            <Modal.Header className="shrink-0 pb-2">
              <div className="min-w-0">
                <Modal.Heading className="text-lg font-bold">Share your chart</Modal.Heading>
                <div className="mt-0.5 truncate text-sm text-foreground-500">
                  {chart.name}{project.name ? ` · ${project.name}` : ""}
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="flex min-h-0 flex-1 overflow-hidden p-0">
              <Tabs
                className="flex min-h-0 flex-1 flex-col gap-0"
                selectedKey={selectedTab}
                variant="secondary"
                onSelectionChange={handleTabChange}
              >
                <Tabs.ListContainer className="shrink-0">
                  <Tabs.List aria-label="Chart sharing options" className="!w-auto">
                    {canManageLinks && (
                      <Tabs.Tab className="!w-auto !flex-none" id="links">
                        <span className="inline-flex items-center gap-2">
                          <LuLink size={16} aria-hidden />
                          Links & embed
                        </span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    )}
                    {canExportImage && (
                      <Tabs.Tab className="!w-auto !flex-none" id="image">
                        <span className="inline-flex items-center gap-2">
                          <LuImage size={16} aria-hidden />
                          Share image
                        </span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    )}
                  </Tabs.List>
                </Tabs.ListContainer>

                {canManageLinks && (
                  <Tabs.Panel className="mt-0 flex min-h-0 flex-1 overflow-hidden p-0" id="links">
                    <LinksEmbedTab chart={chart} isOpen={isOpen} onActionChange={setLinkAction} />
                  </Tabs.Panel>
                )}
                {canExportImage && (
                  <Tabs.Panel className="mt-0 flex min-h-0 flex-1 overflow-y-auto p-0 lg:overflow-hidden" id="image">
                    {isOpen && imageVisited && (
                      <ShareImageTab
                        chart={chart}
                        getSourceSize={getSourceSize}
                        isActive={selectedTab === "image"}
                        onActionChange={setImageAction}
                        project={project}
                        team={team}
                      />
                    )}
                  </Tabs.Panel>
                )}
              </Tabs>
            </Modal.Body>

            <Modal.Footer className="shrink-0 gap-2 pt-3 border-t border-divider">
              <Button slot="close" variant="secondary" size="sm">Close</Button>
              {selectedTab === "links" && linkAction?.hasUnsaved && (
                <Button
                  size="sm"
                  variant="primary"
                  isPending={linkAction.isUpdating}
                  onPress={linkAction.onSave}
                >
                  <LuRefreshCcw size={16} />
                  Save and regenerate link
                </Button>
              )}
              {selectedTab === "image" && imageAction?.supported && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={Boolean(imageAction.activeAction && imageAction.activeAction !== "download")}
                    isPending={imageAction.activeAction === "download"}
                    onPress={imageAction.onDownload}
                  >
                    <LuDownload size={16} />
                    Download image
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={Boolean(imageAction.activeAction && imageAction.activeAction !== "copy")}
                    isPending={imageAction.activeAction === "copy"}
                    onPress={imageAction.onCopy}
                  >
                    <LuCopy size={16} />
                    Copy image
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

ChartSharingModal.propTypes = {
  canExportImage: PropTypes.bool.isRequired,
  canManageLinks: PropTypes.bool.isRequired,
  chart: PropTypes.object.isRequired,
  getSourceSize: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ChartSharingModal;
