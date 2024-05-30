import React from "react"
import { Code, Spacer } from "@nextui-org/react";
import { LuChevronRight } from "react-icons/lu";

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
    </div>
  );
}

export default FormulaTips
