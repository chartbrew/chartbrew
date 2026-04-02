import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Tabs
} from "@heroui/react";

import TableComponent from "./TableComponent";
import Row from "../../../../components/Row";
import Text from "../../../../components/Text";

const TAB_LABEL_MAX_CHARS = 24;

function formatTabLabel(legend) {
  const s = legend == null ? "" : String(legend);
  if (s.length <= TAB_LABEL_MAX_CHARS) return s;
  return `${s.slice(0, TAB_LABEL_MAX_CHARS)}…`;
}

function TableContainer(props) {
  const {
    tabularData, embedded = false, datasets,
    defaultRowsPerPage = 10,
  } = props;

  const [activeDatasetIndex, setActiveDatasetIndex] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

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

  const activeDataset = datasets[activeDatasetIndex];
  const dataKey = Object.keys(tabularData)[activeDatasetIndex];

  return (
    <div className="h-full overflow-y-auto">
      <Row align="center" wrap="wrap" className={"gap-1"}>
        {datasets.length > 1 && (
          <Tabs
            selectedKey={`${activeDatasetIndex}`}
            onSelectionChange={(key) => setActiveDatasetIndex(parseInt(key, 10))}
            size="sm"
            className="w-fit max-w-full shrink-0"
          >
            <Tabs.ListContainer>
              <Tabs.List
                aria-label="Table datasets"
                className="w-fit *:w-fit *:max-w-full *:shrink-0"
              >
                {datasets.map((dataset, index) => {
                  const fullLegend = dataset.legend != null ? String(dataset.legend) : "";
                  return (
                    <Tabs.Tab key={`${index}-${fullLegend}`} id={`${index}`}>
                      <span className="block whitespace-nowrap" title={fullLegend}>
                        {formatTabLabel(dataset.legend)}
                      </span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        )}

        {activeDataset?.configuration?.sum && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <Text>{`Total ${activeDataset.configuration.sum}:`}</Text>
            <div className="w-1" />
            <Text b>{totalValue?.toLocaleString()}</Text>
          </div>
        )}
      </Row>
      {datasets.length > 1 && (
        <div className="h-2" />
      )}
      {dataKey && tabularData[dataKey] && tabularData[dataKey].columns && (
        <TableComponent
          columns={tabularData[dataKey].columns}
          data={tabularData[dataKey].data}
          embedded={embedded}
          dataset={activeDataset}
          defaultRowsPerPage={defaultRowsPerPage}
        />
      )}
    </div>
  );
}

TableContainer.propTypes = {
  tabularData: PropTypes.object.isRequired,
  datasets: PropTypes.array.isRequired,
  embedded: PropTypes.bool,
  defaultRowsPerPage: PropTypes.number,
};

export default TableContainer;
