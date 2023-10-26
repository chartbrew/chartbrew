import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { Button, Input, Link, Popover, PopoverContent, PopoverTrigger, Spacer, Tooltip } from "@nextui-org/react";
import { TbMathFunctionY } from "react-icons/tb";

import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { LuCheck, LuCheckCircle, LuChevronRight, LuInfo, LuWand2, LuXCircle } from "react-icons/lu";
import { selectCdc } from "../../../slices/chart";

function ChartDatasetConfig(props) {
  const { chartId, datasetId } = props;

  const [legend, setLegend] = useState("");
  const [formula, setFormula] = useState("");

  const dataset = useSelector((state) => selectCdc(state, chartId, datasetId))

  useEffect(() => {
    if (dataset.formula) {
      setFormula(dataset.formula);
    }
    if (dataset.legend) {
      setLegend(dataset.legend);
    }
  }, [dataset]);

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}");
    // onUpdate({ formula: "${val / 100}" });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    // onUpdate({ formula: "" });
  };

  const _onApplyFormula = () => {
    // onUpdate({ formula });
  };

  return (
    <div>
      <Row align="center">
        <Input
          placeholder="Enter a name for your dataset"
          label="Dataset name"
          value={legend}
          onChange={(e) => setLegend(e.target.value)}
          variant="bordered"
        />
        {legend && legend !== dataset.legend && (
          <>
            <Spacer x={2} />
            <Button
              isIconOnly
              color="success"
              isLoading={false}
              size="sm"
            >
              <LuCheck />
            </Button>
          </>
        )}
      </Row>
      <Spacer y={4} />
      <Row>
        {!formula && (
          <Link onClick={_onAddFormula} className="flex items-center cursor-pointer">
            <TbMathFunctionY size={24} />
            <Spacer x={0.5} />
            <Text>Apply formula on metric</Text>
          </Link>
        )}
        {formula && (
          <div className="col-span-12">
            <div>
              <Popover>
                <PopoverTrigger>
                  <div className="flex flex-row gap-2 items-center">
                    <Text>
                      {"Metric formula"}
                    </Text>
                    <LuInfo />
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <FormulaTips />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Input
                placeholder="Enter your formula here: {val}"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                variant="bordered"
              />
              <Tooltip
                content={formula === dataset.formula ? "The formula is already applied" : "Apply the formula"}
              >
                <Link onClick={formula === dataset.formula ? () => { } : _onApplyFormula}>
                  <LuCheckCircle className={`${formula === dataset.formula ? "text-default-foreground" : "text-success"}`} />
                </Link>
              </Tooltip>
              <Tooltip content="Remove formula">
                <Link onClick={_onRemoveFormula}>
                  <LuXCircle className="text-danger" />
                </Link>
              </Tooltip>
              <Tooltip content="Click for an example">
                <Link onClick={_onExampleFormula}>
                  <LuWand2 className="text-primary" />
                </Link>
              </Tooltip>
            </div>
          </div>
        )}
      </Row>
    </div>
  );
}

ChartDatasetConfig.propTypes = {
  datasetId: PropTypes.number.isRequired,
  chartId: PropTypes.number.isRequired,
};

function FormulaTips() {
  return (
    <div className={"p-4"}>
      <Row>
        <Text b>{"Formulas allow you to manipulate the final results on the Y-Axis"}</Text>
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

export default ChartDatasetConfig
