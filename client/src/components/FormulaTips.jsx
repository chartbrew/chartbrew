import React from "react"
import { Spacer } from "@nextui-org/react";
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
      <Row>
        <Text>{"For"}</Text>
        <Spacer x={0.5} />
        <Text b>{"val = 12345"}</Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val} => 12345"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val / 100} => 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"$ {val / 100} => $ 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val / 100} USD => 123.45 USD"}
        </Text>
      </Row>
    </div>
  );
}

export default FormulaTips
