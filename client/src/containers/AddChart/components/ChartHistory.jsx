import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Description, Label, ListBox, Modal, Spinner } from "@heroui/react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";

import { chartRequest } from "../../../api/chartHistory";
import { getChart, updateLocalChart } from "../../../slices/chart";
import ChartRenderer from "../../Chart/components/ChartRenderer";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

export function useChartHistory(chart) {
  const dispatch = useDispatch();
  const [page, setPage] = useState({ versions: [], nextBefore: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [canRestore, setCanRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const selectionRequest = useRef(0);
  const listRequest = useRef(0);
  const restoreOperation = useRef(null);
  const { id, project_id: projectId, configurationVersion } = chart;

  const reload = useCallback(async (before) => {
    if (!id) return;
    const request = ++listRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await chartRequest(projectId, id, `/versions${before ? `?before=${before}` : ""}`);
      if (request !== listRequest.current) return;
      setPage((previous) => ({ ...result, versions: before ? [...previous.versions, ...result.versions] : result.versions }));
    } catch (failure) {
      if (request === listRequest.current) setError(failure.message);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, [id, projectId]);

  useEffect(() => {
    setSelected(null);
    setPreview(null);
    setPage({ versions: [], nextBefore: null });
    return () => { selectionRequest.current += 1; listRequest.current += 1; };
  }, [id]);

  const select = async (version) => {
    const request = ++selectionRequest.current;
    setSelected(version);
    setPreview(null);
    setPreviewError("");
    setCanRestore(false);
    setRestoreError("");
    restoreOperation.current = null;
    if (version === null) {
      await dispatch(getChart({ project_id: projectId, chart_id: id }));
      return;
    }
    try {
      const detail = await chartRequest(projectId, id, `/versions/${version}`);
      if (request !== selectionRequest.current) return;
      setCanRestore(detail.canRestore);
      const result = await chartRequest(projectId, id, `/versions/${version}/preview`, "POST");
      if (request === selectionRequest.current) setPreview(result);
    } catch (failure) {
      if (request === selectionRequest.current) setPreviewError(failure.message);
    }
  };

  const restore = async () => {
    setRestoring(true);
    setRestoreError("");
    restoreOperation.current ||= { operationId: crypto.randomUUID(), expectedVersion: configurationVersion };
    try {
      const result = await chartRequest(projectId, id, `/versions/${selected}/restore`, "POST", restoreOperation.current);
      selectionRequest.current += 1;
      dispatch(updateLocalChart({ id, data: result }));
      setSelected(null);
      setPreview(null);
      await reload();
      toast.success("Chart version restored");
      return true;
    } catch (failure) {
      setRestoreError(failure.message);
      if (failure.status === 409) restoreOperation.current = null;
      return false;
    } finally {
      setRestoring(false);
    }
  };

  return {
    ...page, loading, error, selected, preview, previewError, canRestore, restoring, restoreError,
    reload, select, restore, configurationVersion, currentVersion: page.configurationVersion ?? configurationVersion,
  };
}

export function ChartHistoryList({ history, onSelect }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4">
      {history.loading && !history.versions.length ? <Spinner aria-label="Loading history" /> : null}
      {history.error ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-sm">{history.error}</p>
          <Button onPress={() => history.reload()} size="sm" variant="secondary">Retry</Button>
        </div>
      ) : null}
      {!history.loading && !history.error && !history.versions.length ? (
        <p className="text-sm text-muted">No earlier versions. History starts with your next saved change.</p>
      ) : null}
      <ListBox
        aria-label="Chart versions"
        className="gap-2 p-0"
        onSelectionChange={(keys) => {
          const version = Number([...keys][0]);
          if (version) onSelect(version === history.currentVersion ? null : version);
        }}
        selectedKeys={new Set([history.selected ?? history.configurationVersion])}
        selectionMode="single"
      >
        {history.versions.map((version) => (
          <ListBox.Item className="items-start rounded-lg p-3" id={version.version} key={version.version} textValue={version.summary}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="whitespace-normal text-sm font-semibold">{version.summary}</Label>
              <Description className="whitespace-normal text-xs">
                {version.author ? `${version.author}${version.origin === "ai" ? " with AI" : ""} · ` : ""}
                {formatDate(version.createdAt)}
              </Description>
              <span className="text-xs text-muted">
                Version {version.version}{version.version === history.currentVersion ? " · Current" : ""}
              </span>
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
      {history.nextBefore ? (
        <Button isPending={history.loading} onPress={() => history.reload(history.nextBefore)} size="sm" variant="secondary">
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export function ChartHistoryBanner({ history, onRestored }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="chart-history-banner">
        <div className="flex flex-col gap-1" role="status">
          <strong className="text-sm">Viewing version {history.selected}</strong>
          <span className="text-xs text-muted">Saved settings, current data</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button isDisabled={history.restoring} onPress={() => history.select(null)} size="sm" variant="ghost">
            Back to latest
          </Button>
          <Button isDisabled={!history.canRestore || history.restoring} onPress={() => setConfirm(true)} size="sm" variant="primary">
            Restore version
          </Button>
        </div>
      </div>
      <Modal.Backdrop isDismissable={!history.restoring} isOpen={confirm} onOpenChange={setConfirm}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Restore version {history.selected}?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>This saves the selected chart settings as a new version. Shared datasets and alerts stay unchanged.</p>
              <p>Unsaved changes in the editor will be discarded.</p>
              {history.restoreError ? <p className="text-danger" role="alert">{history.restoreError}</p> : null}
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={history.restoring} onPress={() => setConfirm(false)} variant="secondary">Cancel</Button>
              <Button isPending={history.restoring} onPress={async () => {
                if (await history.restore()) { setConfirm(false); onRestored(); }
              }} variant="primary">Restore version</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export function ChartHistoryPreview({ history, viewControl }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(300);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setHeight(Math.max(240, entry.contentRect.height)));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="chart-studio-preview-content flex h-full min-h-80 min-w-0 flex-col">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 className="min-w-0 truncate text-lg font-semibold">{history.preview?.name}</h2>
        {viewControl}
      </div>
      <div className="chart-studio-chart-canvas w-full min-w-0" ref={ref}>
        {history.previewError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4" role="alert">
            <p className="text-sm">{history.previewError}</p>
            <Button onPress={() => history.select(history.selected)} size="sm" variant="secondary">Retry preview</Button>
          </div>
        ) : history.preview ? (
          <div className="h-full w-full min-h-0 min-w-0">
            <ChartRenderer chart={history.preview} editMode height={height} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Spinner aria-label="Loading version preview" />
          </div>
        )}
      </div>
    </div>
  );
}

ChartHistoryList.propTypes = { history: PropTypes.object.isRequired, onSelect: PropTypes.func.isRequired };
ChartHistoryBanner.propTypes = { history: PropTypes.object.isRequired, onRestored: PropTypes.func.isRequired };
ChartHistoryPreview.propTypes = { history: PropTypes.object.isRequired, viewControl: PropTypes.node };
