import React from "react";
import PropTypes from "prop-types";
import { Button, Input, ListBox, Popover } from "@heroui/react";
import { LuAtSign, LuLayers, LuLayoutGrid, LuPlug } from "react-icons/lu";

function getEntityIcon(entityType) {
  switch (entityType) {
    case "project":
      return <LuLayoutGrid size={16} className="shrink-0" />;
    case "connection":
      return <LuPlug size={16} className="shrink-0" />;
    case "dataset":
      return <LuLayers size={16} className="shrink-0" />;
    default:
      return null;
  }
}

function AiContextPicker({
  isOpen,
  onOpenChange,
  isLoading,
  contextSearch,
  setContextSearch,
  filteredContextEntities,
  selectedContext,
  setSelectedContext,
  getContextLabel,
  placement = "bottom",
  contentClassName = "w-80",
  triggerVariant = "tertiary",
  triggerSize = "sm",
  triggerIsIconOnly = false,
  showTriggerLabel = false,
}) {
  const hasSelectedContext = selectedContext.multiSelect.length > 0;

  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          isPending={isLoading}
          isIconOnly={triggerIsIconOnly || (showTriggerLabel && hasSelectedContext)}
          aria-label="Add context"
        >
          <LuAtSign size={triggerSize === "sm" ? 16 : 18} />
          {showTriggerLabel && !hasSelectedContext ? "Add extra context" : null}
        </Button>
      </Popover.Trigger>
      <Popover.Content placement={placement} className={contentClassName}>
        <Popover.Dialog>
          <div className="p-2 w-full">
            <div className="text-xs text-foreground-500 mb-2">
              Context helps our AI to understand your intentions better.
            </div>
            <Input
              placeholder="Search projects, connections, datasets..."
              value={contextSearch}
              onChange={(e) => setContextSearch(e.target.value)}
              size="sm"
              className="mb-2"
              autoFocus
              fullWidth
            />
            <div className="max-h-64 overflow-y-auto w-full">
              <ListBox
                aria-label="Context entities"
                selectionMode="none"
                className="w-full"
                renderEmptyState={() => (
                  <div className="px-2 py-3 text-sm text-foreground-500">No entities found</div>
                )}
              >
                {filteredContextEntities.map((entity) => {
                  const isSelected = selectedContext.multiSelect.some((selected) => selected.id === entity.id && selected.entity_type === entity.entity_type);
                  const rowId = `${entity.entity_type}-${entity.id}`;

                  return (
                    <ListBox.Item
                      key={rowId}
                      id={rowId}
                      textValue={getContextLabel(entity)}
                      className={isSelected ? "bg-primary-50" : ""}
                      onAction={() => {
                        setSelectedContext((prev) => {
                          const newEntity = {
                            ...entity,
                            label: getContextLabel(entity),
                          };
                          const isAlreadySelected = prev.multiSelect.some((selected) => selected.id === entity.id && selected.entity_type === entity.entity_type);

                          if (isAlreadySelected) {
                            return {
                              ...prev,
                              multiSelect: prev.multiSelect.filter((selected) => !(selected.id === entity.id && selected.entity_type === entity.entity_type)),
                            };
                          }

                          return {
                            ...prev,
                            multiSelect: [...prev.multiSelect, newEntity],
                          };
                        });
                        setContextSearch("");
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {getEntityIcon(entity.entity_type)}
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm">{entity.name || entity.legend}</span>
                            <span className="text-xs text-foreground-500">
                              {entity.entity_type === "project" ? "Project" :
                                entity.entity_type === "connection" ? `Connection (${entity.type})` :
                                  "Dataset"}
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
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

AiContextPicker.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  contextSearch: PropTypes.string.isRequired,
  setContextSearch: PropTypes.func.isRequired,
  filteredContextEntities: PropTypes.arrayOf(PropTypes.object).isRequired,
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
};

export default AiContextPicker;
