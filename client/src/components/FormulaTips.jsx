import React from "react"
import { Code, Spacer } from "@heroui/react";
import { LuChevronRight, LuExternalLink } from "react-icons/lu";

import Text from "./Text";
import Row from "./Row";

function FormulaTips() {
  return (
    <div className={"p-4"}>
      <Row>
        <Text b>{"Formulas allow you to manipulate your final Metric results"}</Text>
      </Row>
      <Spacer y={1} />
      <Row className={"items-center"}>
        <Text>{"Example for"}</Text>
        <Spacer x={0.5} />
        <Code>{"val = 12345"}</Code>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          <Code>{"{val}"}</Code>
          {" => 12345"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          <Code>{"{val / 100}"}</Code>
          {" => 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          <Code>{"$ {val / 100}"}</Code>
          {" => $ 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          <Code>{"{val / 100} USD"}</Code>
          {" => 123.45 USD"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          <Code>{"{ROUND(val / 100, 0)}"}</Code>
          {" => 123"}
        </Text>
      </Row>
      <Spacer y={2} />
      <Row align="center">
        <div>
          {"For a full list of formulas, "}
          <a href="https://github.com/handsontable/formula-parser/blob/develop/src/supported-formulas.js">
            {"visit this page"}
          </a>
        </div>
        <Spacer x={0.5} />
        <LuExternalLink size={16} />
      </Row>
    </div>
  );
}

export default FormulaTips
