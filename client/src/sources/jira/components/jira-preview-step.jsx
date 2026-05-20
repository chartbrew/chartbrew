import React from "react";
import { Button, Card, Table } from "@heroui/react";
import { LuPlay } from "react-icons/lu";

import AceEditor from "../../../components/CodeEditor";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import { PREVIEW_ROW_LIMIT } from "../jira-builder.constants";
import { formatPreviewValue } from "../jira-builder.utils";
import { useJiraBuilder } from "./jira-builder-context";

function JiraPreviewStep() {
  const {
    hasPreviewResult,
    previewFallback,
    previewColumns,
    previewRows,
    previewSummary,
    requestLoading,
    testRequest,
  } = useJiraBuilder();

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-accent">Step 3</span>
            <span className="text-base font-semibold text-foreground">Test your configuration</span>
          </div>
          <Button
            isPending={requestLoading}
            onPress={testRequest}
            variant="primary"
          >
            {requestLoading ? <ButtonSpinner /> : <LuPlay size={16} />}
            {hasPreviewResult ? "Re-run" : "Run test"}
          </Button>
        </div>

        {!hasPreviewResult && (
          <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-divider bg-surface-secondary/50 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">
              <LuPlay size={24} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Run a test to see a live sample of your Jira data
              </p>
              <p className="text-sm text-muted">
                Uses your current configuration to fetch a preview.
              </p>
            </div>
          </div>
        )}

        {hasPreviewResult && previewRows.length > 0 && previewColumns.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">Preview rows</span>
              <span className="text-muted">{previewSummary}</span>
            </div>

            <Table className="border border-divider shadow-none">
              <Table.ScrollContainer>
                <Table.Content aria-label="Jira configuration preview" className="min-w-[760px]">
                  <Table.Header>
                    {previewColumns.map((column, index) => (
                      <Table.Column key={column} id={column} isRowHeader={index === 0}>
                        {column}
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body>
                    {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => (
                      <Table.Row key={`${row.key || row.period || "row"}-${index}`} id={`${row.key || row.period || "row"}-${index}`}>
                        {previewColumns.map((column) => (
                          <Table.Cell key={column}>
                            <span className="block max-w-[220px] truncate" title={formatPreviewValue(row[column])}>
                              {formatPreviewValue(row[column])}
                            </span>
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}

        {hasPreviewResult && (previewRows.length === 0 || previewColumns.length === 0) && (
          <AceEditor
            mode="json"
            theme="tomorrow"
            value={previewFallback}
            readOnly
            height="260px"
            width="100%"
          />
        )}
      </Card.Content>
    </Card>
  );
}

export default JiraPreviewStep;
