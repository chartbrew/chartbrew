import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Accordion } from "@heroui/react";
import { LuCheck } from "react-icons/lu";

import { getOperationSummary, getToolDisplayName } from "./aiMessageUtils";

function AiToolOperations({ operations, groupIndex, toolDisplayNames }) {
  const completed = useMemo(() => {
    const results = new Set(
      operations.filter((operation) => operation.type === "result").map((operation) => operation.name)
    );
    const names = operations
      .filter((operation) => operation.type === "call")
      .map((operation) => operation.name);
    return Array.from(new Set(names)).map((name) => ({
      complete: results.has(name),
      label: getToolDisplayName(name, toolDisplayNames),
      name,
    }));
  }, [operations, toolDisplayNames]);

  if (completed.length === 0) return null;

  return (
    <Accordion className="mb-3" variant="surface">
      <Accordion.Item id={`operations-${groupIndex}`} textValue="Work completed">
        <Accordion.Heading>
          <Accordion.Trigger className="rounded-lg px-2 py-1.5">
            <div className="min-w-0 flex-1 text-start">
              <div className="text-xs font-medium text-foreground">Work completed</div>
              <div className="truncate text-xs text-muted">
                {getOperationSummary(operations, toolDisplayNames)}
              </div>
            </div>
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body className="pt-1 pb-2">
            <ol className="flex flex-col gap-2 border-l border-divider pl-4">
              {completed.map((operation) => (
                <li className="flex items-center gap-2 text-xs text-muted" key={operation.name}>
                  <span className="flex size-4 items-center justify-center rounded-full bg-success/10 text-success">
                    <LuCheck size={11} aria-hidden />
                  </span>
                  {operation.label}
                </li>
              ))}
            </ol>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
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
