import React from "react";
import PropTypes from "prop-types";
import { Accordion, Popover } from "@heroui/react";
import { LuChevronDown, LuWrench } from "react-icons/lu";

import { getOperationSummary, getToolDisplayName } from "./aiMessageUtils";

function AiToolOperations({ operations, groupIndex, toolDisplayNames }) {
  if (operations.length === 0) return null;

  return (
    <div className="mb-3">
      <Accordion>
        <Accordion.Item
          id={`operations-${groupIndex}`}
          textValue={`${operations.length} AI operations`}
        >
          <Accordion.Heading>
            <Accordion.Trigger className="rounded-md px-0 py-1">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-start">
                <LuWrench size={14} className="shrink-0 text-foreground-500" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground-600">
                    {operations.length} AI {operations.length === 1 ? "operation" : "operations"}
                  </div>
                  <div className="truncate text-xs text-foreground-500">
                    {getOperationSummary(operations, toolDisplayNames)}
                  </div>
                </div>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div className="flex flex-col gap-1 pt-1">
                {operations.map((op, idx) => (
                  <Popover key={idx} aria-label="Tool details">
                    <Popover.Trigger>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-foreground-500 hover:bg-content2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <LuWrench size={12} className="shrink-0" />
                        <span className="min-w-14 text-foreground-400">
                          {op.type === "call" ? "Started" : "Finished"}
                        </span>
                        <span className="font-medium text-foreground-600">
                          {getToolDisplayName(op.name, toolDisplayNames)}
                        </span>
                        <code className="ml-auto hidden text-[11px] text-foreground-400 sm:block">
                          {op.name}
                        </code>
                        <LuChevronDown size={14} className="shrink-0 opacity-60" />
                      </button>
                    </Popover.Trigger>
                    <Popover.Content placement="bottom" className="max-w-2xl">
                      <Popover.Dialog>
                        <div className="p-2">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold">
                              {op.type === "call" ? "Arguments" : "Result"}
                            </div>
                            <code className="text-[11px] text-foreground-500">{op.name}</code>
                          </div>
                          <code className="block max-h-96 overflow-auto rounded-md bg-default/40 p-2 text-xs text-default-700 whitespace-pre-wrap">
                            {JSON.stringify(op.data, null, 2)}
                          </code>
                        </div>
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
                ))}
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

AiToolOperations.propTypes = {
  operations: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    data: PropTypes.any,
  })).isRequired,
  groupIndex: PropTypes.number.isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiToolOperations;
