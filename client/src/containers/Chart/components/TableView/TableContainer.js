import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Row, Spacer
} from "@nextui-org/react";
import { ChevronDownCircle, ChevronUpCircle } from "react-iconly";

import TableComponent from "./TableComponent";

function TableContainer(props) {
  const {
    tabularData, height, embedded, chartSize
  } = props;

  const [activeDataset, setActiveDataset] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (tabularData && !activeDataset) {
      setActiveDataset(Object.keys(tabularData)[0]);
    } else if (!tabularData[activeDataset]) {
      setActiveDataset(Object.keys(tabularData)[0]);
    }
  }, [tabularData]);

  const _onExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <div>
      <Row align="center">
        {Object.keys(tabularData).map((dataset) => {
          return (
            <>
              <Button
                onClick={() => setActiveDataset(dataset)}
                bordered={activeDataset !== dataset}
                flat={activeDataset === dataset}
                auto
                key={dataset}
                size={chartSize === 1 ? "xs" : "sm"}
              >
                {dataset}
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
            bordered
            css={{ border: "$accents6" }}
          >
            {expanded ? "See less" : "See more"}
          </Button>
        )}
      </Row>
      <Spacer y={0.5} />
      {activeDataset && tabularData[activeDataset] && tabularData[activeDataset].columns && (
        <TableComponent
          height={expanded ? height + 200 : chartSize > 1 ? height + 3 : height + 12}
          columns={tabularData[activeDataset].columns}
          data={tabularData[activeDataset].data}
          embedded={embedded}
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
  height: PropTypes.number,
  embedded: PropTypes.bool,
};

export default TableContainer;
