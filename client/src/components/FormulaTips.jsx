import React from "react"
import { Code } from "@heroui/react";
import { LuChevronRight, LuExternalLink } from "react-icons/lu";

function FormulaTips() {
  return (
    <div className={"p-4"}>
      <div className="font-bold">{"Formulas allow you to manipulate your final Metric results"}</div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <div className="text-sm text-foreground">{"Example for"}</div>
        <Code>{"val = 12345"}</Code>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <Code>{"{val}"}</Code>
          {" => 12345"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <Code>{"{val / 100}"}</Code>
          {" => 123.45"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <Code>{"$ {val / 100}"}</Code>
          {" => $ 123.45"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <Code>{"{val / 100} USD"}</Code>
          {" => 123.45 USD"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <Code>{"{ROUND(val / 100, 0)}"}</Code>
          {" => 123"}
        </span>
      </div>
      <div className="h-2" />
      <div className="flex items-center gap-2">
        <div>
          {"For a full list of formulas, "}
          <a href="https://github.com/handsontable/formula-parser/blob/develop/src/supported-formulas.js" rel="noopener noreferrer" target="_blank">
            {"visit this page"}
          </a>
        </div>
        <LuExternalLink size={16} />
      </div>
    </div>
  );
}

export default FormulaTips
