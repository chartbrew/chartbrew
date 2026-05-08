import React from "react";
import {
  Button,
  Card,
  Disclosure,
  Separator,
} from "@heroui/react";
import {
  LuBraces,
  LuEye,
  LuSave,
  LuTrash,
} from "react-icons/lu";

import AceEditor from "../../../components/CodeEditor";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import { useStripeOfficialBuilder } from "./stripeOfficial-builder-context";

function StripeOfficialSummarySidebar() {
  const {
    configuration,
    dimensionLabel,
    intervalLabel,
    metricLabel,
    outputLabel,
    previewSummary,
    saveConfiguration,
    saveLoading,
    selectedCategory,
    setShowTransform,
    showConfigPreview,
    showTransform,
    setShowConfigPreview,
    sourceLabel,
    onDelete,
  } = useStripeOfficialBuilder();

  return (
    <aside className="col-span-12 xl:col-span-4 2xl:col-span-3">
      <div className="sticky top-4 flex flex-col gap-4">
        <Card className="border border-divider bg-surface p-0 shadow-none">
          <Card.Content className="flex flex-col gap-4 p-5">
            <Card.Title className="text-lg">Dataset summary</Card.Title>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Dataset type</span>
                <span className="text-right font-medium text-foreground">{outputLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Category</span>
                <span className="text-right font-medium text-foreground">{selectedCategory.label}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Source</span>
                <span className="text-right font-medium text-foreground">
                  {sourceLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Metric</span>
                <span className="text-right font-medium text-foreground">{metricLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Grouped by</span>
                <span className="text-right font-medium text-foreground">
                  {intervalLabel ? `${dimensionLabel} - ${intervalLabel}` : dimensionLabel}
                </span>
              </div>
              <Separator variant="tertiary" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Preview</span>
                <span className="text-right font-medium text-emerald-600 dark:text-emerald-300">{previewSummary}</span>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Disclosure isExpanded={showConfigPreview} onExpandedChange={setShowConfigPreview}>
          <Disclosure.Heading>
            <Button slot="trigger" variant="ghost" className="w-full justify-between text-muted">
              <span className="flex items-center gap-2">
                <LuEye size={16} />
                Config preview
              </span>
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-2">
              <AceEditor
                mode="json"
                theme="tomorrow"
                value={JSON.stringify(configuration, null, 2)}
                readOnly
                height="260px"
                width="100%"
              />
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>

        <div className="flex flex-col gap-3">
          <Button
            fullWidth
            isPending={saveLoading}
            onPress={saveConfiguration}
            variant="primary"
          >
            {saveLoading ? <ButtonSpinner /> : <LuSave size={16} />}
            Save configuration
          </Button>
          <Button fullWidth onPress={() => setShowTransform(!showTransform)} variant="secondary">
            <LuBraces size={16} />
            {showTransform ? "Hide transform" : "Transform data"}
          </Button>
          <Button fullWidth variant="danger-soft" onPress={onDelete}>
            <LuTrash size={16} />
            Delete request
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default StripeOfficialSummarySidebar;
