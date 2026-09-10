import React from "react";
import PropTypes from "prop-types";
import { Button, Input, ListBox, Popover, Spinner, Tooltip } from "@heroui/react";
import { LuChartNoAxesColumnIncreasing, LuLayers, LuLayoutGrid, LuPaperclip, LuPlug } from "react-icons/lu";

const GROUP_LABELS = {
  project: "Dashboards",
  chart: "Charts",
  dataset: "Datasets",
  connection: "Connections",
};

function getEntityIcon(entityType) {
  switch (entityType) {
    case "project":
      return <LuLayoutGrid size={16} className="shrink-0" />;
    case "connection":
      return <LuPlug size={16} className="shrink-0" />;
    case "dataset":
      return <LuLayers size={16} className="shrink-0" />;
    case "chart":
      return <LuChartNoAxesColumnIncreasing size={16} className="shrink-0" />;
    default:
      return null;
  }
}

function getEntityDetails(entity) {
  const metadata = entity.metadata || {};
  if (entity.entity_type === "project") {
    const count = metadata.chartCount || 0;
    return `Dashboard · ${count} ${count === 1 ? "chart" : "charts"}`;
  }
  if (entity.entity_type === "chart") {
    return ["Chart", metadata.dashboardName, metadata.chartType].filter(Boolean).join(" · ");
  }
  if (entity.entity_type === "dataset") {
    return ["Dataset", metadata.connectionName, metadata.sourceType].filter(Boolean).join(" · ");
  }
  return ["Connection", metadata.sourceType, metadata.connectionState].filter(Boolean).join(" · ");
}

function AiContextPicker({
  isOpen,
  onOpenChange,
  isLoading,
  isSearching,
  error,
  contextSearch,
  setContextSearch,
  contextEntities,
  selectedContext,
  setSelectedContext,
  getContextLabel,
  placement = "bottom",
  contentClassName = "w-80",
  triggerVariant = "tertiary",
  triggerSize = "sm",
  triggerIsIconOnly = false,
  showTriggerLabel = false,
  triggerTooltip,
}) {
  const hasSelectedContext = selectedContext.multiSelect.length > 0;
  const groups = contextSearch.trim()
    ? Object.keys(GROUP_LABELS).map((type) => ({
      label: GROUP_LABELS[type],
      items: contextEntities.filter((entity) => entity.entity_type === type),
    })).filter((group) => group.items.length > 0)
    : [{ label: "Recent", items: contextEntities }];
  const triggerButton = (
    <Button
      type="button"
      variant={triggerVariant}
      size={triggerSize}
      isPending={isLoading}
      isIconOnly={triggerIsIconOnly}
      aria-label="Add context"
    >
      <LuPaperclip size={triggerSize === "sm" ? 16 : 18} />
      {showTriggerLabel
        ? hasSelectedContext ? `Context (${selectedContext.multiSelect.length})` : "Add context"
        : null}
    </Button>
  );

  const picker = (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        {triggerButton}
      </Popover.Trigger>
      <Popover.Content placement={placement} className={contentClassName}>
        <Popover.Dialog>
          <div className="w-full">
            <div className="mb-2 text-xs font-medium text-foreground">
              Add workspace context
            </div>
            <Input
              placeholder="Search dashboards, charts, datasets, or connections"
              value={contextSearch}
              onChange={(e) => setContextSearch(e.target.value)}
              size="sm"
              className="mb-2"
              autoFocus
              fullWidth
              variant="secondary"
            />
            <div className="max-h-64 overflow-y-auto w-full">
              {isSearching ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-foreground-500">
                  <Spinner aria-label="Searching context" size="sm" />
                  Searching...
                </div>
              ) : null}
              {!isSearching && error ? (
                <div className="px-2 py-3 text-sm text-danger">{error}</div>
              ) : null}
              {!isSearching && !error && contextEntities.length === 0 ? (
                <div className="px-2 py-3 text-sm text-foreground-500">No matching context</div>
              ) : null}
              {!isSearching && !error ? groups.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <div className="px-2 pb-1 pt-1 text-xs font-medium text-foreground-500">
                    {group.label}
                  </div>
                  <ListBox
                    aria-label={group.label}
                    selectionMode="none"
                    className="w-full"
                  >
                    {group.items.map((entity) => {
                      const isSelected = selectedContext.multiSelect.some((selected) => (
                        `${selected.id}` === `${entity.id}`
                        && selected.entity_type === entity.entity_type
                      ));
                      const rowId = `${entity.entity_type}-${entity.id}`;

                      return (
                        <ListBox.Item
                          key={rowId}
                          id={rowId}
                          textValue={getContextLabel(entity)}
                          className={isSelected ? "bg-primary-50" : ""}
                          onAction={() => {
                            setSelectedContext((prev) => {
                              const isAlreadySelected = prev.multiSelect.some((selected) => (
                                `${selected.id}` === `${entity.id}`
                                && selected.entity_type === entity.entity_type
                              ));
                              if (isAlreadySelected) {
                                return {
                                  ...prev,
                                  multiSelect: prev.multiSelect.filter((selected) => !(
                                    `${selected.id}` === `${entity.id}`
                                    && selected.entity_type === entity.entity_type
                                  )),
                                };
                              }
                              return {
                                ...prev,
                                multiSelect: [...prev.multiSelect, {
                                  ...entity,
                                  label: getContextLabel(entity),
                                }],
                              };
                            });
                            setContextSearch("");
                          }}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {getEntityIcon(entity.entity_type)}
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm">{entity.name}</span>
                                <span className="truncate text-xs text-foreground-500">
                                  {getEntityDetails(entity)}
                                </span>
                              </div>
                            </div>
                            {isSelected ? <div className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                          </div>
                        </ListBox.Item>
                      );
                    })}
                  </ListBox>
                </div>
              )) : null}
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );

  if (!triggerTooltip) return picker;

  return (
    <Tooltip delay={0} isDisabled={isOpen}>
      <Tooltip.Trigger>
        <div className="inline-flex">{picker}</div>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p className="text-xs">{triggerTooltip}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

AiContextPicker.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  isSearching: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  contextSearch: PropTypes.string.isRequired,
  setContextSearch: PropTypes.func.isRequired,
  contextEntities: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedContext: PropTypes.shape({
    multiSelect: PropTypes.array.isRequired,
  }).isRequired,
  setSelectedContext: PropTypes.func.isRequired,
  getContextLabel: PropTypes.func.isRequired,
  placement: PropTypes.string,
  contentClassName: PropTypes.string,
  triggerVariant: PropTypes.string,
  triggerSize: PropTypes.string,
  triggerIsIconOnly: PropTypes.bool,
  showTriggerLabel: PropTypes.bool,
  triggerTooltip: PropTypes.string,
};

export default AiContextPicker;
