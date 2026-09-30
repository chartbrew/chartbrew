import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Modal, Tabs, Tooltip } from "@heroui/react";
import {
  LuArrowLeft, LuHistory, LuInfo, LuChevronDown, LuChevronUp, LuPanelLeftClose, LuSlidersHorizontal,
} from "react-icons/lu";

import { getChartStudioPreviewState } from "../chartStudioState";
import { ChartHistoryList } from "./ChartHistory";
import ChartbrewAiIcon from "../../../components/ChartbrewAiIcon";

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}

function ChartStudio({
  actions,
  initiallyOpenChat = false,
  chat,
  dataView,
  identity,
  history,
  historyBanner,
  onBack,
  onSettingsSectionChange,
  renderPreview,
  settings,
  settingsSection,
}) {
  const [panel, setPanel] = useState("chat");
  const historical = history?.selected != null;
  const viewportWidth = useViewportWidth();
  const [chatOpen, setChatOpen] = useState(() => initiallyOpenChat || !window.matchMedia("(max-width: 900px)").matches);
  const [chatWidth, setChatWidth] = useState(320);
  const [previewView, setPreviewView] = useState("chart");
  const [settingsHeight, setSettingsHeight] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const bodyRef = useRef(null);
  const chatPanelRef = useRef(null);
  const chatTriggerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const previewState = getChartStudioPreviewState(viewportWidth, previewView);
  const mobile = previewState.mode === "mobile";
  const wide = previewState.mode === "wide";

  useEffect(() => {
    if (initiallyOpenChat) {
      setChatOpen(true);
      setPanel("chat");
    } else if (mobile) setChatOpen(false);
  }, [mobile, initiallyOpenChat]);

  useEffect(() => {
    if (!mobile || !chatOpen || panel === "history") return undefined;
    const panelElement = chatPanelRef.current;
    const focusable = () => [...panelElement.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )];
    const focusTimer = window.setTimeout(() => focusable()[0]?.focus(), 50);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setChatOpen(false);
        window.requestAnimationFrame(() => {
          const returnTarget = previousFocusRef.current || chatTriggerRef.current;
          returnTarget?.focus();
        });
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panelElement.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      panelElement.removeEventListener("keydown", onKeyDown);
    };
  }, [chatOpen, mobile, panel]);

  useEffect(() => {
    if (panel === "history" && chatOpen) history.reload();
  }, [panel, chatOpen, history?.configurationVersion, history?.reload]);

  const openHistory = () => {
    previousFocusRef.current = document.activeElement;
    setPanel("history");
    setChatOpen(true);
  };

  const selectVersion = (version) => {
    history.select(version);
    if (mobile) setChatOpen(false);
  };

  const openChat = () => {
    setPanel("chat");
    previousFocusRef.current = document.activeElement;
    setChatOpen(true);
  };

  const closeChat = () => {
    setChatOpen(false);
    window.requestAnimationFrame(() => {
      const returnTarget = previousFocusRef.current || chatTriggerRef.current;
      returnTarget?.focus();
    });
  };

  const previewTabs = previewState.showTabs ? (
    <Tabs
      aria-label="Preview view"
      onSelectionChange={(key) => setPreviewView(`${key}`)}
      selectedKey={previewView}
      size="sm"
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Preview view">
          <Tabs.Tab id="chart">
            Chart
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="data">
            Data
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  ) : null;

  return (
    <main className="chart-studio-page">
      <div className="chart-studio-shell">
        <header className="chart-studio-topbar">
          <div className="chart-studio-identity">
            <Button aria-label="Back to dashboard" isIconOnly onPress={onBack} size="sm" variant="ghost">
              <LuArrowLeft aria-hidden size={18} />
            </Button>
            {identity}
          </div>
          <div className="chart-studio-actions">
            <Button
              aria-pressed={panel === "history" && chatOpen}
              onPress={panel === "history" && chatOpen ? openChat : openHistory}
              size="sm"
              variant={panel === "history" && chatOpen ? "secondary" : "ghost"}
            >
              <LuHistory aria-hidden />
              History
            </Button>
            {actions}
          </div>
        </header>

        <div className="chart-studio-body" ref={bodyRef} style={{ "--chart-studio-chat-width": `${chatWidth}px` }}>
          {mobile || !chatOpen ? (
            <nav className="chart-studio-tool-rail" aria-label="Chart Studio tools">
              <Button isDisabled={historical} onPress={openChat} ref={chatTriggerRef} variant="ghost">
                <ChartbrewAiIcon />
                <span>Ask AI</span>
              </Button>
            </nav>
          ) : null}

          {mobile && chatOpen && panel === "chat" ? (
            <button aria-label="Close chart assistant" className="chart-studio-chat-backdrop" onClick={closeChat} type="button" />
          ) : null}

          <aside
            aria-label={panel === "history" ? "Version history" : "Chart assistant"}
            aria-modal={mobile && chatOpen ? "true" : undefined}
            className={`chart-studio-side ${chatOpen && !(mobile && panel === "history") ? "is-open" : "is-closed"}`}
            ref={chatPanelRef}
            role={mobile ? "dialog" : undefined}
          >
            <div className="chart-studio-panel-heading">
              <span>
                {panel === "history" ? <LuHistory aria-hidden /> : <ChartbrewAiIcon />}
                {panel === "history" ? "Version history" : "Chart assistant"}
                {panel === "history" ? (
                  <Tooltip>
                    <Tooltip.Trigger aria-label="History limit" className="rounded-md p-2 text-muted">
                      <LuInfo aria-hidden />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Keeps the latest 100 versions</Tooltip.Content>
                  </Tooltip>
                ) : null}
              </span>
              {panel === "history" ? (
                <Tooltip>
                  <Button aria-label="Ask AI" isDisabled={historical} isIconOnly onPress={openChat} size="sm" variant="ghost">
                    <ChartbrewAiIcon />
                  </Button>
                  <Tooltip.Content>Ask AI</Tooltip.Content>
                </Tooltip>
              ) : (
                <Button aria-label="Close side panel" isIconOnly onPress={closeChat} size="sm" variant="ghost">
                  <LuPanelLeftClose aria-hidden />
                </Button>
              )}
            </div>
            <div className={`min-h-0 flex-1 ${panel === "chat" ? "" : "hidden"}`}>{chat}</div>
            {panel === "history" ? (
              <ChartHistoryList history={history} onSelect={selectVersion} />
            ) : null}
          </aside>

          <Modal.Backdrop isOpen={mobile && chatOpen && panel === "history"} onOpenChange={(open) => { if (!open) closeChat(); }}>
            <Modal.Container size="sm">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Version history</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="min-h-0 p-0">
                  <ChartHistoryList history={history} onSelect={selectVersion} />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>

          {chatOpen && !mobile ? (
            <div
              aria-label="Resize chart assistant"
              aria-orientation="vertical"
              aria-valuemax={440}
              aria-valuemin={260}
              aria-valuenow={chatWidth}
              className="chart-studio-divider-vertical"
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                event.preventDefault();
                setChatWidth(Math.max(260, Math.min(440, chatWidth + (event.key === "ArrowRight" ? 20 : -20))));
              }}
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId) || !bodyRef.current) return;
                const left = bodyRef.current.getBoundingClientRect().left;
                setChatWidth(Math.max(260, Math.min(440, event.clientX - left)));
              }}
              onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
              role="separator"
              tabIndex={0}
            />
          ) : null}

          <div
            className={`chart-studio-main ${settingsOpen ? "" : "is-settings-hidden"} ${historical ? "is-history-preview" : ""}`}
            style={{ "--chart-studio-settings-height": settingsHeight === null ? "calc(50% - 3.5px)" : `${settingsHeight}px` }}
          >
            {historyBanner}
            <section className={`chart-studio-preview ${previewState.showChart ? "" : "is-hidden"}`}>
              {renderPreview(previewState.showTabs && previewState.showChart ? previewTabs : null)}
            </section>
            <section
              aria-label="Chart data"
              className={`chart-studio-data-view ${previewState.showData ? "" : "is-hidden"}`}
            >
              {previewState.showTabs ? <div className="chart-studio-data-toolbar">{previewTabs}</div> : null}
              <div className="chart-studio-data-content">{dataView}</div>
            </section>

            {settingsOpen && !historical && !mobile && !wide ? (
              <div
                aria-label="Resize chart settings"
                aria-orientation="horizontal"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={settingsHeight === null ? 50 : Math.round(settingsHeight / (bodyRef.current.clientHeight - 7) * 100)}
                className="chart-studio-divider-horizontal"
                onKeyDown={(event) => {
                  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  const currentHeight = event.currentTarget.nextElementSibling.getBoundingClientRect().height;
                  const maxHeight = event.currentTarget.parentElement.clientHeight - 247;
                  setSettingsHeight(Math.max(220, Math.min(maxHeight, currentHeight + (event.key === "ArrowUp" ? 20 : -20))));
                }}
                onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const parentBottom = event.currentTarget.parentElement.getBoundingClientRect().bottom;
                  const maxHeight = event.currentTarget.parentElement.clientHeight - 247;
                  setSettingsHeight(Math.max(220, Math.min(maxHeight, parentBottom - event.clientY)));
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                role="separator"
                tabIndex={0}
              ><span /></div>
            ) : null}

            <section className={`chart-studio-settings ${settingsOpen && !historical ? "" : "is-hidden"}`} aria-label="Chart settings">
              <div className="chart-studio-settings-heading">
                <Tabs
                  aria-label="Chart settings"
                  onSelectionChange={(key) => onSettingsSectionChange(`${key}`)}
                  selectedKey={settingsSection}
                  size="sm"
                  variant="secondary"
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Chart settings">
                      <Tabs.Tab id="data">Data<Tabs.Indicator /></Tabs.Tab>
                      <Tabs.Tab id="appearance">Appearance<Tabs.Indicator /></Tabs.Tab>
                      <Tabs.Tab id="automation">Automation<Tabs.Indicator /></Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
                <Button
                  aria-label="Hide chart settings"
                  isIconOnly={wide || mobile}
                  onPress={() => setSettingsOpen(false)}
                  size="sm"
                  variant="ghost"
                >
                  <LuChevronDown aria-hidden />
                  {!wide && !mobile ? "Hide settings" : null}
                </Button>
              </div>
              <div className="chart-studio-settings-content">{settings}</div>
            </section>

            {!settingsOpen && !historical ? (
              <div className="chart-studio-settings-collapsed">
                <span>Chart settings</span>
                <Button onPress={() => setSettingsOpen(true)} size="sm" variant="ghost">
                  <LuSlidersHorizontal aria-hidden />
                  Show settings
                  <LuChevronUp aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

ChartStudio.propTypes = {
  initiallyOpenChat: PropTypes.bool,
  actions: PropTypes.node.isRequired,
  chat: PropTypes.node.isRequired,
  dataView: PropTypes.node.isRequired,
  identity: PropTypes.node.isRequired,
  history: PropTypes.object.isRequired,
  historyBanner: PropTypes.node,
  onBack: PropTypes.func.isRequired,
  onSettingsSectionChange: PropTypes.func.isRequired,
  renderPreview: PropTypes.func.isRequired,
  settings: PropTypes.node.isRequired,
  settingsSection: PropTypes.oneOf(["data", "appearance", "automation"]).isRequired,
};

export default ChartStudio;
