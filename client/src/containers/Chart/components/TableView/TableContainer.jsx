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
    tabularData, embedded, datasets,
  } = props;

  const [activeDataset, setActiveDataset] = useState(null);
  const [totalValue, setTotalValue] = useState(0);
  const [chartSize, setChartSize] = useState(2);

  const containerRef = React.useRef(null);

  useEffect(() => {
    if (datasets && datasets[0] && !activeDataset) {
      setActiveDataset(datasets[0]);
    } else if (activeDataset) {
      setActiveDataset(datasets.find((d) => d.id === activeDataset.id));
    }
  }, [datasets]);

  useEffect(() => {
    if (activeDataset
      && tabularData[activeDataset.legend]?.data
      && activeDataset?.configuration?.sum
    ) {
      setTotalValue(0);
      tabularData[activeDataset.legend].data.forEach((d) => {
        if (d[activeDataset.configuration.sum]) {
          try {
            setTotalValue((prev) => prev + parseFloat(d[activeDataset.configuration.sum]));
          } catch (e) {
            // console.log("e", e);
          }
        }
      });
    }
  }, [activeDataset]);

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


  return (
    <div className="h-full overflow-y-auto">
      <Row align="center" wrap="wrap" className={"gap-1"}>
        {activeDataset && datasets.map((dataset) => {
          return (
            <Fragment key={dataset.id}>
              <Button
                onClick={() => setActiveDataset(dataset)}
                color="primary"
                variant={activeDataset.id !== dataset.id ? "light" : "bordered"}
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
            <Text b>{totalValue.toLocaleString()}</Text>
          </div>
        )}
      </Row>
      <Spacer y={1} />
      {activeDataset?.legend
        && tabularData[activeDataset.legend]
        && tabularData[activeDataset.legend].columns
        && (
          <TableComponent
            columns={tabularData[activeDataset.legend].columns}
            data={tabularData[activeDataset.legend].data}
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
