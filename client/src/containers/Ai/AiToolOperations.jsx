import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Accordion } from "@heroui/react";
import { LuCheck, LuX } from "react-icons/lu";

import { getOperationSummary, getToolDisplayName } from "./aiMessageUtils";

function AiToolOperations({ operations, groupIndex, toolDisplayNames }) {
  const completed = useMemo(() => {
    if (operations.some((operation) => operation.status)) {
      return operations.map((operation) => ({
        label: getToolDisplayName(operation.name, toolDisplayNames),
        name: operation.name,
        status: operation.status,
      }));
    }
    const results = new Map(operations
      .filter((operation) => operation.type === "result")
      .map((operation) => [operation.name, operation.data]));
    const names = operations
      .filter((operation) => operation.type === "call")
      .map((operation) => operation.name);
    return Array.from(new Set(names)).map((name) => ({
      label: getToolDisplayName(name, toolDisplayNames),
      name,
      status: results.get(name)?.error ? "failed" : "complete",
    }));
  }, [operations, toolDisplayNames]);

  if (completed.length === 0) return null;

  return (
    <Accordion className="mt-3" variant="surface">
      <Accordion.Item id={`operations-${groupIndex}`} textValue="Work completed">
        <Accordion.Heading>
          <Accordion.Trigger>
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
          <Accordion.Body>
            <ol className="flex flex-col gap-2 border-l border-divider pl-4">
              {completed.map((operation) => (
                <li className="flex items-center gap-2 text-xs text-muted" key={operation.name}>
                  <span className={operation.status === "failed"
                    ? "flex size-4 items-center justify-center rounded-full bg-danger/10 text-danger"
                    : "flex size-4 items-center justify-center rounded-full bg-success/10 text-success"}
                  >
                    {operation.status === "failed"
                      ? <LuX size={11} aria-hidden />
                      : <LuCheck size={11} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">{operation.label}</span>
                  <span>{operation.status === "failed" ? "Failed" : "Done"}</span>
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
    status: PropTypes.string,
  })).isRequired,
  groupIndex: PropTypes.number.isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiToolOperations;
