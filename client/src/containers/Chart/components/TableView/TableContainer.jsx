import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Spacer,
} from "@heroui/react";

import TableComponent from "./TableComponent";
import Row from "../../../../components/Row";
import Text from "../../../../components/Text";
import { getWidthBreakpoint } from "../../../../modules/layoutBreakpoints";

function TableContainer(props) {
  const {
    tabularData, embedded = false, datasets,
  } = props;

  const [activeDatasetIndex, setActiveDatasetIndex] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [chartSize, setChartSize] = useState(2);

  const containerRef = React.useRef(null);

  useEffect(() => {
    if (datasets && datasets.length > 0) {
      setActiveDatasetIndex(0);
    }
  }, [datasets]);

  useEffect(() => {
    const activeDataset = datasets[activeDatasetIndex];
    const dataKey = Object.keys(tabularData)[activeDatasetIndex];

    if (activeDataset
      && tabularData[dataKey]?.data
      && activeDataset?.configuration?.sum
    ) {
      setTotalValue(0);
      tabularData[dataKey].data.forEach((d) => {
        if (d[activeDataset.configuration.sum]) {
          try {
            setTotalValue((prev) => prev + parseFloat(d[activeDataset.configuration.sum]));
          } catch (e) {
            // console.log("e", e);
          }
        }
      });
    }
  }, [activeDatasetIndex, tabularData]);

  useEffect(() => {
    switch (getWidthBreakpoint(containerRef)) {
      case "xxs":
      case "xs":
        setChartSize(1);
        break;
      case "sm":
        setChartSize(2);
        break;
      case "md":
        setChartSize(3);
        break;
      case "lg":
        setChartSize(4);
        break;
    }
  }, [containerRef.current]);

  const activeDataset = datasets[activeDatasetIndex];
  const dataKey = Object.keys(tabularData)[activeDatasetIndex];

  return (
    <div className="h-full overflow-y-auto">
      <Row align="center" wrap="wrap" className={"gap-1"}>
        {datasets.map((dataset, index) => {
          return (
            <Fragment key={dataset.id}>
              <Button
                onPress={() => setActiveDatasetIndex(index)}
                color="primary"
                variant={activeDatasetIndex !== index ? "light" : "bordered"}
                auto
                size={chartSize === 1 ? "xs" : "sm"}
              >
                {dataset.legend}
              </Button>
            </Fragment>
          );
        })}

        {activeDataset?.configuration?.sum && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <Text>{`Total ${activeDataset.configuration.sum}:`}</Text>
            <Spacer x={0.6} />
            <Text b>{totalValue?.toLocaleString()}</Text>
          </div>
        )}
      </Row>
      <Spacer y={1} />
      {dataKey && tabularData[dataKey] && tabularData[dataKey].columns && (
        <TableComponent
          columns={tabularData[dataKey].columns}
          data={tabularData[dataKey].data}
          embedded={embedded}
          dataset={activeDataset}
        />
      )}
    </div>
  );
}

TableContainer.defaultProps = {
  embedded: false,
};

TableContainer.propTypes = {
  tabularData: PropTypes.object.isRequired,
  datasets: PropTypes.array.isRequired,
  embedded: PropTypes.bool,
};

export default TableContainer;
