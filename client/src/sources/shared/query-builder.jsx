import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button, Checkbox, Dropdown, Label, Tabs, Tooltip } from "@heroui/react";
import { LuEllipsis, LuInfo, LuMaximize2, LuMinimize2, LuPlay, LuTrash } from "react-icons/lu";

import SavedQueries from "../../components/SavedQueries";
import AiQuery from "../../containers/Dataset/AiQuery";
import { ButtonSpinner } from "../../components/ButtonSpinner";

function QueryBuilder({
  children, request, type, onChangeQuery, onSave, onDelete, onRun,
  onTransform, saving, running, invalidateCache, onCacheChange,
  resultsTab, onResultsTabChange, results, resultsHelp,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-w-0 flex-1">
      <div className={`grid min-w-0 ${expanded ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        <section aria-label="Query editor" className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
          <AiQuery query={request.query || ""} dataRequest={request} onChangeQuery={onChangeQuery} />
          <div className="min-w-0 overflow-hidden rounded-2xl border border-divider">
            <div className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
              <SavedQueries type={type} query={request.query} onSelectQuery={(item) => onChangeQuery(item.query)} />
              <Button
                aria-label={expanded ? "Restore split view" : "Expand editor"}
                title={expanded ? "Restore split view" : "Expand editor"}
                aria-pressed={expanded}
                isIconOnly
                onPress={() => setExpanded(!expanded)}
                size="sm"
                variant="ghost"
              >
                {expanded ? <LuMinimize2 aria-hidden size={16} /> : <LuMaximize2 aria-hidden size={16} />}
              </Button>
            </div>
            {children}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-surface-secondary/30 p-3">
              <Button onPress={onRun} isPending={running} isDisabled={saving} size="sm">
                {running ? <ButtonSpinner /> : <LuPlay aria-hidden size={16} />}
                Run query
              </Button>
              <div className="flex items-center gap-1">
                <Checkbox isSelected={!invalidateCache} onChange={(selected) => onCacheChange(!selected)} variant="secondary">
                  <Checkbox.Content>
                    <Checkbox.Control className="size-4 shrink-0">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    Use cached data
                  </Checkbox.Content>
                </Checkbox>
                <Tooltip>
                  <Button aria-label="About cached data" isIconOnly size="sm" variant="ghost">
                    <LuInfo aria-hidden size={16} />
                  </Button>
                  <Tooltip.Content className="max-w-72">
                    Reuse the last result for faster previews. Turn this off to fetch fresh data.
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Query results"
          aria-busy={running}
          className={`flex min-w-0 flex-col border-t border-divider ${expanded ? "" : "lg:border-t-0 lg:border-l"}`}
        >
          <div className="flex items-center justify-end gap-2 border-b border-divider px-4 py-3 sm:px-6">
            <Button size="sm" variant="secondary" onPress={onSave} isPending={saving || running}>
              {saving || running ? <ButtonSpinner /> : null}
              Save request
            </Button>
            <Dropdown>
              <Button aria-label="Request actions" isIconOnly size="sm" variant="ghost">
                <LuEllipsis aria-hidden size={18} />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu aria-label="Request actions" onAction={() => onDelete()}>
                  <Dropdown.Item id="delete" textValue="Delete request" variant="danger">
                    <LuTrash aria-hidden size={16} />
                    <Label>Delete request</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
          <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Sample results</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onPress={onTransform}>
                  Transform
                  {request.transform?.enabled && <span className="size-1.5 rounded-full bg-accent" aria-label="Transformations active" />}
                </Button>
                <Tabs
                  selectedKey={resultsTab}
                  onSelectionChange={onResultsTabChange}
                  disabledKeys={saving || running ? ["table", "json"] : []}
                  aria-label="Result format"
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Result format">
                      <Tabs.Tab id="table">
                        Table
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="json">
                        JSON
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              </div>
            </div>
            {results}
            {resultsHelp}
          </div>
        </section>
      </div>
    </div>
  );
}

QueryBuilder.propTypes = {
  children: PropTypes.node.isRequired,
  request: PropTypes.object.isRequired,
  type: PropTypes.string.isRequired,
  onChangeQuery: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRun: PropTypes.func.isRequired,
  onTransform: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  running: PropTypes.bool,
  invalidateCache: PropTypes.bool,
  onCacheChange: PropTypes.func.isRequired,
  resultsTab: PropTypes.string.isRequired,
  onResultsTabChange: PropTypes.func.isRequired,
  results: PropTypes.node.isRequired,
  resultsHelp: PropTypes.node,
};

export default QueryBuilder;
