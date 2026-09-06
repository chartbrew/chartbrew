import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Accordion } from "@heroui/react";
import { LuCheck, LuWrench, LuX } from "react-icons/lu";

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
    <Accordion className="mt-3" hideSeparator>
      <Accordion.Item id={`operations-${groupIndex}`}>
        <Accordion.Heading>
          <Accordion.Trigger className="group min-h-10 max-w-full flex-none justify-start gap-2 px-0 py-2 font-normal text-muted hover:bg-transparent hover:text-foreground">
            <LuWrench className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words text-start">
              {getOperationSummary(operations, toolDisplayNames)}
            </span>
            <Accordion.Indicator className="ml-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100" />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body className="px-0 pb-2">
            <ol className="flex flex-col gap-2">
              {completed.map((operation) => (
                <li className="flex items-start gap-2 text-sm text-muted" key={operation.name}>
                  {operation.status === "failed"
                    ? <LuX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    : <LuCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  <span className="min-w-0 break-words">
                    {operation.label}
                    {operation.status === "failed" && <span className="text-danger"> — Failed</span>}
                  </span>
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
    type: PropTypes.string,
    name: PropTypes.string.isRequired,
    data: PropTypes.any,
    status: PropTypes.string,
  })).isRequired,
  groupIndex: PropTypes.number.isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiToolOperations;
