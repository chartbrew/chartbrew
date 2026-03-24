import React from "react"
import { LuChevronRight, LuExternalLink } from "react-icons/lu";

function FormulaTips() {
  return (
    <div className={"p-4"}>
      <div className="font-bold">{"Formulas allow you to manipulate your final Metric results"}</div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <div className="text-sm text-foreground">{"Example for"}</div>
        <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"val = 12345"}</code>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"{val}"}</code>
          {" => 12345"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"{val / 100}"}</code>
          {" => 123.45"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"$ {val / 100}"}</code>
          {" => $ 123.45"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"{val / 100} USD"}</code>
          {" => 123.45 USD"}
        </span>
      </div>
      <div className="h-1" />
      <div className="flex items-center gap-2">
        <LuChevronRight />
        <span>
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{"{ROUND(val / 100, 0)}"}</code>
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
