import React from "react";
import { Button, Card, Table } from "@heroui/react";
import { LuPlay } from "react-icons/lu";

import AceEditor from "../../../components/CodeEditor";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import { PREVIEW_ROW_LIMIT } from "../stripeOfficial-builder.constants";
import {
  formatMaxRecords,
  formatPreviewCellValue,
  formatPreviewColumnLabel,
} from "../stripeOfficial-builder.utils";
import { useStripeOfficialBuilder } from "./stripeOfficial-builder-context";

function StripeOfficialPreviewStep() {
  const {
    previewColumns,
    previewRecordsProcessed,
    previewRows,
    previewSummary,
    previewWarnings,
    requestLoading,
    result,
    testRequest,
  } = useStripeOfficialBuilder();

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-accent">Step 3</span>
            <span className="text-base font-semibold text-foreground">Test your configuration</span>
          </div>
          <Button isPending={requestLoading} onPress={testRequest} variant="primary">
            {requestLoading ? <ButtonSpinner /> : <LuPlay size={16} />}
            {result ? "Re-run" : "Run test"}
          </Button>
        </div>

        {!result && (
          <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-divider bg-surface-secondary/50 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">
              <LuPlay size={24} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Run a test to see a live sample of your Stripe data
              </p>
              <p className="text-sm text-muted">
                Uses your current configuration to fetch a preview.
              </p>
            </div>
          </div>
        )}

        {result && previewWarnings.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-700 dark:text-warning-300">
            {previewWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {result && previewRows.length > 0 && previewColumns.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">Preview rows</span>
              <span className="text-muted">
                {previewSummary}
                {previewRecordsProcessed ? ` - ${formatMaxRecords(previewRecordsProcessed)} processed` : ""}
              </span>
            </div>

            <Table className="border border-divider shadow-none">
              <Table.ScrollContainer>
                <Table.Content aria-label="Stripe configuration preview" className="min-w-[760px]">
                  <Table.Header>
                    {previewColumns.map((column, index) => (
                      <Table.Column key={column} id={column} isRowHeader={index === 0}>
                        {formatPreviewColumnLabel(column)}
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body>
                    {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((row, rowIndex) => (
                      <Table.Row key={`${row.id || row.period || "row"}-${rowIndex}`} id={`${row.id || row.period || "row"}-${rowIndex}`}>
                        {previewColumns.map((column) => (
                          <Table.Cell key={column}>
                            <span className="block max-w-[220px] truncate" title={formatPreviewCellValue(column, row[column])}>
                              {formatPreviewCellValue(column, row[column])}
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

        {result && (previewRows.length === 0 || previewColumns.length === 0) && (
          <AceEditor
            mode="json"
            theme="tomorrow"
            value={result}
            readOnly
            height="260px"
            width="100%"
          />
        )}
      </Card.Content>
    </Card>
  );
}

export default StripeOfficialPreviewStep;
