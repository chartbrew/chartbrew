import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Row, Spacer, Text
} from "@nextui-org/react";
import { ChevronDownCircle, ChevronUpCircle } from "react-iconly";

import TableComponent from "./TableComponent";

function TableContainer(props) {
  const {
    tabularData, height, embedded, chartSize, datasets,
  } = props;

  const [activeDataset, setActiveDataset] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [totalValue, setTotalValue] = useState(0);

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

  const _onExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <div>
      <Row align="center" wrap="wrap">
        {activeDataset && datasets.map((dataset) => {
          return (
            <>
              <Button
                onClick={() => setActiveDataset(dataset)}
                color="primary"
                light={activeDataset.id !== dataset.id}
                bordered={activeDataset.id === dataset.id}
                auto
                key={dataset.id}
                size={chartSize === 1 ? "xs" : "sm"}
              >
                {dataset.legend}
              </Button>
              <Spacer x={0.2} />
            </>
          );
        })}
        <Spacer x={0.2} />
        {!embedded && (
          <Button
            icon={expanded ? <ChevronUpCircle /> : <ChevronDownCircle />}
            onClick={() => _onExpand()}
            auto
            size={chartSize === 1 ? "xs" : "sm"}
            light
          >
            {expanded ? "See less" : "See more"}
          </Button>
        )}

        {activeDataset?.configuration?.sum && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <Text>{`Total ${activeDataset.configuration.sum}:`}</Text>
            <Spacer x={0.3} />
            <Text b>{totalValue.toLocaleString()}</Text>
          </div>
        )}
      </Row>
      <Spacer y={0.5} />
      {activeDataset?.legend
        && tabularData[activeDataset.legend]
        && tabularData[activeDataset.legend].columns
        && (
          <TableComponent
            height={expanded ? height + 200 : chartSize > 1 ? height + 3 : height + 12}
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
  height: 300,
  embedded: false,
};

TableContainer.propTypes = {
  tabularData: PropTypes.object.isRequired,
  chartSize: PropTypes.number.isRequired,
  datasets: PropTypes.array.isRequired,
  height: PropTypes.number,
  embedded: PropTypes.bool,
};

export default TableContainer;
