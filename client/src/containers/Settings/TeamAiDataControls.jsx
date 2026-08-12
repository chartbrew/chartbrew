import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button,
  EmptyState,
  Modal,
  ProgressCircle,
  Table,
} from "@heroui/react";
import toast from "react-hot-toast";
import {
  LuArrowDownToLine,
  LuHistory,
  LuShare2,
} from "react-icons/lu";
import { useSelector } from "react-redux";

import {
  getOrchestratorActionAudit,
  getOrchestratorEgressAudit,
  getWorkspaceLearningExport,
} from "../../api/workspaceLearning";
import {
  formatActionLabel,
  formatChangedFields,
  formatContextSections,
  formatContextVolume,
  formatDate,
  formatPurpose,
  formatResult,
} from "../../modules/workspaceAuditFormat";
import { selectTeam } from "../../slices/team";

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  }));
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function AuditModal({ data, error, isLoading, mode, onOpenChange, onRetry, open }) {
  const isActions = mode === "actions";
  const items = data?.items || [];
  return (
    <Modal>
      <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container size="xl">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isActions ? "AI changes history" : "External AI sharing history"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {isLoading ? (
                <div className="flex min-h-52 items-center justify-center">
                  <ProgressCircle aria-label="Loading history" />
                </div>
              ) : error ? (
                <EmptyState className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
                  <span className="text-sm text-muted">{error}</span>
                  <Button onPress={onRetry} size="sm" variant="secondary">
                    Try again
                  </Button>
                </EmptyState>
              ) : (
                <Table className="min-h-52 shadow-none">
                  <Table.ScrollContainer>
                    <Table.Content aria-label={isActions ? "AI changes" : "External AI sharing"}>
                      <Table.Header>
                        <Table.Column id="date" isRowHeader>Date</Table.Column>
                        {isActions ? <Table.Column id="person">Person</Table.Column> : null}
                        {isActions ? <Table.Column id="dashboard">Dashboard</Table.Column> : null}
                        <Table.Column id="event">
                          {isActions ? "Change" : "Question"}
                        </Table.Column>
                        <Table.Column id="details">
                          {isActions ? "Details" : "Information shared"}
                        </Table.Column>
                        {!isActions ? <Table.Column id="volume">Amount</Table.Column> : null}
                        <Table.Column id="result">Result</Table.Column>
                      </Table.Header>
                      <Table.Body renderEmptyState={() => (
                        <EmptyState className="flex min-h-40 items-center justify-center text-sm text-muted">
                          {isActions ? "No AI changes yet" : "No workspace data has been shared with external AI"}
                        </EmptyState>
                      )}>
                        {items.map((item, index) => (
                          <Table.Row id={`${mode}-${index}`} key={`${mode}-${index}`}>
                            <Table.Cell>{formatDate(item.completedAt || item.createdAt)}</Table.Cell>
                            {isActions ? (
                              <Table.Cell>
                                {item.actor?.name || item.actor?.email || "Former member"}
                              </Table.Cell>
                            ) : null}
                            {isActions ? (
                              <Table.Cell>{item.projectName || "Team-wide"}</Table.Cell>
                            ) : null}
                            <Table.Cell>
                              {isActions
                                ? formatActionLabel(item.actionType)
                                : formatPurpose(item.purpose)}
                            </Table.Cell>
                            <Table.Cell>
                              {isActions
                                ? formatChangedFields(item.changedFields)
                                : formatContextSections(item.contextManifest)}
                            </Table.Cell>
                            {!isActions ? (
                              <Table.Cell>{formatContextVolume(item.contextManifest)}</Table.Cell>
                            ) : null}
                            <Table.Cell>
                              {formatResult(isActions ? item.status : item.contextManifest?.resultStatus)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

AuditModal.propTypes = {
  data: PropTypes.shape({ items: PropTypes.arrayOf(PropTypes.object) }),
  error: PropTypes.string,
  isLoading: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(["actions", "egress"]).isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

function TeamAiDataControls() {
  const team = useSelector(selectTeam);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [historyMode, setHistoryMode] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await getWorkspaceLearningExport(team.id);
      const teamName = `${team.name || "team"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadJson(data, `chartbrew-${teamName}-ai-data.json`);
      toast.success("AI data exported");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const openHistory = async (mode) => {
    setHistoryMode(mode);
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      setHistory(mode === "actions"
        ? await getOrchestratorActionAudit(team.id)
        : await getOrchestratorEgressAudit(team.id));
    } catch (error) {
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-divider bg-surface p-4" aria-labelledby="ai-data-heading">
      <h2 className="font-tw text-lg font-semibold" id="ai-data-heading">AI data</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button isPending={exporting} onPress={exportData} variant="secondary">
          <LuArrowDownToLine size={17} aria-hidden />
          Export AI data
        </Button>
        <Button onPress={() => openHistory("actions")} variant="secondary">
          <LuHistory size={17} aria-hidden />
          AI changes history
        </Button>
        <Button onPress={() => openHistory("egress")} variant="secondary">
          <LuShare2 size={17} aria-hidden />
          External AI sharing history
        </Button>
      </div>

      <AuditModal
        data={history}
        error={historyError}
        isLoading={historyLoading}
        mode={historyMode || "actions"}
        onOpenChange={(open) => {
          if (open) return;
          setHistory(null);
          setHistoryError(null);
          setHistoryMode(null);
        }}
        onRetry={() => openHistory(historyMode || "actions")}
        open={Boolean(historyMode)}
      />
    </section>
  );
}

export default TeamAiDataControls;
